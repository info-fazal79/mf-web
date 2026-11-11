-- =====================================================================
-- Nusuk · update 25 · quiz: preview mode, date range, own question times,
-- and 50 new questions (Seerah + history of Makkah and Madinah)
-- Run once in Supabase → SQL Editor (after update 24), BEFORE pushing the
-- new quiz version. Safe to run again.
--
--   • published: OFF = preview. Only you (signed in to Nusuk Manager, same
--     browser) see and play the quiz on /nusuk. ON = everyone.
--     ⚠️ This update starts the quiz in PREVIEW, so you can check the new
--     questions first. Publish it in Nusuk Manager → Quiz.
--   • starts_on / ends_on: the quiz runs only on these dates (empty = always).
--   • slot_times: your own opening time for each question (empty = spread
--     evenly between the start and end time, as before).
--   • The old questions are switched OFF (kept, so past answers and points
--     stay); 50 new questions are added. Today's not-yet-answered questions
--     are re-picked from the new set.
-- =====================================================================

alter table public.nusuk_quiz_settings add column if not exists published boolean not null default false;
alter table public.nusuk_quiz_settings add column if not exists starts_on date;
alter table public.nusuk_quiz_settings add column if not exists ends_on date;
alter table public.nusuk_quiz_settings add column if not exists slot_times int[];

-- ---------- Helpers ----------
-- Visible to this caller? (switched on, and published or you are the admin)
create or replace function public.nusuk_quiz_visible()
returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select s.enabled and (s.published or public.is_admin()) from public.nusuk_quiz_settings s where s.id = 1), false);
$$;
-- Does the quiz run on this day? (inside the date range)
create or replace function public.nusuk_quiz_running(p_day date)
returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select (s.starts_on is null or p_day >= s.starts_on) and (s.ends_on is null or p_day <= s.ends_on)
                   from public.nusuk_quiz_settings s where s.id = 1), false);
$$;

-- Opening time of a question: your own time if set, otherwise spread evenly
create or replace function public.nusuk_quiz_opens(p_day date, p_slot int)
returns timestamptz
language sql stable security definer set search_path = public as $$
  select ((p_day::timestamp + make_interval(mins =>
            case when s.slot_times is not null and array_length(s.slot_times, 1) > p_slot and s.slot_times[p_slot + 1] is not null
                 then s.slot_times[p_slot + 1]
                 else s.start_min + (p_slot * (s.end_min - s.start_min)) / s.per_day end)) at time zone 'Asia/Dhaka')
  from public.nusuk_quiz_settings s where s.id = 1;
$$;

-- Choose a day's questions: fills any missing slot (least-used active questions first)
create or replace function public.nusuk_quiz_ensure_day(p_day date)
returns void
language plpgsql volatile security definer set search_path = public as $$
declare
  n int;
  sl int;
  qid bigint;
begin
  select per_day into n from public.nusuk_quiz_settings where id = 1;
  for sl in select g from generate_series(0, n - 1) g
            where not exists (select 1 from public.nusuk_quiz_days d where d.day = p_day and d.slot = g) loop
    select qq.id into qid
    from public.nusuk_quiz_questions qq
    left join (select question_id, count(*) used from public.nusuk_quiz_days group by question_id) u on u.question_id = qq.id
    where qq.active and qq.id not in (select question_id from public.nusuk_quiz_days where day = p_day)
    order by coalesce(u.used, 0), random()
    limit 1;
    exit when qid is null;
    insert into public.nusuk_quiz_days (day, slot, question_id) values (p_day, sl, qid) on conflict do nothing;
  end loop;
end $$;
revoke all on function public.nusuk_quiz_ensure_day(date) from public, anon, authenticated;

-- ---------- Public section ----------
create or replace function public.nusuk_quiz_public(p_limit int default 5)
returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  s public.nusuk_quiz_settings;
  d date := public.nusuk_today();
