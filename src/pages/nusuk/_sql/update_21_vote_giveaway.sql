-- =====================================================================
-- Nusuk · update 21 · votes and giveaways in the top bar
-- Run once in Supabase → SQL Editor, BEFORE pushing the admin version with
-- "Vote" and "Giveaway" on the Top notice page. Safe to run again.
--
-- VOTE: you ask a question; visitors answer 👍 yes or 👎 no (one vote per
-- browser, they can change it). A "no" must say why; you read the reasons
-- in Nusuk Manager. The bar shows the live yes/no counts.
--
-- GIVEAWAY: a prize (text + optional picture) for N hours with a live
-- countdown in the bar. To enter, visitors do the tasks you choose (follow
-- the page, join the group, share a post), then give their Nusuk code,
-- Facebook name (and the share link). You check entries, draw a winner on
-- the server, and the bar shows the winner.
-- =====================================================================

-- ---------- Vote ----------
create table if not exists public.nusuk_polls (
  id         bigint generated always as identity primary key,
  question   text not null check (char_length(question) between 3 and 300),
  is_on      boolean not null default true,
  ends_at    timestamptz,
  created_at timestamptz not null default now()
);
create table if not exists public.nusuk_poll_votes (
  poll_id    bigint not null references public.nusuk_polls (id) on delete cascade,
  device     uuid not null,
  vote       smallint not null check (vote in (1, -1)),
  reason     text check (char_length(reason) <= 1000),
  created_at timestamptz not null default now(),
  primary key (poll_id, device)
);

-- ---------- Giveaway ----------
create table if not exists public.nusuk_giveaways (
  id          bigint generated always as identity primary key,
  title       text not null default 'গিভঅ্যাওয়ে',
  prize       text not null default '',
  prize_image text not null default '',
  details     text not null default '',
  is_on       boolean not null default false,
  starts_at   timestamptz,
  ends_at     timestamptz,
  need_page   boolean not null default true,
  need_group  boolean not null default true,
  need_share  boolean not null default false,
  page_url    text not null default '',
  group_url   text not null default '',
  post_url    text not null default '',
  winner_code text,
  winner_name text,
  winner_at   timestamptz,
  created_at  timestamptz not null default now()
);
create table if not exists public.nusuk_giveaway_entries (
  id          bigint generated always as identity primary key,
  giveaway_id bigint not null references public.nusuk_giveaways (id) on delete cascade,
  code        text not null,
  fb_name     text not null,
  share_link  text,
  did_page    boolean not null default false,
  did_group   boolean not null default false,
  device      uuid,
  status      text not null default 'ok' check (status in ('ok', 'invalid')),
  created_at  timestamptz not null default now(),
  unique (giveaway_id, code)
);
create index if not exists nusuk_giveaway_entries_dev on public.nusuk_giveaway_entries (giveaway_id, device);

alter table public.nusuk_polls             enable row level security;
alter table public.nusuk_poll_votes        enable row level security;
alter table public.nusuk_giveaways         enable row level security;
alter table public.nusuk_giveaway_entries  enable row level security;
do $$ begin
  drop policy if exists "polls: admin"   on public.nusuk_polls;
  drop policy if exists "votes: admin"   on public.nusuk_poll_votes;
  drop policy if exists "gives: admin"   on public.nusuk_giveaways;
  drop policy if exists "entries: admin" on public.nusuk_giveaway_entries;
end $$;
create policy "polls: admin"   on public.nusuk_polls            for all using (public.is_admin()) with check (public.is_admin());
create policy "votes: admin"   on public.nusuk_poll_votes       for all using (public.is_admin()) with check (public.is_admin());
create policy "gives: admin"   on public.nusuk_giveaways        for all using (public.is_admin()) with check (public.is_admin());
create policy "entries: admin" on public.nusuk_giveaway_entries for all using (public.is_admin()) with check (public.is_admin());

-- ---------- Public: what the top bar shows ----------
create or replace function public.nusuk_live(p_device uuid default null)
returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  p public.nusuk_polls;
  g public.nusuk_giveaways;
begin
  select * into p from public.nusuk_polls
   where is_on and (ends_at is null or ends_at > now() - interval '12 hours')
   order by id desc limit 1;
  -- A giveaway shows while running, and for a day after it ends (to show the winner)
  select * into g from public.nusuk_giveaways
   where is_on and starts_at is not null and starts_at <= now()
     and (ends_at is null or ends_at > now() - interval '24 hours')
   order by id desc limit 1;
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
      'entries', (select count(*) from public.nusuk_giveaway_entries e where e.giveaway_id = g.id and e.status = 'ok'),
      'mine', exists (select 1 from public.nusuk_giveaway_entries e where e.giveaway_id = g.id and e.device = p_device),
      'winner', case when g.winner_code is null then null else jsonb_build_object(
        'name', g.winner_name, 'code', public.nusuk_mask(g.winner_code)) end) end
  );
