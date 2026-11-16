-- =====================================================================
-- Nusuk · update 44 · Ribat quiz competition (Reward Club)
-- Run once in Supabase → SQL Editor (after update 43), BEFORE pushing.
-- Safe to run again.
--
-- A campaign is a Reward Club competition of kind 'quiz' (prizes, raffle wheel,
-- live screen and test mode work as before). Members only:
--   • daily keys: one question per time slot (admin sets the slots, ~2 h each);
--     once a question is opened it must be answered within N seconds (default 30)
--   • referral keys: +1 to the code owner and +1 to the new member for every
--     sign-up with a code (device-checked). They never expire; the admin sets how
--     many can be used per day and in which daily time window
--   • a correct answer = 1 ticket in the running campaign
--   • questions come from one bank in each member's own random order; no repeat
--     until the member has seen the whole bank; options are shuffled each time
--   • leaving the page while a question is open cancels it (the page reports it)
--   • one account per device: a second sign-up from the same browser is refused
--
-- Built to stay light with many members: every screen reads small summary rows
-- (per member, per member-day, per campaign entry) through indexes; no table is
-- counted from scratch on each visit, and nothing is polled.
-- =====================================================================

-- ---------- campaign = competition of kind 'quiz' ----------
alter table public.nusuk_club_contests drop constraint if exists nusuk_club_contests_kind_check;
alter table public.nusuk_club_contests add constraint nusuk_club_contests_kind_check check (kind in ('lucky', 'window', 'top', 'quiz'));
alter table public.nusuk_club_contests add column if not exists quiz jsonb not null default '{}'::jsonb;

