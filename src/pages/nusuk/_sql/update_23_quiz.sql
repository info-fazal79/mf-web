-- =====================================================================
-- Nusuk · update 23 · daily quiz with player IDs and a leaderboard
-- Run once in Supabase → SQL Editor (after update 11), BEFORE pushing the
-- version with the quiz section. Safe to run again.
--
-- How it works
--   • A visitor makes a quiz ID with their name + Nusuk code. The code must
--     already be in the code list (any status except rejected). IDs start at
--     1000 and go up (1000, 1001, …). One code = one ID.
--   • The same browser stays signed in. On a new device they sign in with
--     their ID + the last 4 characters of their Nusuk code (IDs are shown on
--     the public leaderboard, so the ID alone is not enough).
--   • Every day N questions (default 5) open one by one between the start and
--     end time (default 09:00–21:00 Bangladesh time). A question that has
--     opened can be answered until the end time. One answer per question.
--   • Correct answers are checked here on the server and never sent to the
--     browser before the visitor answers.
--   • Leaderboard = points since the season start (Settings → new season),
--     with movement compared to the end of yesterday.
-- =====================================================================

-- ---------- Settings (one row) ----------
create table if not exists public.nusuk_quiz_settings (
  id            int primary key default 1 check (id = 1),
  enabled       boolean not null default true,
  title         text not null default 'দৈনিক ইসলামিক কুইজ',
  start_min     int not null default 540  check (start_min between 0 and 1439),   -- 09:00
  end_min       int not null default 1260 check (end_min between 1 and 1440),     -- 21:00
  per_day       int not null default 5    check (per_day between 1 and 20),
  points        int not null default 10   check (points between 1 and 1000),
  season_start  date not null default (now() at time zone 'Asia/Dhaka')::date,
  updated_at    timestamptz not null default now(),
  check (end_min > start_min)
);
insert into public.nusuk_quiz_settings (id) values (1) on conflict (id) do nothing;

-- ---------- Questions ----------
create table if not exists public.nusuk_quiz_questions (
  id           bigint generated always as identity primary key,
  question     text not null check (char_length(question) between 3 and 500),
  options      jsonb not null check (jsonb_typeof(options) = 'array' and jsonb_array_length(options) between 2 and 6),
  correct      int not null check (correct >= 0),
  explanation  text check (char_length(explanation) <= 1000),
  active       boolean not null default true,
  created_at   timestamptz not null default now(),
  check (correct < jsonb_array_length(options))
);

-- ---------- Players ----------
create sequence if not exists public.nusuk_quiz_player_seq start 1000 minvalue 1000;
create table if not exists public.nusuk_quiz_players (
  id          int primary key default nextval('public.nusuk_quiz_player_seq'),
  name        text not null check (char_length(name) between 1 and 60),
  code_id     bigint not null unique references public.nusuk_codes(id) on delete cascade,
  created_at  timestamptz not null default now()
);
alter sequence public.nusuk_quiz_player_seq owned by public.nusuk_quiz_players.id;

-- Signed-in browsers (one row per device)
create table if not exists public.nusuk_quiz_tokens (
  token       uuid primary key default gen_random_uuid(),
  player_id   int not null references public.nusuk_quiz_players(id) on delete cascade,
  created_at  timestamptz not null default now()
);
create index if not exists nusuk_quiz_tokens_player_idx on public.nusuk_quiz_tokens (player_id);

-- The questions chosen for each day (fixed once chosen, same for everyone)
create table if not exists public.nusuk_quiz_days (
  day          date not null,
  slot         int not null,
  question_id  bigint not null references public.nusuk_quiz_questions(id) on delete cascade,
  primary key (day, slot)
);

create table if not exists public.nusuk_quiz_answers (
  player_id    int not null references public.nusuk_quiz_players(id) on delete cascade,
  day          date not null,
  slot         int not null,
  question_id  bigint not null references public.nusuk_quiz_questions(id) on delete cascade,
  choice       int not null,
  correct      boolean not null,
  points       int not null default 0,
  answered_at  timestamptz not null default now(),
  primary key (player_id, day, slot)
);
create index if not exists nusuk_quiz_answers_day_idx on public.nusuk_quiz_answers (day);

