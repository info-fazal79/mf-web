-- =====================================================================
-- Nusuk · update 41 · database performance (Disk IO / CPU)
-- Run once in Supabase → SQL Editor (after update 40), BEFORE pushing.
-- Safe to run again. Nothing changes for visitors; everything just reads far less.
--
-- What pg_stat showed (13 Nov 2026):
--   nusuk_visitors  727k full scans, 12.5 billion rows read  → ping counted ALL visitors every minute
--   nusuk_codes     1.09M full scans, 11.4 billion rows read → "codes left" counted all codes on every
--                   page refresh and copy; the boosted pick checked thousands of old approved codes
--   bootstrap ran every 60 s per open page: a new pick (which also held a Keys seat) and the whole
--   settings JSON again, although the page kept its code and nothing had changed
--
-- Fixes:
--   1. nusuk_counters: running totals (visitors, active codes) kept up to date by triggers
--   2. nusuk_ping: total from the counter; "active now" counted once per 15 s for everybody,
--      and the active-users history written once per 15 s instead of on every ping
--   3. nusuk_pick: boosted codes found through small indexes instead of scanning every approved code
--   4. nusuk_bootstrap: p_ver (send settings only when they changed) + p_pick (no pick when the
--      page keeps its code); older pages without these still work
--   5. Short cache for public read-only screens: live screen 15 s, insights 30 s, featured list 20 s,
--      quiz leaderboard 30 s, admin dashboard 30 s (one computation shared by every viewer)
--   6. Indexes for the remaining scans, one duplicate index dropped, settings.updated_at kept current
-- =====================================================================

