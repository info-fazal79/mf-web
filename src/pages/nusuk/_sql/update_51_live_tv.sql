-- =====================================================================
-- Nusuk · update 51 · live screen TV program
-- Run once in Supabase → SQL Editor, BEFORE pushing. Safe to run again.
--
-- The live screen settings (Nusuk Manager → Live screen) now also carry the
-- winners list and the latest Nusuk winner, so the TV scenes "Bangladeshi
-- Umrah winners" and "Latest Nusuk winner" can show them at any time
-- (before, they were only sent in the Winner view). Names only, as on /nusuk.
-- =====================================================================

create or replace function public.nusuk_live_screen_cfg()
returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce(content -> 'livescreen', '{}'::jsonb)
         || jsonb_build_object(
              '_winners', case when jsonb_typeof(content -> 'winners') = 'array' then content -> 'winners' else '[]'::jsonb end,
              '_today', content -> 'today_winner')
  from public.nusuk_settings where id = 1;
$$;
grant execute on function public.nusuk_live_screen_cfg() to anon, authenticated;
