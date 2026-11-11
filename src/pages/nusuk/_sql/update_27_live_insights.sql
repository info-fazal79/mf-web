-- =====================================================================
-- Nusuk · update 27 · live charts: active users per minute, copies per 10 minutes
-- Run once in Supabase → SQL Editor (after update 11), BEFORE pushing the
-- version with the live charts card. Safe to run again.
--
--   • nusuk_active_min   highest "active now" in every minute (kept 3 days)
--   • nusuk_copies_10m   copies in every 10 minutes (kept 30 days), filled
--                        automatically from the existing hourly counter, so
--                        the copy logic itself is not changed
--   • nusuk_insights()   one small public call for the charts card on /nusuk
--                        (numbers only, no codes or personal data)
-- The card is switched on/off in Nusuk Manager → Dashboard.
-- =====================================================================

create table if not exists public.nusuk_active_min (
  bucket  timestamptz primary key,  -- start of a 1-minute slot
  peak    int not null default 0
);
alter table public.nusuk_active_min enable row level security;
drop policy if exists "nusuk_active_min: admin read" on public.nusuk_active_min;
create policy "nusuk_active_min: admin read" on public.nusuk_active_min for select using (public.is_admin());

create table if not exists public.nusuk_copies_10m (
  bucket  timestamptz primary key,  -- start of a 10-minute slot
  copies  int not null default 0
);
alter table public.nusuk_copies_10m enable row level security;
drop policy if exists "nusuk_copies_10m: admin read" on public.nusuk_copies_10m;
create policy "nusuk_copies_10m: admin read" on public.nusuk_copies_10m for select using (public.is_admin());

-- ---------- Copies per 10 minutes: follow the hourly counter (written by nusuk_claim) ----------
create or replace function public.nusuk_hourly_to_10m()
returns trigger
language plpgsql security definer set search_path = public as $$
declare
  d int := new.copies - case when tg_op = 'UPDATE' then old.copies else 0 end;
begin
  if d > 0 then
    insert into public.nusuk_copies_10m (bucket, copies)
    values (date_bin('10 minutes', now(), timestamptz '2000-01-01'), d)
    on conflict (bucket) do update set copies = public.nusuk_copies_10m.copies + excluded.copies;
  end if;
  return new;
end $$;
drop trigger if exists nusuk_hourly_to_10m on public.nusuk_hourly;
create trigger nusuk_hourly_to_10m
  after insert or update of copies on public.nusuk_hourly
  for each row execute function public.nusuk_hourly_to_10m();

-- ---------- Ping: same as update 11, plus the per-minute record ----------
create or replace function public.nusuk_ping(p_device uuid)
returns jsonb
language plpgsql volatile security definer set search_path = public as $$
declare
  n_active int;
begin
  if p_device is not null then
    insert into public.nusuk_visitors (device) values (p_device)
    on conflict (device) do update set last_seen = now()
      where public.nusuk_visitors.last_seen < now() - interval '20 seconds';
    insert into public.nusuk_visitor_days (day, device) values (public.nusuk_today(), p_device)
    on conflict do nothing;
  end if;
  select count(*) into n_active from public.nusuk_visitors where last_seen > now() - interval '2 minutes';
  insert into public.nusuk_active_log (bucket, peak)
  values (date_bin('10 minutes', now(), timestamptz '2000-01-01'), n_active)
  on conflict (bucket) do update set peak = greatest(public.nusuk_active_log.peak, excluded.peak);
  insert into public.nusuk_active_min (bucket, peak)
  values (date_trunc('minute', now()), n_active)
  on conflict (bucket) do update set peak = greatest(public.nusuk_active_min.peak, excluded.peak);
  -- Housekeeping now and then (about once an hour across all visitors)
  if extract(minute from now()) = 0 and random() < 0.02 then
    delete from public.nusuk_active_min where bucket < now() - interval '3 days';
    delete from public.nusuk_copies_10m where bucket < now() - interval '30 days';
  end if;
  return jsonb_build_object(
    'total',  (select count(*) from public.nusuk_visitors),
    'active', n_active
  );
end $$;
revoke all on function public.nusuk_ping(uuid) from public;
grant execute on function public.nusuk_ping(uuid) to anon, authenticated;

-- ---------- Public: data for the live charts card ----------
-- Compact: a start time, the step in seconds and a plain list of numbers.
--   active: last 120 minutes, one value per minute (minutes with no ping = 0)
--   copies: last 24 hours, one value per 10 minutes
create or replace function public.nusuk_insights()
returns jsonb
language sql stable security definer set search_path = public as $$
  with a as (
    select g as t, coalesce(m.peak, 0) as n
    from generate_series(date_trunc('minute', now()) - interval '119 minutes', date_trunc('minute', now()), interval '1 minute') g
    left join public.nusuk_active_min m on m.bucket = g
  ), c as (
    select g as t, coalesce(x.copies, 0) as n
    from generate_series(date_bin('10 minutes', now(), timestamptz '2000-01-01') - interval '1430 minutes',
                         date_bin('10 minutes', now(), timestamptz '2000-01-01'), interval '10 minutes') g
    left join public.nusuk_copies_10m x on x.bucket = g
  )
  select jsonb_build_object(
    'now', now(),
    'active_now', (select count(*) from public.nusuk_visitors where last_seen > now() - interval '2 minutes'),
    'peak_today', (select coalesce(max(peak), 0) from public.nusuk_active_log where (bucket at time zone 'Asia/Dhaka')::date = public.nusuk_today()),
    'copies_today', (select coalesce(copies, 0) from public.nusuk_daily where day = public.nusuk_today()),
    'copies_hour', (select coalesce(sum(copies), 0) from public.nusuk_copies_10m where bucket > now() - interval '60 minutes'),
    'active', jsonb_build_object('start', (select min(t) from a), 'step', 60,  'values', (select jsonb_agg(n order by t) from a)),
    'copies', jsonb_build_object('start', (select min(t) from c), 'step', 600, 'values', (select jsonb_agg(n order by t) from c))
  );
$$;
grant execute on function public.nusuk_insights() to anon, authenticated;
