-- =====================================================================
-- Nusuk · update 10 · public list of featured codes (proof for visitors)
-- Run once in Supabase → SQL Editor (after update 09). Safe to run again.
-- The page hides the button's count until this has been run.
--
-- The "ফিচার করা কোড" button on /nusuk shows:
--   • running  – codes featured right now, each with a live countdown of the
--                time left (the full time limit you set, e.g. 8 hours)
--   • recent   – the last 15 features that have finished
--   • total    – how many codes have been featured so far
-- Copy counts and the quota are NOT shown. Codes are partly hidden
-- (NG-y3J•••7lU) so the list can't be used to skip the normal flow,
-- while the owner can still recognise their own code.
-- =====================================================================

create or replace function public.nusuk_mask(p_code text)
returns text
language sql immutable as $$
  select case when char_length(p_code) <= 7 then p_code
              else left(p_code, 6) || '•••' || right(p_code, 3) end;
$$;

drop function if exists public.nusuk_featured_list();
create or replace function public.nusuk_featured_list()
returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  s public.nusuk_settings;
  dur interval;
begin
  select * into s from public.nusuk_settings st where st.id = 1;
  if s is null or not s.enabled then
    return jsonb_build_object('running', '[]'::jsonb, 'recent', '[]'::jsonb, 'total', 0, 'now', now());
  end if;
  dur := make_interval(hours => greatest(1, coalesce(s.feature_hours, 12)));
  return jsonb_build_object(
    'now', now(),
    -- Running = inside its time window (shown for the full time, even if its copies are done early)
    'running', (
      select coalesce(jsonb_agg(jsonb_build_object(
               'code', public.nusuk_mask(c.code),
               'since', c.featured_at,
               'ends', c.featured_at + dur) order by c.featured_at desc), '[]'::jsonb)
      from public.nusuk_codes c
      where c.featured_at is not null and c.status = 'active'
        and c.featured_at + dur > now()),
    'recent', (
      select coalesce(jsonb_agg(x.j order by x.at desc), '[]'::jsonb) from (
        select c.featured_at + dur as at, jsonb_build_object(
                 'code', public.nusuk_mask(c.code),
                 'since', c.featured_at,
                 'ends', c.featured_at + dur) as j
        from public.nusuk_codes c
        where c.featured_at is not null and c.status <> 'rejected'
          and not (c.status = 'active' and c.featured_at + dur > now())
        order by c.featured_at desc
        limit 15) x),
    'total', (select count(*) from public.nusuk_codes c where c.featured_at is not null and c.status <> 'rejected')
  );
end $$;
grant execute on function public.nusuk_featured_list() to anon, authenticated;
