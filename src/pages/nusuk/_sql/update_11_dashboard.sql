-- =====================================================================
-- Nusuk · update 11 · detailed dashboard (visitors, active users, codes)
-- Run once in Supabase → SQL Editor (after update 10). Safe to run again.
-- Run this BEFORE the new admin version goes live (the Dashboard reads it).
--
-- New history, recorded from now on (all in Bangladesh time, Asia/Dhaka):
--   nusuk_visitor_days  which browsers visited on which day → unique, new and
--                       returning visitors per day
--   nusuk_active_log    highest "active now" in every 10 minutes → active users graph
--   nusuk_hourly        copies per hour → today's copies graph
-- Copies per day (nusuk_daily) now also use Bangladesh dates instead of UTC.
-- nusuk_admin_dashboard() returns everything the Dashboard shows in one call.
-- =====================================================================

-- Today's date in Bangladesh
create or replace function public.nusuk_today()
returns date
language sql stable as $$ select (now() at time zone 'Asia/Dhaka')::date $$;

-- ---------- History tables (admin read only; written by the functions below) ----------
create table if not exists public.nusuk_visitor_days (
  day       date not null,
  device    uuid not null,
  via_ping  boolean not null default true,  -- false = filled in from older data when this update ran
  primary key (day, device)
);
alter table public.nusuk_visitor_days enable row level security;
drop policy if exists "nusuk_visitor_days: admin read" on public.nusuk_visitor_days;
create policy "nusuk_visitor_days: admin read" on public.nusuk_visitor_days for select using (public.is_admin());

create table if not exists public.nusuk_active_log (
  bucket  timestamptz primary key,  -- start of a 10-minute slot
  peak    int not null default 0
);
alter table public.nusuk_active_log enable row level security;
drop policy if exists "nusuk_active_log: admin read" on public.nusuk_active_log;
create policy "nusuk_active_log: admin read" on public.nusuk_active_log for select using (public.is_admin());

create table if not exists public.nusuk_hourly (
  hour    timestamptz primary key,
  copies  int not null default 0
);
alter table public.nusuk_hourly enable row level security;
drop policy if exists "nusuk_hourly: admin read" on public.nusuk_hourly;
create policy "nusuk_hourly: admin read" on public.nusuk_hourly for select using (public.is_admin());

-- Fill in what older data can tell us: the day each browser first came and the day it was last seen.
-- (Today is exact; earlier days are partial, so the Dashboard shows returning visitors only from today on.)
insert into public.nusuk_visitor_days (day, device, via_ping)
select (v.first_seen at time zone 'Asia/Dhaka')::date, v.device, false from public.nusuk_visitors v
union
select (v.last_seen at time zone 'Asia/Dhaka')::date, v.device, false from public.nusuk_visitors v
on conflict do nothing;

create index if not exists nusuk_visitors_first_seen_idx on public.nusuk_visitors (first_seen);
create index if not exists nusuk_codes_uses_idx on public.nusuk_codes (uses desc) where status = 'active';

-- ---------- Public: ping (same as update 06, plus history) ----------
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
  return jsonb_build_object(
    'total',  (select count(*) from public.nusuk_visitors),
    'active', n_active
  );
end $$;
revoke all on function public.nusuk_ping(uuid) from public;
grant execute on function public.nusuk_ping(uuid) to anon, authenticated;

-- ---------- Public: record a copy (same as update 03, Bangladesh date + hourly count) ----------
create or replace function public.nusuk_claim(p_id bigint, p_exclude bigint[] default '{}', p_used bigint[] default '{}')
returns jsonb
language plpgsql volatile security definer set search_path = public as $$
declare
  ok boolean := false;
  nxt record;
begin
  if not exists (select 1 from public.nusuk_settings where id = 1 and enabled) then
    return jsonb_build_object('enabled', false);
  end if;

  update public.nusuk_codes
     set uses = uses + 1, last_used_at = now()
   where id = p_id and status = 'active';
  ok := found;

  if ok then
    insert into public.nusuk_daily (day, copies) values (public.nusuk_today(), 1)
    on conflict (day) do update set copies = public.nusuk_daily.copies + 1;
    insert into public.nusuk_hourly (hour, copies) values (date_trunc('hour', now()), 1)
    on conflict (hour) do update set copies = public.nusuk_hourly.copies + 1;
  end if;

  select * into nxt from public.nusuk_pick(array_append(coalesce(p_exclude, '{}'), p_id));
  return jsonb_build_object(
    'enabled', true,
    'counted', ok,
    'remaining', public.nusuk_remaining_for(array_append(coalesce(p_used, '{}'), p_id)),
    'code', case when nxt.id is null then null else jsonb_build_object('id', nxt.id, 'code', nxt.code) end
  );
