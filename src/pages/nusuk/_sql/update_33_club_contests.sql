-- =====================================================================
-- Nusuk · update 33 · Reward Club competitions
-- Run once in Supabase → SQL Editor (after update 32), BEFORE pushing.
-- Safe to run again.
--
-- Several competitions, each with its own ticket rules, time window,
-- photo card and caption. Tickets are counted per competition.
--   join      · new account made while the competition is running
--   enter     · once per member (old members too) while it is running
--   ref_bonus · extra for a new member who joined with someone's code
--   referral  · to the code owner, for each new member who joined with it
--   copy      · once a day for copying a code inside the copy window
-- Each rule has a number (0 = off). Existing tickets go to the first
-- competition ("দৈনিক লাকি ড্র"). Two more samples are added, turned off.
-- =====================================================================

create table if not exists public.nusuk_club_contests (
  id           serial primary key,
  title        text not null check (char_length(title) between 2 and 80),
  kind         text not null default 'lucky' check (kind in ('lucky', 'window', 'top')),
  active       boolean not null default false,
  starts_at    timestamptz,
  ends_at      timestamptz,
  t_join       int not null default 1 check (t_join between 0 and 100),
  t_enter      int not null default 0 check (t_enter between 0 and 100),
  t_ref_bonus  int not null default 1 check (t_ref_bonus between 0 and 100),
  t_referral   int not null default 1 check (t_referral between 0 and 100),
  t_copy       int not null default 1 check (t_copy between 0 and 100),
  copy_from    text not null default '09:00',
  copy_to      text not null default '17:00',
  info         text not null default '',
  card         jsonb not null default '{}'::jsonb,
  caption      text not null default '',
  sort         int not null default 0,
  created_at   timestamptz not null default now()
);
alter table public.nusuk_club_contests enable row level security;
drop policy if exists "nusuk_club_contests: admin all" on public.nusuk_club_contests;
create policy "nusuk_club_contests: admin all" on public.nusuk_club_contests for all using (public.is_admin()) with check (public.is_admin());

-- the first competition = today's rules; two samples (off)
insert into public.nusuk_club_contests (title, kind, active, t_join, t_enter, t_ref_bonus, t_referral, t_copy, info, card, sort)
select * from (values
  ('দৈনিক লাকি ড্র', 'lucky', true, 1, 0, 1, 1, 1,
   'প্রতিদিনের টিকিট দিয়ে লাকি ড্র। যত বেশি টিকিট, তত বেশি সুযোগ।',
   '{"theme":"green","headline":"নুসুক উমরাহ প্রতিযোগিতা","sub":"রিবাত উপহার লাকি ড্র"}'::jsonb, 1),
  ('সীমিত সময়ের রেফারেল অফার', 'window', false, 1, 0, 1, 2, 0,
   'শুধু এই সময়ের মধ্যে যারা যুক্ত হবেন বা যাদের কোড দিয়ে কেউ যুক্ত হবেন, তারাই টিকিট পাবেন।',
   '{"theme":"gold","headline":"সীমিত সময়ের অফার","sub":"বন্ধুকে আনুন, টিকিট নিন"}'::jsonb, 2),
  ('সেরা রেফারার প্রতিযোগিতা', 'top', false, 0, 0, 0, 1, 0,
   'নির্দিষ্ট সময়ে যার কোড দিয়ে সবচেয়ে বেশি মানুষ যুক্ত হবেন, লিডারবোর্ডের শীর্ষে থাকা সদস্যরা পুরস্কার পাবেন।',
   '{"theme":"night","headline":"সেরা রেফারার প্রতিযোগিতা","sub":"সবচেয়ে বেশি বন্ধু আনুন"}'::jsonb, 3)
) v(title, kind, active, t_join, t_enter, t_ref_bonus, t_referral, t_copy, info, card, sort)
where not exists (select 1 from public.nusuk_club_contests);

-- tickets: per competition, with a quantity
alter table public.nusuk_club_tickets add column if not exists contest_id int references public.nusuk_club_contests (id) on delete cascade;
alter table public.nusuk_club_tickets add column if not exists qty int not null default 1;
update public.nusuk_club_tickets set contest_id = (select id from public.nusuk_club_contests order by sort, id limit 1) where contest_id is null;
alter table public.nusuk_club_tickets alter column contest_id set not null;
alter table public.nusuk_club_tickets drop constraint if exists nusuk_club_tickets_kind_check;
alter table public.nusuk_club_tickets add constraint nusuk_club_tickets_kind_check check (kind in ('join', 'enter', 'ref_bonus', 'referral', 'copy'));
alter table public.nusuk_club_tickets drop constraint if exists nusuk_club_tickets_qty_check;
alter table public.nusuk_club_tickets add constraint nusuk_club_tickets_qty_check check (qty between 1 and 100);

