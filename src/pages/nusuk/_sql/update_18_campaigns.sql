-- =====================================================================
-- Nusuk · update 18 · several campaigns, per-post share rules, custom boards
-- Run once in Supabase → SQL Editor (after update 17), BEFORE pushing the
-- new admin version. Safe to run again.
--
-- What changes
--   • Many campaigns, each with its own title, dates, rules, posts, points
--     and leaderboard. Status: Hidden (only you, for testing) / Live
--     (everyone) / Closed (finished, kept for records). Only one can be Live.
--   • Follow-page and join-group points are set per campaign (e.g. 5 each),
--     once per person.
--   • Each post has: points per share, "can be shared once every N days"
--     (0 = only once in the whole campaign) and optional from/to dates.
--   • Leaderboards and draws work for any date range, with or without the
--     follow/join points.
--
-- Kept: the Cloudflare worker secret (so you don't need to change it) and the
-- campaign settings + posts from update 17 (moved into the first campaign).
-- Test participants and shares from update 17 are cleared.
-- =====================================================================

-- ---------- Old (update 17) functions ----------
drop function if exists public.nusuk_camp_draw(text, date, date, text);
drop function if exists public.nusuk_camp_admin_board(date, date, boolean);
drop function if exists public.nusuk_camp_hit(text, text, boolean, boolean);
drop function if exists public.nusuk_camp_hit(text, text, boolean);
drop function if exists public.nusuk_camp_bonus(text, text);
drop function if exists public.nusuk_camp_me(text, text, uuid);
drop function if exists public.nusuk_camp_state();
drop function if exists public.nusuk_camp_can_view();
drop function if exists public.nusuk_camp_scores(date, date, boolean);

-- ---------- Worker secret (shared by all campaigns) ----------
create table if not exists public.nusuk_camp_config (
  id          int primary key default 1 check (id = 1),
  secret      text not null default replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''),
  last_fb_hit timestamptz
);
alter table public.nusuk_camp_config enable row level security;
drop policy if exists "camp config: admin" on public.nusuk_camp_config;
create policy "camp config: admin" on public.nusuk_camp_config for all using (public.is_admin()) with check (public.is_admin());

-- ---------- Campaigns ----------
create table if not exists public.nusuk_campaigns (
  id            bigint generated always as identity primary key,
  title         text not null default 'শেয়ার করুন, পুরস্কার জিতুন',
  rules         text not null default '',
  status        text not null default 'hidden' check (status in ('hidden', 'live', 'closed')),
  starts        date,
  ends          date,
  go_to         text not null default 'post' check (go_to in ('post', 'nusuk')),
  follow_points int not null default 5 check (follow_points between 0 and 1000),
  join_points   int not null default 5 check (join_points between 0 and 1000),
  created_at    timestamptz not null default now()
);
create unique index if not exists nusuk_campaigns_one_live on public.nusuk_campaigns (status) where status = 'live';
alter table public.nusuk_campaigns enable row level security;
drop policy if exists "campaigns: admin" on public.nusuk_campaigns;
create policy "campaigns: admin" on public.nusuk_campaigns for all using (public.is_admin()) with check (public.is_admin());

-- ---------- Move update 17 data in ----------
do $$
declare
  camp bigint;
