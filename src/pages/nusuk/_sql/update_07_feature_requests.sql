-- =====================================================================
-- Nusuk · update 07 · "feature my code" requests
-- Run once in Supabase → SQL Editor (after update 05). Safe to run again.
-- Run this BEFORE the new site version goes live.
--
-- Visitors share the Facebook post, then send name + their code + the link to
-- their share from the "ফিচারের জন্য আবেদন" button on /nusuk.
-- You check them in Nusuk Manager → Feature requests. "Approve & feature"
-- features the code (it goes to the top for everyone, see update 05) and, if
-- the code was still waiting in Review, approves it too.
-- A request is only accepted for a code that was already submitted on the page.
-- =====================================================================

create table if not exists public.nusuk_feature_requests (
  id          bigint generated always as identity primary key,
  name        text not null check (char_length(name) between 1 and 120),
  code        text not null check (char_length(code) between 3 and 40),
  share_link  text not null check (char_length(share_link) between 10 and 600),
  status      text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  created_at  timestamptz not null default now(),
  decided_at  timestamptz
);
create index if not exists nusuk_feature_requests_status_idx on public.nusuk_feature_requests (status, created_at desc);

alter table public.nusuk_feature_requests enable row level security;
-- No public policies: visitors can only send through nusuk_feature_request(), never read.
drop policy if exists "nusuk_feature_requests: admin all" on public.nusuk_feature_requests;
create policy "nusuk_feature_requests: admin all" on public.nusuk_feature_requests
  for all using (public.is_admin()) with check (public.is_admin());

-- ---------- Public: send a request ----------
-- reasons: closed · missing · bad_link · not_found (code not submitted yet) · featured (already featured)
--          · exists (a request for this code is already waiting) · busy
create or replace function public.nusuk_feature_request(p_name text, p_code text, p_link text)
returns jsonb
language plpgsql volatile security definer set search_path = public as $$
declare
  v_name text := left(trim(coalesce(p_name, '')), 120);
  v_code text := trim(coalesce(p_code, ''));
  v_link text := left(trim(coalesce(p_link, '')), 600);
  c record;
begin
  if not exists (select 1 from public.nusuk_settings where id = 1 and enabled) then
    return jsonb_build_object('ok', false, 'reason', 'closed');
  end if;
  if v_name = '' or v_code = '' or v_link = '' then
    return jsonb_build_object('ok', false, 'reason', 'missing');
  end if;
  if v_link !~* '^https?://([a-z0-9-]+\.)*(facebook\.com|fb\.com|fb\.me|fb\.watch)(/|$)' then
    return jsonb_build_object('ok', false, 'reason', 'bad_link');
  end if;

  select id, code, status, featured_at into c
    from public.nusuk_codes where lower(code) = lower(v_code) and status <> 'rejected' limit 1;
  if c.id is null then
    return jsonb_build_object('ok', false, 'reason', 'not_found');
  end if;
  if c.featured_at is not null and c.status = 'active' then
    return jsonb_build_object('ok', false, 'reason', 'featured');
  end if;
  if exists (select 1 from public.nusuk_feature_requests where code = c.code and status = 'pending') then
    return jsonb_build_object('ok', false, 'reason', 'exists');
  end if;
  -- Light flood guard
  if (select count(*) from public.nusuk_feature_requests where status = 'pending') >= 500 then
    return jsonb_build_object('ok', false, 'reason', 'busy');
  end if;

  insert into public.nusuk_feature_requests (name, code, share_link) values (v_name, c.code, v_link);
  return jsonb_build_object('ok', true);
end $$;
grant execute on function public.nusuk_feature_request(text, text, text) to anon, authenticated;

-- ---------- Admin: approve a request = feature its code ----------
create or replace function public.nusuk_admin_feature_approve(p_id bigint)
returns jsonb
language plpgsql volatile security definer set search_path = public as $$
declare
  r public.nusuk_feature_requests;
begin
  if not public.is_admin() then raise exception 'not allowed'; end if;
  select * into r from public.nusuk_feature_requests where id = p_id;
  if r.id is null then raise exception 'request not found'; end if;

  update public.nusuk_codes
     set featured_at = now(), status = 'active'
   where lower(code) = lower(r.code) and status <> 'rejected';
  if not found then raise exception 'code % is not in the list (deleted or rejected)', r.code; end if;

  update public.nusuk_feature_requests set status = 'approved', decided_at = now() where id = p_id;
  return jsonb_build_object('ok', true, 'code', r.code);
end $$;
revoke all on function public.nusuk_admin_feature_approve(bigint) from public, anon;
grant execute on function public.nusuk_admin_feature_approve(bigint) to authenticated;