-- ---------- 0. settings.updated_at always moves when settings change (bootstrap's version) ----------
create or replace function public.nusuk_settings_touch()
returns trigger language plpgsql as $$
begin new.updated_at := now(); return new; end $$;
drop trigger if exists nusuk_settings_touch on public.nusuk_settings;
create trigger nusuk_settings_touch before update on public.nusuk_settings
  for each row execute function public.nusuk_settings_touch();

-- ---------- 1. Running totals ----------
create table if not exists public.nusuk_counters (
  k  text primary key,
  n  bigint not null default 0,
  at timestamptz
);
alter table public.nusuk_counters enable row level security; -- read only through the functions below

create or replace function public.nusuk_count_visitors()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  update public.nusuk_counters set n = n + (case when tg_op = 'INSERT' then 1 else -1 end) where k = 'visitors';
  return null;
end $$;
drop trigger if exists nusuk_count_visitors on public.nusuk_visitors;
create trigger nusuk_count_visitors after insert or delete on public.nusuk_visitors
  for each row execute function public.nusuk_count_visitors();

create or replace function public.nusuk_count_codes()
returns trigger language plpgsql security definer set search_path = public as $$
declare d int := 0;
begin
  if tg_op = 'INSERT' then d := case when new.status = 'active' then 1 else 0 end;
  elsif tg_op = 'DELETE' then d := case when old.status = 'active' then -1 else 0 end;
  else d := (case when new.status = 'active' then 1 else 0 end) - (case when old.status = 'active' then 1 else 0 end);
  end if;
  if d <> 0 then update public.nusuk_counters set n = n + d where k = 'codes_active'; end if;
  return null;
end $$;
drop trigger if exists nusuk_count_codes on public.nusuk_codes;
create trigger nusuk_count_codes after insert or delete on public.nusuk_codes
  for each row execute function public.nusuk_count_codes();
drop trigger if exists nusuk_count_codes_status on public.nusuk_codes;
create trigger nusuk_count_codes_status after update of status on public.nusuk_codes
  for each row when (old.status is distinct from new.status) execute function public.nusuk_count_codes();

-- (re)count once, inside this script's transaction
insert into public.nusuk_counters (k, n) values
  ('visitors', (select count(*) from public.nusuk_visitors)),
  ('codes_active', (select count(*) from public.nusuk_codes where status = 'active')),
  ('active', 0)
on conflict (k) do update set n = excluded.n, at = null;

-- "codes left for this device" = active codes − the active codes this device already used
create or replace function public.nusuk_remaining_for(p_used bigint[])
returns bigint
language sql stable security definer set search_path = public as $$
  select greatest(0,
    (select n from public.nusuk_counters where k = 'codes_active')
    - (select count(*) from public.nusuk_codes c where c.id = any (coalesce(p_used, '{}')) and c.status = 'active'));
$$;

-- ---------- 2. Ping ----------
create or replace function public.nusuk_ping(p_device uuid)
returns jsonb
language plpgsql volatile security definer set search_path = public as $$
declare
  n_active int;
begin
  if p_device is not null then
    insert into public.nusuk_visitors (device) values (p_device)
    on conflict (device) do update set last_seen = now()
      where public.nusuk_visitors.last_seen < now() - interval '20 seconds';
    insert into public.nusuk_visitor_days (day, device) values (public.nusuk_today(), p_device)
    on conflict do nothing;
  end if;

  -- one ping every ~15 s recounts "active now" and writes the history; the others reuse it
  update public.nusuk_counters set at = now()
   where k = 'active' and (at is null or at < now() - interval '15 seconds');
  if found then
    select count(*) into n_active from public.nusuk_visitors where last_seen > now() - interval '2 minutes';
    update public.nusuk_counters set n = n_active where k = 'active';
    insert into public.nusuk_active_log (bucket, peak)
    values (date_bin('10 minutes', now(), timestamptz '2000-01-01'), n_active)
    on conflict (bucket) do update set peak = greatest(public.nusuk_active_log.peak, excluded.peak);
    insert into public.nusuk_active_min (bucket, peak)
    values (date_trunc('minute', now()), n_active)
    on conflict (bucket) do update set peak = greatest(public.nusuk_active_min.peak, excluded.peak);
    -- housekeeping about once an hour
    if extract(minute from now()) = 0 and random() < 0.1 then
      delete from public.nusuk_active_min where bucket < now() - interval '3 days';
      delete from public.nusuk_copies_10m where bucket < now() - interval '30 days';
      delete from public.nusuk_instant_holds where at < now() - interval '1 hour';
      delete from public.nusuk_cache where at < now() - interval '1 day';
    end if;
  else
    select n into n_active from public.nusuk_counters where k = 'active';
  end if;

  return jsonb_build_object(
    'total',  (select n from public.nusuk_counters where k = 'visitors'),
    'active', coalesce(n_active, 0)
  );
end $$;

-- ---------- 3. Pick ----------
-- boosted tier 2 ("newly approved, still under its quota") through an index on copies-since-approval
create index if not exists nusuk_codes_appr_left_idx on public.nusuk_codes ((uses - approved_base), approved_at, id)
  where status = 'active' and approved_at is not null;
-- same columns as nusuk_codes_pick3_idx but without "active only": not used, only slows every copy
drop index if exists public.nusuk_codes_pick2_idx;

create or replace function public.nusuk_pick(p_exclude bigint[])
returns table (id bigint, code text)
language plpgsql volatile security definer set search_path = public as $$
declare
  s public.nusuk_settings;
  ex bigint[] := coalesce(p_exclude, '{}');
  v_id bigint;
  v_code text;
begin
  -- 1) "at once" Keys (index nusuk_codes_instant_idx)
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
    return query select v_id, v_code;
    return;
  end if;

  select * into s from public.nusuk_settings st where st.id = 1;

  if random() * 100 < coalesce(s.boost_share, 80) then
    -- 2a) featured / "within N hours", paced, shown-not-copied seats counted (index nusuk_codes_feat2_idx;
    --     a feature lasts at most 720 h, so only codes featured in the last 30 days are looked at)
    select c.id, c.code into v_id, v_code
    from public.nusuk_codes c
    where c.status = 'active' and c.featured_at is not null
      and c.featured_at > now() - interval '720 hours'
      and c.featured_at > now() - make_interval(hours => coalesce(c.boost_hours, s.feature_hours))
      and not (c.id = any (ex))
      and c.uses - c.featured_base
          + (select count(*) from public.nusuk_instant_holds h where h.code_id = c.id and h.at > now() - interval '90 seconds')
          < ceil(coalesce(c.boost_quota, s.feature_quota)
                 * least(1.0, extract(epoch from now() - c.featured_at)
                              / (greatest(1, coalesce(c.boost_hours, s.feature_hours, 12)) * 3600.0)))
    order by c.uses - c.featured_base, c.featured_at, c.id
    limit 1
    for update of c skip locked;
    if v_id is not null then
      insert into public.nusuk_instant_holds (code_id) values (v_id);
      return query select v_id, v_code;
      return;
    end if;

    -- 2b) newly approved codes under their quota (index nusuk_codes_appr_left_idx); a code that is
    --     still inside its own feature is left to 2a (same rule as before)
    select c.id, c.code into v_id, v_code
    from public.nusuk_codes c
    where c.status = 'active' and c.approved_at is not null
      and (c.uses - c.approved_base) < s.approved_quota
      and not (c.id = any (ex))
      and not (c.featured_at is not null
               and c.featured_at > now() - make_interval(hours => coalesce(c.boost_hours, s.feature_hours))
               and c.uses - c.featured_base < coalesce(c.boost_quota, s.feature_quota))
    order by (c.uses - c.approved_base), c.approved_at, c.id
    limit 1;
    if v_id is not null then
      return query select v_id, v_code;
      return;
    end if;
  end if;

  -- 3) everyone else, least used first (index nusuk_codes_pick3_idx)
  return query
    select c.id, c.code from public.nusuk_codes c
    where c.status = 'active' and not (c.id = any (ex))
    order by c.uses, c.last_used_at nulls first, c.id
    limit 1;
