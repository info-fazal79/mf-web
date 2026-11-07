-- =====================================================================
-- Nusuk code sharing · uninstall
-- Removes every Nusuk table, function and code from Supabase. Cannot be undone.
-- After running it, delete the folder src/pages/nusuk/ and push.
-- =====================================================================
drop function if exists public.nusuk_admin_add_codes(text[], int, text);
drop function if exists public.nusuk_admin_stats();
drop function if exists public.nusuk_submit(text, text, text);
drop function if exists public.nusuk_claim(bigint, bigint[]);
drop function if exists public.nusuk_bootstrap(bigint[]);
drop function if exists public.nusuk_pick(bigint[]);
drop table if exists public.nusuk_daily;
drop table if exists public.nusuk_codes;
drop table if exists public.nusuk_settings;
