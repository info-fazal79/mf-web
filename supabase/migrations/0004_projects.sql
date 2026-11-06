-- =====================================================================
-- MF Website · Migration 0004 · Projects portfolio (Phase 5)
-- Run AFTER 0003. Paste into Supabase → SQL Editor → Run. Safe to re-run.
-- =====================================================================

create table if not exists public.project_categories (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  slug        text not null unique,
  sort_order  int not null default 0,
  created_at  timestamptz not null default now()
);
alter table public.project_categories enable row level security;
drop policy if exists "project_categories: public read" on public.project_categories;
create policy "project_categories: public read" on public.project_categories for select using (true);
drop policy if exists "project_categories: admin write" on public.project_categories;
create policy "project_categories: admin write" on public.project_categories for all using (public.is_admin()) with check (public.is_admin());

insert into public.project_categories (name, slug, sort_order)
select * from (values
  ('Websites', 'websites', 1), ('Google Sheets', 'google-sheets', 2), ('Excel', 'excel', 3),
  ('Word', 'word', 4), ('PowerPoint', 'powerpoint', 5), ('Mobile Apps', 'mobile-apps', 6),
  ('Automation', 'automation', 7)
) v(n, s, o)
where not exists (select 1 from public.project_categories);

create table if not exists public.projects (
  id                uuid primary key default gen_random_uuid(),
  title             text not null,
  slug              text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  summary           text,
  content           text not null default '',
  category_id       uuid references public.project_categories (id) on delete set null,
  cover_url         text,
  gallery           jsonb not null default '[]'::jsonb,  -- [{url, caption}]
  files             jsonb not null default '[]'::jsonb,  -- [{name, url}]
  tools             text[] not null default '{}',
  tags              text[] not null default '{}',
  client            text,
  project_date      date,
  live_url          text,
  repo_url          text,
  preview_type      text not null default 'none'
                    check (preview_type in ('none', 'website', 'google', 'office', 'pdf', 'video', 'app')),
  preview_url       text,
  problem           text,
  solution          text,
  results           text,
  downloads_enabled boolean not null default false,
  featured          boolean not null default false,
  status            text not null default 'draft' check (status in ('draft', 'published')),
  sort_order        int not null default 0,
  views             int not null default 0,
  seo_title         text,
  seo_description   text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index if not exists projects_status_idx on public.projects (status, sort_order, project_date desc);
drop trigger if exists projects_touch on public.projects;
create trigger projects_touch before update on public.projects for each row execute function public.touch_updated_at();

alter table public.projects enable row level security;
drop policy if exists "projects: public read" on public.projects;
create policy "projects: public read" on public.projects for select using (status = 'published' or public.is_admin());
drop policy if exists "projects: admin write" on public.projects;
create policy "projects: admin write" on public.projects for all using (public.is_admin()) with check (public.is_admin());

create or replace function public.increment_project_views(project_slug text)
returns void language sql security definer set search_path = public as $$
  update public.projects set views = views + 1 where slug = project_slug and status = 'published';
$$;
grant execute on function public.increment_project_views(text) to anon, authenticated;
