-- =====================================================================
-- Nusuk · update 17 · share campaign (tickets + draws)
-- Run once in Supabase → SQL Editor, BEFORE pushing the version that has
-- the Campaign section. Safe to run again.
--
-- How it works
--   • You add Facebook posts in Nusuk Manager → Campaign.
--   • A visitor enters their Nusuk code + Facebook profile link and gets a
--     personal link for each post, new every day: muhammadfazal.com/s/<slug>
--   • When they put that link in a Facebook post, Facebook's own server reads
--     it to build the preview. The site's worker sees that (Facebook network
--     + Facebook crawler) and counts ONE share for that code, post and day.
--   • Daily and weekly prizes: shares only. Final prize: all shares in the
--     campaign + 1 point for following the page + 1 for joining the group
--     (each once, counted when they open the link).
--   • Draws run on the server and are saved, so results can't be changed.
--
-- While the campaign is not published, only a signed-in admin can see or
-- use it (the RPCs check is_admin()).
--
-- AFTER RUNNING: copy the worker secret into Cloudflare (see the Campaign
-- page in Nusuk Manager → "Setup", or run:
--   select secret from public.nusuk_camp_settings where id = 1;
-- ) and add it in Cloudflare → Workers → mf-web → Settings →
-- Variables and Secrets as a Secret named NUSUK_CAMP_SECRET.
-- =====================================================================

-- ---------- Settings (one row) ----------
create table if not exists public.nusuk_camp_settings (
  id          int primary key default 1 check (id = 1),
  published   boolean not null default false,
  title       text not null default 'শেয়ার করুন, পুরস্কার জিতুন',
  rules       text not null default '',
  starts      date,
  ends        date,
  go_to       text not null default 'post' check (go_to in ('post', 'nusuk')),
  secret      text not null default replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''),
  last_fb_hit timestamptz,
  updated_at  timestamptz not null default now()
);
insert into public.nusuk_camp_settings (id) values (1) on conflict (id) do nothing;

-- ---------- Posts to share ----------
create table if not exists public.nusuk_camp_posts (
  id         bigint generated always as identity primary key,
  url        text not null,            -- the Facebook post
  title      text not null default '',  -- preview title on Facebook
  body       text not null default '',  -- preview text
  image      text not null default '',  -- preview picture (https)
  active     boolean not null default true,
  sort       int not null default 0,
  created_at timestamptz not null default now()
);

-- ---------- Participants (identified by their Nusuk code) ----------
create table if not exists public.nusuk_camp_people (
  code       text primary key,
  fb_profile text not null,
  device     uuid,
  follow_at  timestamptz,
  join_at    timestamptz,
  created_at timestamptz not null default now()
);

-- ---------- Personal links: one per code, post and day ----------
create table if not exists public.nusuk_camp_links (
  slug       text primary key,
  code       text not null references public.nusuk_camp_people (code) on delete cascade,
  post_id    bigint not null references public.nusuk_camp_posts (id) on delete cascade,
  day        date not null,
  fb_at      timestamptz,   -- first time Facebook read it = the share counts
  clicks     int not null default 0,
  created_at timestamptz not null default now(),
  unique (code, post_id, day)
);
create index if not exists nusuk_camp_links_day_idx on public.nusuk_camp_links (day) where fb_at is not null;

-- ---------- Draw results ----------
create table if not exists public.nusuk_camp_draws (
  id            bigint generated always as identity primary key,
  kind          text not null check (kind in ('day', 'week', 'final')),
  from_day      date not null,
  to_day        date not null,
  method        text not null check (method in ('weighted', 'top')),
  code          text not null,
  fb_profile    text,
  tickets       int not null,
  pool_people   int not null,
  pool_tickets  int not null,
  status        text not null default 'drawn' check (status in ('drawn', 'confirmed', 'void')),
  created_at    timestamptz not null default now()
);

-- Admin-only table access; the public page uses the functions below
alter table public.nusuk_camp_settings enable row level security;
alter table public.nusuk_camp_posts    enable row level security;
alter table public.nusuk_camp_people   enable row level security;
alter table public.nusuk_camp_links    enable row level security;
alter table public.nusuk_camp_draws    enable row level security;
do $$ begin
  drop policy if exists "camp settings: admin" on public.nusuk_camp_settings;
  drop policy if exists "camp posts: admin"    on public.nusuk_camp_posts;
  drop policy if exists "camp people: admin"   on public.nusuk_camp_people;
  drop policy if exists "camp links: admin"    on public.nusuk_camp_links;
  drop policy if exists "camp draws: admin"    on public.nusuk_camp_draws;