begin
  select * into s from public.nusuk_quiz_settings where id = 1;
  if s is null or not public.nusuk_quiz_visible() then return jsonb_build_object('enabled', false); end if;
  return jsonb_build_object(
    'enabled', true,
    'published', s.published,
    'running', public.nusuk_quiz_running(d),
    'starts_on', s.starts_on,
    'ends_on', s.ends_on,
    'title', s.title,
    'per_day', s.per_day,
    'points', s.points,
    'season_start', s.season_start,
    'now', now(),
    'opens', case when public.nusuk_quiz_running(d) then (select jsonb_agg(public.nusuk_quiz_opens(d, g) order by g) from generate_series(0, s.per_day - 1) g) else '[]'::jsonb end,
    'closes', public.nusuk_quiz_closes(d),
    'players', (select count(*) from public.nusuk_quiz_players),
    'board', (
      select coalesce(jsonb_agg(jsonb_build_object('rank', r.rank, 'prev', r.prev_rank, 'id', r.player_id, 'name', r.name, 'points', r.points, 'correct', r.correct) order by r.rank, r.player_id), '[]'::jsonb)
      from (select * from public.nusuk_quiz_ranks() order by rank, player_id limit least(greatest(coalesce(p_limit, 5), 1), 200)) r
    )
  );
end $$;
grant execute on function public.nusuk_quiz_public(int) to anon, authenticated;

-- ---------- Make an ID: same as update 24, but only while the quiz is visible ----------
create or replace function public.nusuk_quiz_register(p_name text, p_code text, p_password text)
returns jsonb
language plpgsql volatile security definer set search_path = public, extensions as $$
declare
  v_name text := left(trim(coalesce(p_name, '')), 60);
  v_code text := regexp_replace(coalesce(p_code, ''), '\s', '', 'g');
  c public.nusuk_codes;
  pl public.nusuk_quiz_players;
  tok uuid;
begin
  if not public.nusuk_quiz_visible() then return jsonb_build_object('ok', false, 'reason', 'closed'); end if;
  if v_name = '' then return jsonb_build_object('ok', false, 'reason', 'name'); end if;
  if v_code !~ '^NG-[A-Za-z0-9]{8}$' then return jsonb_build_object('ok', false, 'reason', 'invalid'); end if;
  if not public.nusuk_quiz_pw_ok(p_password) then return jsonb_build_object('ok', false, 'reason', 'password'); end if;
  select * into c from public.nusuk_codes where lower(code) = lower(v_code) limit 1;
  if c.id is null then return jsonb_build_object('ok', false, 'reason', 'not_found'); end if;
  if c.status = 'rejected' then return jsonb_build_object('ok', false, 'reason', 'rejected'); end if;
  select * into pl from public.nusuk_quiz_players where code_id = c.id;
  if pl.id is not null and pl.pass_hash is not null then
    return jsonb_build_object('ok', false, 'reason', 'exists', 'id', pl.id);
  end if;
  if pl.id is null then
    insert into public.nusuk_quiz_players (name, code_id, pass_hash)
    values (v_name, c.id, extensions.crypt(p_password, extensions.gen_salt('bf')))
    on conflict (code_id) do nothing
    returning * into pl;
    if pl.id is null then
      return jsonb_build_object('ok', false, 'reason', 'exists', 'id', (select id from public.nusuk_quiz_players where code_id = c.id));
    end if;
    insert into public.nusuk_quiz_tokens (player_id) values (pl.id) returning token into tok;
    return jsonb_build_object('ok', true, 'id', pl.id, 'name', pl.name, 'token', tok, 'existing', false);
  end if;
  update public.nusuk_quiz_players set pass_hash = extensions.crypt(p_password, extensions.gen_salt('bf')) where id = pl.id;
  insert into public.nusuk_quiz_tokens (player_id) values (pl.id) returning token into tok;
  return jsonb_build_object('ok', true, 'id', pl.id, 'name', pl.name, 'token', tok, 'existing', true);
end $$;
grant execute on function public.nusuk_quiz_register(text, text, text) to anon, authenticated;

