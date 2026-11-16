-- =====================================================================
-- Nusuk · update 48 · district map: accounts or competition tickets
-- Run once in Supabase → SQL Editor (after update 47), BEFORE pushing.
-- Safe to run again.
--
-- Nusuk Manager → Map chooses what the /nusuk district map shows:
--   • members  : how many accounts were made from each district (as before)
--   • quiz     : tickets per district in the quiz campaign running now
--                (falls back to accounts when no campaign is running)
-- Saved in nusuk_settings.content.map.mode. Still only counts per district are sent.
-- =====================================================================

create or replace function public.nusuk_district_map_raw()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_mode text;
  c public.nusuk_club_contests;
begin
  select coalesce(s.content->'map'->>'mode', 'members') into v_mode from public.nusuk_settings s where s.id = 1;

  if v_mode = 'quiz' then
    c := public.nusuk_cq_live();
    if c.id is not null then
      return jsonb_build_object(
        'public', coalesce((select (s.content->'club'->>'on')::boolean from public.nusuk_settings s where s.id = 1), false),
        'mode', 'quiz',
        'campaign', c.title,
        'total', (select coalesce(sum(e.tickets), 0) from public.nusuk_cq_entries e where e.contest_id = c.id and e.tickets > 0),
        'people', (select count(*) from public.nusuk_cq_entries e where e.contest_id = c.id and e.tickets > 0),
        'd', coalesce((
          select jsonb_object_agg(g.k, g.n) from (
            select lower(btrim(m.district)) as k, sum(e.tickets) as n
            from public.nusuk_cq_entries e
            join public.nusuk_club_members m on m.user_id = e.user_id
            where e.contest_id = c.id and e.tickets > 0 and nullif(btrim(m.district), '') is not null
            group by 1
            order by 2 desc
            limit 300
          ) g), '{}'::jsonb),
        'now', now());
    end if;
  end if;

  return jsonb_build_object(
    'public', coalesce((select (s.content->'club'->>'on')::boolean from public.nusuk_settings s where s.id = 1), false),
    'mode', 'members',
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
    'now', now());
end $$;
revoke all on function public.nusuk_district_map_raw() from public, anon, authenticated;

-- show the new setting right away (the map is cached for 60 s)
delete from public.nusuk_cache where k = 'district_map';