end $$;
create policy "camp settings: admin" on public.nusuk_camp_settings for all using (public.is_admin()) with check (public.is_admin());
create policy "camp posts: admin"    on public.nusuk_camp_posts    for all using (public.is_admin()) with check (public.is_admin());
create policy "camp people: admin"   on public.nusuk_camp_people   for all using (public.is_admin()) with check (public.is_admin());
create policy "camp links: admin"    on public.nusuk_camp_links    for all using (public.is_admin()) with check (public.is_admin());
create policy "camp draws: admin"    on public.nusuk_camp_draws    for all using (public.is_admin()) with check (public.is_admin());

-- ---------- Helpers ----------
create or replace function public.nusuk_camp_today()
returns date language sql stable as $$ select (now() at time zone 'Asia/Dhaka')::date $$;

-- Weeks run Saturday → Friday (Bangladesh)
create or replace function public.nusuk_camp_week_start(d date)
returns date language sql immutable as $$ select d - ((extract(dow from d)::int + 1) % 7) $$;

-- Shares per code between two days (inclusive)
create or replace function public.nusuk_camp_scores(p_from date, p_to date, p_final boolean)
returns table (code text, shares int, follow int, joined int, total int)
language sql stable security definer set search_path = public as $$
  select p.code,
         coalesce(s.n, 0)::int as shares,
         (p_final and p.follow_at is not null)::int as follow,
         (p_final and p.join_at is not null)::int as joined,
         (coalesce(s.n, 0) + (p_final and p.follow_at is not null)::int + (p_final and p.join_at is not null)::int)::int as total
  from public.nusuk_camp_people p
  left join (
    select l.code, count(*) as n from public.nusuk_camp_links l
    where l.fb_at is not null and l.day between p_from and p_to
    group by l.code
  ) s on s.code = p.code
  where coalesce(s.n, 0) > 0 or (p_final and (p.follow_at is not null or p.join_at is not null));
$$;
revoke all on function public.nusuk_camp_scores(date, date, boolean) from public, anon, authenticated;

-- Is the campaign visible to the caller? (published, or signed-in admin)
create or replace function public.nusuk_camp_can_view()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select published from public.nusuk_camp_settings where id = 1), false) or public.is_admin();
$$;

-- ---------- Public: campaign info + top lists ----------
create or replace function public.nusuk_camp_state()
returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  st public.nusuk_camp_settings;
  d date := public.nusuk_camp_today();
  w date := public.nusuk_camp_week_start(public.nusuk_camp_today());
  board jsonb;
begin
  select * into st from public.nusuk_camp_settings where id = 1;
  if st is null or not public.nusuk_camp_can_view() then
    return jsonb_build_object('visible', false);
  end if;
  select jsonb_build_object(
    'day',   coalesce((select jsonb_agg(jsonb_build_object('code', public.nusuk_mask(x.code), 'n', x.total) order by x.total desc, x.code) from (select * from public.nusuk_camp_scores(d, d, false) order by total desc, code limit 10) x), '[]'::jsonb),
    'week',  coalesce((select jsonb_agg(jsonb_build_object('code', public.nusuk_mask(x.code), 'n', x.total) order by x.total desc, x.code) from (select * from public.nusuk_camp_scores(w, d, false) order by total desc, code limit 10) x), '[]'::jsonb),
    'final', coalesce((select jsonb_agg(jsonb_build_object('code', public.nusuk_mask(x.code), 'n', x.total) order by x.total desc, x.code) from (select * from public.nusuk_camp_scores(coalesce(st.starts, '2000-01-01'), coalesce(st.ends, '2999-12-31'), true) order by total desc, code limit 10) x), '[]'::jsonb)
  ) into board;
  return jsonb_build_object(
    'visible', true,
    'published', st.published,
    'admin', public.is_admin(),
    'title', st.title,
    'rules', st.rules,
    'starts', st.starts,
    'ends', st.ends,
    'today', d,
    'week_start', w,
    'open', (st.starts is null or d >= st.starts) and (st.ends is null or d <= st.ends),
    'people', (select count(*) from public.nusuk_camp_people),
    'posts', coalesce((select jsonb_agg(jsonb_build_object('id', p.id, 'title', p.title, 'image', p.image) order by p.sort, p.id) from public.nusuk_camp_posts p where p.active), '[]'::jsonb),
    'board', board
  );
end $$;
grant execute on function public.nusuk_camp_state() to anon, authenticated;