-- ---------- My quiz today (adds preview + date range) ----------
create or replace function public.nusuk_quiz_state(p_token uuid)
returns jsonb
language plpgsql volatile security definer set search_path = public as $$
declare
  s public.nusuk_quiz_settings;
  pid int := public.nusuk_quiz_player_of(p_token);
  pl public.nusuk_quiz_players;
  d date := public.nusuk_today();
  run boolean;
  closes timestamptz;
  slots jsonb := '[]'::jsonb;
  me_points bigint;
  me_rank bigint;
  me_prev bigint;
  streak int := 0;
  k date;
  nxt date;
begin
  if pid is null then return jsonb_build_object('ok', false, 'reason', 'signed_out'); end if;
  select * into s from public.nusuk_quiz_settings where id = 1;
  if not public.nusuk_quiz_visible() then return jsonb_build_object('ok', false, 'reason', 'closed'); end if;
  select * into pl from public.nusuk_quiz_players where id = pid;
  run := public.nusuk_quiz_running(d);
  closes := public.nusuk_quiz_closes(d);

  if run then
    perform public.nusuk_quiz_ensure_day(d);
    select coalesce(jsonb_agg(x.j order by x.slot), '[]'::jsonb) into slots from (
      select g.slot, jsonb_strip_nulls(jsonb_build_object(
        'slot', g.slot,
        'opens', public.nusuk_quiz_opens(d, g.slot),
        'status', case
          when a.player_id is not null then 'answered'
          when now() >= closes then 'missed'
          when now() >= public.nusuk_quiz_opens(d, g.slot) and qd.question_id is not null then 'open'
          else 'locked' end,
        'question', case when a.player_id is not null or (now() >= public.nusuk_quiz_opens(d, g.slot) and now() < closes) then q.question end,
        'options',  case when a.player_id is not null or (now() >= public.nusuk_quiz_opens(d, g.slot) and now() < closes) then q.options end,
        'choice', a.choice,
        'correct', case when a.player_id is not null then q.correct end,
        'right', a.correct,
        'points', a.points,
        'explanation', case when a.player_id is not null then q.explanation end
      )) as j
      from generate_series(0, s.per_day - 1) as g(slot)
      left join public.nusuk_quiz_days qd on qd.day = d and qd.slot = g.slot
      left join public.nusuk_quiz_questions q on q.id = qd.question_id
      left join public.nusuk_quiz_answers a on a.player_id = pid and a.day = d and a.slot = g.slot
    ) x;
  end if;

  select r.points, r.rank, r.prev_rank into me_points, me_rank, me_prev from public.nusuk_quiz_ranks() r where r.player_id = pid;
  k := case when exists (select 1 from public.nusuk_quiz_answers where player_id = pid and day = d) then d else d - 1 end;
  while exists (select 1 from public.nusuk_quiz_answers where player_id = pid and day = k) loop
    streak := streak + 1;
    k := k - 1;
  end loop;
  -- next day the quiz runs (for "the next question opens …")
  nxt := case when s.starts_on is not null and d < s.starts_on then s.starts_on else d + 1 end;
  if s.ends_on is not null and nxt > s.ends_on then nxt := null; end if;

  return jsonb_build_object(
    'ok', true,
    'now', now(),
    'running', run,
    'starts_on', s.starts_on,
    'ends_on', s.ends_on,
    'published', s.published,
    'id', pl.id,
    'name', pl.name,
    'code', (select left(code, 3) || '•••' || right(code, 4) from public.nusuk_codes where id = pl.code_id),
    'points_each', s.points,
    'closes', closes,
    'tomorrow', case when nxt is null then null else public.nusuk_quiz_opens(nxt, 0) end,
    'slots', slots,
    'today_points', (select coalesce(sum(points), 0) from public.nusuk_quiz_answers where player_id = pid and day = d),
    'total', coalesce(me_points, 0),
    'rank', me_rank,
    'prev_rank', me_prev,
    'players', (select count(*) from public.nusuk_quiz_ranks()),
    'streak', streak
  );
end $$;
grant execute on function public.nusuk_quiz_state(uuid) to anon, authenticated;

