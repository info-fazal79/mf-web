-- =====================================================================
-- Nusuk · update 34 · Reward Club prizes, raffle draw and live-screen draw
-- Run once in Supabase → SQL Editor (after update 33), BEFORE pushing.
-- Safe to run again.
--
--   • nusuk_club_contests.prizes      – winners and prize per place
--   • nusuk_club_winners              – who won which draw (one win per person per draw)
--   • nusuk_club_draw_state (1 row)   – what the live screen shows: normal or raffle,
--                                        which competition/draw, countdown end
--   • nusuk_admin_club_pool / _spin   – entries and the server-side weighted pick
--     (every ticket is one chance; "top" competitions go by the leaderboard)
--   • nusuk_club_live_draw()          – public: the live screen reads the draw (first
--                                        names, SL and masked codes only)
-- A draw's "scope" is 'all' (whole competition) or a Bangladesh date 'YYYY-MM-DD'
-- (only that day's tickets).
-- =====================================================================

alter table public.nusuk_club_contests add column if not exists prizes jsonb not null default '[]'::jsonb;

create table if not exists public.nusuk_club_winners (
  id          bigint generated always as identity primary key,
  contest_id  int not null references public.nusuk_club_contests (id) on delete cascade,
  scope       text not null,
  user_id     uuid not null references public.nusuk_club_members (user_id) on delete cascade,
  place       int not null,
  prize       text not null default '',
  tickets     int not null default 0,
  pool        int not null default 0,
  created_at  timestamptz not null default now(),
  unique (contest_id, scope, user_id),
  unique (contest_id, scope, place)
);
alter table public.nusuk_club_winners enable row level security;
drop policy if exists "nusuk_club_winners: admin all" on public.nusuk_club_winners;
create policy "nusuk_club_winners: admin all" on public.nusuk_club_winners for all using (public.is_admin()) with check (public.is_admin());

create table if not exists public.nusuk_club_draw_state (
  id            int primary key default 1 check (id = 1),
  mode          text not null default 'normal' check (mode in ('normal', 'raffle')),
  contest_id    int references public.nusuk_club_contests (id) on delete set null,
  scope         text not null default 'all',
  countdown_end timestamptz,
  updated_at    timestamptz not null default now()
);
insert into public.nusuk_club_draw_state (id) values (1) on conflict (id) do nothing;
alter table public.nusuk_club_draw_state enable row level security;
drop policy if exists "nusuk_club_draw_state: admin all" on public.nusuk_club_draw_state;
create policy "nusuk_club_draw_state: admin all" on public.nusuk_club_draw_state for all using (public.is_admin()) with check (public.is_admin());

/** Entries of a draw: tickets per member (lucky / limited-time), or people brought in (top referrers) */
create or replace function public.nusuk_club_pool(p_contest int, p_scope text)
returns table (user_id uuid, n bigint)
language plpgsql stable security definer set search_path = public as $$
declare k text;
begin
  select kind into k from public.nusuk_club_contests where id = p_contest;
  if k = 'top' then
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

create or replace function public.nusuk_club_mask(c text)
returns text language sql immutable as $$ select left(c, 5) || '•••' || right(c, 3) $$;

/** Nusuk Manager: everyone in a draw + winners so far */
create or replace function public.nusuk_admin_club_pool(p_contest int, p_scope text default 'all')
returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'not allowed'; end if;
  return jsonb_build_object(
    'total', (select coalesce(sum(n), 0) from public.nusuk_club_pool(p_contest, p_scope)),
    'people', (select count(*) from public.nusuk_club_pool(p_contest, p_scope)),
    'entries', coalesce((
      select jsonb_agg(jsonb_build_object('sl', m.sl, 'name', m.name, 'code', m.nusuk_code, 'tickets', p.n,
               'won', exists (select 1 from public.nusuk_club_winners w where w.contest_id = p_contest and w.scope = p_scope and w.user_id = p.user_id))
             order by p.n desc, m.sl)
      from public.nusuk_club_pool(p_contest, p_scope) p
      join public.nusuk_club_members m on m.user_id = p.user_id), '[]'::jsonb),
    'winners', coalesce((
      select jsonb_agg(jsonb_build_object('id', w.id, 'place', w.place, 'prize', w.prize, 'tickets', w.tickets, 'pool', w.pool,
               'sl', m.sl, 'name', m.name, 'phone', m.phone, 'code', m.nusuk_code, 'at', w.created_at) order by w.place)
      from public.nusuk_club_winners w
      join public.nusuk_club_members m on m.user_id = w.user_id
      where w.contest_id = p_contest and w.scope = p_scope), '[]'::jsonb)
  );
end $$;

/** Nusuk Manager: draw the winner for one place. The server picks; the wheel only shows it. */
create or replace function public.nusuk_admin_club_spin(p_contest int, p_scope text, p_place int)
returns jsonb
language plpgsql volatile security definer set search_path = public as $$
declare
  c public.nusuk_club_contests;
  v_uid uuid;
  v_n bigint;
  tot bigint;
  r bigint;
  v_prize text;
  w public.nusuk_club_winners;
  m public.nusuk_club_members;
begin
  if not public.is_admin() then raise exception 'not allowed'; end if;
  select * into c from public.nusuk_club_contests where id = p_contest for update;
  if c.id is null then raise exception 'competition not found'; end if;
  if p_scope <> 'all' and p_scope !~ '^\d{4}-\d{2}-\d{2}$' then raise exception 'bad scope'; end if;
  if exists (select 1 from public.nusuk_club_winners where contest_id = p_contest and scope = p_scope and place = p_place) then
    return jsonb_build_object('ok', false, 'reason', 'place_taken');
  end if;

  create temporary table if not exists _club_left (user_id uuid, n bigint) on commit drop;
  truncate _club_left;
  insert into _club_left
    select p.user_id, p.n from public.nusuk_club_pool(p_contest, p_scope) p
    where p.n > 0 and not exists (select 1 from public.nusuk_club_winners x where x.contest_id = p_contest and x.scope = p_scope and x.user_id = p.user_id);
  select coalesce(sum(n), 0) into tot from _club_left;
  if tot = 0 then return jsonb_build_object('ok', false, 'reason', 'empty'); end if;

  if c.kind = 'top' then
    -- leaderboard: most people brought in; ties → the earlier member
    select l.user_id, l.n into v_uid, v_n from _club_left l join public.nusuk_club_members mm on mm.user_id = l.user_id
      order by l.n desc, mm.sl limit 1;
  else
    -- every ticket is one chance
    r := floor(random() * tot)::bigint;
    select x.user_id, x.n into v_uid, v_n from (
      select l.user_id, l.n, sum(l.n) over (order by l.user_id) as cum from _club_left l
    ) x where x.cum > r order by x.cum limit 1;
  end if;

  select coalesce(e->>'prize', '') into v_prize from jsonb_array_elements(c.prizes) e where (e->>'place')::int = p_place limit 1;
  insert into public.nusuk_club_winners (contest_id, scope, user_id, place, prize, tickets, pool)
  values (p_contest, p_scope, v_uid, p_place, coalesce(v_prize, ''), v_n, (select coalesce(sum(n), 0) from public.nusuk_club_pool(p_contest, p_scope)))
  returning * into w;
  update public.nusuk_club_draw_state set updated_at = now() where id = 1;
  select * into m from public.nusuk_club_members where user_id = v_uid;
  return jsonb_build_object('ok', true, 'winner', jsonb_build_object(
    'id', w.id, 'place', w.place, 'prize', w.prize, 'tickets', w.tickets, 'pool', w.pool,
    'sl', m.sl, 'name', m.name, 'phone', m.phone, 'code', m.nusuk_code, 'at', w.created_at));
end $$;

/** Public, for /nusuk/live: what to show and the draw so far (first names, SL, masked codes) */
create or replace function public.nusuk_club_live_draw()
returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  s public.nusuk_club_draw_state;
  c public.nusuk_club_contests;
begin
  select * into s from public.nusuk_club_draw_state where id = 1;
  if s.id is null or s.mode <> 'raffle' or s.contest_id is null then
    return jsonb_build_object('mode', 'normal', 'now', now());
  end if;
  select * into c from public.nusuk_club_contests where id = s.contest_id;
  if c.id is null then return jsonb_build_object('mode', 'normal', 'now', now()); end if;
  return jsonb_build_object(
    'mode', 'raffle',
    'now', now(),
    'countdown_end', s.countdown_end,
    'scope', s.scope,
    'contest', jsonb_build_object('id', c.id, 'title', c.title, 'kind', c.kind, 'prizes', c.prizes),
    'total', (select coalesce(sum(n), 0) from public.nusuk_club_pool(c.id, s.scope)),
    'people', (select count(*) from public.nusuk_club_pool(c.id, s.scope)),
    'wheel', coalesce((
      select jsonb_agg(jsonb_build_object('k', m.sl, 'name', split_part(m.name, ' ', 1), 't', p.n) order by p.n desc, m.sl)
      from (select * from public.nusuk_club_pool(c.id, s.scope) order by n desc limit 300) p
      join public.nusuk_club_members m on m.user_id = p.user_id), '[]'::jsonb),
    'winners', coalesce((
      select jsonb_agg(jsonb_build_object('id', w.id, 'place', w.place, 'prize', w.prize, 'tickets', w.tickets,
               'k', m.sl, 'name', m.name, 'code', public.nusuk_club_mask(m.nusuk_code)) order by w.created_at)
      from public.nusuk_club_winners w
      join public.nusuk_club_members m on m.user_id = w.user_id
      where w.contest_id = c.id and w.scope = s.scope), '[]'::jsonb)
  );
end $$;

-- nusuk_club_me now also sends each competition's prizes
create or replace function public.nusuk_club_me()
returns jsonb
language plpgsql volatile security definer set search_path = public as $$
declare
  cfg jsonb := public.nusuk_club_cfg();
  uid uuid := auth.uid();
  m public.nusuk_club_members;
  today date := public.nusuk_today();
  ref_name text;
  c public.nusuk_club_contests;
  contests jsonb := '[]'::jsonb;
  is_member boolean := false;
begin
  if uid is not null then
    select * into m from public.nusuk_club_members where user_id = uid;
    is_member := found;
  end if;
  -- "enter" tickets for members while a competition is running (old members included)
  if is_member and coalesce((cfg->>'on')::boolean, false) then
    for c in select * from public.nusuk_club_live() loop
      perform public.nusuk_club_give(uid, c.id, 'enter', c.t_enter);
    end loop;
  end if;

  for c in select * from public.nusuk_club_live() loop
    contests := contests || jsonb_build_object(
      'id', c.id, 'title', c.title, 'kind', c.kind, 'starts_at', c.starts_at, 'ends_at', c.ends_at,
      't_join', c.t_join, 't_enter', c.t_enter, 't_ref_bonus', c.t_ref_bonus, 't_referral', c.t_referral, 't_copy', c.t_copy,
      'copy_from', c.copy_from, 'copy_to', c.copy_to,
      'in_window', public.nusuk_club_in_window(jsonb_build_object('copy_from', c.copy_from, 'copy_to', c.copy_to)),
      'info', c.info, 'card', c.card, 'caption', c.caption, 'prizes', c.prizes,
      'my', case when is_member then jsonb_build_object(
        'total', (select coalesce(sum(qty), 0) from public.nusuk_club_tickets where user_id = uid and contest_id = c.id),
        'today', (select coalesce(sum(qty), 0) from public.nusuk_club_tickets where user_id = uid and contest_id = c.id and day = today),
        'referrals', (select count(*) from public.nusuk_club_tickets where user_id = uid and contest_id = c.id and kind = 'referral'),
        'copied_today', exists (select 1 from public.nusuk_club_tickets where user_id = uid and contest_id = c.id and kind = 'copy' and day = today),
        'rank', case when c.kind = 'top' then (
          select r from (
            select user_id, rank() over (order by count(*) desc) as r
            from public.nusuk_club_tickets where contest_id = c.id and kind = 'referral' group by user_id) x
          where x.user_id = uid) end
      ) end,
      'top', case when c.kind = 'top' then coalesce((
        select jsonb_agg(jsonb_build_object('name', split_part(mm.name, ' ', 1), 'sl', mm.sl, 'refs', x.n) order by x.n desc, mm.sl)
        from (select user_id, count(*) as n from public.nusuk_club_tickets where contest_id = c.id and kind = 'referral'
              group by user_id order by n desc limit 10) x
        join public.nusuk_club_members mm on mm.user_id = x.user_id), '[]'::jsonb) end
    );
  end loop;

  if uid is null then
    return jsonb_build_object('cfg', cfg, 'signed_in', false, 'member', null, 'contests', contests, 'today', today);
  end if;
  if not is_member then
    return jsonb_build_object('cfg', cfg, 'signed_in', true, 'member', null, 'contests', contests, 'today', today,
      'email', (select email from auth.users where id = uid));
  end if;
  select name into ref_name from public.nusuk_club_members where user_id = m.referred_by;
  return jsonb_build_object(
    'cfg', cfg,
    'signed_in', true,
    'today', today,
    'contests', contests,
    'member', jsonb_build_object(
      'sl', m.sl, 'name', m.name, 'phone', m.phone, 'email', m.email, 'nusuk_code', m.nusuk_code,
      'district', m.district, 'umrah_done', m.umrah_done, 'consent', m.consent,
      'referred_by', ref_name, 'joined', m.created_at),
    'history', coalesce((
      select jsonb_agg(jsonb_build_object('kind', h.kind, 'qty', h.qty, 'day', h.day, 'at', h.created_at, 'from', h.from_name, 'contest', h.title) order by h.created_at desc)
      from (
        select t.kind, t.qty, t.day, t.created_at, f.name as from_name, k.title
        from public.nusuk_club_tickets t
        join public.nusuk_club_contests k on k.id = t.contest_id
        left join public.nusuk_club_members f on f.user_id = t.from_user
        where t.user_id = uid
        order by t.created_at desc
        limit 40
      ) h), '[]'::jsonb)
  );
end $$;


grant execute on function public.nusuk_club_me() to anon, authenticated;
grant execute on function public.nusuk_admin_club_pool(int, text) to authenticated;
grant execute on function public.nusuk_admin_club_spin(int, text, int) to authenticated;
grant execute on function public.nusuk_club_live_draw() to anon, authenticated;
grant select, insert, update, delete on public.nusuk_club_winners to authenticated;
grant select, insert, update, delete on public.nusuk_club_draw_state to authenticated;