-- ---------- Public: join / my links and scores ----------
-- p_profile is only needed the first time (or to change it from the same device).
create or replace function public.nusuk_camp_me(p_code text, p_profile text default null, p_device uuid default null)
returns jsonb
language plpgsql volatile security definer set search_path = public as $$
declare
  st public.nusuk_camp_settings;
  d date := public.nusuk_camp_today();
  w date := public.nusuk_camp_week_start(public.nusuk_camp_today());
  v_code text;
  v_prof text := left(trim(coalesce(p_profile, '')), 300);
  me public.nusuk_camp_people;
  is_open boolean;
begin
  select * into st from public.nusuk_camp_settings where id = 1;
  if st is null or not public.nusuk_camp_can_view() then
    return jsonb_build_object('ok', false, 'reason', 'closed');
  end if;
  select c.code into v_code from public.nusuk_codes c
   where lower(c.code) = lower(trim(coalesce(p_code, ''))) and c.status <> 'rejected' limit 1;
  if v_code is null then
    return jsonb_build_object('ok', false, 'reason', 'not_found');
  end if;
  if v_prof <> '' and v_prof !~* '^https?://([a-z0-9-]+\.)*(facebook\.com|fb\.com|fb\.me)(/|$)' then
    return jsonb_build_object('ok', false, 'reason', 'bad_profile');
  end if;

  select * into me from public.nusuk_camp_people where code = v_code;
  if me.code is null then
    if v_prof = '' then return jsonb_build_object('ok', false, 'reason', 'need_profile'); end if;
    insert into public.nusuk_camp_people (code, fb_profile, device) values (v_code, v_prof, p_device)
    returning * into me;
  elsif v_prof <> '' and v_prof <> me.fb_profile and (me.device is null or me.device = p_device) then
    update public.nusuk_camp_people set fb_profile = v_prof, device = coalesce(me.device, p_device) where code = v_code
    returning * into me;
  end if;

  is_open := (st.starts is null or d >= st.starts) and (st.ends is null or d <= st.ends);
  -- Today's personal links (new each day, so Facebook reads them again)
  if is_open then
    insert into public.nusuk_camp_links (slug, code, post_id, day)
    select left(replace(gen_random_uuid()::text, '-', ''), 10), v_code, p.id, d
    from public.nusuk_camp_posts p
    where p.active
    on conflict (code, post_id, day) do nothing;
  end if;

  return jsonb_build_object(
    'ok', true,
    'code', v_code,
    'profile', me.fb_profile,
    'own_device', me.device is null or me.device = p_device,
    'open', is_open,
    'follow', me.follow_at is not null,
    'join', me.join_at is not null,
    'links', coalesce((select jsonb_agg(jsonb_build_object('post', l.post_id, 'slug', l.slug, 'done', l.fb_at is not null, 'clicks', l.clicks) order by p.sort, p.id)
                        from public.nusuk_camp_links l join public.nusuk_camp_posts p on p.id = l.post_id
                        where l.code = v_code and l.day = d and p.active), '[]'::jsonb),
    'today', (select count(*) from public.nusuk_camp_links l where l.code = v_code and l.day = d and l.fb_at is not null),
    'week',  (select count(*) from public.nusuk_camp_links l where l.code = v_code and l.day between w and d and l.fb_at is not null),
    'final', (select coalesce(sum(total), 0) from public.nusuk_camp_scores(coalesce(st.starts, '2000-01-01'), coalesce(st.ends, '2999-12-31'), true) s where s.code = v_code)
  );
end $$;
grant execute on function public.nusuk_camp_me(text, text, uuid) to anon, authenticated;

-- ---------- Public: follow page / join group (1 point each, once) ----------
create or replace function public.nusuk_camp_bonus(p_code text, p_kind text)
returns jsonb
language plpgsql volatile security definer set search_path = public as $$
begin
  if not public.nusuk_camp_can_view() then return jsonb_build_object('ok', false); end if;
  if p_kind = 'follow' then
    update public.nusuk_camp_people set follow_at = coalesce(follow_at, now()) where lower(code) = lower(trim(coalesce(p_code, '')));
  elsif p_kind = 'join' then
    update public.nusuk_camp_people set join_at = coalesce(join_at, now()) where lower(code) = lower(trim(coalesce(p_code, '')));
  else
    return jsonb_build_object('ok', false);
  end if;
  return jsonb_build_object('ok', found);
end $$;
grant execute on function public.nusuk_camp_bonus(text, text) to anon, authenticated;