begin
  if to_regclass('public.nusuk_camp_settings') is not null then
    execute $q$
      insert into public.nusuk_camp_config (id, secret, last_fb_hit)
      select 1, secret, last_fb_hit from public.nusuk_camp_settings where id = 1
      on conflict (id) do update set secret = excluded.secret, last_fb_hit = excluded.last_fb_hit
    $q$;
    execute $q$
      insert into public.nusuk_campaigns (title, rules, status, starts, ends, go_to)
      select title, rules, case when published then 'live' else 'hidden' end, starts, ends, go_to
      from public.nusuk_camp_settings where id = 1
      returning id
    $q$ into camp;
  end if;

  -- Old posts table has no campaign_id: keep its posts, rebuild the tables
  if to_regclass('public.nusuk_camp_posts') is not null and not exists (
       select 1 from information_schema.columns
       where table_schema = 'public' and table_name = 'nusuk_camp_posts' and column_name = 'campaign_id') then
    if camp is null then
      insert into public.nusuk_campaigns default values returning id into camp;
    end if;
    drop table if exists pg_temp._old_posts;
    create temp table _old_posts as
      select url, title, body, image, active, sort, created_at from public.nusuk_camp_posts;
    drop table if exists public.nusuk_camp_draws cascade;
    drop table if exists public.nusuk_camp_links cascade;
    drop table if exists public.nusuk_camp_people cascade;
    drop table public.nusuk_camp_posts cascade;
    perform set_config('nusuk.old_camp', camp::text, false);
  end if;
  drop table if exists public.nusuk_camp_settings cascade;
end $$;
insert into public.nusuk_camp_config (id) values (1) on conflict (id) do nothing;

-- ---------- Posts (per campaign) ----------
create table if not exists public.nusuk_camp_posts (
  id          bigint generated always as identity primary key,
  campaign_id bigint not null references public.nusuk_campaigns (id) on delete cascade,
  url         text not null,
  title       text not null default '',
  body        text not null default '',
  image       text not null default '',
  active      boolean not null default true,
  sort        int not null default 0,
  points      int not null default 1 check (points between 1 and 100),
  every_days  int not null default 1 check (every_days between 0 and 365), -- 0 = once per campaign
  from_day    date,
  to_day      date,
  created_at  timestamptz not null default now()
);
do $$ begin
  if to_regclass('pg_temp._old_posts') is not null and current_setting('nusuk.old_camp', true) is not null then
    insert into public.nusuk_camp_posts (campaign_id, url, title, body, image, active, sort, created_at)
    select current_setting('nusuk.old_camp')::bigint, url, title, body, image, active, sort, created_at from _old_posts;
    drop table _old_posts;
  end if;
end $$;

-- ---------- Participants (per campaign, by Nusuk code) ----------
create table if not exists public.nusuk_camp_people (
  campaign_id bigint not null references public.nusuk_campaigns (id) on delete cascade,
  code        text not null,
  fb_profile  text not null,
  device      uuid,
  follow_at   timestamptz,
  join_at     timestamptz,
  created_at  timestamptz not null default now(),
  primary key (campaign_id, code)
);

-- ---------- Personal links: one per code, post and share window ----------
create table if not exists public.nusuk_camp_links (
  slug        text primary key,
  campaign_id bigint not null references public.nusuk_campaigns (id) on delete cascade,
  code        text not null,
  post_id     bigint not null references public.nusuk_camp_posts (id) on delete cascade,
  win_start   date not null,           -- first day of this share window
  fb_at       timestamptz,             -- when Facebook read it (= share counted)
  fb_day      date,                    -- that day in Bangladesh (used by leaderboards)
  points      int not null default 0,  -- points given for this share
  clicks      int not null default 0,
  created_at  timestamptz not null default now(),
  unique (code, post_id, win_start)
);
create index if not exists nusuk_camp_links_score_idx on public.nusuk_camp_links (campaign_id, fb_day) where fb_at is not null;

-- ---------- Draw results ----------
create table if not exists public.nusuk_camp_draws (
  id           bigint generated always as identity primary key,
  campaign_id  bigint not null references public.nusuk_campaigns (id) on delete cascade,
  from_day     date not null,
  to_day       date not null,
  with_bonus   boolean not null default false,
  method       text not null check (method in ('weighted', 'top')),
  code         text not null,
  fb_profile   text,
  points       int not null,
  pool_people  int not null,
  pool_points  int not null,
  status       text not null default 'drawn' check (status in ('drawn', 'confirmed', 'void')),
  created_at   timestamptz not null default now()
);

