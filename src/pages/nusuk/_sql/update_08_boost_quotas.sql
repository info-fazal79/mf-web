-- =====================================================================
-- Nusuk · update 08 · priority engine with quotas, expiry and balance
-- Run once in Supabase → SQL Editor (after update 07). Safe to run again.
-- Run this BEFORE the new admin version goes live (Settings reads the new columns).
--
-- Every active code is in one of three tiers. A visitor gets the next code from
-- the highest tier that still has a code they have not copied:
--
--   Tier 1 · FEATURED   featured by you (★ in Codes, or an approved feature request)
--                       stays here until it gets `feature_quota` copies (default 10)
--                       OR `feature_hours` pass (default 12 h), whichever comes first.
--   Tier 2 · NEW        a user submission you approved in Review
--                       stays here until it gets `approved_quota` copies (default 2).
--   Tier 3 · NORMAL     everything else, least-used first.
--
-- Balance: `boost_share` (default 80 %) of picks go to tiers 1–2 first; the other
-- picks go straight to the normal pool, so the thousands of normal codes keep
-- getting copies even while many codes are boosted. 100 = boosted always first.
--
-- Inside a tier, the code with the fewest copies *since it was boosted* comes
-- first, so 10 featured codes share the traffic evenly (round robin).
-- Re-featuring a code (★ again) restarts its quota and its timer.
-- =====================================================================

-- ---------- Settings ----------
alter table public.nusuk_settings add column if not exists feature_quota  int not null default 10;
alter table public.nusuk_settings add column if not exists feature_hours  int not null default 12;
alter table public.nusuk_settings add column if not exists approved_quota int not null default 2;
alter table public.nusuk_settings add column if not exists boost_share    int not null default 80;
do $$ begin
  alter table public.nusuk_settings add constraint nusuk_settings_boost_chk check (
    feature_quota between 1 and 100000 and feature_hours between 1 and 8760
    and approved_quota between 0 and 100000 and boost_share between 0 and 100);
exception when duplicate_object then null; end $$;

-- ---------- Copies counted from the moment a code is boosted ----------
alter table public.nusuk_codes add column if not exists featured_base int not null default 0;
alter table public.nusuk_codes add column if not exists approved_base int not null default 0;

create or replace function public.nusuk_codes_mark_approved()
returns trigger
language plpgsql as $$
begin
  if new.source = 'user' and new.status = 'active' and new.approved_at is null then
    if tg_op = 'INSERT' then
      new.approved_at := now();
      new.approved_base := new.uses;
    elsif old.status is distinct from 'active' then
      new.approved_at := now();
      new.approved_base := new.uses;
    end if;
  end if;
  -- (Re)featuring restarts the featured quota
  if new.featured_at is not null and (tg_op = 'INSERT' or new.featured_at is distinct from old.featured_at) then
    new.featured_base := new.uses;
  end if;
  return new;
end $$;

drop trigger if exists nusuk_codes_mark_approved on public.nusuk_codes;
create trigger nusuk_codes_mark_approved
  before insert or update of status, featured_at on public.nusuk_codes
  for each row execute function public.nusuk_codes_mark_approved();

-- Small indexes for the boosted tiers (the normal tier uses nusuk_codes_pick3_idx)
create index if not exists nusuk_codes_feat2_idx on public.nusuk_codes (featured_at desc)
  where status = 'active' and featured_at is not null;
create index if not exists nusuk_codes_appr2_idx on public.nusuk_codes (approved_at desc)
  where status = 'active' and approved_at is not null;

-- ---------- Is a code boosted right now? (used by the admin and requests) ----------
create or replace function public.nusuk_boost_tier(c public.nusuk_codes, s public.nusuk_settings)
returns int
language sql stable as $$
  select case
    when c.featured_at is not null
         and c.featured_at > now() - make_interval(hours => s.feature_hours)
         and c.uses - c.featured_base < s.feature_quota then 1
    when c.approved_at is not null
         and c.uses - c.approved_base < s.approved_quota then 2
    else 3 end;
$$;

-- ---------- Internal: next code for a visitor ----------
create or replace function public.nusuk_pick(p_exclude bigint[])
returns table (id bigint, code text)
language plpgsql volatile security definer set search_path = public as $$
declare
  s public.nusuk_settings;
  ex bigint[] := coalesce(p_exclude, '{}');
begin
  select * into s from public.nusuk_settings st where st.id = 1;

  -- Tiers 1–2, for `boost_share` % of picks
  if random() * 100 < coalesce(s.boost_share, 80) then
    return query
      select c.id, c.code from public.nusuk_codes c
      where c.status = 'active'
        and (c.featured_at is not null or c.approved_at is not null)
        and not (c.id = any (ex))
        and public.nusuk_boost_tier(c, s) < 3
      order by public.nusuk_boost_tier(c, s),
               case when public.nusuk_boost_tier(c, s) = 1 then c.uses - c.featured_base else c.uses - c.approved_base end,
               coalesce(c.featured_at, c.approved_at) desc,
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

-- ---------- Feature requests: an expired / used-up feature can apply again ----------
create or replace function public.nusuk_feature_request(p_name text, p_code text, p_link text)
returns jsonb
language plpgsql volatile security definer set search_path = public as $$
declare
  v_name text := left(trim(coalesce(p_name, '')), 120);
  v_code text := trim(coalesce(p_code, ''));
  v_link text := left(trim(coalesce(p_link, '')), 600);
  s public.nusuk_settings;
  c public.nusuk_codes;
begin
  select * into s from public.nusuk_settings where id = 1;
  if s is null or not s.enabled then
    return jsonb_build_object('ok', false, 'reason', 'closed');
  end if;
  if v_name = '' or v_code = '' or v_link = '' then
    return jsonb_build_object('ok', false, 'reason', 'missing');
  end if;
  if v_link !~* '^https?://([a-z0-9-]+\.)*(facebook\.com|fb\.com|fb\.me|fb\.watch)(/|$)' then
    return jsonb_build_object('ok', false, 'reason', 'bad_link');
  end if;

  select * into c from public.nusuk_codes where lower(code) = lower(v_code) and status <> 'rejected' limit 1;
  if c.id is null then
    return jsonb_build_object('ok', false, 'reason', 'not_found');
  end if;
  if c.status = 'active' and public.nusuk_boost_tier(c, s) = 1 then
    return jsonb_build_object('ok', false, 'reason', 'featured');
  end if;
  if exists (select 1 from public.nusuk_feature_requests where code = c.code and status = 'pending') then
    return jsonb_build_object('ok', false, 'reason', 'exists');
  end if;
  if (select count(*) from public.nusuk_feature_requests where status = 'pending') >= 500 then
    return jsonb_build_object('ok', false, 'reason', 'busy');
  end if;

  insert into public.nusuk_feature_requests (name, code, share_link) values (v_name, c.code, v_link);
  return jsonb_build_object('ok', true);
end $$;
grant execute on function public.nusuk_feature_request(text, text, text) to anon, authenticated;
