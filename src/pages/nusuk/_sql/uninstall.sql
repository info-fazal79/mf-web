-- =====================================================================
-- Nusuk code sharing · uninstall
-- Removes every Nusuk table, function and code from Supabase. Cannot be undone.
-- After running it, delete the folder src/pages/nusuk/ and push.
-- =====================================================================
drop function if exists public.nusuk_feedback_submit(text, text, text, text, text);
drop table if exists public.nusuk_feedback;
drop function if exists public.nusuk_admin_add_codes(text[], int, text);
drop function if exists public.nusuk_admin_stats();
drop function if exists public.nusuk_submit(text, text, text);
drop function if exists public.nusuk_claim(bigint, bigint[], bigint[]);
drop function if exists public.nusuk_claim(bigint, bigint[]);
drop function if exists public.nusuk_bootstrap(bigint[], bigint[]);
drop function if exists public.nusuk_bootstrap(bigint[]);
drop function if exists public.nusuk_remaining_for(bigint[]);
drop function if exists public.nusuk_pick(bigint[]);
drop function if exists public.nusuk_admin_feature_approve(bigint);
drop function if exists public.nusuk_feature_request(text, text, text);
drop table if exists public.nusuk_feature_requests;
drop function if exists public.nusuk_ping(uuid);
drop table if exists public.nusuk_visitors;
drop table if exists public.nusuk_daily;
drop table if exists public.nusuk_codes;
drop function if exists public.nusuk_codes_mark_approved();
drop table if exists public.nusuk_settings;