alter table public.nusuk_camp_posts  enable row level security;
alter table public.nusuk_camp_people enable row level security;
alter table public.nusuk_camp_links  enable row level security;
alter table public.nusuk_camp_draws  enable row level security;
do $$ begin
  drop policy if exists "camp posts: admin"  on public.nusuk_camp_posts;
  drop policy if exists "camp people: admin" on public.nusuk_camp_people;
  drop policy if exists "camp links: admin"  on public.nusuk_camp_links;
  drop policy if exists "camp draws: admin"  on public.nusuk_camp_draws;
end $$;
create policy "camp posts: admin"  on public.nusuk_camp_posts  for all using (public.is_admin()) with check (public.is_admin());
create policy "camp people: admin" on public.nusuk_camp_people for all using (public.is_admin()) with check (public.is_admin());
create policy "camp links: admin"  on public.nusuk_camp_links  for all using (public.is_admin()) with check (public.is_admin());
create policy "camp draws: admin"  on public.nusuk_camp_draws  for all using (public.is_admin()) with check (public.is_admin());

-- ---------- Helpers ----------
create or replace function public.nusuk_camp_today()
returns date language sql stable as $$ select (now() at time zone 'Asia/Dhaka')::date $$;

create or replace function public.nusuk_camp_week_start(d date)
returns date language sql immutable as $$ select d - ((extract(dow from d)::int + 1) % 7) $$;

-- Which share window of a post is open on day d (its first day), or null if none.
-- every_days = 1 → a new window each day; 7 → each week; 0 → one window for the whole campaign.
create or replace function public.nusuk_camp_window(p public.nusuk_camp_posts, c public.nusuk_campaigns, d date)
returns date language sql stable as $$
  with b as (
    select coalesce(greatest(p.from_day, c.starts), (p.created_at at time zone 'Asia/Dhaka')::date) as base,
           least(p.to_day, c.ends) as last
  )
  select case
    when not p.active or c.status = 'closed' then null
    when d < b.base then null
    when b.last is not null and d > b.last then null
    when p.every_days = 0 then b.base
    else b.base + ((d - b.base) / p.every_days) * p.every_days
  end
  from b;
$$;

-- The campaign this caller sees: an admin sees the newest Hidden one (for testing),
-- otherwise everyone sees the Live one.
create or replace function public.nusuk_camp_current()
returns public.nusuk_campaigns
language plpgsql stable security definer set search_path = public as $$
declare c public.nusuk_campaigns;
begin
  if public.is_admin() then
    select * into c from public.nusuk_campaigns where status = 'hidden' order by id desc limit 1;
    if c.id is not null then return c; end if;
  end if;
  select * into c from public.nusuk_campaigns where status = 'live' limit 1;
  return c;
end $$;
revoke all on function public.nusuk_camp_current() from public, anon, authenticated;

-- Points per code in a date range (Bangladesh days). p_bonus adds the
-- follow/join points of people who did that inside the range.
create or replace function public.nusuk_camp_scores(p_camp bigint, p_from date, p_to date, p_bonus boolean)
returns table (code text, shares int, share_points int, bonus int, total int)
language sql stable security definer set search_path = public as $$
  with s as (
    select l.code, count(*)::int as n, sum(l.points)::int as pts
    from public.nusuk_camp_links l
    where l.campaign_id = p_camp and l.fb_at is not null and l.fb_day between p_from and p_to
    group by l.code
  ), x as (
    select p.code, coalesce(s.n, 0) as shares, coalesce(s.pts, 0) as share_points,
           case when p_bonus then
             (case when p.follow_at is not null and (p.follow_at at time zone 'Asia/Dhaka')::date between p_from and p_to then c.follow_points else 0 end)
           + (case when p.join_at is not null and (p.join_at at time zone 'Asia/Dhaka')::date between p_from and p_to then c.join_points else 0 end)
           else 0 end as bonus
    from public.nusuk_camp_people p
    join public.nusuk_campaigns c on c.id = p.campaign_id
    left join s on s.code = p.code
    where p.campaign_id = p_camp
  )
  select x.code, x.shares, x.share_points, x.bonus, x.share_points + x.bonus from x
  where x.share_points + x.bonus > 0;
