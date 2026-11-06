-- =====================================================================
-- MF Website · Migration 0006 · E-books, reader & customer library (Phase 7)
-- Run AFTER 0005. Paste into Supabase → SQL Editor → Run. Safe to re-run.
-- If Supabase shows a Row Level Security warning, choose "Run without RLS":
-- every table below already enables RLS itself.
-- =====================================================================

-- ---------- Categories ----------
create table if not exists public.ebook_categories (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  slug        text not null unique,
  sort_order  int not null default 0,
  created_at  timestamptz not null default now()
);
alter table public.ebook_categories enable row level security;
drop policy if exists "ebook_categories: public read" on public.ebook_categories;
create policy "ebook_categories: public read" on public.ebook_categories for select using (true);
drop policy if exists "ebook_categories: admin write" on public.ebook_categories;
create policy "ebook_categories: admin write" on public.ebook_categories for all using (public.is_admin()) with check (public.is_admin());

insert into public.ebook_categories (name, slug, sort_order)
select * from (values ('Excel', 'excel', 1), ('Google Sheets', 'google-sheets', 2), ('MS Office', 'ms-office', 3), ('Automation', 'automation', 4), ('AI & Productivity', 'ai-productivity', 5)) v(n, s, o)
where not exists (select 1 from public.ebook_categories);

