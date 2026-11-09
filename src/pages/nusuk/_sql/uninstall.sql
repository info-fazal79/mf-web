-- =====================================================================
-- Nusuk code sharing · uninstall
-- Removes every Nusuk table, function and code from Supabase. Cannot be undone.
-- After running it, delete the folder src/pages/nusuk/ and push.
-- =====================================================================
drop function if exists public.nusuk_camp_draw(bigint, date, date, boolean, text);
drop function if exists public.nusuk_camp_admin_board(bigint, date, date, boolean);
drop function if exists public.nusuk_camp_hit(text, text, boolean, boolean);
drop function if exists public.nusuk_camp_bonus(text, text);
drop function if exists public.nusuk_camp_me(text, text, uuid);
drop function if exists public.nusuk_camp_state();
drop function if exists public.nusuk_camp_top(bigint, date, date, boolean);
drop function if exists public.nusuk_camp_scores(bigint, date, date, boolean);
drop function if exists public.nusuk_camp_current();
drop function if exists public.nusuk_camp_window(public.nusuk_camp_posts, public.nusuk_campaigns, date);
drop function if exists public.nusuk_camp_week_start(date);
drop function if exists public.nusuk_camp_today();
drop table if exists public.nusuk_camp_draws;
drop table if exists public.nusuk_camp_links;
drop table if exists public.nusuk_camp_people;
drop table if exists public.nusuk_camp_posts;
drop table if exists public.nusuk_campaigns;
drop table if exists public.nusuk_camp_config;
drop function if exists public.nusuk_feedback_slider();
drop function if exists public.nusuk_feedback_submit(text, text, text, text, text, boolean);
drop function if exists public.nusuk_feedback_submit(text, text, text, text, text);
drop function if exists public.nusuk_feedback_slider_stamp() cascade;
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
drop function if exists public.nusuk_featured_list();
drop function if exists public.nusuk_mask(text);
drop function if exists public.nusuk_boost_tier(public.nusuk_codes, public.nusuk_settings);
drop function if exists public.nusuk_feature_bonus(bigint, text, boolean, boolean, text);
drop function if exists public.nusuk_admin_feature_approve(bigint, int);
drop function if exists public.nusuk_admin_feature_approve(bigint);
drop function if exists public.nusuk_feature_request(text, text, text);
drop table if exists public.nusuk_feature_requests;
drop function if exists public.nusuk_ping(uuid);
drop table if exists public.nusuk_visitors;
drop function if exists public.nusuk_admin_dashboard();
drop function if exists public.nusuk_today();
drop table if exists public.nusuk_visitor_days;
drop table if exists public.nusuk_active_log;
drop table if exists public.nusuk_hourly;
drop table if exists public.nusuk_daily;
drop table if exists public.nusuk_codes;
drop function if exists public.nusuk_codes_mark_approved();
drop table if exists public.nusuk_settings;
