-- =====================================================================
-- Nusuk · update 22 · raffle draw (spinning wheel), several winners,
-- prizes per place, and "give N Keys" to a winner
-- Run once in Supabase → SQL Editor (after update 21), BEFORE pushing the
-- admin version with "Raffle draw". Safe to run again.
--
--   • nusuk_giveaways.prizes      – prize per place: [{"place":1,"prize":"…","keys":50}, …]
--   • nusuk_raffle_winners        – everyone drawn on the wheel, in order
--   • nusuk_raffle_spin()         – the server picks the next winner at random
--                                   (the wheel only shows the result)
--   • nusuk_admin_award()         – gives a code N Keys: either instantly
--                                   (Instant Keys) or spread over H hours (Feature)
--   • nusuk_codes.boost_hours     – a code's own feature time (empty = Settings)
--   • nusuk_live()                – the top bar now shows all winners
-- =====================================================================

alter table public.nusuk_giveaways add column if not exists prizes jsonb not null default '[]'::jsonb;
alter table public.nusuk_codes add column if not exists boost_hours int
  check (boost_hours is null or boost_hours between 1 and 720);

create table if not exists public.nusuk_raffle_winners (
  id          bigint generated always as identity primary key,
  giveaway_id bigint not null references public.nusuk_giveaways (id) on delete cascade,
  entry_id    bigint not null references public.nusuk_giveaway_entries (id) on delete cascade,
  code        text not null,
  fb_name     text not null,
  place       int not null,
  prize       text not null default '',
  keys        int,
  awarded_at  timestamptz,
  award_mode  text,
  created_at  timestamptz not null default now(),
  unique (giveaway_id, entry_id)
);
alter table public.nusuk_raffle_winners enable row level security;
drop policy if exists "raffle winners: admin" on public.nusuk_raffle_winners;
create policy "raffle winners: admin" on public.nusuk_raffle_winners for all using (public.is_admin()) with check (public.is_admin());

-- ---------- A code's own feature time ----------
create or replace function public.nusuk_boost_tier(c public.nusuk_codes, s public.nusuk_settings)
returns int
language sql stable as $$
  select case
    when c.featured_at is not null
         and c.featured_at > now() - make_interval(hours => coalesce(c.boost_hours, s.feature_hours))
         and c.uses - c.featured_base < coalesce(c.boost_quota, s.feature_quota) then 1
    when c.approved_at is not null
         and c.uses - c.approved_base < s.approved_quota then 2
    else 3 end;
$$;

-- Pick: same as update 20, the feature pacing uses each code's own hours
create or replace function public.nusuk_pick(p_exclude bigint[])
returns table (id bigint, code text)
language plpgsql volatile security definer set search_path = public as $$
declare
  s public.nusuk_settings;
  ex bigint[] := coalesce(p_exclude, '{}');
  v_id bigint;
  v_code text;
begin
  select c.id, c.code into v_id, v_code
  from public.nusuk_codes c
  where c.status = 'active' and c.instant_quota is not null
    and not (c.id = any (ex))
    and c.uses - c.instant_base
        + (select count(*) from public.nusuk_instant_holds h where h.code_id = c.id and h.at > now() - interval '90 seconds')
        < c.instant_quota
  order by c.instant_at, c.id
  limit 1
  for update of c skip locked;
  if v_id is not null then
    insert into public.nusuk_instant_holds (code_id) values (v_id);
    if random() < 0.02 then
      delete from public.nusuk_instant_holds where at < now() - interval '1 hour';
    end if;
    return query select v_id, v_code;
    return;
  end if;

  select * into s from public.nusuk_settings st where st.id = 1;

  if random() * 100 < coalesce(s.boost_share, 80) then
    return query
      select c.id, c.code from public.nusuk_codes c
      where c.status = 'active'
        and (c.featured_at is not null or c.approved_at is not null)
        and not (c.id = any (ex))
        and (
          (public.nusuk_boost_tier(c, s) = 1
            and c.uses - c.featured_base
                < ceil(coalesce(c.boost_quota, s.feature_quota)
                       * least(1.0, extract(epoch from now() - c.featured_at)
                                    / (greatest(1, coalesce(c.boost_hours, s.feature_hours, 12)) * 3600.0))))
          or public.nusuk_boost_tier(c, s) = 2
        )
      order by public.nusuk_boost_tier(c, s),
               case when public.nusuk_boost_tier(c, s) = 1 then c.uses - c.featured_base else c.uses - c.approved_base end,
               coalesce(c.featured_at, c.approved_at),
               c.id
      limit 1;
    if found then return; end if;
  end if;

  return query
    select c.id, c.code from public.nusuk_codes c
    where c.status = 'active' and not (c.id = any (ex))
    order by c.uses, c.last_used_at nulls first, c.id
    limit 1;
end $$;
revoke all on function public.nusuk_pick(bigint[]) from public, anon, authenticated;