-- browser "fingerprint" (for the admin's look-alike list; never used to block)
alter table public.nusuk_club_members add column if not exists fp text;
create index if not exists nusuk_club_members_fp on public.nusuk_club_members (fp);

-- ---------- tables ----------
create table if not exists public.nusuk_cq_questions (
  id          bigint generated always as identity primary key,
  question    text not null check (char_length(question) between 3 and 500),
  options     jsonb not null check (jsonb_typeof(options) = 'array' and jsonb_array_length(options) between 2 and 6),
  correct     int not null check (correct >= 0),
  active      boolean not null default true,
  note        text not null default '',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  check (correct < jsonb_array_length(options))
);
create index if not exists nusuk_cq_questions_active on public.nusuk_cq_questions (id) where active;

-- one row per member: their question order seed, referral key balance and running totals
create table if not exists public.nusuk_cq_state (
  user_id     uuid primary key references public.nusuk_club_members (user_id) on delete cascade,
  seed        int not null default floor(random() * 2000000000)::int,
  cycle       int not null default 0,
  ref_keys    int not null default 0 check (ref_keys >= 0),
  ref_earned  int not null default 0,
  bonus_keys  int not null default 0,
  refs        int not null default 0,
  answered    int not null default 0,
  correct     int not null default 0,
  updated_at  timestamptz not null default now()
);

-- one row per member per day: referral keys used that day
create table if not exists public.nusuk_cq_day (
  user_id   uuid not null references public.nusuk_club_members (user_id) on delete cascade,
  day       date not null,
  ref_used  int not null default 0,
  primary key (user_id, day)
);

-- every opened question
create table if not exists public.nusuk_cq_attempts (
  id           bigint generated always as identity primary key,
  user_id      uuid not null references public.nusuk_club_members (user_id) on delete cascade,
  contest_id   int not null references public.nusuk_club_contests (id) on delete cascade,
  question_id  bigint not null references public.nusuk_cq_questions (id) on delete cascade,
  kind         text not null check (kind in ('slot', 'ref')),
  slot         smallint,
  day          date not null,
  cycle        int not null,
  perm         smallint[] not null,
  opened_at    timestamptz not null default now(),
  deadline     timestamptz not null,
  status       text not null default 'open' check (status in ('open', 'right', 'wrong', 'late', 'left')),
  choice       smallint,
  answered_at  timestamptz
);
create index if not exists nusuk_cq_att_user_day on public.nusuk_cq_attempts (user_id, day);
create index if not exists nusuk_cq_att_seen on public.nusuk_cq_attempts (user_id, cycle, question_id);
create unique index if not exists nusuk_cq_att_slot on public.nusuk_cq_attempts (user_id, contest_id, day, slot) where kind = 'slot';
create index if not exists nusuk_cq_att_open on public.nusuk_cq_attempts (user_id) where status = 'open';
create index if not exists nusuk_cq_att_right_day on public.nusuk_cq_attempts (contest_id, day) where status = 'right';
create index if not exists nusuk_cq_att_contest_day on public.nusuk_cq_attempts (contest_id, day);

-- tickets per member per campaign (the draw reads this, not the attempts)
create table if not exists public.nusuk_cq_entries (
  contest_id  int not null references public.nusuk_club_contests (id) on delete cascade,
  user_id     uuid not null references public.nusuk_club_members (user_id) on delete cascade,
  tickets     int not null default 0,
  answered    int not null default 0,
  primary key (contest_id, user_id)
);
create index if not exists nusuk_cq_entries_contest on public.nusuk_cq_entries (contest_id) include (tickets);

do $$
declare t text;
begin
  foreach t in array array['nusuk_cq_questions', 'nusuk_cq_state', 'nusuk_cq_day', 'nusuk_cq_attempts', 'nusuk_cq_entries'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "%s: admin all" on public.%I', t, t);
    execute format('create policy "%s: admin all" on public.%I for all using (public.is_admin()) with check (public.is_admin())', t, t);
  end loop;
end $$;

-- sample questions (only when the bank is empty)
insert into public.nusuk_cq_questions (question, options, correct)
select * from (values
  ('পবিত্র কুরআনে মোট কতটি সূরা আছে?', '["১১০টি","১১৪টি","১২০টি","১১২টি"]'::jsonb, 1),
  ('ইসলামের প্রথম স্তম্ভ কোনটি?', '["নামাজ","রোজা","কালিমা (ঈমান)","হজ"]'::jsonb, 2),
  ('উমরাহর সময় কাবা শরীফ কতবার তাওয়াফ করতে হয়?', '["৫ বার","৬ বার","৭ বার","৩ বার"]'::jsonb, 2),
  ('রাসূলুল্লাহ ﷺ কোন শহরে জন্মগ্রহণ করেন?', '["মদিনা","মক্কা","তায়েফ","জেদ্দা"]'::jsonb, 1),
  ('সাফা ও মারওয়া পাহাড়ের মাঝে দৌড়ানোকে কী বলে?', '["তাওয়াফ","সাঈ","রমি","ইহরাম"]'::jsonb, 1)
) v(question, options, correct)
where not exists (select 1 from public.nusuk_cq_questions);

-- ---------- helpers ----------
/** The quiz campaign running right now (one at a time) */
create or replace function public.nusuk_cq_live()
returns public.nusuk_club_contests
language sql stable security definer set search_path = public as $$
  select * from public.nusuk_club_live() where kind = 'quiz' limit 1
$$;
revoke all on function public.nusuk_cq_live() from public, anon, authenticated;

/** Campaign settings with defaults */
create or replace function public.nusuk_cq_cfg(q jsonb)
returns jsonb
language sql immutable as $$
  select jsonb_build_object(
    'slots', case when jsonb_typeof(q->'slots') = 'array' and jsonb_array_length(q->'slots') > 0 then q->'slots'
                  else '[{"at":"09:00","mins":120},{"at":"11:00","mins":120},{"at":"14:00","mins":120},{"at":"17:00","mins":120},{"at":"20:00","mins":120}]'::jsonb end,
    'secs', least(300, greatest(10, coalesce((q->>'secs')::int, 30))),
    'ref_per_day', least(100, greatest(0, coalesce((q->>'ref_per_day')::int, 10))),
    'ref_from', coalesce(nullif(q->>'ref_from', ''), '00:00'),
    'ref_to', coalesce(nullif(q->>'ref_to', ''), '23:59'),
    'rule', case when q->>'rule' in ('people', 'tickets') then q->>'rule' else 'date' end,
    'target', greatest(0, coalesce((q->>'target')::int, 0)),
    'pledge', coalesce(q->>'pledge', ''),
    'rules', coalesce(q->>'rules', ''),
    'bonus_done', coalesce((q->>'bonus_done')::boolean, false)
  )
$$;

/** Bangladesh "today at HH:MM" as a timestamp */
create or replace function public.nusuk_cq_at(p_day date, p_hhmm text)
returns timestamptz
language sql stable as $$
  select ((p_day::timestamp + coalesce(nullif(p_hhmm, ''), '00:00')::time) at time zone 'Asia/Dhaka')
$$;

/** Campaign totals (people with tickets, tickets) from the summary rows */
create or replace function public.nusuk_cq_totals(p_contest int)
returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object('people', count(*) filter (where tickets > 0), 'tickets', coalesce(sum(tickets), 0))
  from public.nusuk_cq_entries where contest_id = p_contest
$$;
revoke all on function public.nusuk_cq_totals(int) from public, anon, authenticated;

/** Has a "people" / "tickets" target been reached? */
create or replace function public.nusuk_cq_full(c public.nusuk_club_contests)
returns boolean
language plpgsql stable security definer set search_path = public as $$
declare cfg jsonb := public.nusuk_cq_cfg(c.quiz); t jsonb; target int := (cfg->>'target')::int;
begin
  if cfg->>'rule' = 'date' or target <= 0 then return false; end if;
  t := public.nusuk_cq_totals(c.id);
  return (t->>(cfg->>'rule'))::int >= target;
end $$;
revoke all on function public.nusuk_cq_full(public.nusuk_club_contests) from public, anon, authenticated;

/** Is the time of day inside "from–to" (Bangladesh), windows past midnight allowed */
create or replace function public.nusuk_cq_in(p_from text, p_to text)
returns boolean
language plpgsql stable as $$
declare t time := (now() at time zone 'Asia/Dhaka')::time; a time; b time;
begin
  begin a := p_from::time; b := p_to::time; exception when others then return true; end;
  if a <= b then return t >= a and t <= b; end if;
  return t >= a or t <= b;
end $$;

-- ---------- referral keys: given by trigger, so the existing sign-up code stays as it is ----------
create or replace function public.nusuk_cq_on_ref()
returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.ref_ok and new.referred_by is not null and (tg_op = 'INSERT' or not coalesce(old.ref_ok, false)) then
    insert into public.nusuk_cq_state (user_id) values (new.user_id), (new.referred_by) on conflict do nothing;
    update public.nusuk_cq_state set ref_keys = ref_keys + 1, ref_earned = ref_earned + 1, refs = refs + 1, updated_at = now()
     where user_id = new.referred_by;
    update public.nusuk_cq_state set ref_keys = ref_keys + 1, ref_earned = ref_earned + 1, updated_at = now()
     where user_id = new.user_id;
  end if;
  return new;
end $$;
drop trigger if exists nusuk_cq_ref on public.nusuk_club_members;
create trigger nusuk_cq_ref after insert or update of ref_ok on public.nusuk_club_members
  for each row execute function public.nusuk_cq_on_ref();

-- ---------- one account per device ----------
create or replace function public.nusuk_cq_one_device()
returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.device is not null and exists (select 1 from public.nusuk_club_members where device = new.device and user_id <> new.user_id) then
    raise exception 'device_taken' using errcode = 'P0001';
  end if;
  -- the Nusuk code goes into the code list too (waits for review like a submitted code)
  insert into public.nusuk_codes (code, source, status) values (new.nusuk_code, 'user', 'pending') on conflict do nothing;
  return new;
end $$;
drop trigger if exists nusuk_cq_device on public.nusuk_club_members;
create trigger nusuk_cq_device before insert on public.nusuk_club_members
  for each row execute function public.nusuk_cq_one_device();

/** Before the sign-up form: is this browser already used by an account? (masked email) */
create or replace function public.nusuk_club_device_owner(p_device text)
returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce((
    select jsonb_build_object('taken', true,
      'email', case when m.email is null then null
                    else left(split_part(m.email, '@', 1), 2) || '***@' || split_part(m.email, '@', 2) end)
    from public.nusuk_club_members m
    where p_device ~ '^[0-9a-fA-F-]{36}$' and m.device = p_device and m.user_id <> coalesce(auth.uid(), '00000000-0000-0000-0000-000000000000'::uuid)
    limit 1), jsonb_build_object('taken', false))
$$;

/** The account page reports the browser it is used on (device id + fingerprint) */
create or replace function public.nusuk_cq_seen(p_device text, p_fp text)
returns void
language sql volatile security definer set search_path = public as $$
  update public.nusuk_club_members
     set device = coalesce(device, case when p_device ~ '^[0-9a-fA-F-]{36}$' then p_device end),
         fp = case when p_fp ~ '^[0-9a-f]{8,64}$' then p_fp else fp end
   where user_id = auth.uid()
$$;

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
      'tickets_today', (select count(*) from public.nusuk_cq_attempts where user_id = uid and day = today and contest_id = c.id and status = 'right'))
  );
