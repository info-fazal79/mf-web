-- =====================================================================
-- Nusuk · update 43 · district map on /nusuk
-- Run once in Supabase → SQL Editor (after update 42), BEFORE pushing.
-- Safe to run again.
--
-- /nusuk shows a Bangladesh map with how many accounts were made from each
-- district. Only counts per district are sent out (no names, no other details).
-- Cached for 60 s, so many visitors cost one small count per minute.
-- =====================================================================

create or replace function public.nusuk_district_map_raw()
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'public', coalesce((select (s.content->'club'->>'on')::boolean from public.nusuk_settings s where s.id = 1), false),
    'total', (select count(*) from public.nusuk_club_members),
    'd', coalesce((
      select jsonb_object_agg(g.k, g.n) from (
        select lower(btrim(m.district)) as k, count(*) as n
        from public.nusuk_club_members m
        where nullif(btrim(m.district), '') is not null
        group by 1
        order by 2 desc
        limit 300
      ) g), '{}'::jsonb),
    'now', now())
$$;
revoke all on function public.nusuk_district_map_raw() from public, anon, authenticated;

create or replace function public.nusuk_district_map()
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare v jsonb;
begin
  v := public.nusuk_cache_get('district_map', interval '60 seconds');
  if v is null then v := public.nusuk_cache_put('district_map', public.nusuk_district_map_raw()); end if;
  return public.nusuk_cache_now(v);
end $$;
revoke all on function public.nusuk_district_map() from public;
grant execute on function public.nusuk_district_map() to anon, authenticated;
