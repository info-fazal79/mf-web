-- =====================================================================
-- Nusuk · update 52 · Facebook live comments on the live screen
-- Run once in Supabase → SQL Editor, BEFORE pushing. Safe to run again.
--
-- Nusuk Manager → Live screen → Live comments → Settings keeps the Facebook
-- connection here (App ID, App secret, the Page and its access token).
-- Only admins can read or change this row: the public site never sees it.
-- The comments themselves are NOT stored: they are fetched from Facebook
-- straight into Nusuk Manager while it is open. Only the one comment you
-- press "Show" on goes to the live screen settings.
-- =====================================================================

create table if not exists public.nusuk_fb_conn (
  id          int primary key default 1 check (id = 1),
  app_id      text not null default '',
  app_secret  text not null default '',
  page_id     text not null default '',
  page_name   text not null default '',
  page_token  text not null default '',
  updated_at  timestamptz not null default now()
);
insert into public.nusuk_fb_conn (id) values (1) on conflict (id) do nothing;

alter table public.nusuk_fb_conn enable row level security;
drop policy if exists "nusuk_fb_conn: admin all" on public.nusuk_fb_conn;
create policy "nusuk_fb_conn: admin all" on public.nusuk_fb_conn
  for all using (public.is_admin()) with check (public.is_admin());
revoke all on public.nusuk_fb_conn from anon;
grant select, insert, update on public.nusuk_fb_conn to authenticated;