-- ---------- E-books ----------
-- access_mode:
--   free_read      free, read online only
--   free_download  free, read online + download
--   email          free after leaving an email address
--   whatsapp       free via a WhatsApp group link (file not served by the site)
--   paid           buy to unlock (allow_download decides if buyers can download)
create table if not exists public.ebooks (
  id               uuid primary key default gen_random_uuid(),
  title            text not null,
  slug             text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  subtitle         text,
  description      text not null default '',
  cover_url        text,
  category_id      uuid references public.ebook_categories (id) on delete set null,
  author_name      text not null default 'Muhammad Fazal',
  language         text not null default 'Bangla',
  pages            int,
  format           text not null default 'native' check (format in ('native', 'pdf', 'both')),
  pdf_path         text,
  access_mode      text not null default 'free_read' check (access_mode in ('free_read', 'free_download', 'email', 'whatsapp', 'paid')),
  allow_download   boolean not null default false,
  price            numeric(10, 2) not null default 0,
  sale_price       numeric(10, 2),
  whatsapp_url     text,
  preview_pages    int not null default 10,
  tags             text[] not null default '{}',
  featured         boolean not null default false,
  status           text not null default 'draft' check (status in ('draft', 'published')),
  sort_order       int not null default 0,
  published_at     timestamptz,
  seo_title        text,
  seo_description  text,
  views            int not null default 0,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
drop trigger if exists ebooks_touch on public.ebooks;
create trigger ebooks_touch before update on public.ebooks for each row execute function public.touch_updated_at();
alter table public.ebooks enable row level security;
drop policy if exists "ebooks: public read" on public.ebooks;
create policy "ebooks: public read" on public.ebooks for select using (status = 'published' or public.is_admin());
drop policy if exists "ebooks: admin write" on public.ebooks;
create policy "ebooks: admin write" on public.ebooks for all using (public.is_admin()) with check (public.is_admin());

-- ---------- Customer library (free claims now, purchases in Phase 8) ----------
create table if not exists public.ebook_library (
  user_id     uuid not null references auth.users (id) on delete cascade,
  ebook_id    uuid not null references public.ebooks (id) on delete cascade,
  source      text not null default 'free' check (source in ('free', 'purchase', 'admin')),
  granted_at  timestamptz not null default now(),
  primary key (user_id, ebook_id)
);
alter table public.ebook_library enable row level security;
drop policy if exists "library: own read" on public.ebook_library;
create policy "library: own read" on public.ebook_library for select using (user_id = auth.uid() or public.is_admin());
drop policy if exists "library: claim free" on public.ebook_library;
create policy "library: claim free" on public.ebook_library
  for insert with check (
    user_id = auth.uid() and source = 'free'
    and exists (select 1 from public.ebooks e where e.id = ebook_id and e.status = 'published' and e.access_mode <> 'paid')
  );
drop policy if exists "library: own remove free" on public.ebook_library;
create policy "library: own remove free" on public.ebook_library for delete using (user_id = auth.uid() and source = 'free');
drop policy if exists "library: admin all" on public.ebook_library;
create policy "library: admin all" on public.ebook_library for all using (public.is_admin()) with check (public.is_admin());

-- ---------- Who may read a book's full content ----------
create or replace function public.can_read_ebook(p_ebook uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_admin() or exists (
    select 1 from public.ebooks e
    where e.id = p_ebook and e.status = 'published'
      and (
        e.access_mode in ('free_read', 'free_download', 'email')
        or exists (select 1 from public.ebook_library l where l.ebook_id = e.id and l.user_id = auth.uid())
      )
  );
$$;
grant execute on function public.can_read_ebook(uuid) to anon, authenticated;

create or replace function public.can_read_ebook_path(p_path text)
returns boolean language sql stable security definer set search_path = public as $$
  select case
    when split_part(p_path, '/', 1) ~ '^[0-9a-f-]{36}$' then public.can_read_ebook(split_part(p_path, '/', 1)::uuid)
    else public.is_admin()
  end;
$$;
grant execute on function public.can_read_ebook_path(text) to anon, authenticated;

-- ---------- Chapters (for books written in the admin) ----------
create table if not exists public.ebook_chapters (
  id          uuid primary key default gen_random_uuid(),
  ebook_id    uuid not null references public.ebooks (id) on delete cascade,
  title       text not null,
  content     text not null default '',
  position    int not null default 0,
  is_preview  boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists ebook_chapters_idx on public.ebook_chapters (ebook_id, position);
drop trigger if exists ebook_chapters_touch on public.ebook_chapters;
create trigger ebook_chapters_touch before update on public.ebook_chapters for each row execute function public.touch_updated_at();
alter table public.ebook_chapters enable row level security;
drop policy if exists "chapters: readers" on public.ebook_chapters;
create policy "chapters: readers" on public.ebook_chapters
  for select using (
    public.can_read_ebook(ebook_id)
    or (is_preview and exists (select 1 from public.ebooks e where e.id = ebook_id and e.status = 'published'))
  );
drop policy if exists "chapters: admin write" on public.ebook_chapters;
create policy "chapters: admin write" on public.ebook_chapters for all using (public.is_admin()) with check (public.is_admin());

-- Table of contents (titles only) for everyone
create or replace function public.ebook_toc(p_ebook uuid)
returns table (id uuid, title text, chapter_position int, is_preview boolean)
language sql stable security definer set search_path = public as $$
  select c.id, c.title, c.position, c.is_preview
  from public.ebook_chapters c join public.ebooks e on e.id = c.ebook_id
  where c.ebook_id = p_ebook and e.status = 'published'
  order by c.position;
$$;
grant execute on function public.ebook_toc(uuid) to anon, authenticated;

-- ---------- Reading progress, highlights, bookmarks (per signed-in reader) ----------
create table if not exists public.reading_progress (
  user_id     uuid not null references auth.users (id) on delete cascade,
  ebook_id    uuid not null references public.ebooks (id) on delete cascade,
  location    jsonb not null default '{}'::jsonb,
  percent     numeric(5, 2) not null default 0,
  updated_at  timestamptz not null default now(),
  primary key (user_id, ebook_id)
);
alter table public.reading_progress enable row level security;
drop policy if exists "progress: own" on public.reading_progress;
create policy "progress: own" on public.reading_progress for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create table if not exists public.ebook_annotations (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  ebook_id    uuid not null references public.ebooks (id) on delete cascade,
  kind        text not null check (kind in ('highlight', 'bookmark')),
  location    jsonb not null default '{}'::jsonb,   -- {chapter, start, end} or {page}
  quote       text,
  note        text,
  color       text,
  created_at  timestamptz not null default now()
);
create index if not exists annotations_user_book_idx on public.ebook_annotations (user_id, ebook_id);
alter table public.ebook_annotations enable row level security;
drop policy if exists "annotations: own" on public.ebook_annotations;
create policy "annotations: own" on public.ebook_annotations for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ---------- Reviews ----------
create table if not exists public.ebook_reviews (
  id          uuid primary key default gen_random_uuid(),
  ebook_id    uuid not null references public.ebooks (id) on delete cascade,
  user_id     uuid references auth.users (id) on delete set null,
  name        text not null check (char_length(name) between 1 and 100),
  rating      int not null check (rating between 1 and 5),
  body        text check (char_length(body) <= 3000),
  status      text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  created_at  timestamptz not null default now(),
  unique (ebook_id, user_id)
);
alter table public.ebook_reviews enable row level security;
drop policy if exists "reviews: public read approved" on public.ebook_reviews;
create policy "reviews: public read approved" on public.ebook_reviews for select using (status = 'approved' or user_id = auth.uid() or public.is_admin());
drop policy if exists "reviews: signed-in insert" on public.ebook_reviews;
create policy "reviews: signed-in insert" on public.ebook_reviews for insert with check (user_id = auth.uid() and status = 'pending');
drop policy if exists "reviews: admin all" on public.ebook_reviews;
create policy "reviews: admin all" on public.ebook_reviews for all using (public.is_admin()) with check (public.is_admin());

create or replace function public.ebook_ratings()
returns table (ebook_id uuid, avg_rating numeric, review_count bigint)
language sql stable security definer set search_path = public as $$
  select ebook_id, round(avg(rating)::numeric, 1), count(*) from public.ebook_reviews where status = 'approved' group by ebook_id;
$$;
grant execute on function public.ebook_ratings() to anon, authenticated;

-- ---------- Email-gated downloads (leads) ----------
create table if not exists public.ebook_leads (
  id          uuid primary key default gen_random_uuid(),
  ebook_id    uuid not null references public.ebooks (id) on delete cascade,
  name        text check (char_length(name) <= 100),
  email       text not null check (char_length(email) <= 320),
  created_at  timestamptz not null default now()
);
alter table public.ebook_leads enable row level security;
drop policy if exists "leads: public insert" on public.ebook_leads;
create policy "leads: public insert" on public.ebook_leads for insert with check (true);
drop policy if exists "leads: admin read" on public.ebook_leads;
create policy "leads: admin read" on public.ebook_leads for all using (public.is_admin()) with check (public.is_admin());

create or replace function public.increment_ebook_views(book_slug text)
returns void language sql security definer set search_path = public as $$
  update public.ebooks set views = views + 1 where slug = book_slug and status = 'published';
$$;
grant execute on function public.increment_ebook_views(text) to anon, authenticated;

-- ---------- Private storage for PDF files: ebooks/<ebook id>/<file>.pdf ----------
insert into storage.buckets (id, name, public, file_size_limit)
values ('ebooks', 'ebooks', false, 52428800)
on conflict (id) do update set public = false;

drop policy if exists "ebooks bucket: readers" on storage.objects;
create policy "ebooks bucket: readers" on storage.objects
  for select using (bucket_id = 'ebooks' and public.can_read_ebook_path(name));
drop policy if exists "ebooks bucket: admin insert" on storage.objects;
create policy "ebooks bucket: admin insert" on storage.objects for insert with check (bucket_id = 'ebooks' and public.is_admin());
drop policy if exists "ebooks bucket: admin update" on storage.objects;
create policy "ebooks bucket: admin update" on storage.objects for update using (bucket_id = 'ebooks' and public.is_admin());
drop policy if exists "ebooks bucket: admin delete" on storage.objects;
create policy "ebooks bucket: admin delete" on storage.objects for delete using (bucket_id = 'ebooks' and public.is_admin());