end $$;
revoke all on function public.nusuk_pick(bigint[]) from public, anon, authenticated;

-- ---------- 4. Bootstrap ----------
drop function if exists public.nusuk_bootstrap(bigint[], bigint[]);
create or replace function public.nusuk_bootstrap(
  p_exclude bigint[] default '{}', p_used bigint[] default '{}', p_ver text default null, p_pick boolean default true)
returns jsonb
language plpgsql volatile security definer set search_path = public as $$
declare
  s public.nusuk_settings;
  nxt record;
  v text;
begin
  select * into s from public.nusuk_settings where id = 1;
  if s is null or not s.enabled then
    return jsonb_build_object('enabled', false, 'notice', s.notice, 'logo_url', s.logo_url);
  end if;
  v := (floor(extract(epoch from s.updated_at) * 1000))::bigint::text;
  if p_pick then
    select * into nxt from public.nusuk_pick(p_exclude);
  end if;
  return jsonb_build_object(
    'enabled', true,
    'submissions_enabled', s.submissions_enabled,
    'notice', s.notice,
    'logo_url', s.logo_url,
    'ver', v,
    -- the page already has these settings: don't send them again
    'content', case when p_ver is not distinct from v then null else s.content end,
    'remaining', public.nusuk_remaining_for(p_used),
    'code', case when nxt.id is null then null else jsonb_build_object('id', nxt.id, 'code', nxt.code) end
  );
end $$;
grant execute on function public.nusuk_bootstrap(bigint[], bigint[], text, boolean) to anon, authenticated;

-- ---------- 5. Short shared cache for public read-only screens ----------
create unlogged table if not exists public.nusuk_cache (
  k  text primary key,
  at timestamptz not null,
  v  jsonb
);
alter table public.nusuk_cache enable row level security; -- no public access; only the functions below

create or replace function public.nusuk_cache_get(p_key text, p_ttl interval)
returns jsonb language sql stable security definer set search_path = public as $$
  select v from public.nusuk_cache where k = p_key and at > now() - p_ttl
$$;
create or replace function public.nusuk_cache_put(p_key text, p_v jsonb)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
begin
  insert into public.nusuk_cache (k, at, v) values (p_key, now(), p_v)
  on conflict (k) do update set at = excluded.at, v = excluded.v;
  return p_v;
end $$;
/** cached value with a fresh "now" (pages use it for their clocks and countdowns) */
create or replace function public.nusuk_cache_now(p_v jsonb)
returns jsonb language sql stable as $$
  select case when jsonb_typeof(p_v) = 'object' and p_v ? 'now' then p_v || jsonb_build_object('now', now()) else p_v end