drop index if exists public.nusuk_club_t_join;
drop index if exists public.nusuk_club_t_bonus;
drop index if exists public.nusuk_club_t_copy;
drop index if exists public.nusuk_club_t_ref;
create unique index if not exists nusuk_club_tc_join on public.nusuk_club_tickets (contest_id, user_id) where kind = 'join';
create unique index if not exists nusuk_club_tc_enter on public.nusuk_club_tickets (contest_id, user_id) where kind = 'enter';
create unique index if not exists nusuk_club_tc_bonus on public.nusuk_club_tickets (contest_id, user_id) where kind = 'ref_bonus';
create unique index if not exists nusuk_club_tc_copy on public.nusuk_club_tickets (contest_id, user_id, day) where kind = 'copy';
create unique index if not exists nusuk_club_tc_ref on public.nusuk_club_tickets (contest_id, from_user) where kind = 'referral';
create index if not exists nusuk_club_tc_contest on public.nusuk_club_tickets (contest_id, day);

-- ---------- helpers ----------
/** Competitions running right now */
create or replace function public.nusuk_club_live()
returns setof public.nusuk_club_contests
language sql stable security definer set search_path = public as $$
  select * from public.nusuk_club_contests
  where active and (starts_at is null or now() >= starts_at) and (ends_at is null or now() < ends_at)
  order by sort, id
$$;
revoke all on function public.nusuk_club_live() from public, anon, authenticated;

create or replace function public.nusuk_club_give(p_user uuid, p_contest int, p_kind text, p_qty int, p_from uuid default null)
returns int
language plpgsql volatile security definer set search_path = public as $$
declare n int;
begin
  if coalesce(p_qty, 0) < 1 then return 0; end if;
  insert into public.nusuk_club_tickets (user_id, contest_id, kind, qty, from_user)
  values (p_user, p_contest, p_kind, least(p_qty, 100), p_from)
  on conflict do nothing;
  get diagnostics n = row_count;
  return n;
end $$;
revoke all on function public.nusuk_club_give(uuid, int, text, int, uuid) from public, anon, authenticated;

-- ---------- member functions ----------
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
      'info', c.info, 'card', c.card, 'caption', c.caption,
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

create or replace function public.nusuk_club_save(
  p_name text, p_phone text, p_code text, p_district text, p_umrah text, p_consent boolean,
  p_ref text default null, p_device text default null)
returns jsonb
language plpgsql volatile security definer set search_path = public as $$
declare
  cfg jsonb := public.nusuk_club_cfg();
  uid uuid := auth.uid();
  v_name text := btrim(regexp_replace(coalesce(p_name, ''), '\s+', ' ', 'g'));
  v_phone text := public.nusuk_club_phone(p_phone);
  v_code text := regexp_replace(coalesce(p_code, ''), '\s', '', 'g');
  v_district text := nullif(btrim(left(coalesce(p_district, ''), 40)), '');
  v_umrah text := case when p_umrah in ('yes', 'no', 'planning') then p_umrah else null end;
  v_device text := case when p_device ~ '^[0-9a-fA-F-]{36}$' then p_device else null end;
  ref public.nusuk_club_members;
  v_ok boolean := false;
  c public.nusuk_club_contests;
