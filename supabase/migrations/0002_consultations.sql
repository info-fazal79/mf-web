-- =====================================================================
-- MF Website · Migration 0002 · Consultation booking (Phase 3)
-- Run AFTER 0001_core.sql. Paste into Supabase → SQL Editor → Run.
-- Safe to run more than once.
-- All times are Bangladesh time (Asia/Dhaka, UTC+6).
-- =====================================================================

-- ---------- Weekly availability ----------
create table if not exists public.availability_rules (
  id          uuid primary key default gen_random_uuid(),
  weekday     int  not null check (weekday between 0 and 6), -- 0 = Sunday
  start_time  time not null,
  end_time    time not null check (end_time > start_time),
  created_at  timestamptz not null default now()
);
alter table public.availability_rules enable row level security;
drop policy if exists "rules: public read" on public.availability_rules;
create policy "rules: public read" on public.availability_rules for select using (true);
drop policy if exists "rules: admin write" on public.availability_rules;
create policy "rules: admin write" on public.availability_rules
  for all using (public.is_admin()) with check (public.is_admin());

-- Default schedule (only if empty): Sun–Wed 4–8 PM, Thu 4–6 PM, Sat 10 AM–1 PM
insert into public.availability_rules (weekday, start_time, end_time)
select * from (values
  (0, time '16:00', time '20:00'), (1, time '16:00', time '20:00'),
  (2, time '16:00', time '20:00'), (3, time '16:00', time '20:00'),
  (4, time '16:00', time '18:00'), (6, time '10:00', time '13:00')
) v(w, s, e)
where not exists (select 1 from public.availability_rules);

-- ---------- Date overrides (holidays / special hours) ----------
create table if not exists public.availability_overrides (
  id          uuid primary key default gen_random_uuid(),
  date        date not null,
  is_closed   boolean not null default true,
  start_time  time,
  end_time    time,
  note        text,
  created_at  timestamptz not null default now(),
  check (is_closed or (start_time is not null and end_time is not null and end_time > start_time))
);
create index if not exists overrides_date_idx on public.availability_overrides (date);
alter table public.availability_overrides enable row level security;
drop policy if exists "overrides: public read" on public.availability_overrides;
create policy "overrides: public read" on public.availability_overrides for select using (true);
drop policy if exists "overrides: admin write" on public.availability_overrides;
create policy "overrides: admin write" on public.availability_overrides
  for all using (public.is_admin()) with check (public.is_admin());

-- ---------- Consultations: slot format + no double booking ----------
-- preferred_time is stored as 24h "HH:MM" Bangladesh time.
alter table public.consultations add column if not exists duration_minutes int;
alter table public.consultations add column if not exists updated_at timestamptz not null default now();
drop trigger if exists consultations_touch on public.consultations;
create trigger consultations_touch before update on public.consultations
  for each row execute function public.touch_updated_at();

create unique index if not exists consultations_active_slot_uniq
  on public.consultations (preferred_date, preferred_time)
  where status in ('pending', 'confirmed') and preferred_date is not null and preferred_time is not null;

-- Visitors may only book slots in the future.
drop policy if exists "consultations: public insert" on public.consultations;
create policy "consultations: public insert" on public.consultations
  for insert with check (
    status = 'pending' and admin_notes is null and meeting_link is null
    and (preferred_date is null or preferred_date >= (now() at time zone 'Asia/Dhaka')::date)
  );

-- Taken slots for the public calendar (no personal data exposed).
create or replace function public.booked_slots(from_date date, to_date date)
returns table (slot_date date, slot_time text)
language sql stable security definer set search_path = public as $$
  select preferred_date, preferred_time
  from public.consultations
  where status in ('pending', 'confirmed')
    and preferred_date between from_date and to_date
    and preferred_time is not null;
$$;
grant execute on function public.booked_slots(date, date) to anon, authenticated;