end $$;

-- ---------- member: open a question ----------
create or replace function public.nusuk_cq_open(p_kind text, p_slot int default null)
returns jsonb
language plpgsql volatile security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  m public.nusuk_club_members;
  c public.nusuk_club_contests;
  cfg jsonb;
  st public.nusuk_cq_state;
  today date := public.nusuk_today();
  s jsonb;
  a_start timestamptz;
  a_end timestamptz;
  q public.nusuk_cq_questions;
  n int;
  v_perm smallint[];
  v_secs int;
  att public.nusuk_cq_attempts;
  used int;
begin
  if uid is null then return jsonb_build_object('ok', false, 'reason', 'signin'); end if;
  select * into m from public.nusuk_club_members where user_id = uid;
  if not found then return jsonb_build_object('ok', false, 'reason', 'member'); end if;
  if not public.nusuk_club_active() then return jsonb_build_object('ok', false, 'reason', 'closed'); end if;
  c := public.nusuk_cq_live();
  if c.id is null then return jsonb_build_object('ok', false, 'reason', 'no_campaign'); end if;
  if public.nusuk_cq_full(c) then return jsonb_build_object('ok', false, 'reason', 'full'); end if;
  if not exists (select 1 from public.nusuk_cq_questions where active) then return jsonb_build_object('ok', false, 'reason', 'no_questions'); end if;
  cfg := public.nusuk_cq_cfg(c.quiz);
  v_secs := (cfg->>'secs')::int;

  insert into public.nusuk_cq_state (user_id) values (uid) on conflict do nothing;
  select * into st from public.nusuk_cq_state where user_id = uid for update;
  -- a question still open from before counts as left (opening another one is not a way around the timer)
  update public.nusuk_cq_attempts set status = case when now() > deadline then 'late' else 'left' end, answered_at = now()
   where user_id = uid and status = 'open';

  if p_kind = 'slot' then
    s := case when p_slot >= 0 then cfg->'slots'->p_slot end; -- (a negative index would count from the end)
    if s is null then return jsonb_build_object('ok', false, 'reason', 'slot'); end if;
    a_start := public.nusuk_cq_at(today, s->>'at');
    a_end := a_start + make_interval(mins => least(1440, greatest(5, coalesce((s->>'mins')::int, 120))));
    if now() < a_start or now() >= a_end then return jsonb_build_object('ok', false, 'reason', 'window'); end if;
    if exists (select 1 from public.nusuk_cq_attempts where user_id = uid and contest_id = c.id and day = today and kind = 'slot' and slot = p_slot) then
      return jsonb_build_object('ok', false, 'reason', 'used');
    end if;
  elsif p_kind = 'ref' then
    if st.ref_keys <= 0 then return jsonb_build_object('ok', false, 'reason', 'no_keys'); end if;
    if not public.nusuk_cq_in(cfg->>'ref_from', cfg->>'ref_to') then return jsonb_build_object('ok', false, 'reason', 'ref_window'); end if;
    insert into public.nusuk_cq_day (user_id, day) values (uid, today) on conflict do nothing;
    select ref_used into used from public.nusuk_cq_day where user_id = uid and day = today for update;
    if used >= (cfg->>'ref_per_day')::int then return jsonb_build_object('ok', false, 'reason', 'ref_limit'); end if;
    update public.nusuk_cq_day set ref_used = ref_used + 1 where user_id = uid and day = today;
    update public.nusuk_cq_state set ref_keys = ref_keys - 1, updated_at = now() where user_id = uid;
  else
    return jsonb_build_object('ok', false, 'reason', 'kind');
  end if;

  -- next question in this member's own order; a new round starts when they have seen the whole bank
  for n in 1..2 loop
    select qq.* into q from public.nusuk_cq_questions qq
     where qq.active
       and not exists (select 1 from public.nusuk_cq_attempts a where a.user_id = uid and a.cycle = st.cycle and a.question_id = qq.id)
     order by md5(st.seed::text || ':' || st.cycle::text || ':' || qq.id::text)
     limit 1;
    exit when q.id is not null;
    update public.nusuk_cq_state set cycle = cycle + 1 where user_id = uid returning * into st;
  end loop;

  n := jsonb_array_length(q.options);
  select array_agg(x::smallint order by random()) into v_perm from generate_series(0, n - 1) x;
  insert into public.nusuk_cq_attempts (user_id, contest_id, question_id, kind, slot, day, cycle, perm, deadline)
  values (uid, c.id, q.id, p_kind, case when p_kind = 'slot' then p_slot end, today, st.cycle, v_perm,
          now() + make_interval(secs => v_secs + 2)) -- 2 s grace for the network
  returning * into att;

  return jsonb_build_object(
    'ok', true, 'id', att.id, 'secs', v_secs, 'deadline', att.deadline, 'now', now(),
    'question', q.question,
    'options', (select jsonb_agg(q.options->(p::int) order by o) from unnest(v_perm) with ordinality u(p, o)),
    'mark', jsonb_build_object('sl', m.sl, 'code', m.nusuk_code));
