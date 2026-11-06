-- =====================================================================
-- Remove ALL demo content (anything tagged 'demo').
-- Paste into Supabase → SQL Editor → Run when you're ready for real content.
-- Comments on demo posts are deleted automatically.
-- =====================================================================
delete from public.posts where 'demo' = any(tags);
delete from public.projects where 'demo' = any(tags);