begin
  if uid is null then return jsonb_build_object('ok', false, 'reason', 'signin'); end if;
  if char_length(v_name) < 2 or char_length(v_name) > 60 then return jsonb_build_object('ok', false, 'reason', 'name'); end if;
  if v_phone is null then return jsonb_build_object('ok', false, 'reason', 'phone'); end if;
  if exists (select 1 from public.nusuk_club_members where phone = v_phone and user_id <> uid) then
    return jsonb_build_object('ok', false, 'reason', 'phone_taken');
  end if;

  -- existing member: profile details only; Nusuk code and referrer never change
  if exists (select 1 from public.nusuk_club_members where user_id = uid) then
    update public.nusuk_club_members
       set name = v_name, phone = v_phone, district = v_district, umrah_done = v_umrah,
           consent = coalesce(p_consent, false), updated_at = now()
     where user_id = uid;
    return jsonb_build_object('ok', true, 'created', false);
  end if;

  if not coalesce((cfg->>'on')::boolean, false) then return jsonb_build_object('ok', false, 'reason', 'closed'); end if;
  if v_code !~ '^NG-[A-Za-z0-9]{8}$' then return jsonb_build_object('ok', false, 'reason', 'code'); end if;
  if exists (select 1 from public.nusuk_club_members where lower(nusuk_code) = lower(v_code)) then
    return jsonb_build_object('ok', false, 'reason', 'code_taken');
  end if;

  if nullif(btrim(coalesce(p_ref, '')), '') is not null then
    select * into ref from public.nusuk_club_members where lower(nusuk_code) = lower(btrim(p_ref));
    if not found then return jsonb_build_object('ok', false, 'reason', 'bad_ref'); end if;
    if lower(btrim(p_ref)) = lower(v_code) then return jsonb_build_object('ok', false, 'reason', 'self_ref'); end if;
    v_ok := v_device is not null and not exists (select 1 from public.nusuk_club_members where device = v_device);
  end if;

  insert into public.nusuk_club_members (user_id, name, phone, email, nusuk_code, district, umrah_done, consent, referred_by, ref_ok, device)
  values (uid, v_name, v_phone, (select email from auth.users where id = uid), v_code, v_district, v_umrah,
          coalesce(p_consent, false), ref.user_id, v_ok, v_device);

  for c in select * from public.nusuk_club_live() loop
    perform public.nusuk_club_give(uid, c.id, 'join', c.t_join);
    perform public.nusuk_club_give(uid, c.id, 'enter', c.t_enter);
    if v_ok then
      perform public.nusuk_club_give(uid, c.id, 'ref_bonus', c.t_ref_bonus, ref.user_id);
      perform public.nusuk_club_give(ref.user_id, c.id, 'referral', c.t_referral, uid);
    end if;
  end loop;
  return jsonb_build_object('ok', true, 'created', true, 'ref_counted', v_ok);
exception when unique_violation then
  return jsonb_build_object('ok', false, 'reason', 'busy');
end $$;

create or replace function public.nusuk_club_copy()
returns jsonb
language plpgsql volatile security definer set search_path = public as $$
declare
  cfg jsonb := public.nusuk_club_cfg();
  uid uuid := auth.uid();
  c public.nusuk_club_contests;
  n int := 0;
  open_now int := 0;
  had int := 0;
begin
  if uid is null or not exists (select 1 from public.nusuk_club_members where user_id = uid) then
    return jsonb_build_object('ok', false, 'reason', 'member');
  end if;
  if not coalesce((cfg->>'on')::boolean, false) then return jsonb_build_object('ok', false, 'reason', 'closed'); end if;
  for c in select * from public.nusuk_club_live() where t_copy > 0 loop
    if public.nusuk_club_in_window(jsonb_build_object('copy_from', c.copy_from, 'copy_to', c.copy_to)) then
      open_now := open_now + 1;
      if exists (select 1 from public.nusuk_club_tickets where user_id = uid and contest_id = c.id and kind = 'copy' and day = public.nusuk_today()) then
        had := had + 1;
      else
        n := n + public.nusuk_club_give(uid, c.id, 'copy', c.t_copy);
      end if;
    end if;
  end loop;
  if open_now = 0 then return jsonb_build_object('ok', false, 'reason', 'window'); end if;
  return jsonb_build_object('ok', true, 'counted', n > 0, 'n', n);
end $$;

-- ---------- Nusuk Manager ----------
drop function if exists public.nusuk_admin_club(text, int, int);
create or replace function public.nusuk_admin_club(p_search text default '', p_limit int default 50, p_offset int default 0, p_contest int default null)
returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  today date := public.nusuk_today();
  q text := lower(btrim(coalesce(p_search, '')));