exception when unique_violation then
  return jsonb_build_object('ok', false, 'reason', 'used');
end $$;

-- ---------- member: answer ----------
create or replace function public.nusuk_cq_answer(p_id bigint, p_choice int)
returns jsonb
language plpgsql volatile security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  att public.nusuk_cq_attempts;
  q public.nusuk_cq_questions;
  right_at int;
  ok boolean;
  t int;
begin
  if uid is null then return jsonb_build_object('ok', false, 'reason', 'signin'); end if;
  select * into att from public.nusuk_cq_attempts where id = p_id and user_id = uid for update;
  if not found then return jsonb_build_object('ok', false, 'reason', 'missing'); end if;
  select * into q from public.nusuk_cq_questions where id = att.question_id;
  select o - 1 into right_at from unnest(att.perm) with ordinality u(p, o) where p = q.correct;
  if att.status <> 'open' then return jsonb_build_object('ok', false, 'reason', att.status, 'right', right_at); end if;
  if now() > att.deadline then
    update public.nusuk_cq_attempts set status = 'late', answered_at = now() where id = p_id;
    return jsonb_build_object('ok', true, 'status', 'late', 'right', right_at);
  end if;
  if p_choice is null or p_choice < 0 or p_choice >= array_length(att.perm, 1) then
    return jsonb_build_object('ok', false, 'reason', 'choice');
  end if;
  ok := att.perm[p_choice + 1] = q.correct;
  update public.nusuk_cq_attempts set status = case when ok then 'right' else 'wrong' end, choice = p_choice, answered_at = now() where id = p_id;
  update public.nusuk_cq_state set answered = answered + 1, correct = correct + ok::int, updated_at = now() where user_id = uid;
  insert into public.nusuk_cq_entries (contest_id, user_id, tickets, answered) values (att.contest_id, uid, ok::int, 1)
  on conflict (contest_id, user_id) do update set tickets = nusuk_cq_entries.tickets + excluded.tickets, answered = nusuk_cq_entries.answered + 1
  returning tickets into t;
  return jsonb_build_object('ok', true, 'status', case when ok then 'right' else 'wrong' end, 'right', right_at, 'tickets', t);
