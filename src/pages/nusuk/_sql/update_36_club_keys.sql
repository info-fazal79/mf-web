-- =====================================================================
-- Nusuk · update 36 · give Nusuk Keys to Reward Club members
-- Run once in Supabase → SQL Editor (after update 35), BEFORE pushing.
-- Safe to run again.
--
-- Nusuk Manager → Reward Club → Members: "Give N Keys" on a member sends N
-- Keys to their Nusuk code, at once or spread over H hours (same engine as
-- Raffle draw → Give Keys, nusuk_admin_award). Each gift is recorded with the
-- code's copy count at that moment, so progress = copies since then (max N).
-- The member sees the progress on their account page.
-- =====================================================================

create table if not exists public.nusuk_club_key_awards (
  id          bigint generated always as identity primary key,
  user_id     uuid not null references public.nusuk_club_members (user_id) on delete cascade,
  code        text not null,
  keys        int not null check (keys between 1 and 1000),
  hours       int check (hours is null or hours between 1 and 720),
  base_uses   int not null default 0,
  created_at  timestamptz not null default now()
);
create index if not exists nusuk_club_key_awards_user on public.nusuk_club_key_awards (user_id, created_at desc);
alter table public.nusuk_club_key_awards enable row level security;
drop policy if exists "nusuk_club_key_awards: admin all" on public.nusuk_club_key_awards;
create policy "nusuk_club_key_awards: admin all" on public.nusuk_club_key_awards for all using (public.is_admin()) with check (public.is_admin());

/** Nusuk Manager: give a member N Keys (p_hours empty/0 = at once) */
create or replace function public.nusuk_admin_club_give_keys(p_sl int, p_keys int, p_hours int default null)
returns jsonb
language plpgsql volatile security definer set search_path = public as $$
declare
  m public.nusuk_club_members;
  k int := least(1000, greatest(1, coalesce(p_keys, 50)));
  h int := case when coalesce(p_hours, 0) > 0 then least(720, p_hours) else null end;
  base int;
  r jsonb;
begin
  if not public.is_admin() then raise exception 'not allowed'; end if;
  select * into m from public.nusuk_club_members where sl = p_sl;
  if m.user_id is null then return jsonb_build_object('ok', false, 'reason', 'member'); end if;
  select uses into base from public.nusuk_codes where lower(code) = lower(m.nusuk_code) limit 1;
  r := public.nusuk_admin_award(m.nusuk_code, k, h, null);
  if not coalesce((r->>'ok')::boolean, false) then return r; end if;
  insert into public.nusuk_club_key_awards (user_id, code, keys, hours, base_uses)
  values (m.user_id, m.nusuk_code, k, h, coalesce(base, 0));
  return jsonb_build_object('ok', true, 'sl', m.sl, 'code', m.nusuk_code, 'keys', k, 'hours', h);
end $$;

/** Nusuk Manager: latest gift + progress per member (SL → …) */
create or replace function public.nusuk_admin_club_keys()
returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'not allowed'; end if;
  return coalesce((
    select jsonb_object_agg(x.sl::text, jsonb_build_object('keys', x.keys, 'hours', x.hours, 'at', x.created_at, 'delivered', x.delivered, 'count', x.cnt))
    from (
      select distinct on (k.user_id) m.sl, k.keys, k.hours, k.created_at,
             least(k.keys, greatest(0, coalesce(nc.uses, k.base_uses) - k.base_uses)) as delivered,
             (select count(*) from public.nusuk_club_key_awards k2 where k2.user_id = k.user_id) as cnt
      from public.nusuk_club_key_awards k
      join public.nusuk_club_members m on m.user_id = k.user_id
      left join public.nusuk_codes nc on lower(nc.code) = lower(k.code)
      order by k.user_id, k.created_at desc
    ) x), '{}'::jsonb);
end $$;

-- nusuk_club_me now also sends the member's latest Key gift and its progress
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
    'keys', (
      select jsonb_build_object('keys', k.keys, 'hours', k.hours, 'at', k.created_at,
               'delivered', least(k.keys, greatest(0, coalesce(nc.uses, k.base_uses) - k.base_uses)),
               'ends', case when k.hours is null then null else k.created_at + make_interval(hours => k.hours) end)
      from public.nusuk_club_key_awards k
      left join public.nusuk_codes nc on lower(nc.code) = lower(k.code)
      where k.user_id = uid order by k.created_at desc limit 1),
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
grant execute on function public.nusuk_admin_club_give_keys(int, int, int) to authenticated;
grant execute on function public.nusuk_admin_club_keys() to authenticated;
grant select, insert, update, delete on public.nusuk_club_key_awards to authenticated;
