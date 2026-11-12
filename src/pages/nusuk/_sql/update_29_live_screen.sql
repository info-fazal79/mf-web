-- =====================================================================
-- Nusuk · update 29 · "Live screen" for OBS / Facebook & YouTube live
-- Run once in Supabase → SQL Editor (after update 27), BEFORE pushing.
-- Safe to run again.
--
-- nusuk_live_screen() gives the broadcast page (/nusuk/live) everything in
-- one read-only call: today's numbers, a live activity feed and the winner
-- card. Only public-safe data: codes are partly hidden (NG-y3J•••7lU), quiz
-- players show their first name only, feedback and requests show no content.
-- It never picks or reserves a code, so Instant Keys seats are not touched.
-- =====================================================================

create or replace function public.nusuk_live_screen()
returns jsonb
language sql stable security definer set search_path = public as $$
  with d as (select public.nusuk_today() as day),
  s as (select content from public.nusuk_settings where id = 1),
  ev as (
    -- New code submitted by a visitor
    (select c.created_at as at, 'submitted' as kind, public.nusuk_mask(c.code) as label
       from public.nusuk_codes c
      where c.source = 'user' and c.created_at > now() - interval '24 hours'
      order by c.created_at desc limit 15)
    union all
    -- Submission approved (added to the list)
    (select c.approved_at, 'approved', public.nusuk_mask(c.code)
       from public.nusuk_codes c
      where c.approved_at > now() - interval '24 hours'
      order by c.approved_at desc limit 15)
    union all
    -- Code featured (goes to the top for everyone)
    (select c.featured_at, 'featured', public.nusuk_mask(c.code)
       from public.nusuk_codes c
      where c.featured_at > now() - interval '24 hours'
      order by c.featured_at desc limit 10)
    union all
    -- New quiz player (first name only)
    (select p.created_at, 'quiz_join', split_part(trim(p.name), ' ', 1)
       from public.nusuk_quiz_players p
      where p.created_at > now() - interval '24 hours'
      order by p.created_at desc limit 10)
    union all
    -- Feature request received (no details)
    (select r.created_at, 'feature_request', null
       from public.nusuk_feature_requests r
      where r.created_at > now() - interval '24 hours'
      order by r.created_at desc limit 10)
    union all
    -- Feedback received (no content)
    (select f.created_at, 'feedback', null
       from public.nusuk_feedback f
      where f.created_at > now() - interval '24 hours'
      order by f.created_at desc limit 10)
  )
  select jsonb_build_object(
    'now', now(),
    'active_now',     (select count(*) from public.nusuk_visitors where last_seen > now() - interval '2 minutes'),
    'visitors_today', (select count(*) from public.nusuk_visitor_days, d where nusuk_visitor_days.day = d.day),
    'new_today',      (select count(*) from public.nusuk_visitors, d where (first_seen at time zone 'Asia/Dhaka')::date = d.day),
    'peak_today',     (select coalesce(max(peak), 0) from public.nusuk_active_log, d where (bucket at time zone 'Asia/Dhaka')::date = d.day),
    'copies_today',   (select coalesce(copies, 0) from public.nusuk_daily, d where nusuk_daily.day = d.day),
    'copies_hour',    (select coalesce(sum(copies), 0) from public.nusuk_copies_10m where bucket > now() - interval '60 minutes'),
    'copies_total',   (select coalesce(sum(uses), 0) from public.nusuk_codes),
    'codes_active',   (select count(*) from public.nusuk_codes where status = 'active'),
    'submitted_today',(select count(*) from public.nusuk_codes, d where source = 'user' and (created_at at time zone 'Asia/Dhaka')::date = d.day),
    'approved_today', (select count(*) from public.nusuk_codes, d where (approved_at at time zone 'Asia/Dhaka')::date = d.day),
    'quiz_players',   (select count(*) from public.nusuk_quiz_players),
    'quiz_answers_today', (select count(*) from public.nusuk_quiz_answers, d where nusuk_quiz_answers.day = d.day),
    'quiz_correct_today', (select count(*) from public.nusuk_quiz_answers, d where nusuk_quiz_answers.day = d.day and correct),
    'requests_today', (select count(*) from public.nusuk_feature_requests, d where (created_at at time zone 'Asia/Dhaka')::date = d.day),
    'feedback_today', (select count(*) from public.nusuk_feedback, d where (created_at at time zone 'Asia/Dhaka')::date = d.day),
    'today_winner',   (select content -> 'today_winner' from s),
    'winners_count',  (select case when jsonb_typeof(content -> 'winners') = 'array' then jsonb_array_length(content -> 'winners') else 0 end from s),
    'notice',         (select case when (content -> 'topbar' ->> 'on') = 'true' then content -> 'topbar' ->> 'text' end from s),
    'feed', (select coalesce(jsonb_agg(jsonb_build_object('at', e.at, 'kind', e.kind, 'label', e.label) order by e.at desc), '[]'::jsonb)
               from (select * from ev where at is not null order by at desc limit 30) e)
  );
$$;
grant execute on function public.nusuk_live_screen() to anon, authenticated;
