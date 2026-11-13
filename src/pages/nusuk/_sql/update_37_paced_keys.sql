-- =====================================================================
-- Nusuk · update 37 · Keys "within N hours" arrive evenly, not in bursts
-- Run once in Supabase → SQL Editor (after update 36), BEFORE pushing.
-- Safe to run again. (No code change on the site; this is server-side only.)
--
-- Before: a featured / "within N hours" code was allowed while
--   copies so far < quota × (time passed / N hours)
-- but only COPIES were counted. With many visitors at once the code was
-- shown to all of them in the same few seconds, several copied, and the code
-- jumped ahead of schedule — then nothing came for a long time.
-- Now each time the code is shown it holds a seat for 90 seconds (like
-- "at once" Keys already do; a copy uses the seat up, see update 20), so it is
-- only shown to as many people as the schedule allows. 50 Keys in 1 hour ≈ one
-- every 72 seconds.
-- =====================================================================

create or replace function public.nusuk_pick(p_exclude bigint[])
returns table (id bigint, code text)
language plpgsql volatile security definer set search_path = public as $$
declare
  s public.nusuk_settings;
  ex bigint[] := coalesce(p_exclude, '{}');
  v_id bigint;
  v_code text;
  v_tier int;
begin
  -- 1) "at once" Keys (unchanged)
  select c.id, c.code into v_id, v_code
  from public.nusuk_codes c
  where c.status = 'active' and c.instant_quota is not null
    and not (c.id = any (ex))
    and c.uses - c.instant_base
        + (select count(*) from public.nusuk_instant_holds h where h.code_id = c.id and h.at > now() - interval '90 seconds')
        < c.instant_quota
  order by c.instant_at, c.id
  limit 1
  for update of c skip locked;
  if v_id is not null then
    insert into public.nusuk_instant_holds (code_id) values (v_id);
    if random() < 0.02 then
      delete from public.nusuk_instant_holds where at < now() - interval '1 hour';
    end if;
    return query select v_id, v_code;
    return;
  end if;

  select * into s from public.nusuk_settings st where st.id = 1;

  -- 2) featured / "within N hours" (paced, now counting shown-but-not-copied seats) and newly approved codes
  if random() * 100 < coalesce(s.boost_share, 80) then
    select c.id, c.code, public.nusuk_boost_tier(c, s) into v_id, v_code, v_tier
    from public.nusuk_codes c
    where c.status = 'active'
      and (c.featured_at is not null or c.approved_at is not null)
      and not (c.id = any (ex))
      and (
        (public.nusuk_boost_tier(c, s) = 1
          and c.uses - c.featured_base
              + (select count(*) from public.nusuk_instant_holds h where h.code_id = c.id and h.at > now() - interval '90 seconds')
              < ceil(coalesce(c.boost_quota, s.feature_quota)
                     * least(1.0, extract(epoch from now() - c.featured_at)
                                  / (greatest(1, coalesce(c.boost_hours, s.feature_hours, 12)) * 3600.0))))
        or public.nusuk_boost_tier(c, s) = 2
      )
    order by public.nusuk_boost_tier(c, s),
             case when public.nusuk_boost_tier(c, s) = 1 then c.uses - c.featured_base else c.uses - c.approved_base end,
             coalesce(c.featured_at, c.approved_at),
             c.id
    limit 1
    for update of c skip locked;
    if v_id is not null then
      if v_tier = 1 then
        insert into public.nusuk_instant_holds (code_id) values (v_id);
      end if;
      return query select v_id, v_code;
      return;
    end if;
  end if;

  -- 3) everyone else, least used first (unchanged)
  return query
    select c.id, c.code from public.nusuk_codes c
    where c.status = 'active' and not (c.id = any (ex))
    order by c.uses, c.last_used_at nulls first, c.id
    limit 1;
end $$;
revoke all on function public.nusuk_pick(bigint[]) from public, anon, authenticated;
