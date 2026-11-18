-- =====================================================================
-- Nusuk · update 50 · remove the Zamzam water winners
-- Run once in Supabase → SQL Editor. Safe to run again (the second time it removes nothing).
--
-- Deletes every winner with prize "zamzam" from Nusuk Manager → Winners
-- (nusuk_settings.content.winners). Umrah and other winners stay.
-- This cannot be undone: the Zamzam names are gone after it runs.
-- =====================================================================

-- how many will be removed (shown in the result panel before the delete)
select count(*) as zamzam_winners_to_remove
from public.nusuk_settings s, jsonb_array_elements(case when jsonb_typeof(s.content->'winners') = 'array' then s.content->'winners' else '[]'::jsonb end) w
where s.id = 1 and w->>'prize' = 'zamzam';

update public.nusuk_settings s
   set content = jsonb_set(s.content, '{winners}', coalesce((
         select jsonb_agg(w)
         from jsonb_array_elements(s.content->'winners') w
         where coalesce(w->>'prize', '') <> 'zamzam'), '[]'::jsonb)),
       updated_at = now()
 where s.id = 1 and jsonb_typeof(s.content->'winners') = 'array';

-- the live screen and home page read cached numbers: refresh them now
delete from public.nusuk_cache;
