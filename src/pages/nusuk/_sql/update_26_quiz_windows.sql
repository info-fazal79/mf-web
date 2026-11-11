-- =====================================================================
-- Nusuk · update 26 · quiz: each question only until the next one opens;
-- leaderboard shows part of the code instead of the ID
-- Run once in Supabase → SQL Editor (after update 25), BEFORE pushing.
-- Safe to run again.
--
--   • Questions at 9:00 and 11:00 → the 9:00 question can be answered
--     until 11:00 only; the last question until the day's end time.
--     A missed question can't be answered later.
--   • The public leaderboard sends the code as NG-y3J•••7lU, so the page
--     shows name + part of the code (the quiz ID is no longer shown).
-- =====================================================================

-- When a question's answer window ends: when the next question opens, or
-- the day's end time for the last question
create or replace function public.nusuk_quiz_slot_ends(p_day date, p_slot int)
returns timestamptz
language sql stable security definer set search_path = public as $$
  select case when p_slot < s.per_day - 1
              then least(public.nusuk_quiz_opens(p_day, p_slot + 1), public.nusuk_quiz_closes(p_day))
              else public.nusuk_quiz_closes(p_day) end
  from public.nusuk_quiz_settings s where s.id = 1;
$$;

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
      select coalesce(jsonb_agg(jsonb_build_object('rank', r.rank, 'prev', r.prev_rank, 'id', r.player_id, 'name', r.name, 'points', r.points, 'correct', r.correct,
                                                   'code', public.nusuk_mask(c.code)) order by r.rank, r.player_id), '[]'::jsonb)
      from (select * from public.nusuk_quiz_ranks() order by rank, player_id limit least(greatest(coalesce(p_limit, 5), 1), 200)) r
      join public.nusuk_quiz_players p on p.id = r.player_id
      join public.nusuk_codes c on c.id = p.code_id
    )
  );
end $$;
grant execute on function public.nusuk_quiz_public(int) to anon, authenticated;

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
        'ends', public.nusuk_quiz_slot_ends(d, g.slot),
        'status', case
          when a.player_id is not null then 'answered'
          when now() >= public.nusuk_quiz_slot_ends(d, g.slot) then 'missed'
          when now() >= public.nusuk_quiz_opens(d, g.slot) and qd.question_id is not null then 'open'
          else 'locked' end,
        'question', case when a.player_id is not null or (now() >= public.nusuk_quiz_opens(d, g.slot) and now() < public.nusuk_quiz_slot_ends(d, g.slot)) then q.question end,
        'options',  case when a.player_id is not null or (now() >= public.nusuk_quiz_opens(d, g.slot) and now() < public.nusuk_quiz_slot_ends(d, g.slot)) then q.options end,
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
  if now() >= public.nusuk_quiz_slot_ends(d, p_slot) then return jsonb_build_object('ok', false, 'reason', 'missed'); end if;
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


notify pgrst, 'reload schema';
