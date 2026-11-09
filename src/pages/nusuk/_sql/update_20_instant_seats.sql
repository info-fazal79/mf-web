-- =====================================================================
-- Nusuk · update 20 · instant codes no longer overshoot
-- Run once in Supabase → SQL Editor (after update 19). Safe to run again.
--
-- Problem: with ~80 people on the page at once, an instant code was SHOWN
-- to many of them before anyone's copy was counted, so a 10-copy code got
-- 28–32 copies.
--
-- Fix: "seats". An instant code with 10 Keys has 10 seats. Showing the code
-- to someone takes a seat for 90 seconds; when they copy it, the seat turns
-- into a counted copy. So at most (Keys − copies so far) people can see it
-- at the same time, and it can only go over by a copy or two.
-- If people don't copy it, their seat frees up after 90 seconds and the
-- code is shown to someone else.
-- =====================================================================

create table if not exists public.nusuk_instant_holds (
  id      bigint generated always as identity primary key,
  code_id bigint not null references public.nusuk_codes (id) on delete cascade,
  at      timestamptz not null default now()
);
create index if not exists nusuk_instant_holds_idx on public.nusuk_instant_holds (code_id, at);
alter table public.nusuk_instant_holds enable row level security; -- no public access

-- A counted copy frees one seat (the oldest) of that code
create or replace function public.nusuk_instant_release()
returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.instant_quota is not null and new.uses > old.uses then
    delete from public.nusuk_instant_holds h
     where h.id in (select x.id from public.nusuk_instant_holds x where x.code_id = new.id order by x.at limit (new.uses - old.uses));
  end if;
  return new;
end $$;
drop trigger if exists nusuk_instant_release on public.nusuk_codes;
create trigger nusuk_instant_release
  after update of uses on public.nusuk_codes
  for each row execute function public.nusuk_instant_release();

-- Showing a code now saves a seat, so the page-load function must be allowed to write
alter function public.nusuk_bootstrap(bigint[], bigint[]) volatile;

-- ---------- Pick: instant codes only while a seat is free ----------
create or replace function public.nusuk_pick(p_exclude bigint[])
returns table (id bigint, code text)
language plpgsql volatile security definer set search_path = public as $$
declare
  s public.nusuk_settings;
  ex bigint[] := coalesce(p_exclude, '{}');
  dur double precision;
  v_id bigint;
  v_code text;
begin
  -- Tier 0: instant boost. Copies so far + people holding a seat (last 90 s) must stay under the Keys.
  -- The row lock makes two visitors at the same moment take turns, so seats are never double-booked.
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

-- Make the API notice the change right away
notify pgrst, 'reload schema';
