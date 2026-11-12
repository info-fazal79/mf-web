-- =====================================================================
-- Nusuk · update 32 · Reward Club test mode + reset
-- Run once in Supabase → SQL Editor (after update 31), BEFORE pushing.
-- Safe to run again.
--
-- Test mode (nusuk_settings.content.club.test = true): the club works only
-- for the Google emails listed in content.club.testers; everyone else still
-- sees it as closed and the /nusuk banner stays hidden.
-- Reset: Nusuk Manager → Reward Club → "Delete all test data" removes every
-- member and ticket and starts SL numbers again from 1001.
-- =====================================================================

/** Is the club open for the person calling? (on for everyone, or test mode + listed email) */
create or replace function public.nusuk_club_active()
returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((s.content->'club'->>'on')::boolean, false)
      or (coalesce((s.content->'club'->>'test')::boolean, false)
          and auth.uid() is not null
          and exists (
            select 1
            from jsonb_array_elements_text(case when jsonb_typeof(s.content->'club'->'testers') = 'array' then s.content->'club'->'testers' else '[]'::jsonb end) e
            where lower(btrim(e)) = lower((select u.email from auth.users u where u.id = auth.uid()))))
  from public.nusuk_settings s where s.id = 1
$$;

-- 'on' now means "open for this caller", so nusuk_club_me / _save / _copy follow test mode by themselves.
-- 'public' = open for everyone, 'test' = test mode is running. The testers list is never sent out.
create or replace function public.nusuk_club_cfg()
returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'on', public.nusuk_club_active(),
    'public', coalesce((s.content->'club'->>'on')::boolean, false),
    'test', coalesce((s.content->'club'->>'test')::boolean, false) and not coalesce((s.content->'club'->>'on')::boolean, false),
    'copy_from', coalesce(nullif(s.content->'club'->>'copy_from', ''), '09:00'),
    'copy_to', coalesce(nullif(s.content->'club'->>'copy_to', ''), '17:00'),
    'title', coalesce(s.content->'club'->>'title', ''),
    'rules', coalesce(s.content->'club'->>'rules', ''),
    'caption', coalesce(s.content->'club'->>'caption', ''),
    'card_line', coalesce(s.content->'club'->>'card_line', '')
  )
  from public.nusuk_settings s where s.id = 1
$$;

/** Delete every member and ticket (before going public). Google logins stay; they can sign up again. */
create or replace function public.nusuk_admin_club_reset(p_confirm text)
returns jsonb
language plpgsql volatile security definer set search_path = public as $$
declare
  m int;
  t int;
begin
  if not public.is_admin() then raise exception 'not allowed'; end if;
  if p_confirm is distinct from 'DELETE' then return jsonb_build_object('ok', false); end if;
  select count(*) into t from public.nusuk_club_tickets;
  select count(*) into m from public.nusuk_club_members;
  delete from public.nusuk_club_tickets;
  delete from public.nusuk_club_members;
  alter table public.nusuk_club_members alter column sl restart with 1001;
  return jsonb_build_object('ok', true, 'members', m, 'tickets', t);
end $$;

grant execute on function public.nusuk_club_active() to anon, authenticated;
grant execute on function public.nusuk_admin_club_reset(text) to authenticated;