begin
  if not public.is_admin() then raise exception 'not allowed'; end if;
  return jsonb_build_object(
    'today', today,
    'stats', jsonb_build_object(
      'members', (select count(*) from public.nusuk_club_members),
      'members_today', (select count(*) from public.nusuk_club_members where (created_at at time zone 'Asia/Dhaka')::date = today),
      'referred', (select count(*) from public.nusuk_club_members where ref_ok),
      'tickets', (select coalesce(sum(qty), 0) from public.nusuk_club_tickets where p_contest is null or contest_id = p_contest),
      'tickets_today', (select coalesce(sum(qty), 0) from public.nusuk_club_tickets where day = today and (p_contest is null or contest_id = p_contest)),
      'copy_today', (select count(*) from public.nusuk_club_tickets where day = today and kind = 'copy' and (p_contest is null or contest_id = p_contest)),
      'holders_today', (select count(distinct user_id) from public.nusuk_club_tickets where day = today and (p_contest is null or contest_id = p_contest))),
    'top', coalesce((
      select jsonb_agg(x order by x.refs desc, x.sl)
      from (
        select m.sl, m.name, m.nusuk_code, count(t.id) as refs
        from public.nusuk_club_members m
        join public.nusuk_club_tickets t on t.user_id = m.user_id and t.kind = 'referral' and (p_contest is null or t.contest_id = p_contest)
        group by m.user_id
        order by refs desc, m.sl
        limit 10
      ) x), '[]'::jsonb),
    'total', (select count(*) from public.nusuk_club_members m
              where q = '' or lower(m.name) like '%' || q || '%' or m.phone like '%' || q || '%'
                 or lower(m.nusuk_code) like '%' || q || '%' or lower(coalesce(m.email, '')) like '%' || q || '%' or m.sl::text = q),
    'rows', coalesce((
      select jsonb_agg(r order by r.sl desc)
      from (
        select m.sl, m.name, m.phone, m.email, m.nusuk_code, m.district, m.umrah_done, m.consent, m.ref_ok,
               m.created_at, rm.name as ref_name, rm.sl as ref_sl,
               (select coalesce(sum(qty), 0) from public.nusuk_club_tickets t where t.user_id = m.user_id and (p_contest is null or t.contest_id = p_contest)) as tickets,
               (select coalesce(sum(qty), 0) from public.nusuk_club_tickets t where t.user_id = m.user_id and t.day = today and (p_contest is null or t.contest_id = p_contest)) as tickets_today,
               (select count(*) from public.nusuk_club_tickets t where t.user_id = m.user_id and t.kind = 'referral' and (p_contest is null or t.contest_id = p_contest)) as referrals
        from public.nusuk_club_members m
        left join public.nusuk_club_members rm on rm.user_id = m.referred_by
        where q = '' or lower(m.name) like '%' || q || '%' or m.phone like '%' || q || '%'
           or lower(m.nusuk_code) like '%' || q || '%' or lower(coalesce(m.email, '')) like '%' || q || '%' or m.sl::text = q
        order by m.sl desc
        limit greatest(1, least(p_limit, 5000)) offset greatest(0, p_offset)
      ) r), '[]'::jsonb)
  );
end $$;

drop function if exists public.nusuk_admin_club_day(date);
create or replace function public.nusuk_admin_club_day(p_day date default null, p_contest int default null)
returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare d date := coalesce(p_day, public.nusuk_today());
begin
  if not public.is_admin() then raise exception 'not allowed'; end if;
  return jsonb_build_object('day', d, 'rows', coalesce((
    select jsonb_agg(jsonb_build_object('sl', m.sl, 'name', m.name, 'phone', m.phone, 'code', m.nusuk_code, 'tickets', x.n) order by x.n desc, m.sl)
    from (select user_id, sum(qty) as n from public.nusuk_club_tickets
          where day = d and (p_contest is null or contest_id = p_contest) group by user_id) x
    join public.nusuk_club_members m on m.user_id = x.user_id), '[]'::jsonb));
end $$;

/** Ticket totals per competition for the admin list */
create or replace function public.nusuk_admin_club_contests()
returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'not allowed'; end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object('id', c.id, 'tickets', coalesce(t.n, 0), 'people', coalesce(t.p, 0)))
    from public.nusuk_club_contests c
    left join (select contest_id, sum(qty) as n, count(distinct user_id) as p from public.nusuk_club_tickets group by contest_id) t on t.contest_id = c.id
  ), '[]'::jsonb);
end $$;

grant execute on function public.nusuk_club_me() to anon, authenticated;
grant execute on function public.nusuk_club_save(text, text, text, text, text, boolean, text, text) to authenticated;
grant execute on function public.nusuk_club_copy() to authenticated;
grant execute on function public.nusuk_admin_club(text, int, int, int) to authenticated;
grant execute on function public.nusuk_admin_club_day(date, int) to authenticated;
grant execute on function public.nusuk_admin_club_contests() to authenticated;
grant select, insert, update, delete on public.nusuk_club_contests to authenticated;
grant usage, select on sequence public.nusuk_club_contests_id_seq to authenticated;