$$;
revoke all on function public.nusuk_camp_scores(bigint, date, date, boolean) from public, anon, authenticated;

create or replace function public.nusuk_camp_top(p_camp bigint, p_from date, p_to date, p_bonus boolean)
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object('code', public.nusuk_mask(t.code), 'n', t.total) order by t.total desc, t.code), '[]'::jsonb)
  from (select * from public.nusuk_camp_scores(p_camp, p_from, p_to, p_bonus) order by total desc, code limit 10) t;
$$;
revoke all on function public.nusuk_camp_top(bigint, date, date, boolean) from public, anon, authenticated;

-- ---------- Public: the campaign + top lists ----------
create or replace function public.nusuk_camp_state()
returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  c public.nusuk_campaigns := public.nusuk_camp_current();
  d date := public.nusuk_camp_today();
  w date := public.nusuk_camp_week_start(public.nusuk_camp_today());
  a date; z date;
begin
  if c.id is null then return jsonb_build_object('visible', false); end if;
  a := coalesce(c.starts, '2000-01-01'); z := coalesce(c.ends, '2999-12-31');
  return jsonb_build_object(
    'visible', true,
    'id', c.id,
    'published', c.status = 'live',
    'title', c.title,
    'rules', c.rules,
    'starts', c.starts,
    'ends', c.ends,
    'today', d,
    'open', d >= a and d <= z,
    'follow_points', c.follow_points,
    'join_points', c.join_points,
    'people', (select count(*) from public.nusuk_camp_people p where p.campaign_id = c.id),
    'board', jsonb_build_object(
      'day',  public.nusuk_camp_top(c.id, d, d, false),
      'week', public.nusuk_camp_top(c.id, greatest(w, a), d, false),
      'all',  public.nusuk_camp_top(c.id, a, z, true))
  );
end $$;
grant execute on function public.nusuk_camp_state() to anon, authenticated;

-- ---------- Public: join / my links and points ----------
create or replace function public.nusuk_camp_me(p_code text, p_profile text default null, p_device uuid default null)
returns jsonb
language plpgsql volatile security definer set search_path = public as $$
declare
  c public.nusuk_campaigns := public.nusuk_camp_current();
  d date := public.nusuk_camp_today();
  v_code text;
  v_prof text := left(trim(coalesce(p_profile, '')), 300);
  me public.nusuk_camp_people;
