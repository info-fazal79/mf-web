-- =====================================================================
-- Nusuk · update 14 · any feedback can go on the slider
-- Run once in Supabase → SQL Editor (after update 13). Safe to run again.
-- Run this BEFORE the new admin version goes live.
--
-- Before: only messages where the visitor ticked "may be shown on the page"
--   could go on the slider; older messages were stuck as "Private".
-- Now:   the admin decides. Any message can be put on the slider. The
--   visitor's choice is still saved (allow_public) and shown in the admin
--   as "✓ Public OK" to help you pick. Phone and address are never shown.
-- =====================================================================

alter table public.nusuk_feedback drop constraint if exists nusuk_feedback_slider_consent;

create or replace function public.nusuk_feedback_slider()
returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object(
           'kind', f.kind,
           'name', left(f.name, 60),
           'message', left(f.message, 500),
           'at', f.created_at) order by f.slider_at desc), '[]'::jsonb)
  from (select * from public.nusuk_feedback
        where on_slider
        order by slider_at desc
        limit 30) f
  where exists (select 1 from public.nusuk_settings where id = 1 and enabled);
$$;
grant execute on function public.nusuk_feedback_slider() to anon, authenticated;
