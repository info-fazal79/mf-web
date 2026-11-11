-- =====================================================================
-- Nusuk · update 28 · live charts: choose the time range (6 / 12 / 24 hours)
-- Run once in Supabase → SQL Editor (after update 27), BEFORE pushing.
-- Safe to run again.
--
-- The 1- and 2-hour views use nusuk_insights() as before. For longer ranges
-- the page calls nusuk_insights_range(hours), only when a visitor picks one:
--   active users: highest per 10 minutes (from nusuk_active_log)
--   copies:       per 10 minutes (from nusuk_copies_10m)
-- At most 144 numbers per series, so the call stays small.
-- =====================================================================

create or replace function public.nusuk_insights_range(p_hours int)
returns jsonb
language sql stable security definer set search_path = public as $$
  with h as (select least(greatest(coalesce(p_hours, 6), 1), 24) as n),
  slots as (
    select g as t
    from h, generate_series(date_bin('10 minutes', now(), timestamptz '2000-01-01') - make_interval(mins => h.n * 60 - 10),
                            date_bin('10 minutes', now(), timestamptz '2000-01-01'), interval '10 minutes') g
  ),
  a as (select s.t, coalesce(l.peak, 0) as n from slots s left join public.nusuk_active_log l on l.bucket = s.t),
  c as (select s.t, coalesce(x.copies, 0) as n from slots s left join public.nusuk_copies_10m x on x.bucket = s.t)
  select jsonb_build_object(
    'hours', (select n from h),
    'active', jsonb_build_object('start', (select min(t) from slots), 'step', 600, 'values', (select jsonb_agg(n order by t) from a)),
    'copies', jsonb_build_object('start', (select min(t) from slots), 'step', 600, 'values', (select jsonb_agg(n order by t) from c))
  );
$$;
grant execute on function public.nusuk_insights_range(int) to anon, authenticated;
