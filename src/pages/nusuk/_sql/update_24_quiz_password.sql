-- =====================================================================
-- Nusuk · update 24 · quiz sign-in with ID + password
-- Run once in Supabase → SQL Editor (after update 23), BEFORE pushing the
-- version with passwords. Safe to run again.
--
--   • New players choose a password when they make their ID.
--   • Existing players who are signed in on their phone are asked to create
--     a password the next time they open the quiz.
--   • An existing player with no password yet, on another device, proves the
--     ID is theirs once with their full Nusuk code and sets a password.
--   • The old "ID + last 4 characters of the code" sign-in is removed: the
--     codes are shared publicly on the page, so it was not safe.
--   • Forgotten password: the admin sets a new one in Nusuk Manager → Quiz.
--   • Passwords are stored only as bcrypt hashes (pgcrypto), never as text.
-- =====================================================================

create extension if not exists pgcrypto with schema extensions;

alter table public.nusuk_quiz_players add column if not exists pass_hash text;

-- Old functions (code-only sign-in / sign-up) are replaced
drop function if exists public.nusuk_quiz_login(int, text);
drop function if exists public.nusuk_quiz_register(text, text);

create or replace function public.nusuk_quiz_pw_ok(p text)
returns boolean
language sql immutable as $$ select char_length(coalesce(p, '')) between 4 and 40 $$;

-- ---------- Public: make an ID (name + code + password) ----------
-- reasons: closed · name · invalid · not_found · rejected · password · exists (code already has an ID with a password)
create or replace function public.nusuk_quiz_register(p_name text, p_code text, p_password text)
returns jsonb
language plpgsql volatile security definer set search_path = public, extensions as $$
declare
  v_name text := left(trim(coalesce(p_name, '')), 60);
  v_code text := regexp_replace(coalesce(p_code, ''), '\s', '', 'g');
  c public.nusuk_codes;
  pl public.nusuk_quiz_players;
  tok uuid;
begin
  if not exists (select 1 from public.nusuk_quiz_settings where id = 1 and enabled) then
    return jsonb_build_object('ok', false, 'reason', 'closed');
  end if;
  if v_name = '' then return jsonb_build_object('ok', false, 'reason', 'name'); end if;
  if v_code !~ '^NG-[A-Za-z0-9]{8}$' then return jsonb_build_object('ok', false, 'reason', 'invalid'); end if;
  if not public.nusuk_quiz_pw_ok(p_password) then return jsonb_build_object('ok', false, 'reason', 'password'); end if;
  select * into c from public.nusuk_codes where lower(code) = lower(v_code) limit 1;
  if c.id is null then return jsonb_build_object('ok', false, 'reason', 'not_found'); end if;
  if c.status = 'rejected' then return jsonb_build_object('ok', false, 'reason', 'rejected'); end if;

  select * into pl from public.nusuk_quiz_players where code_id = c.id;
  if pl.id is not null and pl.pass_hash is not null then
    return jsonb_build_object('ok', false, 'reason', 'exists', 'id', pl.id);
  end if;
  if pl.id is null then
    insert into public.nusuk_quiz_players (name, code_id, pass_hash)
    values (v_name, c.id, extensions.crypt(p_password, extensions.gen_salt('bf')))
    on conflict (code_id) do nothing
    returning * into pl;
    if pl.id is null then
      return jsonb_build_object('ok', false, 'reason', 'exists', 'id', (select id from public.nusuk_quiz_players where code_id = c.id));
    end if;
    insert into public.nusuk_quiz_tokens (player_id) values (pl.id) returning token into tok;
    return jsonb_build_object('ok', true, 'id', pl.id, 'name', pl.name, 'token', tok, 'existing', false);
  end if;
  -- An older ID with no password yet: the person with the full code sets it now
  update public.nusuk_quiz_players set pass_hash = extensions.crypt(p_password, extensions.gen_salt('bf')) where id = pl.id;
  insert into public.nusuk_quiz_tokens (player_id) values (pl.id) returning token into tok;
  return jsonb_build_object('ok', true, 'id', pl.id, 'name', pl.name, 'token', tok, 'existing', true);
end $$;
grant execute on function public.nusuk_quiz_register(text, text, text) to anon, authenticated;

-- ---------- Public: sign in with ID + password ----------
-- reasons: no_id · wrong · no_password (old ID: use nusuk_quiz_claim)
create or replace function public.nusuk_quiz_signin(p_id int, p_password text)
returns jsonb
language plpgsql volatile security definer set search_path = public, extensions as $$
declare
  pl public.nusuk_quiz_players;
  tok uuid;