-- ---------- Worker: a personal link was opened ----------
-- Called only by the Cloudflare worker (it knows the secret).
-- p_fb = true when Facebook's own server read the link (= it was put on Facebook).
-- p_peek = another app's preview bot (WhatsApp, Telegram…): not a click.
drop function if exists public.nusuk_camp_hit(text, text, boolean);
create or replace function public.nusuk_camp_hit(p_secret text, p_slug text, p_fb boolean, p_peek boolean default false)
returns jsonb
language plpgsql volatile security definer set search_path = public as $$
declare
  st public.nusuk_camp_settings;
  l public.nusuk_camp_links;
  p public.nusuk_camp_posts;
  counted boolean := false;
begin
  select * into st from public.nusuk_camp_settings where id = 1;
  if st is null or p_secret is distinct from st.secret then
    return jsonb_build_object('ok', false);
  end if;
  select * into l from public.nusuk_camp_links where slug = p_slug;
  if l.slug is null then return jsonb_build_object('ok', false); end if;
  select * into p from public.nusuk_camp_posts where id = l.post_id;

  if p_fb then
    update public.nusuk_camp_settings set last_fb_hit = now() where id = 1;
    -- Counts once, and only on the link's own day (Bangladesh time)
    if l.fb_at is null and public.nusuk_camp_today() = l.day then
      update public.nusuk_camp_links set fb_at = now() where slug = p_slug;
      counted := true;
    end if;
  elsif not coalesce(p_peek, false) then
    update public.nusuk_camp_links set clicks = clicks + 1 where slug = p_slug;
  end if;

  return jsonb_build_object(
    'ok', true,
    'counted', counted,
    'dest', case when st.go_to = 'post' then p.url else null end,
    'title', p.title,
    'body', p.body,
    'image', p.image
  );
end $$;
grant execute on function public.nusuk_camp_hit(text, text, boolean, boolean) to anon, authenticated;

-- ---------- Admin: leaderboard for a period ----------
create or replace function public.nusuk_camp_admin_board(p_from date, p_to date, p_final boolean)
returns table (code text, fb_profile text, shares int, follow int, joined int, total int)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'not allowed'; end if;
  return query
    select s.code, p.fb_profile, s.shares, s.follow, s.joined, s.total
    from public.nusuk_camp_scores(p_from, p_to, p_final) s
    join public.nusuk_camp_people p on p.code = s.code
    order by s.total desc, s.code
    limit 500;
end $$;
grant execute on function public.nusuk_camp_admin_board(date, date, boolean) to authenticated;

-- ---------- Admin: draw a winner (saved, can't be redone silently) ----------
-- weighted = every ticket is one entry (more tickets, better chance)
-- top      = only the people with the highest score, equal chance each
-- Codes already drawn for the same period (and not voided) are skipped.
create or replace function public.nusuk_camp_draw(p_kind text, p_from date, p_to date, p_method text)
returns jsonb
language plpgsql volatile security definer set search_path = public as $$
declare
  is_final boolean := p_kind = 'final';
  pool_people int;
  pool_tickets int;
  pick record;
  r public.nusuk_camp_draws;
begin
  if not public.is_admin() then raise exception 'not allowed'; end if;
  if p_kind not in ('day', 'week', 'final') or p_method not in ('weighted', 'top') then raise exception 'bad draw'; end if;

  create temp table _pool on commit drop as
    select s.code, s.total from public.nusuk_camp_scores(p_from, p_to, is_final) s
    where s.total > 0
      and not exists (select 1 from public.nusuk_camp_draws d
                      where d.kind = p_kind and d.from_day = p_from and d.to_day = p_to
                        and d.code = s.code and d.status <> 'void');
  if p_method = 'top' then
    delete from _pool where total < (select max(total) from _pool);
  end if;
  select count(*), coalesce(sum(total), 0) into pool_people, pool_tickets from _pool;
  if pool_people = 0 then return jsonb_build_object('ok', false, 'reason', 'empty'); end if;

  if p_method = 'weighted' then
    -- Walk the tickets: pick a random ticket number, find whose it is
    select x.code, x.total into pick from (
      select code, total, sum(total) over (order by code) as upto from _pool
    ) x
    where x.upto > floor(random() * pool_tickets)
    order by x.upto limit 1;
  else
    select code, total into pick from _pool order by random() limit 1;
  end if;

  insert into public.nusuk_camp_draws (kind, from_day, to_day, method, code, fb_profile, tickets, pool_people, pool_tickets)
  values (p_kind, p_from, p_to, p_method, pick.code,
          (select fb_profile from public.nusuk_camp_people where code = pick.code),
          pick.total, pool_people, pool_tickets)
  returning * into r;
  return jsonb_build_object('ok', true, 'draw', to_jsonb(r));
end $$;
grant execute on function public.nusuk_camp_draw(text, date, date, text) to authenticated;
