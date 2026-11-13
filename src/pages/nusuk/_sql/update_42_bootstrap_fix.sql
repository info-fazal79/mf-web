-- =====================================================================
-- Nusuk · update 42 · fix for update 41: bootstrap with p_pick = false
-- Run once in Supabase → SQL Editor (after update 41), BEFORE pushing.
-- Safe to run again.
--
-- When the page keeps its code (p_pick = false) no pick runs, and update 41
-- read an empty record ("record nxt is not assigned yet"). Same function,
-- with plain variables instead.
-- =====================================================================

create or replace function public.nusuk_bootstrap(
  p_exclude bigint[] default '{}', p_used bigint[] default '{}', p_ver text default null, p_pick boolean default true)
returns jsonb
language plpgsql volatile security definer set search_path = public as $$
declare
  s public.nusuk_settings;
  v_id bigint;
  v_code text;
  v text;
begin
  select * into s from public.nusuk_settings where id = 1;
  if s is null or not s.enabled then
    return jsonb_build_object('enabled', false, 'notice', s.notice, 'logo_url', s.logo_url);
  end if;
  v := (floor(extract(epoch from s.updated_at) * 1000))::bigint::text;
  if p_pick then
    select x.id, x.code into v_id, v_code from public.nusuk_pick(p_exclude) x;
  end if;
  return jsonb_build_object(
    'enabled', true,
    'submissions_enabled', s.submissions_enabled,
    'notice', s.notice,
    'logo_url', s.logo_url,
    'ver', v,
    -- the page already has these settings: don't send them again
    'content', case when p_ver is not distinct from v then null else s.content end,
    'remaining', public.nusuk_remaining_for(p_used),
    'code', case when v_id is null then null else jsonb_build_object('id', v_id, 'code', v_code) end
  );
end $$;
grant execute on function public.nusuk_bootstrap(bigint[], bigint[], text, boolean) to anon, authenticated;
