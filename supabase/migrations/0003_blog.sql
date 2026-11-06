-- =====================================================================
-- MF Website · Migration 0003 · Blog (Phase 4)
-- Run AFTER 0002. Paste into Supabase → SQL Editor → Run. Safe to re-run.
-- =====================================================================

-- ---------- Authors ----------
create table if not exists public.authors (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  slug        text not null unique,
  title       text,
  bio         text,
  avatar_url  text,
  website     text,
  created_at  timestamptz not null default now()
);
alter table public.authors enable row level security;
drop policy if exists "authors: public read" on public.authors;
create policy "authors: public read" on public.authors for select using (true);
drop policy if exists "authors: admin write" on public.authors;
create policy "authors: admin write" on public.authors for all using (public.is_admin()) with check (public.is_admin());

insert into public.authors (name, slug, title, bio)
select 'Muhammad Fazal', 'muhammad-fazal', 'Office Automation Specialist & Developer',
       'Lead MS Office instructor and automation specialist. I build Google Sheets & Apps Script systems, dashboards and websites.'
where not exists (select 1 from public.authors);

-- ---------- Categories ----------
create table if not exists public.blog_categories (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  slug        text not null unique,
  description text,
  sort_order  int not null default 0,
  created_at  timestamptz not null default now()
);
alter table public.blog_categories enable row level security;
drop policy if exists "categories: public read" on public.blog_categories;
create policy "categories: public read" on public.blog_categories for select using (true);
drop policy if exists "categories: admin write" on public.blog_categories;
create policy "categories: admin write" on public.blog_categories for all using (public.is_admin()) with check (public.is_admin());

insert into public.blog_categories (name, slug, sort_order)
select * from (values
  ('Excel', 'excel', 1), ('Google Sheets', 'google-sheets', 2), ('Automation', 'automation', 3),
  ('AI Tools', 'ai-tools', 4), ('Web Development', 'web-development', 5)
) v(n, s, o)
where not exists (select 1 from public.blog_categories);

-- ---------- Posts ----------
create table if not exists public.posts (
  id               uuid primary key default gen_random_uuid(),
  title            text not null,
  slug             text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  excerpt          text,
  content          text not null default '',
  cover_url        text,
  category_id      uuid references public.blog_categories (id) on delete set null,
  author_id        uuid references public.authors (id) on delete set null,
  tags             text[] not null default '{}',
  status           text not null default 'draft' check (status in ('draft', 'published')),
  published_at     timestamptz,
  featured         boolean not null default false,
  allow_comments   boolean not null default true,
  seo_title        text,
  seo_description  text,
  views            int not null default 0,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index if not exists posts_published_idx on public.posts (status, published_at desc);
drop trigger if exists posts_touch on public.posts;
create trigger posts_touch before update on public.posts for each row execute function public.touch_updated_at();

alter table public.posts enable row level security;
-- A post is public once published and its publish time has passed (future = scheduled).
drop policy if exists "posts: public read" on public.posts;
create policy "posts: public read" on public.posts
  for select using ((status = 'published' and published_at <= now()) or public.is_admin());
drop policy if exists "posts: admin write" on public.posts;
create policy "posts: admin write" on public.posts for all using (public.is_admin()) with check (public.is_admin());

create or replace function public.increment_post_views(post_slug text)
returns void language sql security definer set search_path = public as $$
  update public.posts set views = views + 1
  where slug = post_slug and status = 'published' and published_at <= now();
$$;
grant execute on function public.increment_post_views(text) to anon, authenticated;

-- ---------- Comments ----------
create table if not exists public.comments (
  id          uuid primary key default gen_random_uuid(),
  post_id     uuid not null references public.posts (id) on delete cascade,
  parent_id   uuid references public.comments (id) on delete cascade,
  name        text not null check (char_length(name) between 1 and 100),
  email       text not null check (char_length(email) <= 320),
  body        text not null check (char_length(body) between 1 and 5000),
  status      text not null default 'pending' check (status in ('pending', 'approved', 'spam')),
  is_admin    boolean not null default false,
  created_at  timestamptz not null default now()
);
create index if not exists comments_post_idx on public.comments (post_id, created_at);
alter table public.comments enable row level security;

-- Visitors can only submit pending, non-admin comments on posts that allow comments.
drop policy if exists "comments: public insert" on public.comments;
create policy "comments: public insert" on public.comments
  for insert with check (
    status = 'pending' and is_admin = false
    and exists (
      select 1 from public.posts p
      where p.id = post_id and p.allow_comments and p.status = 'published' and p.published_at <= now()
    )
  );
drop policy if exists "comments: admin all" on public.comments;
create policy "comments: admin all" on public.comments for all using (public.is_admin()) with check (public.is_admin());

-- Approved comments without email addresses, for the public site.
create or replace function public.approved_comments(p_post_id uuid)
returns table (id uuid, parent_id uuid, name text, body text, is_admin boolean, created_at timestamptz)
language sql stable security definer set search_path = public as $$
  select c.id, c.parent_id, c.name, c.body, c.is_admin, c.created_at
  from public.comments c
  join public.posts p on p.id = c.post_id
  where c.post_id = p_post_id and c.status = 'approved'
    and p.status = 'published' and p.published_at <= now()
  order by c.created_at;
$$;
grant execute on function public.approved_comments(uuid) to anon, authenticated;