end $$;

-- ---------- member: left the page while a question was open ----------
create or replace function public.nusuk_cq_leave(p_id bigint)
returns jsonb
language sql volatile security definer set search_path = public as $$
  with u as (
    update public.nusuk_cq_attempts set status = 'left', answered_at = now()
     where id = p_id and user_id = auth.uid() and status = 'open'
    returning 1)
  select jsonb_build_object('ok', exists (select 1 from u))
$$;

-- ---------- the draw reads the summary rows for quiz campaigns ----------
create or replace function public.nusuk_club_pool(p_contest int, p_scope text)
returns table (user_id uuid, n bigint)
language plpgsql stable security definer set search_path = public as $$
declare k text;
begin
  select kind into k from public.nusuk_club_contests where id = p_contest;
  if k = 'quiz' then
    if p_scope = 'all' then
      return query select e.user_id, e.tickets::bigint from public.nusuk_cq_entries e where e.contest_id = p_contest and e.tickets > 0;
    else
      return query select a.user_id, count(*)::bigint from public.nusuk_cq_attempts a
        where a.contest_id = p_contest and a.day = p_scope::date and a.status = 'right' group by a.user_id;
    end if;
  elsif k = 'top' then
    return query
      select t.user_id, count(*)::bigint from public.nusuk_club_tickets t
      where t.contest_id = p_contest and t.kind = 'referral'
        and (p_scope = 'all' or t.day = p_scope::date)
      group by t.user_id;
  else
    return query
      select t.user_id, sum(t.qty)::bigint from public.nusuk_club_tickets t
      where t.contest_id = p_contest
        and (p_scope = 'all' or t.day = p_scope::date)
      group by t.user_id;
  end if;