-- ---------- Answer: only while visible and inside the date range ----------
create or replace function public.nusuk_quiz_answer(p_token uuid, p_slot int, p_choice int)
returns jsonb
language plpgsql volatile security definer set search_path = public as $$
declare
  s public.nusuk_quiz_settings;
  pid int := public.nusuk_quiz_player_of(p_token);
  d date := public.nusuk_today();
  q public.nusuk_quiz_questions;
  ok boolean;
begin
  if pid is null then return jsonb_build_object('ok', false, 'reason', 'signed_out'); end if;
  select * into s from public.nusuk_quiz_settings where id = 1;
  if not public.nusuk_quiz_visible() or not public.nusuk_quiz_running(d) then return jsonb_build_object('ok', false, 'reason', 'closed'); end if;
  if p_slot is null or p_slot < 0 or p_slot >= s.per_day then return jsonb_build_object('ok', false, 'reason', 'bad'); end if;
  if now() < public.nusuk_quiz_opens(d, p_slot) then return jsonb_build_object('ok', false, 'reason', 'locked'); end if;
  if now() >= public.nusuk_quiz_closes(d) then return jsonb_build_object('ok', false, 'reason', 'missed'); end if;
  perform public.nusuk_quiz_ensure_day(d);
  select qq.* into q from public.nusuk_quiz_days qd join public.nusuk_quiz_questions qq on qq.id = qd.question_id
   where qd.day = d and qd.slot = p_slot;
  if q.id is null then return jsonb_build_object('ok', false, 'reason', 'locked'); end if;
  if p_choice is null or p_choice < 0 or p_choice >= jsonb_array_length(q.options) then return jsonb_build_object('ok', false, 'reason', 'bad'); end if;
  ok := p_choice = q.correct;
  insert into public.nusuk_quiz_answers (player_id, day, slot, question_id, choice, correct, points)
  values (pid, d, p_slot, q.id, p_choice, ok, case when ok then s.points else 0 end)
  on conflict do nothing;
  if not found then return jsonb_build_object('ok', false, 'reason', 'answered'); end if;
  return jsonb_build_object('ok', true, 'right', ok, 'correct', q.correct, 'points', case when ok then s.points else 0 end, 'explanation', q.explanation);
end $$;
grant execute on function public.nusuk_quiz_answer(uuid, int, int) to anon, authenticated;