begin
  if c.id is null or c.status = 'closed' then return jsonb_build_object('ok', false, 'reason', 'closed'); end if;
  select x.code into v_code from public.nusuk_codes x
   where lower(x.code) = lower(trim(coalesce(p_code, ''))) and x.status <> 'rejected' limit 1;
  if v_code is null then return jsonb_build_object('ok', false, 'reason', 'not_found'); end if;
  if v_prof <> '' and v_prof !~* '^https?://([a-z0-9-]+\.)*(facebook\.com|fb\.com|fb\.me)(/|$)' then
    return jsonb_build_object('ok', false, 'reason', 'bad_profile');
  end if;

  select * into me from public.nusuk_camp_people p where p.campaign_id = c.id and p.code = v_code;
  if me.code is null then
    if v_prof = '' then return jsonb_build_object('ok', false, 'reason', 'need_profile'); end if;
    insert into public.nusuk_camp_people (campaign_id, code, fb_profile, device) values (c.id, v_code, v_prof, p_device)
    returning * into me;
  elsif v_prof <> '' and v_prof <> me.fb_profile and (me.device is null or me.device = p_device) then
    update public.nusuk_camp_people p set fb_profile = v_prof, device = coalesce(me.device, p_device)
     where p.campaign_id = c.id and p.code = v_code returning * into me;
  end if;

  -- A personal link for every post whose share window is open today
  insert into public.nusuk_camp_links (slug, campaign_id, code, post_id, win_start)
  select left(replace(gen_random_uuid()::text, '-', ''), 10), c.id, v_code, p.id, public.nusuk_camp_window(p, c, d)
  from public.nusuk_camp_posts p
  where p.campaign_id = c.id and public.nusuk_camp_window(p, c, d) is not null
  on conflict (code, post_id, win_start) do nothing;

  return jsonb_build_object(
    'ok', true,
    'code', v_code,
    'profile', me.fb_profile,
    'follow', me.follow_at is not null,
    'join', me.join_at is not null,
    'posts', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', p.id, 'title', p.title, 'image', p.image, 'points', p.points, 'every', p.every_days,
               'slug', l.slug, 'done', l.fb_at is not null,
               'next', case when w.ws is null then null
                            when p.every_days = 0 then null
                            else w.ws + p.every_days end,
               'state', case when w.ws is null then
                               case when d < coalesce(greatest(p.from_day, c.starts), d) then 'soon' else 'ended' end
                             when l.fb_at is not null then 'done' else 'open' end,
               'from', greatest(p.from_day, c.starts))
             order by p.sort, p.id)
      from public.nusuk_camp_posts p
      cross join lateral (select public.nusuk_camp_window(p, c, d) as ws) w
      left join public.nusuk_camp_links l on l.post_id = p.id and l.code = v_code and l.win_start = w.ws
      where p.campaign_id = c.id and p.active), '[]'::jsonb),
    'today', (select coalesce(sum(l.points), 0) from public.nusuk_camp_links l where l.campaign_id = c.id and l.code = v_code and l.fb_day = d),
    'total', (select coalesce(sum(s.total), 0) from public.nusuk_camp_scores(c.id, coalesce(c.starts, '2000-01-01'), coalesce(c.ends, '2999-12-31'), true) s where s.code = v_code)
  );
end $$;
grant execute on function public.nusuk_camp_me(text, text, uuid) to anon, authenticated;

-- ---------- Public: follow page / join group (points once each) ----------
create or replace function public.nusuk_camp_bonus(p_code text, p_kind text)
returns jsonb
language plpgsql volatile security definer set search_path = public as $$
declare c public.nusuk_campaigns := public.nusuk_camp_current();
begin
  if c.id is null or c.status = 'closed' then return jsonb_build_object('ok', false); end if;
  if p_kind = 'follow' then
    update public.nusuk_camp_people p set follow_at = coalesce(p.follow_at, now())
     where p.campaign_id = c.id and lower(p.code) = lower(trim(coalesce(p_code, '')));
  elsif p_kind = 'join' then
    update public.nusuk_camp_people p set join_at = coalesce(p.join_at, now())
     where p.campaign_id = c.id and lower(p.code) = lower(trim(coalesce(p_code, '')));
  else
    return jsonb_build_object('ok', false);
  end if;
  return jsonb_build_object('ok', found);
end $$;
grant execute on function public.nusuk_camp_bonus(text, text) to anon, authenticated;

-- ---------- Worker: a personal link was opened ----------
create or replace function public.nusuk_camp_hit(p_secret text, p_slug text, p_fb boolean, p_peek boolean default false)
returns jsonb
language plpgsql volatile security definer set search_path = public as $$
declare
  cfg public.nusuk_camp_config;
  l public.nusuk_camp_links;
  p public.nusuk_camp_posts;
  c public.nusuk_campaigns;
  d date := public.nusuk_camp_today();
  counted boolean := false;