end $$;
revoke all on function public.nusuk_club_pool(int, text) from public, anon, authenticated;

-- ---------- Nusuk Manager ----------
/** Welcome bonus: N referral keys to everyone who joined before the campaign, once per campaign */
create or replace function public.nusuk_admin_cq_bonus(p_contest int, p_keys int)
returns jsonb
language plpgsql volatile security definer set search_path = public as $$
declare c public.nusuk_club_contests; n int;
begin
  if not public.is_admin() then raise exception 'not allowed'; end if;
  if coalesce(p_keys, 0) < 1 or p_keys > 50 then return jsonb_build_object('ok', false, 'reason', 'keys'); end if;
  select * into c from public.nusuk_club_contests where id = p_contest and kind = 'quiz' for update;
  if c.id is null then return jsonb_build_object('ok', false, 'reason', 'missing'); end if;
  if coalesce((c.quiz->>'bonus_done')::boolean, false) then return jsonb_build_object('ok', false, 'reason', 'done'); end if;
  insert into public.nusuk_cq_state (user_id)
    select user_id from public.nusuk_club_members where created_at < coalesce(c.starts_at, now()) on conflict do nothing;
  update public.nusuk_cq_state s set ref_keys = s.ref_keys + p_keys, bonus_keys = s.bonus_keys + p_keys, updated_at = now()
   from public.nusuk_club_members m
   where m.user_id = s.user_id and m.created_at < coalesce(c.starts_at, now());
  get diagnostics n = row_count;
  update public.nusuk_club_contests
     set quiz = quiz || jsonb_build_object('bonus_done', true, 'bonus_keys', p_keys, 'bonus_people', n, 'bonus_at', now())
   where id = p_contest;
  return jsonb_build_object('ok', true, 'people', n);
end $$;

/** Numbers for one campaign + the look-alike accounts list */
create or replace function public.nusuk_admin_cq(p_contest int)
returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare today date := public.nusuk_today();
begin
  if not public.is_admin() then raise exception 'not allowed'; end if;
  return jsonb_build_object(
    'today', today,
    'totals', public.nusuk_cq_totals(p_contest),
    'questions', (select count(*) from public.nusuk_cq_questions where active),
    'day', (select jsonb_build_object(
              'opened', count(*), 'right', count(*) filter (where status = 'right'), 'wrong', count(*) filter (where status = 'wrong'),
              'late', count(*) filter (where status = 'late' or (status = 'open' and deadline < now())),
              'left', count(*) filter (where status = 'left'), 'people', count(distinct user_id))
            from public.nusuk_cq_attempts where contest_id = p_contest and day = today),
    'top', coalesce((
      select jsonb_agg(jsonb_build_object('sl', m.sl, 'name', m.name, 'code', m.nusuk_code, 'tickets', e.tickets, 'answered', e.answered) order by e.tickets desc, m.sl)
      from (select * from public.nusuk_cq_entries where contest_id = p_contest order by tickets desc limit 20) e
      join public.nusuk_club_members m on m.user_id = e.user_id), '[]'::jsonb),
    'alike', coalesce((
      select jsonb_agg(g order by g.n desc)
      from (
        select x.how, x.val, count(*) as n,
               jsonb_agg(jsonb_build_object('sl', m.sl, 'name', m.name, 'email', m.email, 'phone', m.phone, 'joined', m.created_at) order by m.sl) as people
        from (select 'device' as how, device as val, user_id from public.nusuk_club_members where device is not null
              union all
              select 'browser', fp, user_id from public.nusuk_club_members where fp is not null) x
        join public.nusuk_club_members m on m.user_id = x.user_id
        group by x.how, x.val
        having count(*) > 1
        limit 50) g), '[]'::jsonb)
  );
end $$;

grant execute on function public.nusuk_club_device_owner(text) to anon, authenticated;
grant execute on function public.nusuk_cq_seen(text, text) to authenticated;
grant execute on function public.nusuk_cq_me() to authenticated;
grant execute on function public.nusuk_cq_open(text, int) to authenticated;
grant execute on function public.nusuk_cq_answer(bigint, int) to authenticated;
grant execute on function public.nusuk_cq_leave(bigint) to authenticated;
grant execute on function public.nusuk_admin_cq_bonus(int, int) to authenticated;
grant execute on function public.nusuk_admin_cq(int) to authenticated;