-- Featured list: each code's own end time
create or replace function public.nusuk_featured_list()
returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  s public.nusuk_settings;
begin
  select * into s from public.nusuk_settings st where st.id = 1;
  if s is null or not s.enabled then
    return jsonb_build_object('running', '[]'::jsonb, 'recent', '[]'::jsonb, 'total', 0, 'now', now());
  end if;
  return jsonb_build_object(
    'now', now(),
    'running', (
      select coalesce(jsonb_agg(jsonb_build_object('code', public.nusuk_mask(x.code), 'since', x.featured_at, 'ends', x.ends) order by x.featured_at desc), '[]'::jsonb)
      from (select c.code, c.featured_at, c.featured_at + make_interval(hours => greatest(1, coalesce(c.boost_hours, s.feature_hours, 12))) as ends
            from public.nusuk_codes c where c.featured_at is not null and c.status = 'active') x
      where x.ends > now()),
    'recent', (
      select coalesce(jsonb_agg(jsonb_build_object('code', public.nusuk_mask(z.code), 'since', z.featured_at, 'ends', z.ends) order by z.ends desc), '[]'::jsonb)
      from (select y.* from (
              select c.code, c.featured_at, c.status, c.featured_at + make_interval(hours => greatest(1, coalesce(c.boost_hours, s.feature_hours, 12))) as ends
              from public.nusuk_codes c where c.featured_at is not null and c.status <> 'rejected'
              order by c.featured_at desc limit 60) y
            where not (y.status = 'active' and y.ends > now())
            order by y.ends desc limit 15) z),
    'total', (select count(*) from public.nusuk_codes c where c.featured_at is not null and c.status <> 'rejected')
  );
end $$;
grant execute on function public.nusuk_featured_list() to anon, authenticated;

-- Approving a feature request uses the normal time (clears any award hours)
create or replace function public.nusuk_admin_feature_approve(p_id bigint, p_quota int default null)
returns jsonb
language plpgsql volatile security definer set search_path = public as $$
declare
  r public.nusuk_feature_requests;
begin
  if not public.is_admin() then raise exception 'not allowed'; end if;
  select * into r from public.nusuk_feature_requests x where x.id = p_id;
  if r.id is null then raise exception 'request not found'; end if;
  update public.nusuk_codes c
     set featured_at = now(), status = 'active', boost_hours = null,
         boost_quota = case when p_quota between 1 and 1000 then p_quota else null end
   where lower(c.code) = lower(r.code) and c.status <> 'rejected';
  if not found then raise exception 'code % is not in the list (deleted or rejected)', r.code; end if;
  update public.nusuk_feature_requests x set status = 'approved', decided_at = now() where x.id = p_id;
  return jsonb_build_object('ok', true, 'code', r.code);
end $$;
revoke all on function public.nusuk_admin_feature_approve(bigint, int) from public, anon;
grant execute on function public.nusuk_admin_feature_approve(bigint, int) to authenticated;

-- ---------- Raffle: the server draws the next winner ----------
create or replace function public.nusuk_raffle_spin(p_giveaway bigint)
returns jsonb
language plpgsql volatile security definer set search_path = public as $$
declare
  g public.nusuk_giveaways;
  e public.nusuk_giveaway_entries;
  n int;
  pz jsonb;
  w public.nusuk_raffle_winners;
begin
  if not public.is_admin() then raise exception 'not allowed'; end if;
  select * into g from public.nusuk_giveaways where id = p_giveaway for update;
  if g.id is null then raise exception 'giveaway not found'; end if;
  select * into e from public.nusuk_giveaway_entries x
   where x.giveaway_id = p_giveaway and x.status = 'ok'
     and not exists (select 1 from public.nusuk_raffle_winners r where r.entry_id = x.id)
   order by random() limit 1;
  if e.id is null then return jsonb_build_object('ok', false, 'reason', 'empty'); end if;
  select count(*) + 1 into n from public.nusuk_raffle_winners r where r.giveaway_id = p_giveaway;
  select x.value into pz from jsonb_array_elements(coalesce(g.prizes, '[]'::jsonb)) as x(value)
   where (x.value ->> 'place') ~ '^\d+$' and (x.value ->> 'place')::int = n limit 1;
  insert into public.nusuk_raffle_winners (giveaway_id, entry_id, code, fb_name, place, prize, keys)
  values (p_giveaway, e.id, e.code, e.fb_name, n, coalesce(pz ->> 'prize', g.prize, ''),
          case when (pz ->> 'keys') ~ '^\d+$' then (pz ->> 'keys')::int else null end)
  returning * into w;
  -- The first winner is also the giveaway's main winner (shown by older pages)
  if n = 1 then
    update public.nusuk_giveaways set winner_code = e.code, winner_name = e.fb_name, winner_at = now() where id = p_giveaway;
  end if;
  return jsonb_build_object('ok', true, 'winner', to_jsonb(w));