-- Admin can read and manage everything; visitors only go through the functions below
do $$
declare t text;
begin
  foreach t in array array['nusuk_quiz_settings','nusuk_quiz_questions','nusuk_quiz_players','nusuk_quiz_tokens','nusuk_quiz_days','nusuk_quiz_answers'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "%s: admin all" on public.%I', t, t);
    execute format('create policy "%s: admin all" on public.%I for all using (public.is_admin()) with check (public.is_admin())', t, t);
  end loop;
end $$;

-- ---------- Internal helpers ----------
-- Opening time of a slot (timestamptz) on a Bangladesh date
create or replace function public.nusuk_quiz_opens(p_day date, p_slot int)
returns timestamptz
language sql stable security definer set search_path = public as $$
  select ((p_day::timestamp + make_interval(mins => s.start_min + (p_slot * (s.end_min - s.start_min)) / s.per_day)) at time zone 'Asia/Dhaka')
  from public.nusuk_quiz_settings s where s.id = 1;
$$;
create or replace function public.nusuk_quiz_closes(p_day date)
returns timestamptz
language sql stable security definer set search_path = public as $$
  select ((p_day::timestamp + make_interval(mins => s.end_min)) at time zone 'Asia/Dhaka')
  from public.nusuk_quiz_settings s where s.id = 1;
$$;

-- Choose today's questions once: least-used active questions first, random among equals
create or replace function public.nusuk_quiz_ensure_day(p_day date)
returns void
language plpgsql volatile security definer set search_path = public as $$
declare
  n int;
  have int;
begin
  select per_day into n from public.nusuk_quiz_settings where id = 1;
  select count(*) into have from public.nusuk_quiz_days where day = p_day;
  if have >= n then return; end if;
  insert into public.nusuk_quiz_days (day, slot, question_id)
  select p_day, have - 1 + row_number() over (), q.id
  from (
    select qq.id
    from public.nusuk_quiz_questions qq
    left join (select question_id, count(*) used from public.nusuk_quiz_days group by question_id) u on u.question_id = qq.id
    where qq.active
      and qq.id not in (select question_id from public.nusuk_quiz_days where day = p_day)
    order by coalesce(u.used, 0), random()
    limit n - have
  ) q
  on conflict do nothing;
end $$;
revoke all on function public.nusuk_quiz_ensure_day(date) from public, anon, authenticated;

create or replace function public.nusuk_quiz_player_of(p_token uuid)
returns int
language sql stable security definer set search_path = public as $$
  select player_id from public.nusuk_quiz_tokens where token = p_token;
$$;
revoke all on function public.nusuk_quiz_player_of(uuid) from public, anon, authenticated;

-- Leaderboard rows: rank now and rank at the end of yesterday
create or replace function public.nusuk_quiz_ranks()
returns table (player_id int, name text, points bigint, correct bigint, rank bigint, prev_rank bigint)
language sql stable security definer set search_path = public as $$
  with s as (select season_start from public.nusuk_quiz_settings where id = 1),
  t as (
    select a.player_id,
           sum(a.points) as points,
           count(*) filter (where a.correct) as correct,
           sum(a.points) filter (where a.day < public.nusuk_today()) as prev_points,
           max(a.answered_at) filter (where a.correct) as last_ok
    from public.nusuk_quiz_answers a, s
    where a.day >= s.season_start
    group by a.player_id
  ),
  now_r as (
    select t.*, rank() over (order by t.points desc, t.last_ok asc nulls last) as rank from t where t.points > 0
  ),
  prev_r as (
    select t.player_id, rank() over (order by t.prev_points desc) as prev_rank from t where coalesce(t.prev_points, 0) > 0
  )
  select n.player_id, p.name, n.points, n.correct, n.rank, pr.prev_rank
  from now_r n
  join public.nusuk_quiz_players p on p.id = n.player_id
  left join prev_r pr on pr.player_id = n.player_id;
$$;
revoke all on function public.nusuk_quiz_ranks() from public, anon, authenticated;

-- ---------- Public: section on the page (title, top players, schedule) ----------
create or replace function public.nusuk_quiz_public(p_limit int default 5)
returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  s public.nusuk_quiz_settings;
  d date := public.nusuk_today();
begin
  select * into s from public.nusuk_quiz_settings where id = 1;
  if s is null or not s.enabled then return jsonb_build_object('enabled', false); end if;
  return jsonb_build_object(
    'enabled', true,
    'title', s.title,
    'per_day', s.per_day,
    'points', s.points,
    'season_start', s.season_start,
    'now', now(),
    'opens', (select jsonb_agg(public.nusuk_quiz_opens(d, g) order by g) from generate_series(0, s.per_day - 1) g),
    'closes', public.nusuk_quiz_closes(d),
    'players', (select count(*) from public.nusuk_quiz_players),
    'board', (
      select coalesce(jsonb_agg(jsonb_build_object('rank', r.rank, 'prev', r.prev_rank, 'id', r.player_id, 'name', r.name, 'points', r.points, 'correct', r.correct) order by r.rank, r.player_id), '[]'::jsonb)
      from (select * from public.nusuk_quiz_ranks() order by rank, player_id limit least(greatest(coalesce(p_limit, 5), 1), 200)) r
    )
  );
end $$;
grant execute on function public.nusuk_quiz_public(int) to anon, authenticated;

-- ---------- Public: make an ID ----------
-- reasons: closed · name · invalid · not_found (code not in the list) · rejected
create or replace function public.nusuk_quiz_register(p_name text, p_code text)
returns jsonb
language plpgsql volatile security definer set search_path = public as $$
declare
  v_name text := left(trim(coalesce(p_name, '')), 60);
  v_code text := regexp_replace(coalesce(p_code, ''), '\s', '', 'g');
  c public.nusuk_codes;
  pl public.nusuk_quiz_players;
  tok uuid;
begin
  if not exists (select 1 from public.nusuk_quiz_settings where id = 1 and enabled) then
    return jsonb_build_object('ok', false, 'reason', 'closed');
  end if;
  if v_name = '' then return jsonb_build_object('ok', false, 'reason', 'name'); end if;
  if v_code !~ '^NG-[A-Za-z0-9]{8}$' then return jsonb_build_object('ok', false, 'reason', 'invalid'); end if;
  select * into c from public.nusuk_codes where lower(code) = lower(v_code) limit 1;
  if c.id is null then return jsonb_build_object('ok', false, 'reason', 'not_found'); end if;
  if c.status = 'rejected' then return jsonb_build_object('ok', false, 'reason', 'rejected'); end if;

  select * into pl from public.nusuk_quiz_players where code_id = c.id;
  if pl.id is null then
    insert into public.nusuk_quiz_players (name, code_id) values (v_name, c.id)
    on conflict (code_id) do nothing
    returning * into pl;
    if pl.id is null then select * into pl from public.nusuk_quiz_players where code_id = c.id; end if;
    insert into public.nusuk_quiz_tokens (player_id) values (pl.id) returning token into tok;
    return jsonb_build_object('ok', true, 'id', pl.id, 'name', pl.name, 'token', tok, 'existing', false);
  end if;
  -- This code already has an ID: give it back (the person knows the full code)
  insert into public.nusuk_quiz_tokens (player_id) values (pl.id) returning token into tok;
  return jsonb_build_object('ok', true, 'id', pl.id, 'name', pl.name, 'token', tok, 'existing', true);
end $$;
grant execute on function public.nusuk_quiz_register(text, text) to anon, authenticated;

-- ---------- Public: sign in on a new device (ID + last 4 characters of the code) ----------
create or replace function public.nusuk_quiz_login(p_id int, p_last4 text)
returns jsonb
language plpgsql volatile security definer set search_path = public as $$
declare
  pl public.nusuk_quiz_players;
  v_code text;
  tok uuid;
begin
  select * into pl from public.nusuk_quiz_players where id = p_id;
  if pl.id is null then return jsonb_build_object('ok', false, 'reason', 'no_id'); end if;
  select code into v_code from public.nusuk_codes where id = pl.code_id;
  if lower(right(v_code, 4)) <> lower(right(regexp_replace(coalesce(p_last4, ''), '\s', '', 'g'), 4)) then
    return jsonb_build_object('ok', false, 'reason', 'wrong');
  end if;
  insert into public.nusuk_quiz_tokens (player_id) values (pl.id) returning token into tok;
  return jsonb_build_object('ok', true, 'id', pl.id, 'name', pl.name, 'token', tok);
end $$;
grant execute on function public.nusuk_quiz_login(int, text) to anon, authenticated;

-- ---------- Public: my quiz today ----------
create or replace function public.nusuk_quiz_state(p_token uuid)
returns jsonb
language plpgsql volatile security definer set search_path = public as $$
declare
  s public.nusuk_quiz_settings;
  pid int := public.nusuk_quiz_player_of(p_token);
  pl public.nusuk_quiz_players;
  d date := public.nusuk_today();
  closes timestamptz;
  slots jsonb;
  me_points bigint;
  me_rank bigint;
  me_prev bigint;
  streak int := 0;
  k date;
begin
  if pid is null then return jsonb_build_object('ok', false, 'reason', 'signed_out'); end if;
  select * into s from public.nusuk_quiz_settings where id = 1;
  if not s.enabled then return jsonb_build_object('ok', false, 'reason', 'closed'); end if;
  select * into pl from public.nusuk_quiz_players where id = pid;
  perform public.nusuk_quiz_ensure_day(d);
  closes := public.nusuk_quiz_closes(d);

  select coalesce(jsonb_agg(x.j order by x.slot), '[]'::jsonb) into slots from (
    select g.slot, jsonb_strip_nulls(jsonb_build_object(
      'slot', g.slot,
      'opens', public.nusuk_quiz_opens(d, g.slot),
      'status', case
        when a.player_id is not null then 'answered'
        when now() >= closes then 'missed'
        when now() >= public.nusuk_quiz_opens(d, g.slot) and qd.question_id is not null then 'open'
        else 'locked' end,
      -- the question is sent only once it is open (or answered)
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

  select r.points, r.rank, r.prev_rank into me_points, me_rank, me_prev from public.nusuk_quiz_ranks() r where r.player_id = pid;

  -- Days in a row with at least one answer (today counts once answered; otherwise from yesterday)
  k := case when exists (select 1 from public.nusuk_quiz_answers where player_id = pid and day = d) then d else d - 1 end;
  while exists (select 1 from public.nusuk_quiz_answers where player_id = pid and day = k) loop
    streak := streak + 1;
    k := k - 1;
  end loop;

  return jsonb_build_object(
    'ok', true,
    'now', now(),
    'id', pl.id,
    'name', pl.name,
    'code', (select left(code, 3) || '•••' || right(code, 4) from public.nusuk_codes where id = pl.code_id),
    'points_each', s.points,
    'closes', closes,
    'tomorrow', public.nusuk_quiz_opens(d + 1, 0),
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

-- ---------- Public: answer a question ----------
-- reasons: signed_out · closed · locked · answered · missed · bad
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
  if not s.enabled then return jsonb_build_object('ok', false, 'reason', 'closed'); end if;
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

-- ---------- Public: sign out this device ----------
create or replace function public.nusuk_quiz_logout(p_token uuid)
returns void
language sql volatile security definer set search_path = public as $$
  delete from public.nusuk_quiz_tokens where token = p_token;
$$;
grant execute on function public.nusuk_quiz_logout(uuid) to anon, authenticated;

-- ---------- Admin: leaderboard with codes, today's schedule ----------
create or replace function public.nusuk_admin_quiz()
returns jsonb
language plpgsql volatile security definer set search_path = public as $$
declare d date := public.nusuk_today();
begin
  if not public.is_admin() then raise exception 'not allowed'; end if;
  perform public.nusuk_quiz_ensure_day(d);
  return jsonb_build_object(
    'today', d,
    'players', (select count(*) from public.nusuk_quiz_players),
    'new_today', (select count(*) from public.nusuk_quiz_players where (created_at at time zone 'Asia/Dhaka')::date = d),
    'answers_today', (select count(*) from public.nusuk_quiz_answers where day = d),
    'correct_today', (select count(*) from public.nusuk_quiz_answers where day = d and correct),
    'questions', (select count(*) from public.nusuk_quiz_questions where active),
    'schedule', (
      select coalesce(jsonb_agg(jsonb_build_object('slot', qd.slot, 'opens', public.nusuk_quiz_opens(d, qd.slot), 'question_id', q.id, 'question', q.question,
               'answers', (select count(*) from public.nusuk_quiz_answers a where a.day = d and a.slot = qd.slot),
               'right', (select count(*) from public.nusuk_quiz_answers a where a.day = d and a.slot = qd.slot and a.correct)) order by qd.slot), '[]'::jsonb)
      from public.nusuk_quiz_days qd join public.nusuk_quiz_questions q on q.id = qd.question_id where qd.day = d
    ),
    'board', (
      select coalesce(jsonb_agg(jsonb_build_object('rank', r.rank, 'id', r.player_id, 'name', r.name, 'points', r.points, 'correct', r.correct, 'code', c.code) order by r.rank, r.player_id), '[]'::jsonb)
      from (select * from public.nusuk_quiz_ranks() order by rank, player_id limit 300) r
      join public.nusuk_quiz_players p on p.id = r.player_id
      join public.nusuk_codes c on c.id = p.code_id
    )
  );
end $$;
revoke all on function public.nusuk_admin_quiz() from public, anon;
grant execute on function public.nusuk_admin_quiz() to authenticated;

-- ---------- Starter questions (only when the list is empty) ----------
do $$
begin
  if exists (select 1 from public.nusuk_quiz_questions) then return; end if;
  insert into public.nusuk_quiz_questions (question, options, correct, explanation) values
  ('ইসলামের মূল স্তম্ভ কয়টি?', '["৩টি","৪টি","৫টি","৬টি"]', 2, 'কালিমা (ঈমান), নামাজ, যাকাত, রোজা ও হজ: এই পাঁচটি।'),
  ('পবিত্র কুরআনে মোট কতটি সূরা আছে?', '["১১০টি","১১২টি","১১৪টি","১২০টি"]', 2, null),
  ('পবিত্র কুরআনের প্রথম সূরা কোনটি?', '["সূরা আল-বাকারা","সূরা আল-ফাতিহা","সূরা আল-ইখলাস","সূরা আন-নাস"]', 1, null),
  ('পবিত্র কুরআনের সবচেয়ে বড় সূরা কোনটি?', '["সূরা আলে ইমরান","সূরা আন-নিসা","সূরা আল-বাকারা","সূরা ইয়াসিন"]', 2, 'সূরা আল-বাকারায় ২৮৬টি আয়াত আছে।'),
  ('পবিত্র কুরআনের সবচেয়ে ছোট সূরা কোনটি?', '["সূরা আল-কাউসার","সূরা আল-ইখলাস","সূরা আল-আসর","সূরা আন-নাস"]', 0, 'সূরা আল-কাউসারে মাত্র ৩টি আয়াত।'),
  ('পবিত্র কুরআনে কতটি পারা (জুয) আছে?', '["২০টি","২৫টি","৩০টি","৪০টি"]', 2, null),
  ('দৈনিক ফরজ নামাজ কত ওয়াক্ত?', '["৩ ওয়াক্ত","৪ ওয়াক্ত","৫ ওয়াক্ত","৬ ওয়াক্ত"]', 2, 'ফজর, যোহর, আসর, মাগরিব ও এশা।'),
  ('কোন নামাজের আযানে "আস-সালাতু খাইরুম মিনান নাওম" বলা হয়?', '["ফজর","যোহর","মাগরিব","এশা"]', 0, 'অর্থ: ঘুমের চেয়ে নামাজ উত্তম।'),
  ('জুমার নামাজ সপ্তাহের কোন দিনে আদায় করা হয়?', '["বৃহস্পতিবার","শুক্রবার","শনিবার","সোমবার"]', 1, null),
  ('হাদিস অনুযায়ী কোন সূরা পড়া ছাড়া নামাজ হয় না?', '["সূরা আল-ইখলাস","সূরা আল-ফাতিহা","সূরা আল-কাউসার","সূরা আন-নাস"]', 1, 'রাসূলুল্লাহ (সা.) বলেছেন: যে সূরা ফাতিহা পড়ে না, তার নামাজ হয় না। (বুখারি ও মুসলিম)'),
  ('পানি না পেলে পবিত্রতা অর্জনের জন্য কী করা হয়?', '["তায়াম্মুম","ইস্তিঞ্জা","গোসল","মাসেহ"]', 0, 'তায়াম্মুম পবিত্র মাটি দিয়ে করা হয়।'),
  ('সোনা-রূপা ও নগদ অর্থের যাকাতের হার কত?', '["১%","২.৫%","৫%","১০%"]', 1, 'নিসাব পরিমাণ সম্পদ এক বছর থাকলে তার আড়াই শতাংশ।'),
  ('রমজান হিজরি সনের কততম মাস?', '["৭ম","৮ম","৯ম","১০ম"]', 2, null),
  ('হিজরি সনের প্রথম মাস কোনটি?', '["রমজান","মুহাররম","রবিউল আউয়াল","শাওয়াল"]', 1, null),
  ('পবিত্র কুরআন নাযিল শুরু হয় কোন মাসে?', '["শাবান","রমজান","মুহাররম","জিলহজ"]', 1, null),
  ('লাইলাতুল কদর কোন মাসে?', '["শাবান","রজব","রমজান","জিলহজ"]', 2, 'রমজানের শেষ দশকের বেজোড় রাতগুলোতে খোঁজার কথা হাদিসে এসেছে।'),
  ('হজ কোন আরবি মাসে পালন করা হয়?', '["রমজান","শাওয়াল","জিলকদ","জিলহজ"]', 3, null),
  ('হজের সময় আরাফার ময়দানে অবস্থান করা হয় কোন তারিখে?', '["৮ জিলহজ","৯ জিলহজ","১০ জিলহজ","১১ জিলহজ"]', 1, null),
  ('ঈদুল আযহা কোন তারিখে?', '["১ শাওয়াল","১০ মুহাররম","১০ জিলহজ","১২ রবিউল আউয়াল"]', 2, null),
  ('উমরাহতে কাবা শরীফ কতবার প্রদক্ষিণ (তাওয়াফ) করতে হয়?', '["৩ বার","৫ বার","৭ বার","১০ বার"]', 2, null),
  ('সাফা ও মারওয়া পাহাড়ের মাঝে কতবার সাঈ করতে হয়?', '["৩ বার","৫ বার","৭ বার","৯ বার"]', 2, 'সাফা থেকে শুরু করে মারওয়ায় গিয়ে শেষ হয়।'),
  ('ইহরাম অবস্থায় পুরুষেরা কী পরিধান করেন?', '["সাদা পাঞ্জাবি","সেলাইবিহীন দুই টুকরো কাপড়","জুব্বা","যেকোনো পোশাক"]', 1, null),
  ('"লাব্বাইক আল্লাহুম্মা লাব্বাইক" পাঠকে কী বলা হয়?', '["তাকবির","তাসবিহ","তালবিয়া","তাহলিল"]', 2, null),
  ('হজে মিনায় শয়তানকে কংকর নিক্ষেপ করাকে কী বলে?', '["সাঈ","রমি","তাওয়াফ","উকুফ"]', 1, null),
  ('জমজম কূপ কোথায় অবস্থিত?', '["মসজিদে নববী","মসজিদুল হারাম","মসজিদে কুবা","আরাফার ময়দান"]', 1, null),
  ('মসজিদে নববী কোন শহরে অবস্থিত?', '["মক্কা","মদিনা","তায়েফ","জেদ্দা"]', 1, null),
  ('রাসূলুল্লাহ (সা.)-এর রওজা মোবারক কোথায়?', '["মসজিদুল হারাম","মসজিদে কুবা","মসজিদে নববী","মসজিদুল আকসা"]', 2, null),
  ('মুসলমানদের প্রথম কিবলা কোনটি ছিল?', '["কাবা শরীফ","বায়তুল মুকাদ্দাস","মসজিদে নববী","মসজিদে কুবা"]', 1, null),
  ('মসজিদুল আকসা কোন শহরে অবস্থিত?', '["দামেস্ক","বাগদাদ","জেরুজালেম","কায়রো"]', 2, null),
  ('ইসলামের শেষ নবী কে?', '["হযরত ঈসা (আ.)","হযরত মুসা (আ.)","হযরত মুহাম্মদ (সা.)","হযরত ইবরাহিম (আ.)"]', 2, null),
  ('রাসূলুল্লাহ (সা.) কোন শহরে জন্মগ্রহণ করেন?', '["মদিনা","মক্কা","তায়েফ","জেরুজালেম"]', 1, null),
  ('রাসূলুল্লাহ (সা.)-এর সম্মানিত মায়ের নাম কী?', '["হযরত খাদিজা (রা.)","হযরত আমিনা","হযরত হালিমা","হযরত ফাতিমা (রা.)"]', 1, null),
  ('প্রথম ওহি কোন গুহায় নাযিল হয়?', '["সাওর গুহা","হেরা গুহা","উহুদ","বদর"]', 1, null),
  ('প্রথম নাযিল হওয়া আয়াতের প্রথম শব্দ কী?', '["বিসমিল্লাহ","কুল","ইকরা (পড়ো)","আলহামদু"]', 2, 'সূরা আল-আলাকের প্রথম আয়াত।'),
  ('রাসূলুল্লাহ (সা.) মক্কা থেকে মদিনায় হিজরত করেন কোন খ্রিস্টাব্দে?', '["৬১০","৬২২","৬৩০","৬৩২"]', 1, 'এই হিজরত থেকেই হিজরি সন গণনা শুরু।'),
  ('বদরের যুদ্ধ কোন হিজরিতে সংঘটিত হয়?', '["১ম হিজরি","২য় হিজরি","৩য় হিজরি","৫ম হিজরি"]', 1, null),
  ('ইসলামের প্রথম খলিফা কে?', '["হযরত উমর (রা.)","হযরত উসমান (রা.)","হযরত আবু বকর (রা.)","হযরত আলী (রা.)"]', 2, null),
  ('কোন নবীকে "খলিলুল্লাহ" (আল্লাহর বন্ধু) বলা হয়?', '["হযরত নূহ (আ.)","হযরত ইবরাহিম (আ.)","হযরত মুসা (আ.)","হযরত ইউসুফ (আ.)"]', 1, null),
  ('কাবা ঘর পুনর্নির্মাণ করেছিলেন কোন নবী ও তাঁর পুত্র?', '["হযরত ইবরাহিম ও ইসমাইল (আ.)","হযরত দাউদ ও সুলাইমান (আ.)","হযরত ইয়াকুব ও ইউসুফ (আ.)","হযরত নূহ ও সাম"]', 0, null),
  ('কোন নবী মাছের পেটে ছিলেন?', '["হযরত ইউনুস (আ.)","হযরত ইদ্রিস (আ.)","হযরত হুদ (আ.)","হযরত সালেহ (আ.)"]', 0, null),
  ('তাওরাত কোন নবীর ওপর নাযিল হয়?', '["হযরত দাউদ (আ.)","হযরত ঈসা (আ.)","হযরত মুসা (আ.)","হযরত ইবরাহিম (আ.)"]', 2, null),
  ('যাবুর কিতাব কোন নবীর ওপর নাযিল হয়?', '["হযরত দাউদ (আ.)","হযরত মুসা (আ.)","হযরত সুলাইমান (আ.)","হযরত ঈসা (আ.)"]', 0, null),
  ('ইঞ্জিল কিতাব কোন নবীর ওপর নাযিল হয়?', '["হযরত মুসা (আ.)","হযরত ঈসা (আ.)","হযরত ইয়াহইয়া (আ.)","হযরত দাউদ (আ.)"]', 1, null),
  ('পুরো কুরআন মুখস্থকারীকে কী বলা হয়?', '["কারী","হাফেজ","মুফতি","ইমাম"]', 1, null),
  ('কোন মাসে রোজা রাখা ফরজ?', '["রজব","শাবান","রমজান","মুহাররম"]', 2, null);
end $$;