-- ---------- 50 new questions (once) ----------
do $$
begin
  if exists (select 1 from public.nusuk_quiz_questions where question like 'রাসূলুল্লাহ (সা.) কোন বছর জন্মগ্রহণ করেন%') then return; end if;

  -- Old questions OFF (kept, so answers and points already given stay)
  update public.nusuk_quiz_questions set active = false where active;
  -- Re-pick days that haven't started: future days, and today's slots nobody answered yet
  delete from public.nusuk_quiz_days where day > public.nusuk_today();
  delete from public.nusuk_quiz_days d where d.day = public.nusuk_today()
     and not exists (select 1 from public.nusuk_quiz_answers a where a.day = d.day and a.slot = d.slot);

  insert into public.nusuk_quiz_questions (question, options, correct, explanation) values
  -- ===== সীরাত: জন্ম ও শৈশব =====
  ('রাসূলুল্লাহ (সা.) কোন বছর জন্মগ্রহণ করেন বলে প্রসিদ্ধ?', '["আমুল হুযন (শোকের বছর)","আমুল ফীল (হস্তীর বছর)","হিজরতের বছর","বদর যুদ্ধের বছর"]', 1, 'আবরাহার হস্তীবাহিনী যে বছর কাবা আক্রমণ করতে এসেছিল, সে বছরই রাসূলুল্লাহ (সা.) জন্মগ্রহণ করেন (আনুমানিক ৫৭০/৫৭১ খ্রিস্টাব্দ)।'),
  ('রাসূলুল্লাহ (সা.)-এর সম্মানিত পিতার নাম কী?', '["আবদুল্লাহ","আবদুল মুত্তালিব","আবু তালিব","হামজা"]', 0, 'রাসূলুল্লাহ (সা.)-এর জন্মের আগেই তাঁর পিতা আবদুল্লাহ ইন্তেকাল করেন।'),
  ('রাসূলুল্লাহ (সা.)-এর দাদার নাম কী?', '["আবু তালিব","হাশিম","আব্বাস","আবদুল মুত্তালিব"]', 3, 'মা আমিনার ইন্তেকালের পর দাদা আবদুল মুত্তালিব তাঁকে লালন-পালন করেন।'),
  ('শৈশবে রাসূলুল্লাহ (সা.) বনু সাদ গোত্রে কোন দুধমায়ের কাছে লালিত হন?', '["উম্মে আইমান","সুমাইয়া","হালিমা সাদিয়া","উম্মে সালামা"]', 2, 'আরবের রীতি অনুযায়ী শিশুকে মরুভূমির পরিবেশে বড় করতে হালিমা সাদিয়ার কাছে দেওয়া হয়।'),
  ('রাসূলুল্লাহ (সা.)-এর মা আমিনা কোন স্থানে ইন্তেকাল করেন?', '["মক্কা","আবওয়া","তায়েফ","জেদ্দা"]', 1, 'মদিনা থেকে মক্কায় ফেরার পথে আবওয়া নামক স্থানে তিনি ইন্তেকাল করেন।'),
  ('মা আমিনার ইন্তেকালের সময় রাসূলুল্লাহ (সা.)-এর বয়স কত ছিল?', '["৬ বছর","২ বছর","১০ বছর","১২ বছর"]', 0, null),
  ('দাদা আবদুল মুত্তালিবের ইন্তেকালের পর কে রাসূলুল্লাহ (সা.)-কে লালন-পালন করেন?', '["চাচা আব্বাস","চাচা হামজা","চাচা আবু লাহাব","চাচা আবু তালিব"]', 3, 'আবু তালিব আজীবন ভাতিজাকে আগলে রেখেছিলেন।'),
  ('রাসূলুল্লাহ (সা.) কোন বংশের কোন শাখায় জন্মগ্রহণ করেন?', '["কুরাইশ বংশের বনু উমাইয়া","আউস গোত্র","কুরাইশ বংশের বনু হাশিম","খাযরাজ গোত্র"]', 2, null),
  ('সত্যবাদিতা ও বিশ্বস্ততার জন্য মক্কাবাসী নবুওয়তের আগেই রাসূলুল্লাহ (সা.)-কে কী উপাধি দিয়েছিল?', '["আল-ফারুক","আল-আমিন","আস-সিদ্দিক","যুন-নুরাইন"]', 1, 'আল-আমিন অর্থ বিশ্বস্ত।'),
  ('নবুওয়তের আগে কাবা পুনর্নির্মাণের সময় হাজরে আসওয়াদ স্থাপন নিয়ে গোত্রগুলোর বিরোধ কে মীমাংসা করেন?', '["মুহাম্মদ (সা.)","আবু তালিব","আবদুল মুত্তালিব","ওয়ারাকা ইবনে নওফেল"]', 0, 'তিনি চাদরে পাথরটি রেখে সব গোত্রের নেতাদের একসাথে ধরতে বলেন, তারপর নিজ হাতে যথাস্থানে স্থাপন করেন।'),
  ('হযরত খাদিজা (রা.)-কে বিয়ের সময় রাসূলুল্লাহ (সা.)-এর বয়স কত ছিল?', '["২০ বছর","৩০ বছর","৪০ বছর","২৫ বছর"]', 3, 'তখন হযরত খাদিজা (রা.)-এর বয়স ছিল প্রসিদ্ধ মতে ৪০ বছর।'),

  -- ===== নবুওয়ত ও মক্কি জীবন =====
  ('প্রথম ওহি নাযিলের সময় রাসূলুল্লাহ (সা.)-এর বয়স কত ছিল?', '["২৫ বছর","৩৫ বছর","৪০ বছর","৫০ বছর"]', 2, null),
  ('প্রথম ওহি নিয়ে কোন ফেরেশতা এসেছিলেন?', '["মিকাইল (আ.)","জিবরাইল (আ.)","ইসরাফিল (আ.)","আজরাইল (আ.)"]', 1, null),
  ('প্রথম ওহি হিসেবে কোন সূরার প্রথম আয়াতগুলো নাযিল হয়?', '["সূরা আল-আলাক","সূরা আল-ফাতিহা","সূরা আল-মুদ্দাসসির","সূরা আল-কদর"]', 0, 'হেরা গুহায় সূরা আল-আলাকের প্রথম পাঁচটি আয়াত নাযিল হয়, যার শুরু "ইকরা" (পড়ো) দিয়ে।'),
  ('নারীদের মধ্যে সর্বপ্রথম ইসলাম গ্রহণ করেন কে?', '["হযরত ফাতিমা (রা.)","হযরত আয়েশা (রা.)","হযরত সুমাইয়া (রা.)","হযরত খাদিজা (রা.)"]', 3, null),
  ('কিশোরদের মধ্যে সর্বপ্রথম ইসলাম গ্রহণ করেন কে?', '["হযরত যায়েদ (রা.)","হযরত উসামা (রা.)","হযরত আলী (রা.)","হযরত ইবনে আব্বাস (রা.)"]', 2, null),
  ('প্রাপ্তবয়স্ক স্বাধীন পুরুষদের মধ্যে সর্বপ্রথম ইসলাম গ্রহণ করেন কে?', '["হযরত উমর (রা.)","হযরত আবু বকর (রা.)","হযরত উসমান (রা.)","হযরত হামজা (রা.)"]', 1, null),
  ('ইসলামের প্রথম শহীদ কে?', '["হযরত সুমাইয়া (রা.)","হযরত হামজা (রা.)","হযরত ইয়াসির (রা.)","হযরত মুসআব (রা.)"]', 0, 'আবু জাহেলের নির্যাতনে হযরত সুমাইয়া (রা.) শহীদ হন।'),
  ('ইসলামের প্রথম মুয়াজ্জিন কে?', '["হযরত আম্মার (রা.)","হযরত আবু হুরায়রা (রা.)","হযরত সালমান (রা.)","হযরত বিলাল (রা.)"]', 3, null),
  ('নির্যাতন থেকে বাঁচতে মুসলমানরা প্রথম কোন দেশে হিজরত করেন?', '["সিরিয়া","ইয়েমেন","হাবশা (আবিসিনিয়া)","মিসর"]', 2, null),
  ('হাবশায় হিজরতকারী মুসলমানদের আশ্রয় দিয়েছিলেন কোন বাদশাহ?', '["কায়সার","নাজাশি","কিসরা","মুকাওকিস"]', 1, null),
  ('কুরাইশরা বনু হাশিমকে শিআবে আবি তালিবে প্রায় কত বছর অবরুদ্ধ করে রেখেছিল?', '["৩ বছর","১ বছর","৫ বছর","৭ বছর"]', 0, null),
  ('হযরত খাদিজা (রা.) ও চাচা আবু তালিবের ইন্তেকালের বছরটি কী নামে পরিচিত?', '["আমুল ফীল","আমুল উফুদ","আমুল ফাতহ","আমুল হুযন (শোকের বছর)"]', 3, null),
  ('দাওয়াত দিতে গিয়ে রাসূলুল্লাহ (সা.) কোন শহরে পাথরের আঘাতে রক্তাক্ত হন?', '["জেদ্দা","খায়বার","তায়েফ","তাবুক"]', 2, null),
  ('ইসরার রাতে রাসূলুল্লাহ (সা.) মসজিদুল হারাম থেকে কোন মসজিদে গিয়েছিলেন?', '["মসজিদে কুবা","মসজিদুল আকসা","মসজিদে নববী","মসজিদে কিবলাতাইন"]', 1, 'সূরা বনি ইসরাইলের প্রথম আয়াতে এর বর্ণনা আছে।'),
  ('মিরাজের রাতে মুসলমানদের ওপর কোন ইবাদত ফরজ করা হয়?', '["পাঁচ ওয়াক্ত নামাজ","রোজা","যাকাত","হজ"]', 0, null),

  -- ===== হিজরত ও মাদানি জীবন =====
  ('হিজরতের সময় রাসূলুল্লাহ (সা.) কোন গুহায় তিন দিন আত্মগোপন করেছিলেন?', '["হেরা গুহা","উহুদ গুহা","কাহাফ গুহা","সাওর গুহা"]', 3, null),
  ('হিজরতের সময় রাসূলুল্লাহ (সা.)-এর সফরসঙ্গী কে ছিলেন?', '["হযরত আলী (রা.)","হযরত উমর (রা.)","হযরত আবু বকর (রা.)","হযরত উসমান (রা.)"]', 2, null),
  ('হিজরতের পথে মদিনার কাছে রাসূলুল্লাহ (সা.) কোন মসজিদ নির্মাণ করেন, যা ইসলামের প্রথম মসজিদ?', '["মসজিদে নববী","মসজিদে কুবা","মসজিদুল হারাম","মসজিদে কিবলাতাইন"]', 1, null),
  ('মদিনা শহরের পূর্ব নাম কী ছিল?', '["ইয়াসরিব","তায়েফ","বাক্কা","খায়বার"]', 0, null),
  ('মদিনায় পৌঁছে রাসূলুল্লাহ (সা.) প্রথমে কোন সাহাবির বাড়িতে অবস্থান করেন?', '["হযরত সাদ ইবনে মুয়াজ (রা.)","হযরত উবাই ইবনে কাব (রা.)","হযরত মুআজ ইবনে জাবাল (রা.)","হযরত আবু আইয়ুব আনসারি (রা.)"]', 3, null),
  ('মক্কা থেকে মদিনায় হিজরতকারী সাহাবিদের কী বলা হয়?', '["আনসার","তাবেয়ি","মুহাজির","বদরি"]', 2, 'আর মদিনার যে মুসলমানরা তাদের আশ্রয় দিয়েছিলেন, তাদের বলা হয় আনসার।'),
  ('কিবলা বায়তুল মুকাদ্দাস থেকে কাবার দিকে পরিবর্তন হয় কোন হিজরিতে?', '["১ম হিজরি","২য় হিজরি","৫ম হিজরি","৮ম হিজরি"]', 1, null),
  ('বদর যুদ্ধে মুসলিম যোদ্ধার সংখ্যা প্রায় কত ছিল?', '["৩১৩ জন","৭০০ জন","১,০০০ জন","৩,০০০ জন"]', 0, null),
  ('উহুদ যুদ্ধে শহীদ হওয়া রাসূলুল্লাহ (সা.)-এর কোন চাচাকে "সাইয়্যিদুশ শুহাদা" বলা হয়?', '["হযরত আব্বাস (রা.)","হযরত আবু তালিব","হযরত জাফর (রা.)","হযরত হামজা (রা.)"]', 3, null),
  ('খন্দকের যুদ্ধে মদিনার চারপাশে পরিখা খননের পরামর্শ কে দিয়েছিলেন?', '["হযরত আবু বকর (রা.)","হযরত খালিদ ইবনে ওয়ালিদ (রা.)","হযরত সালমান ফারসি (রা.)","হযরত আলী (রা.)"]', 2, null),
  ('হুদায়বিয়ার সন্ধি কোন হিজরিতে হয়?', '["৪র্থ হিজরি","৬ষ্ঠ হিজরি","৮ম হিজরি","১০ম হিজরি"]', 1, 'কুরআনে এই সন্ধিকে "স্পষ্ট বিজয়" বলা হয়েছে (সূরা আল-ফাতহ)।'),
  ('মক্কা বিজয় হয় কোন হিজরিতে?', '["৮ম হিজরি","৬ষ্ঠ হিজরি","৭ম হিজরি","৯ম হিজরি"]', 0, null),
  ('বিদায় হজ কোন হিজরিতে অনুষ্ঠিত হয়?', '["৮ম হিজরি","৯ম হিজরি","১১তম হিজরি","১০ম হিজরি"]', 3, null),
  ('বিদায় হজের ঐতিহাসিক ভাষণ রাসূলুল্লাহ (সা.) কোথায় দিয়েছিলেন?', '["মিনা","মসজিদে নববী","আরাফার ময়দান","মসজিদে কুবা"]', 2, null),
  ('রাসূলুল্লাহ (সা.) কত বছর বয়সে ইন্তেকাল করেন?', '["৬০ বছর","৬৩ বছর","৬১ বছর","৬৫ বছর"]', 1, 'তিনি ১১ হিজরিতে মদিনায় ইন্তেকাল করেন।'),

  -- ===== মক্কার ইতিহাস ও স্থান =====
  ('কাবা ঘরের কোণে স্থাপিত কালো পাথরটির নাম কী?', '["হাজরে আসওয়াদ","মাকামে ইবরাহিম","রুকনে ইয়ামানি","হাতিম"]', 0, null),
  ('কাবার সামনে হযরত ইবরাহিম (আ.)-এর পায়ের ছাপসহ পাথরটি কী নামে পরিচিত?', '["হাজরে আসওয়াদ","মুলতাযাম","মিযাবে রহমত","মাকামে ইবরাহিম"]', 3, null),
  ('জমজম কূপের পানি প্রথম কার জন্য প্রবাহিত হয়েছিল?', '["হযরত ইবরাহিম (আ.)","হযরত মুসা (আ.)","শিশু ইসমাইল (আ.) ও মা হাজেরা","আবদুল মুত্তালিব"]', 2, 'পরে আবদুল মুত্তালিব স্বপ্নের নির্দেশে চাপা পড়া কূপটি আবার খনন করেন।'),
  ('সাফা ও মারওয়া পাহাড়ের মাঝে সাঈ কার স্মৃতি বহন করে?', '["হযরত হাওয়া (আ.)","হযরত হাজেরা (আ.)","হযরত সারা (আ.)","হযরত মারইয়াম (আ.)"]', 1, 'পানির খোঁজে তিনি সাতবার এই দুই পাহাড়ের মাঝে দৌড়েছিলেন।'),
  ('আবরাহার হস্তীবাহিনী কোন পাখির নিক্ষেপ করা পাথরে ধ্বংস হয়? (সূরা আল-ফীল)', '["আবাবিল","হুদহুদ","কবুতর","বাজপাখি"]', 0, null),

  -- ===== মদিনার ইতিহাস ও স্থান =====
  ('মসজিদে নববীর কোন অংশকে হাদিসে "জান্নাতের বাগানসমূহের একটি বাগান" বলা হয়েছে?', '["বাবুস সালাম","সুফফা","মিহরাব","রিয়াজুল জান্নাহ"]', 3, 'রাসূলুল্লাহ (সা.)-এর ঘর ও মিম্বরের মাঝের অংশ। (বুখারি ও মুসলিম)'),
  ('মদিনার কোন কবরস্থানে বহু সাহাবি ও আহলে বাইত শায়িত আছেন?', '["জান্নাতুল মুআল্লা","শুহাদায়ে উহুদ","জান্নাতুল বাকি","মাকবারাতুল হাজুন"]', 2, null),
  ('উহুদ পাহাড় কোন শহরের কাছে অবস্থিত?', '["মক্কা","মদিনা","তায়েফ","জেদ্দা"]', 1, 'রাসূলুল্লাহ (সা.) বলেছেন: উহুদ এমন পাহাড়, যে আমাদের ভালোবাসে আর আমরাও তাকে ভালোবাসি। (বুখারি)'),
  ('হাদিস অনুযায়ী মসজিদে নববীতে এক ওয়াক্ত নামাজ (মসজিদুল হারাম ছাড়া) অন্য মসজিদের তুলনায় কত গুণ উত্তম?', '["১,০০০ গুণ","১০ গুণ","১০০ গুণ","১,০০,০০০ গুণ"]', 0, '(বুখারি ও মুসলিম)'),
  ('মদিনার কোন মসজিদে নামাজ পড়া অবস্থায় কিবলা পরিবর্তনের আদেশ আসে বলে প্রসিদ্ধ?', '["মসজিদে কুবা","মসজিদে জুমা","মসজিদে গামামা","মসজিদে কিবলাতাইন"]', 3, 'কিবলাতাইন অর্থ দুই কিবলার মসজিদ।');
end $$;

notify pgrst, 'reload schema';
