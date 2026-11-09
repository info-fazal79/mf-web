-- =====================================================================
-- Nusuk · update 19 · instant boost (e.g. "share your code in our group,
-- get 10 Keys instantly")
-- Run once in Supabase → SQL Editor (after update 16), BEFORE pushing the
-- admin version with the "Instant Keys" box. Safe to run again.
--
-- You paste codes (copied from the group) into Nusuk Manager → Popup notice
-- → Instant Keys. Each one goes straight to the very top for every visitor
-- until it has been copied N times (e.g. 10), then it is a normal code again.
--   • Codes not in the list yet are added as active codes.
--   • Pending/inactive codes are switched to active. Rejected codes are skipped.
--   • A visitor still never gets a code they already copied.
--   • Unlike Feature (spread over hours), this is not paced: it is instant.
-- =====================================================================

alter table public.nusuk_codes add column if not exists instant_quota int
  check (instant_quota is null or instant_quota between 1 and 1000);
alter table public.nusuk_codes add column if not exists instant_base int not null default 0;
alter table public.nusuk_codes add column if not exists instant_at timestamptz;
create index if not exists nusuk_codes_instant_idx on public.nusuk_codes (instant_at, id)
  where instant_quota is not null and status = 'active';

-- ---------- Pick: instant codes first, then the update 16 order ----------
create or replace function public.nusuk_pick(p_exclude bigint[])
returns table (id bigint, code text)
language plpgsql volatile security definer set search_path = public as $$
declare
  s public.nusuk_settings;
  ex bigint[] := coalesce(p_exclude, '{}');
  dur double precision;
begin
  -- Tier 0: instant boost, oldest first, until each has its copies
  return query
    select c.id, c.code from public.nusuk_codes c
    where c.status = 'active' and c.instant_quota is not null
      and c.uses - c.instant_base < c.instant_quota
      and not (c.id = any (ex))
    order by c.instant_at, c.id
    limit 1;
  if found then return; end if;

  select * into s from public.nusuk_settings st where st.id = 1;
  dur := greatest(1, coalesce(s.feature_hours, 12)) * 3600.0;

  if random() * 100 < coalesce(s.boost_share, 80) then
    return query
      select c.id, c.code from public.nusuk_codes c
      where c.status = 'active'
        and (c.featured_at is not null or c.approved_at is not null)
        and not (c.id = any (ex))
        and (
          (public.nusuk_boost_tier(c, s) = 1
            and c.uses - c.featured_base
                < ceil(coalesce(c.boost_quota, s.feature_quota) * least(1.0, extract(epoch from now() - c.featured_at) / dur)))
          or public.nusuk_boost_tier(c, s) = 2
        )
      order by public.nusuk_boost_tier(c, s),
               case when public.nusuk_boost_tier(c, s) = 1 then c.uses - c.featured_base else c.uses - c.approved_base end,
               coalesce(c.featured_at, c.approved_at),
               c.id
      limit 1;
    if found then return; end if;
  end if;

  return query
    select c.id, c.code from public.nusuk_codes c
    where c.status = 'active' and not (c.id = any (ex))
    order by c.uses, c.last_used_at nulls first, c.id
    limit 1;
end $$;
revoke all on function public.nusuk_pick(bigint[]) from public, anon, authenticated;

-- ---------- Admin: give codes an instant boost ----------
create or replace function public.nusuk_admin_instant(p_codes text[], p_quota int default 10)
returns jsonb
language plpgsql volatile security definer set search_path = public as $$
declare
  q int := least(1000, greatest(1, coalesce(p_quota, 10)));
  v_added text[];
  v_boosted text[];
  v_rejected text[];
  v_invalid text[];
begin
  if not public.is_admin() then raise exception 'not allowed'; end if;

  create temp table _in on commit drop as
    select distinct on (lower(c)) c
    from (select regexp_replace(x, '\s', '', 'g') as c from unnest(p_codes) as x) s
    where c ~ '^[A-Za-z0-9_-]{3,40}$'
    order by lower(c);
  select coalesce(array_agg(t), '{}') into v_invalid
    from (select regexp_replace(x, '\s', '', 'g') as t from unnest(p_codes) as x) s
    where t <> '' and t !~ '^[A-Za-z0-9_-]{3,40}$';

  -- New codes are added as active
  with ins as (
    insert into public.nusuk_codes (code, status, source)
    select i.c, 'active', 'admin' from _in i
    where not exists (select 1 from public.nusuk_codes x where lower(x.code) = lower(i.c))
    on conflict do nothing
    returning code
  ) select coalesce(array_agg(code), '{}') into v_added from ins;

  select coalesce(array_agg(x.code), '{}') into v_rejected
    from public.nusuk_codes x join _in i on lower(x.code) = lower(i.c) where x.status = 'rejected';

  with up as (
    update public.nusuk_codes x
       set instant_quota = q, instant_base = x.uses, instant_at = now(), status = 'active'
     where lower(x.code) in (select lower(c) from _in) and x.status <> 'rejected'
    returning x.code
  ) select coalesce(array_agg(code), '{}') into v_boosted from up;

  return jsonb_build_object('added', v_added, 'boosted', v_boosted, 'rejected', v_rejected, 'invalid', v_invalid, 'quota', q);
end $$;
revoke all on function public.nusuk_admin_instant(text[], int) from public, anon;
grant execute on function public.nusuk_admin_instant(text[], int) to authenticated;
