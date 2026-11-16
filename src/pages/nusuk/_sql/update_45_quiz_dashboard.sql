-- =====================================================================
-- Nusuk · update 45 · quiz dashboard numbers + old competitions off
-- Run once in Supabase → SQL Editor (after update 44), BEFORE pushing.
-- Safe to run again.
--
--   • the three old Reward Club competitions (lucky draw, limited-time offer,
--     top referrers) are switched off. Their tickets and winners stay in the
--     database; only the quiz campaigns are used from now on
--   • the member dashboard also gets today's tickets split by daily keys and
--     extra keys, and today's answers
-- =====================================================================

update public.nusuk_club_contests set active = false where kind <> 'quiz' and active;

-- ---------- member: dashboard ----------
create or replace function public.nusuk_cq_me()
returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  m public.nusuk_club_members;
  c public.nusuk_club_contests;
  cfg jsonb;
  st public.nusuk_cq_state;
  today date := public.nusuk_today();
  used_today int := 0;
  slots jsonb := '[]'::jsonb;
  s jsonb;
  i int := 0;
  a_start timestamptz;
  a_end timestamptz;
  att public.nusuk_cq_attempts;
  stt text;
  my jsonb;
begin
  if uid is null then return null; end if;
  select * into m from public.nusuk_club_members where user_id = uid;
  if not found then return null; end if;
  select * into st from public.nusuk_cq_state where user_id = uid;
  select coalesce(ref_used, 0) into used_today from public.nusuk_cq_day where user_id = uid and day = today;
  used_today := coalesce(used_today, 0);

  my := jsonb_build_object(
    'sl', m.sl, 'code', m.nusuk_code,
    'ref_keys', coalesce(st.ref_keys, 0), 'ref_earned', coalesce(st.ref_earned, 0), 'refs', coalesce(st.refs, 0),
    'answered', coalesce(st.answered, 0), 'correct', coalesce(st.correct, 0),
    'copies', coalesce((select uses from public.nusuk_codes where code = m.nusuk_code), 0),
    'gift_keys', coalesce((select sum(keys) from public.nusuk_club_key_awards where user_id = uid), 0));

  if not public.nusuk_club_active() then return jsonb_build_object('campaign', null, 'my', my, 'now', now()); end if;
  c := public.nusuk_cq_live();
  if c.id is null then return jsonb_build_object('campaign', null, 'my', my, 'now', now()); end if;
  cfg := public.nusuk_cq_cfg(c.quiz);

  for s in select * from jsonb_array_elements(cfg->'slots') loop
    a_start := public.nusuk_cq_at(today, s->>'at');
    a_end := a_start + make_interval(mins => least(1440, greatest(5, coalesce((s->>'mins')::int, 120))));
    select * into att from public.nusuk_cq_attempts where user_id = uid and contest_id = c.id and day = today and kind = 'slot' and slot = i;
    if att.id is not null then
      stt := case when att.status = 'open' and now() > att.deadline then 'late' else att.status end;
    elsif now() < a_start then stt := 'upcoming';
    elsif now() < a_end then stt := 'ready';
    else stt := 'missed';
    end if;
    slots := slots || jsonb_build_object('i', i, 'from', a_start, 'to', a_end, 'status', stt);
    i := i + 1;
  end loop;

  return jsonb_build_object(
    'now', now(),
    'campaign', jsonb_build_object(
      'id', c.id, 'title', c.title, 'info', c.info, 'starts_at', c.starts_at, 'ends_at', c.ends_at,
      'rule', cfg->'rule', 'target', cfg->'target', 'totals', public.nusuk_cq_totals(c.id), 'full', public.nusuk_cq_full(c),
      'prizes', c.prizes, 'caption', c.caption, 'card', c.card),
    'secs', cfg->'secs', 'pledge', cfg->'pledge', 'rules', cfg->'rules',
    'questions', (select count(*) from public.nusuk_cq_questions where active),
    'slots', slots,
    'ref', jsonb_build_object('keys', coalesce(st.ref_keys, 0), 'used_today', used_today, 'per_day', cfg->'ref_per_day',
      'from', cfg->'ref_from', 'to', cfg->'ref_to', 'in_window', public.nusuk_cq_in(cfg->>'ref_from', cfg->>'ref_to')),
    'my', my || jsonb_build_object(
      'tickets', coalesce((select tickets from public.nusuk_cq_entries where contest_id = c.id and user_id = uid), 0),
      'tickets_today', (select count(*) from public.nusuk_cq_attempts where user_id = uid and day = today and contest_id = c.id and status = 'right'),
      'today_slot', (select count(*) from public.nusuk_cq_attempts where user_id = uid and day = today and contest_id = c.id and status = 'right' and kind = 'slot'),
      'today_ref', (select count(*) from public.nusuk_cq_attempts where user_id = uid and day = today and contest_id = c.id and status = 'right' and kind = 'ref'),
      'answered_today', (select count(*) from public.nusuk_cq_attempts where user_id = uid and day = today and contest_id = c.id and status in ('right', 'wrong')))
  );
end $$;

grant execute on function public.nusuk_cq_me() to authenticated;