end $$;
grant execute on function public.nusuk_claim(bigint, bigint[], bigint[]) to anon, authenticated;

-- ---------- Admin: everything the Dashboard shows ----------
create or replace function public.nusuk_admin_dashboard()
returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  s public.nusuk_settings;
  d0 date := public.nusuk_today();
  dur interval;
  tracked date;
begin
  if not public.is_admin() then raise exception 'not allowed'; end if;
  select * into s from public.nusuk_settings where id = 1;
  dur := make_interval(hours => greatest(1, coalesce(s.feature_hours, 12)));
  select min(day) into tracked from public.nusuk_visitor_days where via_ping;
  tracked := least(coalesce(tracked, d0), d0);

  return jsonb_build_object(
    'today', d0,
    'tracked_from', tracked,
    'visitors', jsonb_build_object(
      'total',          (select count(*) from public.nusuk_visitors),
      'active_now',     (select count(*) from public.nusuk_visitors where last_seen > now() - interval '2 minutes'),
      'unique_today',   (select count(*) from public.nusuk_visitor_days where day = d0),
      'unique_yday',    (select count(*) from public.nusuk_visitor_days where day = d0 - 1),
      'new_today',      (select count(*) from public.nusuk_visitors where (first_seen at time zone 'Asia/Dhaka')::date = d0),
      'new_yday',       (select count(*) from public.nusuk_visitors where (first_seen at time zone 'Asia/Dhaka')::date = d0 - 1),
      'peak_today',     (select coalesce(max(peak), 0) from public.nusuk_active_log where (bucket at time zone 'Asia/Dhaka')::date = d0),
      'peak_today_at',  (select bucket from public.nusuk_active_log where (bucket at time zone 'Asia/Dhaka')::date = d0 order by peak desc, bucket limit 1),
      'peak_ever',      (select coalesce(max(peak), 0) from public.nusuk_active_log)
    ),
    'copies', jsonb_build_object(
      'total',  (select coalesce(sum(uses), 0) from public.nusuk_codes),
      'today',  (select coalesce(copies, 0) from public.nusuk_daily where day = d0),
      'yday',   (select coalesce(copies, 0) from public.nusuk_daily where day = d0 - 1),
      'last_hour', (select coalesce(sum(copies), 0) from public.nusuk_hourly where hour >= date_trunc('hour', now()) - interval '1 hour')
    ),
    -- 30 days: new / unique visitors, copies, submissions, approvals
    'daily', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'day', g.day,
        'new', (select count(*) from public.nusuk_visitors v where (v.first_seen at time zone 'Asia/Dhaka')::date = g.day),
        'unique', case when g.day >= tracked then (select count(*) from public.nusuk_visitor_days vd where vd.day = g.day) end,
        'copies', coalesce((select copies from public.nusuk_daily n where n.day = g.day), 0),
        'submitted', (select count(*) from public.nusuk_codes c where c.source = 'user' and (c.created_at at time zone 'Asia/Dhaka')::date = g.day),
        'approved', (select count(*) from public.nusuk_codes c where c.source = 'user' and (c.approved_at at time zone 'Asia/Dhaka')::date = g.day)
      ) order by g.day), '[]'::jsonb)
      from (select gs::date as day from generate_series(d0 - 29, d0, interval '1 day') gs) g
    ),
    -- Highest "active now" per 10 minutes, last 7 days
    'active_log', (
      select coalesce(jsonb_agg(jsonb_build_object('t', a.bucket, 'n', a.peak) order by a.bucket), '[]'::jsonb)
      from public.nusuk_active_log a where a.bucket > now() - interval '7 days'
    ),
    -- Copies per hour, last 48 hours
    'hourly', (
      select coalesce(jsonb_agg(jsonb_build_object('t', h.hour, 'n', h.copies) order by h.hour), '[]'::jsonb)
      from public.nusuk_hourly h where h.hour > now() - interval '48 hours'
    ),
    'codes', jsonb_build_object(
      'active',      (select count(*) from public.nusuk_codes where status = 'active'),
      'inactive',    (select count(*) from public.nusuk_codes where status = 'inactive'),
      'never_used',  (select count(*) from public.nusuk_codes where status = 'active' and uses = 0),
      'avg_uses',    (select coalesce(round(avg(uses)::numeric, 1), 0) from public.nusuk_codes where status = 'active'),
      'from_admin',  (select count(*) from public.nusuk_codes where source = 'admin' and status in ('active', 'inactive')),
      'from_users',  (select count(*) from public.nusuk_codes where source = 'user' and status in ('active', 'inactive')),
      'buckets', (
        select jsonb_build_array(
          jsonb_build_object('label', '0',      'n', count(*) filter (where uses = 0)),
          jsonb_build_object('label', '1–5',    'n', count(*) filter (where uses between 1 and 5)),
          jsonb_build_object('label', '6–20',   'n', count(*) filter (where uses between 6 and 20)),
          jsonb_build_object('label', '21–50',  'n', count(*) filter (where uses between 21 and 50)),
          jsonb_build_object('label', '51–100', 'n', count(*) filter (where uses between 51 and 100)),
          jsonb_build_object('label', '100+',   'n', count(*) filter (where uses > 100)))
        from public.nusuk_codes where status = 'active'
      ),
      'top', (
        select coalesce(jsonb_agg(jsonb_build_object('code', x.code, 'uses', x.uses, 'source', x.source, 'featured', x.featured_at is not null) order by x.uses desc, x.id), '[]'::jsonb)
        from (select * from public.nusuk_codes where status = 'active' order by uses desc, id limit 10) x
      ),
      'bottom', (
        select coalesce(jsonb_agg(jsonb_build_object('code', x.code, 'uses', x.uses, 'source', x.source, 'featured', x.featured_at is not null) order by x.uses, x.id), '[]'::jsonb)
        from (select * from public.nusuk_codes where status = 'active' order by uses, id limit 10) x
      )
    ),
    'review', jsonb_build_object(
      'pending',        (select count(*) from public.nusuk_codes where status = 'pending'),
      'submitted',      (select count(*) from public.nusuk_codes where source = 'user'),
      'approved',       (select count(*) from public.nusuk_codes where source = 'user' and approved_at is not null),
      'rejected',       (select count(*) from public.nusuk_codes where source = 'user' and status = 'rejected'),
      'submitted_today',(select count(*) from public.nusuk_codes where source = 'user' and (created_at at time zone 'Asia/Dhaka')::date = d0),
      'approved_today', (select count(*) from public.nusuk_codes where source = 'user' and (approved_at at time zone 'Asia/Dhaka')::date = d0)
    ),
    'featured', jsonb_build_object(
      'running',   (select count(*) from public.nusuk_codes where status = 'active' and featured_at is not null and featured_at + dur > now()),
      'ever',      (select count(*) from public.nusuk_codes where featured_at is not null and status <> 'rejected'),
      'today',     (select count(*) from public.nusuk_codes where featured_at is not null and (featured_at at time zone 'Asia/Dhaka')::date = d0),
      'req_pending',  (select count(*) from public.nusuk_feature_requests where status = 'pending'),
      'req_approved', (select count(*) from public.nusuk_feature_requests where status = 'approved'),
      'req_rejected', (select count(*) from public.nusuk_feature_requests where status = 'rejected'),
      'req_today',    (select count(*) from public.nusuk_feature_requests where (created_at at time zone 'Asia/Dhaka')::date = d0)
    ),
    'feedback', jsonb_build_object(
      'new',   (select count(*) from public.nusuk_feedback where status = 'new'),
      'total', (select count(*) from public.nusuk_feedback),
      'today', (select count(*) from public.nusuk_feedback where (created_at at time zone 'Asia/Dhaka')::date = d0)
    )
  );
end $$;
revoke all on function public.nusuk_admin_dashboard() from public, anon;
grant execute on function public.nusuk_admin_dashboard() to authenticated;