begin
  select * into pl from public.nusuk_quiz_players where id = p_id;
  if pl.id is null then return jsonb_build_object('ok', false, 'reason', 'no_id'); end if;
  if pl.pass_hash is null then return jsonb_build_object('ok', false, 'reason', 'no_password'); end if;
  if pl.pass_hash <> extensions.crypt(coalesce(p_password, ''), pl.pass_hash) then
    perform pg_sleep(0.4); -- slows down guessing
    return jsonb_build_object('ok', false, 'reason', 'wrong');
  end if;
  insert into public.nusuk_quiz_tokens (player_id) values (pl.id) returning token into tok;
  return jsonb_build_object('ok', true, 'id', pl.id, 'name', pl.name, 'token', tok);
end $$;
grant execute on function public.nusuk_quiz_signin(int, text) to anon, authenticated;

-- ---------- Public: older ID without a password, on a new device ----------
-- Proves the ID with the full Nusuk code, then sets the password. Works only while no password is set.
create or replace function public.nusuk_quiz_claim(p_id int, p_code text, p_password text)
returns jsonb
language plpgsql volatile security definer set search_path = public, extensions as $$
declare
  pl public.nusuk_quiz_players;
  v_code text;
  tok uuid;
begin
  if not public.nusuk_quiz_pw_ok(p_password) then return jsonb_build_object('ok', false, 'reason', 'password'); end if;
  select * into pl from public.nusuk_quiz_players where id = p_id;
  if pl.id is null then return jsonb_build_object('ok', false, 'reason', 'no_id'); end if;
  if pl.pass_hash is not null then return jsonb_build_object('ok', false, 'reason', 'has_password'); end if;
  select code into v_code from public.nusuk_codes where id = pl.code_id;
  if lower(v_code) <> lower(regexp_replace(coalesce(p_code, ''), '\s', '', 'g')) then
    perform pg_sleep(0.4);
    return jsonb_build_object('ok', false, 'reason', 'wrong');
  end if;
  update public.nusuk_quiz_players set pass_hash = extensions.crypt(p_password, extensions.gen_salt('bf')) where id = pl.id;
  insert into public.nusuk_quiz_tokens (player_id) values (pl.id) returning token into tok;
  return jsonb_build_object('ok', true, 'id', pl.id, 'name', pl.name, 'token', tok);
end $$;
grant execute on function public.nusuk_quiz_claim(int, text, text) to anon, authenticated;

-- ---------- Public: signed-in player creates or changes their password ----------
create or replace function public.nusuk_quiz_set_password(p_token uuid, p_password text)
returns jsonb
language plpgsql volatile security definer set search_path = public, extensions as $$
declare pid int := public.nusuk_quiz_player_of(p_token);
begin
  if pid is null then return jsonb_build_object('ok', false, 'reason', 'signed_out'); end if;
  if not public.nusuk_quiz_pw_ok(p_password) then return jsonb_build_object('ok', false, 'reason', 'password'); end if;
  update public.nusuk_quiz_players set pass_hash = extensions.crypt(p_password, extensions.gen_salt('bf')) where id = pid;
  return jsonb_build_object('ok', true);
end $$;
grant execute on function public.nusuk_quiz_set_password(uuid, text) to anon, authenticated;

-- ---------- Public: "do I still need a password?" (added to the state) ----------
create or replace function public.nusuk_quiz_has_password(p_token uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select p.pass_hash is not null from public.nusuk_quiz_players p where p.id = public.nusuk_quiz_player_of(p_token);
$$;
grant execute on function public.nusuk_quiz_has_password(uuid) to anon, authenticated;

-- ---------- Admin: set a new password for a player (forgotten password) ----------
create or replace function public.nusuk_admin_quiz_password(p_id int, p_password text)
returns jsonb
language plpgsql volatile security definer set search_path = public, extensions as $$
begin
  if not public.is_admin() then raise exception 'not allowed'; end if;
  if not public.nusuk_quiz_pw_ok(p_password) then return jsonb_build_object('ok', false, 'reason', 'password'); end if;
  update public.nusuk_quiz_players set pass_hash = extensions.crypt(p_password, extensions.gen_salt('bf')) where id = p_id;
  if not found then return jsonb_build_object('ok', false, 'reason', 'no_id'); end if;
  -- sign the player out everywhere, so only the new password works
  delete from public.nusuk_quiz_tokens where player_id = p_id;
  return jsonb_build_object('ok', true);
end $$;
revoke all on function public.nusuk_admin_quiz_password(int, text) from public, anon;
grant execute on function public.nusuk_admin_quiz_password(int, text) to authenticated;
