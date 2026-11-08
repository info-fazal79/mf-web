-- =====================================================================
-- Nusuk · update 09 · featured copies are spread over the whole time limit
-- Run once in Supabase → SQL Editor (after update 08). Safe to run again.
--
-- Before: a featured code with a quota of 10 got its 10 copies within minutes,
--   because every visitor saw it first.
-- Now:   the quota is paced evenly over the feature's time limit.
--   Example: 20 copies in 1 hour → one copy about every 3 minutes.
--   A featured code is only offered when it is "due":
--     copies so far < ceil(quota × time passed ÷ time limit)
--   Between its slots, visitors get the other codes as usual.
-- If traffic is low it may get fewer copies than the quota by the end; it
-- never gets more, and it drops back to normal when the time is up.
-- =====================================================================

create or replace function public.nusuk_pick(p_exclude bigint[])
returns table (id bigint, code text)
language plpgsql volatile security definer set search_path = public as $$
declare
  s public.nusuk_settings;
  ex bigint[] := coalesce(p_exclude, '{}');
  dur double precision;
begin
  select * into s from public.nusuk_settings st where st.id = 1;
  dur := greatest(1, coalesce(s.feature_hours, 12)) * 3600.0;

  -- Tiers 1–2, for `boost_share` % of picks
  if random() * 100 < coalesce(s.boost_share, 80) then
    return query
      select c.id, c.code from public.nusuk_codes c
      where c.status = 'active'
        and (c.featured_at is not null or c.approved_at is not null)
        and not (c.id = any (ex))
        and (
          -- featured and due for its next paced copy
          (public.nusuk_boost_tier(c, s) = 1
            and c.uses - c.featured_base
                < ceil(s.feature_quota * least(1.0, extract(epoch from now() - c.featured_at) / dur)))
          or public.nusuk_boost_tier(c, s) = 2
        )
      order by public.nusuk_boost_tier(c, s),
               case when public.nusuk_boost_tier(c, s) = 1 then c.uses - c.featured_base else c.uses - c.approved_base end,
               coalesce(c.featured_at, c.approved_at),
               c.id
      limit 1;
    if found then return; end if;
  end if;

  -- Tier 3 (and anything left over): least-used first
  return query
    select c.id, c.code from public.nusuk_codes c
    where c.status = 'active' and not (c.id = any (ex))
    order by c.uses, c.last_used_at nulls first, c.id
    limit 1;
end $$;
revoke all on function public.nusuk_pick(bigint[]) from public, anon, authenticated;