end $$;
grant execute on function public.nusuk_live(uuid) to anon, authenticated;

-- ---------- Public: vote (one per browser; can change it) ----------
create or replace function public.nusuk_poll_vote(p_poll bigint, p_device uuid, p_vote int, p_reason text default null)
returns jsonb
language plpgsql volatile security definer set search_path = public as $$
declare
  p public.nusuk_polls;
  r text := left(trim(coalesce(p_reason, '')), 1000);
begin
  select * into p from public.nusuk_polls where id = p_poll;
  if p.id is null or not p.is_on or (p.ends_at is not null and p.ends_at <= now()) then
    return jsonb_build_object('ok', false, 'reason', 'closed');
  end if;
  if p_device is null or p_vote not in (1, -1) then return jsonb_build_object('ok', false, 'reason', 'bad'); end if;
  if p_vote = -1 and char_length(r) < 3 then return jsonb_build_object('ok', false, 'reason', 'need_reason'); end if;
  insert into public.nusuk_poll_votes (poll_id, device, vote, reason)
  values (p_poll, p_device, p_vote, case when p_vote = -1 then r else null end)
  on conflict (poll_id, device) do update
    set vote = excluded.vote, reason = excluded.reason, created_at = now();
  return jsonb_build_object('ok', true);
end $$;
grant execute on function public.nusuk_poll_vote(bigint, uuid, int, text) to anon, authenticated;

-- ---------- Public: enter a giveaway ----------
create or replace function public.nusuk_giveaway_enter(p_id bigint, p_device uuid, p_code text, p_name text,
                                                      p_share text default null, p_page boolean default false, p_group boolean default false)
returns jsonb
language plpgsql volatile security definer set search_path = public as $$
declare
  g public.nusuk_giveaways;
  v_code text := trim(coalesce(p_code, ''));
  v_name text := left(trim(coalesce(p_name, '')), 120);
  v_share text := left(trim(coalesce(p_share, '')), 600);
begin
  select * into g from public.nusuk_giveaways where id = p_id;
  if g.id is null or not g.is_on or g.starts_at is null or g.starts_at > now() or (g.ends_at is not null and g.ends_at <= now()) then
    return jsonb_build_object('ok', false, 'reason', 'closed');
  end if;
  if v_code !~ '^NG-[A-Za-z0-9]{8}$' then return jsonb_build_object('ok', false, 'reason', 'bad_code'); end if;
  if v_name = '' then return jsonb_build_object('ok', false, 'reason', 'need_name'); end if;
  if g.need_page and not coalesce(p_page, false) then return jsonb_build_object('ok', false, 'reason', 'need_page'); end if;
  if g.need_group and not coalesce(p_group, false) then return jsonb_build_object('ok', false, 'reason', 'need_group'); end if;
  if g.need_share and v_share !~* '^https?://([a-z0-9-]+\.)*(facebook\.com|fb\.com|fb\.me|fb\.watch)(/|$)' then
    return jsonb_build_object('ok', false, 'reason', 'need_share');
  end if;
  if exists (select 1 from public.nusuk_giveaway_entries e where e.giveaway_id = p_id and lower(e.code) = lower(v_code)) then
    return jsonb_build_object('ok', false, 'reason', 'exists');
  end if;
  -- A few entries per browser at most (a family may share a phone), so nobody floods the draw
  if p_device is not null and (select count(*) from public.nusuk_giveaway_entries e where e.giveaway_id = p_id and e.device = p_device) >= 3 then
    return jsonb_build_object('ok', false, 'reason', 'too_many');
  end if;
  insert into public.nusuk_giveaway_entries (giveaway_id, code, fb_name, share_link, did_page, did_group, device)
  values (p_id, v_code, v_name, nullif(v_share, ''), coalesce(p_page, false), coalesce(p_group, false), p_device);
  return jsonb_build_object('ok', true);
end $$;
grant execute on function public.nusuk_giveaway_enter(bigint, uuid, text, text, text, boolean, boolean) to anon, authenticated;

-- ---------- Admin: draw a winner (random among valid entries) ----------
create or replace function public.nusuk_giveaway_draw(p_id bigint)
returns jsonb
language plpgsql volatile security definer set search_path = public as $$
declare e public.nusuk_giveaway_entries;
begin
  if not public.is_admin() then raise exception 'not allowed'; end if;
  select * into e from public.nusuk_giveaway_entries x
   where x.giveaway_id = p_id and x.status = 'ok'
   order by random() limit 1;
  if e.id is null then return jsonb_build_object('ok', false, 'reason', 'empty'); end if;
  update public.nusuk_giveaways set winner_code = e.code, winner_name = e.fb_name, winner_at = now() where id = p_id;
  return jsonb_build_object('ok', true, 'code', e.code, 'name', e.fb_name, 'share_link', e.share_link);
end $$;
grant execute on function public.nusuk_giveaway_draw(bigint) to authenticated;