begin
  select * into cfg from public.nusuk_camp_config where id = 1;
  if cfg is null or p_secret is distinct from cfg.secret then return jsonb_build_object('ok', false); end if;
  select * into l from public.nusuk_camp_links where slug = p_slug;
  if l.slug is null then return jsonb_build_object('ok', false); end if;
  select * into p from public.nusuk_camp_posts where id = l.post_id;
  select * into c from public.nusuk_campaigns where id = l.campaign_id;

  if p_fb then
    update public.nusuk_camp_config set last_fb_hit = now() where id = 1;
    -- Counts once, and only while the link's own share window is open
    if l.fb_at is null and public.nusuk_camp_window(p, c, d) = l.win_start then
      update public.nusuk_camp_links set fb_at = now(), fb_day = d, points = p.points where slug = p_slug;
      counted := true;
    end if;
  elsif not coalesce(p_peek, false) then
    update public.nusuk_camp_links set clicks = clicks + 1 where slug = p_slug;
  end if;

  return jsonb_build_object(
    'ok', true, 'counted', counted,
    'dest', case when c.go_to = 'post' then p.url else null end,
    'title', p.title, 'body', p.body, 'image', p.image);
end $$;
grant execute on function public.nusuk_camp_hit(text, text, boolean, boolean) to anon, authenticated;

-- ---------- Admin: leaderboard for any date range ----------
create or replace function public.nusuk_camp_admin_board(p_camp bigint, p_from date, p_to date, p_bonus boolean)
returns table (code text, fb_profile text, shares int, share_points int, bonus int, total int)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'not allowed'; end if;
  return query
    select s.code, p.fb_profile, s.shares, s.share_points, s.bonus, s.total
    from public.nusuk_camp_scores(p_camp, p_from, p_to, p_bonus) s
    join public.nusuk_camp_people p on p.campaign_id = p_camp and p.code = s.code
    order by s.total desc, s.code
    limit 1000;
end $$;
grant execute on function public.nusuk_camp_admin_board(bigint, date, date, boolean) to authenticated;

-- ---------- Admin: draw a winner for any date range (saved) ----------
-- weighted = every point is one ticket; top = only the highest scorers, equal chance.
-- People already drawn for the same campaign + range (and not voided) are skipped.
create or replace function public.nusuk_camp_draw(p_camp bigint, p_from date, p_to date, p_bonus boolean, p_method text)
returns jsonb
language plpgsql volatile security definer set search_path = public as $$
declare
  pool_people int;
  pool_points int;
  pick record;
  r public.nusuk_camp_draws;
begin
  if not public.is_admin() then raise exception 'not allowed'; end if;
  if p_method not in ('weighted', 'top') then raise exception 'bad method'; end if;

  create temp table _pool on commit drop as
    select s.code, s.total from public.nusuk_camp_scores(p_camp, p_from, p_to, p_bonus) s
    where not exists (select 1 from public.nusuk_camp_draws x
                      where x.campaign_id = p_camp and x.from_day = p_from and x.to_day = p_to
                        and x.code = s.code and x.status <> 'void');
  if p_method = 'top' then
    delete from _pool where total < (select max(total) from _pool);
  end if;
  select count(*), coalesce(sum(total), 0) into pool_people, pool_points from _pool;
  if pool_people = 0 then return jsonb_build_object('ok', false, 'reason', 'empty'); end if;

  if p_method = 'weighted' then
    select y.code, y.total into pick from (
      select code, total, sum(total) over (order by code) as upto from _pool
    ) y where y.upto > floor(random() * pool_points) order by y.upto limit 1;
  else
    select code, total into pick from _pool order by random() limit 1;
  end if;

  insert into public.nusuk_camp_draws (campaign_id, from_day, to_day, with_bonus, method, code, fb_profile, points, pool_people, pool_points)
  values (p_camp, p_from, p_to, p_bonus, p_method, pick.code,
          (select fb_profile from public.nusuk_camp_people where campaign_id = p_camp and code = pick.code),
          pick.total, pool_people, pool_points)
  returning * into r;
  return jsonb_build_object('ok', true, 'draw', to_jsonb(r));
end $$;
grant execute on function public.nusuk_camp_draw(bigint, date, date, boolean, text) to authenticated;
