-- =====================================================================
-- MF Website · Migration 0005 · Tutorials (Phase 6)
-- Run AFTER 0004. Paste into Supabase → SQL Editor → Run. Safe to re-run.
-- If Supabase shows a "Row Level Security" warning, choose "Run without RLS":
-- every table below already enables RLS itself.
-- =====================================================================

-- ---------- Admin-only settings (e.g. YouTube API key) ----------
create table if not exists public.private_settings (
  key         text primary key,
  value       jsonb not null default '{}'::jsonb,
  updated_at  timestamptz not null default now()
);
alter table public.private_settings enable row level security;
drop policy if exists "private_settings: admin only" on public.private_settings;
create policy "private_settings: admin only" on public.private_settings
  for all using (public.is_admin()) with check (public.is_admin());

-- ---------- Playlists (courses) ----------
create table if not exists public.tutorial_playlists (
  id                   uuid primary key default gen_random_uuid(),
  title                text not null,
  slug                 text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  description          text,
  cover_url            text,
  topic                text,                        -- Excel, Word, PowerPoint, Google Sheets…
  level                text not null default 'beginner' check (level in ('beginner', 'intermediate', 'advanced', 'all')),
  language             text not null default 'Bangla',
  youtube_playlist_id  text,
  featured             boolean not null default false,
  status               text not null default 'draft' check (status in ('draft', 'published')),
  sort_order           int not null default 0,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);
drop trigger if exists tutorial_playlists_touch on public.tutorial_playlists;
create trigger tutorial_playlists_touch before update on public.tutorial_playlists for each row execute function public.touch_updated_at();
alter table public.tutorial_playlists enable row level security;
drop policy if exists "playlists: public read" on public.tutorial_playlists;
create policy "playlists: public read" on public.tutorial_playlists for select using (status = 'published' or public.is_admin());
drop policy if exists "playlists: admin write" on public.tutorial_playlists;
create policy "playlists: admin write" on public.tutorial_playlists for all using (public.is_admin()) with check (public.is_admin());

-- ---------- Lessons (videos) ----------
create table if not exists public.tutorial_videos (
  id                uuid primary key default gen_random_uuid(),
  playlist_id       uuid not null references public.tutorial_playlists (id) on delete cascade,
  youtube_id        text not null check (youtube_id ~ '^[A-Za-z0-9_-]{11}$'),
  title             text not null,
  description       text,
  duration_seconds  int,
  thumbnail_url     text,
  position          int not null default 0,
  resources         jsonb not null default '[]'::jsonb,  -- [{name, url}]
  published         boolean not null default true,
  created_at        timestamptz not null default now()
);
create index if not exists tutorial_videos_playlist_idx on public.tutorial_videos (playlist_id, position);
alter table public.tutorial_videos enable row level security;
drop policy if exists "videos: public read" on public.tutorial_videos;
create policy "videos: public read" on public.tutorial_videos
  for select using (
    public.is_admin()
    or (published and exists (select 1 from public.tutorial_playlists p where p.id = playlist_id and p.status = 'published'))
  );
drop policy if exists "videos: admin write" on public.tutorial_videos;
create policy "videos: admin write" on public.tutorial_videos for all using (public.is_admin()) with check (public.is_admin());