end $$;
grant execute on function public.nusuk_raffle_spin(bigint) to authenticated;

-- ---------- Admin: give a code N Keys ----------
-- p_hours null/0: Instant Keys (top of the page until it gets N copies, as fast as visitors come).
-- p_hours ≥ 1:    Feature for N copies spread evenly over that many hours.
create or replace function public.nusuk_admin_award(p_code text, p_keys int, p_hours int default null, p_winner bigint default null)
returns jsonb
language plpgsql volatile security definer set search_path = public as $$
declare
  k int := least(1000, greatest(1, coalesce(p_keys, 1)));
  c public.nusuk_codes;
begin
  if not public.is_admin() then raise exception 'not allowed'; end if;
  select * into c from public.nusuk_codes x where lower(x.code) = lower(trim(p_code)) limit 1;
  if c.id is null then
    insert into public.nusuk_codes (code, status, source) values (trim(p_code), 'active', 'admin') returning * into c;
  end if;
  if c.status = 'rejected' then return jsonb_build_object('ok', false, 'reason', 'rejected'); end if;
  if coalesce(p_hours, 0) <= 0 then
    update public.nusuk_codes set status = 'active', instant_quota = k, instant_base = uses, instant_at = now() where id = c.id;
  else
    update public.nusuk_codes set status = 'active', featured_at = now(), boost_quota = k, boost_hours = least(720, p_hours) where id = c.id;
  end if;
  if p_winner is not null then
    update public.nusuk_raffle_winners set awarded_at = now(), keys = k,
           award_mode = case when coalesce(p_hours, 0) <= 0 then 'instant' else p_hours || 'h' end
     where id = p_winner;
  end if;
  return jsonb_build_object('ok', true, 'code', c.code, 'keys', k, 'hours', p_hours);
end $$;
revoke all on function public.nusuk_admin_award(text, int, int, bigint) from public, anon;
grant execute on function public.nusuk_admin_award(text, int, int, bigint) to authenticated;

-- ---------- Top bar: all winners of the giveaway ----------
create or replace function public.nusuk_live(p_device uuid default null)
returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  p public.nusuk_polls;
  g public.nusuk_giveaways;
  ws jsonb;
begin
  select * into p from public.nusuk_polls
   where is_on and (ends_at is null or ends_at > now() - interval '12 hours')
   order by id desc limit 1;
  select * into g from public.nusuk_giveaways
   where is_on and starts_at is not null and starts_at <= now()
     and (ends_at is null or ends_at > now() - interval '24 hours')
   order by id desc limit 1;
  if g.id is not null then
    select coalesce(jsonb_agg(jsonb_build_object('place', r.place, 'name', r.fb_name, 'code', public.nusuk_mask(r.code), 'prize', r.prize) order by r.place), '[]'::jsonb)
      into ws from public.nusuk_raffle_winners r where r.giveaway_id = g.id;
    if ws = '[]'::jsonb and g.winner_code is not null then
      ws := jsonb_build_array(jsonb_build_object('place', 1, 'name', g.winner_name, 'code', public.nusuk_mask(g.winner_code), 'prize', g.prize));
    end if;
  end if;
  return jsonb_build_object(
    'now', now(),
    'poll', case when p.id is null then null else jsonb_build_object(
      'id', p.id, 'question', p.question, 'ends_at', p.ends_at,
      'open', p.ends_at is null or p.ends_at > now(),
      'yes', (select count(*) from public.nusuk_poll_votes v where v.poll_id = p.id and v.vote = 1),
      'no',  (select count(*) from public.nusuk_poll_votes v where v.poll_id = p.id and v.vote = -1),
      'mine', (select v.vote from public.nusuk_poll_votes v where v.poll_id = p.id and v.device = p_device)) end,
    'giveaway', case when g.id is null then null else jsonb_build_object(
      'id', g.id, 'title', g.title, 'prize', g.prize, 'prize_image', g.prize_image, 'details', g.details,
      'ends_at', g.ends_at, 'open', g.ends_at is null or g.ends_at > now(),
      'need_page', g.need_page, 'need_group', g.need_group, 'need_share', g.need_share,
      'page_url', g.page_url, 'group_url', g.group_url, 'post_url', g.post_url,
      'prizes', g.prizes,
      'entries', (select count(*) from public.nusuk_giveaway_entries e where e.giveaway_id = g.id and e.status = 'ok'),
      'mine', exists (select 1 from public.nusuk_giveaway_entries e where e.giveaway_id = g.id and e.device = p_device),
      'winners', ws,
      'winner', case when jsonb_array_length(coalesce(ws, '[]'::jsonb)) > 0 then ws -> 0 else null end) end
  );
end $$;
grant execute on function public.nusuk_live(uuid) to anon, authenticated;

notify pgrst, 'reload schema';