$$;
revoke all on function public.nusuk_cache_get(text, interval) from public, anon, authenticated;
revoke all on function public.nusuk_cache_put(text, jsonb) from public, anon, authenticated;

-- keep the original functions as *_raw (once), then put a cached function under the old name
do $$
declare f text;
begin
  foreach f in array array['nusuk_live_screen()', 'nusuk_insights()', 'nusuk_featured_list()', 'nusuk_quiz_public(integer)', 'nusuk_admin_dashboard()'] loop
    if to_regprocedure('public.' || replace(f, '(', '_raw(')) is null then
      execute format('alter function public.%s rename to %s', f, split_part(f, '(', 1) || '_raw');
    end if;
  end loop;
end $$;
revoke all on function public.nusuk_live_screen_raw() from public, anon, authenticated;
revoke all on function public.nusuk_insights_raw() from public, anon, authenticated;
revoke all on function public.nusuk_featured_list_raw() from public, anon, authenticated;
revoke all on function public.nusuk_quiz_public_raw(integer) from public, anon, authenticated;
revoke all on function public.nusuk_admin_dashboard_raw() from public, anon;

create or replace function public.nusuk_live_screen()
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare v jsonb;
begin
  v := public.nusuk_cache_get('live_screen', interval '15 seconds');
  if v is null then v := public.nusuk_cache_put('live_screen', public.nusuk_live_screen_raw()); end if;
  return public.nusuk_cache_now(v);
end $$;

create or replace function public.nusuk_insights()
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare v jsonb;
begin
  v := public.nusuk_cache_get('insights', interval '30 seconds');
  if v is null then v := public.nusuk_cache_put('insights', public.nusuk_insights_raw()); end if;
  return public.nusuk_cache_now(v);
end $$;

create or replace function public.nusuk_featured_list()
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare v jsonb;
begin
  v := public.nusuk_cache_get('featured_list', interval '20 seconds');
  if v is null then v := public.nusuk_cache_put('featured_list', public.nusuk_featured_list_raw()); end if;
  return public.nusuk_cache_now(v);
end $$;

create or replace function public.nusuk_quiz_public(p_limit int default 5)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare
  v jsonb;
  key text := 'quiz_public:' || least(greatest(coalesce(p_limit, 5), 1), 100);
begin
  v := public.nusuk_cache_get(key, interval '30 seconds');
  if v is null then v := public.nusuk_cache_put(key, public.nusuk_quiz_public_raw(p_limit)); end if;
  return public.nusuk_cache_now(v);
end $$;

create or replace function public.nusuk_admin_dashboard()
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare v jsonb;
begin
  if not public.is_admin() then raise exception 'not allowed'; end if;
  v := public.nusuk_cache_get('admin_dashboard', interval '30 seconds');
  if v is null then v := public.nusuk_cache_put('admin_dashboard', public.nusuk_admin_dashboard_raw()); end if;
  return public.nusuk_cache_now(v);
end $$;

grant execute on function public.nusuk_live_screen() to anon, authenticated;
grant execute on function public.nusuk_insights() to anon, authenticated;
grant execute on function public.nusuk_featured_list() to anon, authenticated;
grant execute on function public.nusuk_quiz_public(int) to anon, authenticated;
grant execute on function public.nusuk_admin_dashboard() to authenticated;

-- ---------- 6. Indexes for the remaining scans ----------
create index if not exists nusuk_visitors_first_seen_idx on public.nusuk_visitors (first_seen);
create index if not exists nusuk_codes_created_idx on public.nusuk_codes (created_at);
create index if not exists nusuk_feature_requests_created_idx on public.nusuk_feature_requests (created_at);
create index if not exists nusuk_feedback_created_idx on public.nusuk_feedback (created_at);
create index if not exists nusuk_giveaway_entries_gs on public.nusuk_giveaway_entries (giveaway_id, status);

analyze public.nusuk_codes;
analyze public.nusuk_visitors;

notify pgrst, 'reload schema';

-- ---------- 7. Start the query statistics again, to measure the result tomorrow ----------
do $$ begin perform pg_stat_statements_reset(); exception when others then null; end $$;
