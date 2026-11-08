-- =====================================================================
-- Nusuk · update 03 · per-device remaining count
-- Run once in Supabase → SQL Editor (after the earlier updates). Safe to run again.
-- Run this BEFORE the new site version goes live.
--
-- Before: copying a code raised its global `uses`; once uses reached max_uses
--   the code disappeared for EVERYONE, so 5 copies on one phone made the
--   "remaining" number drop by 5 on every phone.
-- Now:   every active code stays available to everyone. Each device only stops
--   seeing the codes it has copied itself (remembered in that browser), and the
--   "remaining" number is: active codes − codes this device has copied.
--   `uses` is still counted, only for statistics and to show the least-used
--   code first so codes get spread evenly. max_uses no longer hides a code.
-- =====================================================================

-- Fast "next code" lookup over active codes
create index if not exists nusuk_codes_pick3_idx on public.nusuk_codes (uses, last_used_at nulls first, id)
  where status = 'active';

-- ---------- Internal: next code for a visitor (any active code they have not copied/skipped) ----------
create or replace function public.nusuk_pick(p_exclude bigint[])
returns table (id bigint, code text)
language sql stable security definer set search_path = public as $$
  select c.id, c.code
  from public.nusuk_codes c
  where c.status = 'active'
    and not (c.id = any (coalesce(p_exclude, '{}')))
  order by c.uses, c.last_used_at nulls first, c.id
  limit 1;
$$;
revoke all on function public.nusuk_pick(bigint[]) from public, anon, authenticated;

-- ---------- Internal: remaining for one device = active codes it has not copied ----------
create or replace function public.nusuk_remaining_for(p_used bigint[])
returns bigint
language sql stable security definer set search_path = public as $$
  select count(*) from public.nusuk_codes c
  where c.status = 'active'
    and not (c.id = any (coalesce(p_used, '{}')));
$$;
revoke all on function public.nusuk_remaining_for(bigint[]) from public, anon, authenticated;

-- Old signatures are replaced by versions that also take p_used
drop function if exists public.nusuk_bootstrap(bigint[]);
drop function if exists public.nusuk_claim(bigint, bigint[]);

-- ---------- Public: page load ----------
-- p_exclude = codes this device copied + skipped (not shown again)
-- p_used    = codes this device copied (subtracted from its remaining count)
create or replace function public.nusuk_bootstrap(p_exclude bigint[] default '{}', p_used bigint[] default '{}')
returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  s public.nusuk_settings;
  nxt record;
begin
  select * into s from public.nusuk_settings where id = 1;
  if s is null or not s.enabled then
    return jsonb_build_object('enabled', false, 'notice', s.notice, 'logo_url', s.logo_url);
  end if;
  select * into nxt from public.nusuk_pick(p_exclude);
  return jsonb_build_object(
    'enabled', true,
    'submissions_enabled', s.submissions_enabled,
    'notice', s.notice,
    'logo_url', s.logo_url,
    'content', s.content,
    'remaining', public.nusuk_remaining_for(p_used),
    'code', case when nxt.id is null then null else jsonb_build_object('id', nxt.id, 'code', nxt.code) end
  );
end $$;
grant execute on function public.nusuk_bootstrap(bigint[], bigint[]) to anon, authenticated;

-- ---------- Public: record a copy and return the next code ----------
create or replace function public.nusuk_claim(p_id bigint, p_exclude bigint[] default '{}', p_used bigint[] default '{}')
returns jsonb
language plpgsql volatile security definer set search_path = public as $$
declare
  ok boolean := false;
  nxt record;
begin
  if not exists (select 1 from public.nusuk_settings where id = 1 and enabled) then
    return jsonb_build_object('enabled', false);
  end if;

  update public.nusuk_codes
     set uses = uses + 1, last_used_at = now()
   where id = p_id and status = 'active';
  ok := found;

  if ok then
    insert into public.nusuk_daily (day, copies) values (current_date, 1)
    on conflict (day) do update set copies = public.nusuk_daily.copies + 1;
  end if;

  select * into nxt from public.nusuk_pick(array_append(coalesce(p_exclude, '{}'), p_id));
  return jsonb_build_object(
    'enabled', true,
    'counted', ok,
    'remaining', public.nusuk_remaining_for(array_append(coalesce(p_used, '{}'), p_id)),
    'code', case when nxt.id is null then null else jsonb_build_object('id', nxt.id, 'code', nxt.code) end
  );
end $$;
grant execute on function public.nusuk_claim(bigint, bigint[], bigint[]) to anon, authenticated;

-- ---------- Admin stats: "available" = every active code ----------
create or replace function public.nusuk_admin_stats()
returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'not allowed'; end if;
  return jsonb_build_object(
    'total',     (select count(*) from public.nusuk_codes where status in ('active', 'inactive')),
    'active',    (select count(*) from public.nusuk_codes where status = 'active'),
    'remaining', (select count(*) from public.nusuk_codes where status = 'active'),
    'used_up',   0,
    'inactive',  (select count(*) from public.nusuk_codes where status = 'inactive'),
    'pending',   (select count(*) from public.nusuk_codes where status = 'pending'),
    'copies',    (select coalesce(sum(uses), 0) from public.nusuk_codes),
    'today',     (select coalesce(copies, 0) from public.nusuk_daily where day = current_date),
    'daily',     (select coalesce(jsonb_agg(jsonb_build_object('day', d.day::date, 'copies', coalesce(n.copies, 0)) order by d.day), '[]'::jsonb)
                    from generate_series(current_date - 13, current_date, interval '1 day') as d(day)
                    left join public.nusuk_daily n on n.day = d.day::date)
  );
end $$;
grant execute on function public.nusuk_admin_stats() to authenticated;
