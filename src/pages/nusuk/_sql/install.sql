-- =====================================================================
-- Nusuk code sharing · install
-- Paste this whole file into Supabase → SQL Editor → New query → Run.
-- Safe to run more than once. Remove everything with uninstall.sql.
-- AFTER this, also run update_01_no_duplicates.sql (case-insensitive duplicate block + bulk upload),
-- update_02_feedback.sql and update_03_per_device.sql (per-device remaining count).
-- Depends only on public.is_admin() from the main site (0001_core.sql).
-- =====================================================================

-- ---------- Settings (single row) ----------
create table if not exists public.nusuk_settings (
  id                   int primary key default 1 check (id = 1),
  enabled              boolean not null default true,
  submissions_enabled  boolean not null default true,
  default_max_uses     int not null default 1 check (default_max_uses between 1 and 100000),
  logo_url             text,
  notice               text,
  content              jsonb not null default '{}'::jsonb,
  updated_at           timestamptz not null default now()
);
insert into public.nusuk_settings (id) values (1) on conflict (id) do nothing;

alter table public.nusuk_settings enable row level security;
drop policy if exists "nusuk_settings: admin all" on public.nusuk_settings;
create policy "nusuk_settings: admin all" on public.nusuk_settings
  for all using (public.is_admin()) with check (public.is_admin());

-- ---------- Codes ----------
-- status: active (shown to visitors) · inactive (hidden) · pending (user submitted, awaiting review) · rejected
create table if not exists public.nusuk_codes (
  id            bigint generated always as identity primary key,
  code          text not null unique check (char_length(code) between 3 and 40),
  status        text not null default 'active' check (status in ('active', 'inactive', 'pending', 'rejected')),
  source        text not null default 'admin' check (source in ('admin', 'user')),
  uses          int not null default 0,
  max_uses      int not null default 1 check (max_uses >= 1),
  submitter     text check (char_length(submitter) <= 120),
  note          text check (char_length(note) <= 300),
  last_used_at  timestamptz,
  created_at    timestamptz not null default now()
);
-- true when visitors can still get this code
alter table public.nusuk_codes
  add column if not exists available boolean generated always as (status = 'active' and uses < max_uses) stored;
-- Fast "next available code" lookup: least-used first, then least-recently used.
drop index if exists public.nusuk_codes_pick_idx;
create index if not exists nusuk_codes_pick2_idx on public.nusuk_codes (uses, last_used_at nulls first, id)
  where available;
create index if not exists nusuk_codes_status_idx on public.nusuk_codes (status, created_at desc);

alter table public.nusuk_codes enable row level security;
-- No public policies: visitors only reach codes through the functions below.
drop policy if exists "nusuk_codes: admin all" on public.nusuk_codes;
create policy "nusuk_codes: admin all" on public.nusuk_codes
  for all using (public.is_admin()) with check (public.is_admin());

-- ---------- Daily copy counter (for the analytics chart) ----------
create table if not exists public.nusuk_daily (
  day     date primary key,
  copies  int not null default 0
);
alter table public.nusuk_daily enable row level security;
drop policy if exists "nusuk_daily: admin all" on public.nusuk_daily;
create policy "nusuk_daily: admin all" on public.nusuk_daily
  for all using (public.is_admin()) with check (public.is_admin());

-- ---------- Internal: pick the next code for a visitor ----------
create or replace function public.nusuk_pick(p_exclude bigint[])
returns table (id bigint, code text)
language sql stable security definer set search_path = public as $$
  select c.id, c.code
  from public.nusuk_codes c
  where c.available
    and not (c.id = any (coalesce(p_exclude, '{}')))
  order by c.uses, c.last_used_at nulls first, c.id
  limit 1;
$$;
revoke all on function public.nusuk_pick(bigint[]) from public, anon, authenticated;

-- ---------- Public: page load (settings + remaining + first code) in one call ----------
create or replace function public.nusuk_bootstrap(p_exclude bigint[] default '{}')
returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  s public.nusuk_settings;
  nxt record;
begin
  select * into s from public.nusuk_settings where id = 1;
  if s is null or not s.enabled then
    return jsonb_build_object('enabled', false, 'notice', s.notice, 'logo_url', s.logo_url);
  end if;
  select * into nxt from public.nusuk_pick(p_exclude);
  return jsonb_build_object(
    'enabled', true,
    'submissions_enabled', s.submissions_enabled,
    'notice', s.notice,
    'logo_url', s.logo_url,
    'content', s.content,
    'remaining', (select count(*) from public.nusuk_codes where available),
    'code', case when nxt.id is null then null else jsonb_build_object('id', nxt.id, 'code', nxt.code) end
  );
