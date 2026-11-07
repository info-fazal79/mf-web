-- =====================================================================
-- MF Website · Migration 0001 · Core (Phase 2)
-- Paste this whole file into Supabase → SQL Editor → New query → Run.
-- Safe to run more than once.
-- =====================================================================

-- ---------- Profiles & roles ----------
create table if not exists public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  email       text,
  full_name   text,
  avatar_url  text,
  role        text not null default 'customer' check (role in ('admin', 'editor', 'customer')),
  created_at  timestamptz not null default now()
);

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data ->> 'full_name', ''))
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Backfill users created before this migration
insert into public.profiles (id, email)
select id, email from auth.users
on conflict (id) do nothing;

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role in ('admin', 'editor')
  );
$$;

alter table public.profiles enable row level security;
drop policy if exists "profiles: own read" on public.profiles;
create policy "profiles: own read" on public.profiles
  for select using (id = auth.uid() or public.is_admin());
-- Customers update their own name/avatar through a function in a later phase,
-- so they can never change their own role.
drop policy if exists "profiles: own update" on public.profiles;
drop policy if exists "profiles: admin all" on public.profiles;
create policy "profiles: admin all" on public.profiles
  for all using (public.is_admin()) with check (public.is_admin());

-- ---------- updated_at helper ----------
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

-- ---------- Site settings (key → JSON) ----------
create table if not exists public.site_settings (
  key         text primary key,
  value       jsonb not null default '{}'::jsonb,
  updated_at  timestamptz not null default now()
);
drop trigger if exists site_settings_touch on public.site_settings;
create trigger site_settings_touch before update on public.site_settings
  for each row execute function public.touch_updated_at();

alter table public.site_settings enable row level security;
drop policy if exists "settings: public read" on public.site_settings;
create policy "settings: public read" on public.site_settings for select using (true);
drop policy if exists "settings: admin write" on public.site_settings;
create policy "settings: admin write" on public.site_settings
  for all using (public.is_admin()) with check (public.is_admin());

-- ---------- Testimonials ----------
create table if not exists public.testimonials (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  role        text,
  quote       text not null,
  rating      int not null default 5 check (rating between 1 and 5),
  avatar_url  text,
  sort_order  int not null default 0,
  published   boolean not null default true,
  created_at  timestamptz not null default now()
);
alter table public.testimonials enable row level security;
drop policy if exists "testimonials: public read" on public.testimonials;
create policy "testimonials: public read" on public.testimonials
  for select using (published or public.is_admin());
drop policy if exists "testimonials: admin write" on public.testimonials;
create policy "testimonials: admin write" on public.testimonials
  for all using (public.is_admin()) with check (public.is_admin());

-- ---------- Media library ----------
create table if not exists public.media (
  id          uuid primary key default gen_random_uuid(),
  path        text not null unique,
  url         text not null,
  name        text not null,
  mime        text,
  size        bigint,
  width       int,
  height      int,
  folder      text not null default 'general',
  alt         text,
  uploaded_by uuid references auth.users (id) on delete set null default auth.uid(),
  created_at  timestamptz not null default now()
);
create index if not exists media_created_idx on public.media (created_at desc);
alter table public.media enable row level security;
drop policy if exists "media: public read" on public.media;
create policy "media: public read" on public.media for select using (true);
drop policy if exists "media: admin write" on public.media;
create policy "media: admin write" on public.media
  for all using (public.is_admin()) with check (public.is_admin());

-- ---------- Contact messages ----------
create table if not exists public.messages (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (char_length(name) <= 200),
  email       text not null check (char_length(email) <= 320),
  subject     text check (char_length(subject) <= 300),
  message     text not null check (char_length(message) <= 10000),
  is_read     boolean not null default false,
  created_at  timestamptz not null default now()
);
alter table public.messages enable row level security;
drop policy if exists "messages: public insert" on public.messages;
create policy "messages: public insert" on public.messages for insert with check (is_read = false);
drop policy if exists "messages: admin all" on public.messages;
create policy "messages: admin all" on public.messages
  for all using (public.is_admin()) with check (public.is_admin());

-- ---------- Newsletter subscribers ----------
create table if not exists public.subscribers (
  id          uuid primary key default gen_random_uuid(),
  email       text not null unique check (char_length(email) <= 320),
  source      text default 'footer',
  status      text not null default 'active' check (status in ('active', 'unsubscribed')),
  created_at  timestamptz not null default now()
);
alter table public.subscribers enable row level security;
drop policy if exists "subscribers: public insert" on public.subscribers;
create policy "subscribers: public insert" on public.subscribers for insert with check (status = 'active');
drop policy if exists "subscribers: admin all" on public.subscribers;
create policy "subscribers: admin all" on public.subscribers
  for all using (public.is_admin()) with check (public.is_admin());

-- ---------- Consultations (form is live now; full module in Phase 3) ----------
create table if not exists public.consultations (
  id              uuid primary key default gen_random_uuid(),
  name            text not null check (char_length(name) <= 200),
  email           text not null check (char_length(email) <= 320),
  phone           text not null check (char_length(phone) <= 40),
  address         text check (char_length(address) <= 300),
  topic           text check (char_length(topic) <= 120),
  message         text not null check (char_length(message) <= 10000),
  preferred_date  date,
  preferred_time  text,
  status          text not null default 'pending' check (status in ('pending', 'confirmed', 'completed', 'cancelled')),
  meeting_link    text,
  admin_notes     text,
  created_at      timestamptz not null default now()
);
alter table public.consultations enable row level security;
drop policy if exists "consultations: public insert" on public.consultations;
create policy "consultations: public insert" on public.consultations
  for insert with check (status = 'pending' and admin_notes is null and meeting_link is null);
drop policy if exists "consultations: admin all" on public.consultations;
create policy "consultations: admin all" on public.consultations
  for all using (public.is_admin()) with check (public.is_admin());

-- ---------- Storage bucket for the media library ----------
insert into storage.buckets (id, name, public, file_size_limit)
values ('media', 'media', true, 52428800)
on conflict (id) do update set public = true;

drop policy if exists "media bucket: public read" on storage.objects;
create policy "media bucket: public read" on storage.objects
  for select using (bucket_id = 'media');
drop policy if exists "media bucket: admin insert" on storage.objects;
create policy "media bucket: admin insert" on storage.objects
  for insert with check (bucket_id = 'media' and public.is_admin());
drop policy if exists "media bucket: admin update" on storage.objects;
create policy "media bucket: admin update" on storage.objects
  for update using (bucket_id = 'media' and public.is_admin());
drop policy if exists "media bucket: admin delete" on storage.objects;
create policy "media bucket: admin delete" on storage.objects
  for delete using (bucket_id = 'media' and public.is_admin());
