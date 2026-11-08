-- =====================================================================
-- Nusuk · update 15 · edit how a message looks on the slider
-- Run once in Supabase → SQL Editor (after update 14). Safe to run again.
-- Run this BEFORE the new admin version goes live.
--
-- In Nusuk Manager → Feedback, "Edit for slider" lets you tidy a message
-- (e.g. join many short lines into one paragraph) and the name shown with it.
-- The visitor's original message is never changed; the slider shows your
-- edited copy when there is one.
-- =====================================================================

alter table public.nusuk_feedback add column if not exists slider_text text check (char_length(slider_text) <= 3000);
alter table public.nusuk_feedback add column if not exists slider_name text check (char_length(slider_name) <= 120);

create or replace function public.nusuk_feedback_slider()
returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object(
           'kind', f.kind,
           'name', left(coalesce(nullif(trim(f.slider_name), ''), f.name), 60),
           'message', left(coalesce(nullif(trim(f.slider_text), ''), f.message), 500),
           'at', f.created_at) order by f.slider_at desc), '[]'::jsonb)
  from (select * from public.nusuk_feedback
        where on_slider
        order by slider_at desc
        limit 30) f
  where exists (select 1 from public.nusuk_settings where id = 1 and enabled);
$$;
grant execute on function public.nusuk_feedback_slider() to anon, authenticated;