end $$;
grant execute on function public.nusuk_bootstrap(bigint[]) to anon, authenticated;

-- ---------- Public: mark a code as copied and return the next one ----------
create or replace function public.nusuk_claim(p_id bigint, p_exclude bigint[] default '{}')
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
   where id = p_id and status = 'active' and uses < max_uses;
  ok := found;

  if ok then
    insert into public.nusuk_daily (day, copies) values (current_date, 1)
    on conflict (day) do update set copies = public.nusuk_daily.copies + 1;
  end if;

  select * into nxt from public.nusuk_pick(array_append(coalesce(p_exclude, '{}'), p_id));
  return jsonb_build_object(
    'enabled', true,
    'counted', ok,
    'remaining', (select count(*) from public.nusuk_codes where available),
    'code', case when nxt.id is null then null else jsonb_build_object('id', nxt.id, 'code', nxt.code) end
  );
end $$;
grant execute on function public.nusuk_claim(bigint, bigint[]) to anon, authenticated;

-- ---------- Public: submit your own referral code (goes to review) ----------
create or replace function public.nusuk_submit(p_code text, p_name text default null, p_note text default null)
returns jsonb
language plpgsql volatile security definer set search_path = public as $$
declare
  v text := regexp_replace(coalesce(p_code, ''), '\s', '', 'g');
  st text;
begin
  if not exists (select 1 from public.nusuk_settings where id = 1 and enabled and submissions_enabled) then
    return jsonb_build_object('ok', false, 'reason', 'closed');
  end if;
  if v !~ '^[A-Za-z0-9_-]{3,40}$' then
    return jsonb_build_object('ok', false, 'reason', 'invalid');
  end if;
  select status into st from public.nusuk_codes where code = v;
  if st is not null then
    return jsonb_build_object('ok', false, 'reason', 'exists', 'status', st);
  end if;
  -- Light flood guard: at most 300 pending submissions waiting at once.
  if (select count(*) from public.nusuk_codes where status = 'pending') >= 300 then
    return jsonb_build_object('ok', false, 'reason', 'busy');
  end if;
  insert into public.nusuk_codes (code, status, source, max_uses, submitter, note)
  values (
    v, 'pending', 'user',
    (select default_max_uses from public.nusuk_settings where id = 1),
    nullif(left(trim(coalesce(p_name, '')), 120), ''),
    nullif(left(trim(coalesce(p_note, '')), 300), '')
  );
  return jsonb_build_object('ok', true);
end $$;
grant execute on function public.nusuk_submit(text, text, text) to anon, authenticated;

-- ---------- Admin: stats in one call ----------
create or replace function public.nusuk_admin_stats()
returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'not allowed'; end if;
  return jsonb_build_object(
    'total',     (select count(*) from public.nusuk_codes where status in ('active', 'inactive')),
    'active',    (select count(*) from public.nusuk_codes where status = 'active'),
    'remaining', (select count(*) from public.nusuk_codes where available),
    'used_up',   (select count(*) from public.nusuk_codes where status = 'active' and not available),
    'inactive',  (select count(*) from public.nusuk_codes where status = 'inactive'),
    'pending',   (select count(*) from public.nusuk_codes where status = 'pending'),
    'copies',    (select coalesce(sum(uses), 0) from public.nusuk_codes),
    'today',     (select coalesce(copies, 0) from public.nusuk_daily where day = current_date),
    'daily',     (select coalesce(jsonb_agg(jsonb_build_object('day', d.day::date, 'copies', coalesce(n.copies, 0)) order by d.day), '[]'::jsonb)
                    from generate_series(current_date - 13, current_date, interval '1 day') as d(day)
                    left join public.nusuk_daily n on n.day = d.day::date)
  );
end $$;
grant execute on function public.nusuk_admin_stats() to authenticated;

-- ---------- Sample codes (edit or delete them from /nusuk/admin) ----------
insert into public.nusuk_codes (code, status, source, max_uses, note)
select 'SAMPLE' || lpad(g::text, 3, '0'), 'active', 'admin', 3, 'Sample code, replace with real ones'
from generate_series(1, 20) g
on conflict do nothing;

insert into public.nusuk_codes (code, status, source, max_uses, submitter, note)
values ('USERDEMO01', 'pending', 'user', 3, 'Demo visitor', 'Sample submission to try the review queue')
on conflict do nothing;
