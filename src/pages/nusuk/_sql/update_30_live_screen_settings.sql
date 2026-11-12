-- =====================================================================
-- Nusuk · update 30 · live screen settings from Nusuk Manager
-- Run once in Supabase → SQL Editor (after update 29), BEFORE pushing.
-- Safe to run again.
--
-- The live screen (/nusuk/live) reads its theme, theme schedule, panels and
-- headline from nusuk_settings.content.livescreen every 10 seconds, so a
-- change in Nusuk Manager → Live screen shows on the stream by itself.
-- =====================================================================

create or replace function public.nusuk_live_screen_cfg()
returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce(content -> 'livescreen', '{}'::jsonb) from public.nusuk_settings where id = 1;
$$;
grant execute on function public.nusuk_live_screen_cfg() to anon, authenticated;
