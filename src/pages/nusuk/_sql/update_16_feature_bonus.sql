-- =====================================================================
-- Nusuk · update 16 · bonus Keys for following the page / joining the group
-- Run once in Supabase → SQL Editor (after update 10), BEFORE the new
-- admin version goes live. Safe to run again.
--
-- After someone sends a feature request, a popup invites them to follow the
-- Facebook page and join the community group for extra Keys. What they tick
-- (and their Facebook name, so you can check) is saved on the same request.
-- When you approve it, the code is featured for its normal quota PLUS the
-- bonus (e.g. 10 + 15 = 25 copies), spread over the usual time limit.
--
--   • nusuk_codes.boost_quota      – this feature's own copy target
--                                    (empty = Settings → feature quota)
--   • nusuk_feature_requests.page_follow / group_join / fb_name / bonus_at
--   • nusuk_feature_request()      – now also returns the request id
--   • nusuk_feature_bonus()        – the popup saves what they did
--   • nusuk_admin_feature_approve(id, quota) – approve with a copy target
-- =====================================================================

alter table public.nusuk_codes add column if not exists boost_quota int
  check (boost_quota is null or boost_quota between 1 and 1000);

alter table public.nusuk_feature_requests add column if not exists page_follow boolean not null default false;
alter table public.nusuk_feature_requests add column if not exists group_join boolean not null default false;
alter table public.nusuk_feature_requests add column if not exists fb_name text;
alter table public.nusuk_feature_requests add column if not exists bonus_at timestamptz;

-- ---------- Priority tier: use the code's own quota when it has one ----------
create or replace function public.nusuk_boost_tier(c public.nusuk_codes, s public.nusuk_settings)
returns int
language sql stable as $$
  select case
    when c.featured_at is not null
         and c.featured_at > now() - make_interval(hours => s.feature_hours)
         and c.uses - c.featured_base < coalesce(c.boost_quota, s.feature_quota) then 1
    when c.approved_at is not null
         and c.uses - c.approved_base < s.approved_quota then 2
    else 3 end;
$$;

-- ---------- Pick (same as update 09, with the per-code quota) ----------
create or replace function public.nusuk_pick(p_exclude bigint[])
returns table (id bigint, code text)
language plpgsql volatile security definer set search_path = public as $$
declare
  s public.nusuk_settings;
  ex bigint[] := coalesce(p_exclude, '{}');
  dur double precision;
begin
  select * into s from public.nusuk_settings st where st.id = 1;
  dur := greatest(1, coalesce(s.feature_hours, 12)) * 3600.0;

  if random() * 100 < coalesce(s.boost_share, 80) then
    return query
      select c.id, c.code from public.nusuk_codes c
      where c.status = 'active'
        and (c.featured_at is not null or c.approved_at is not null)
        and not (c.id = any (ex))
        and (
          (public.nusuk_boost_tier(c, s) = 1
            and c.uses - c.featured_base
                < ceil(coalesce(c.boost_quota, s.feature_quota) * least(1.0, extract(epoch from now() - c.featured_at) / dur)))
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

-- ---------- Feature request: same checks as update 08, now returns the id ----------
create or replace function public.nusuk_feature_request(p_name text, p_code text, p_link text)
returns jsonb
language plpgsql volatile security definer set search_path = public as $$
declare
  v_name text := left(trim(coalesce(p_name, '')), 120);
  v_code text := trim(coalesce(p_code, ''));
  v_link text := left(trim(coalesce(p_link, '')), 600);
  s public.nusuk_settings;
  c public.nusuk_codes;
  v_id bigint;
begin
  select * into s from public.nusuk_settings st where st.id = 1;
  if s is null or not s.enabled then
    return jsonb_build_object('ok', false, 'reason', 'closed');
  end if;
  if v_name = '' or v_code = '' or v_link = '' then
    return jsonb_build_object('ok', false, 'reason', 'missing');
  end if;
  if v_link !~* '^https?://([a-z0-9-]+\.)*(facebook\.com|fb\.com|fb\.me|fb\.watch)(/|$)' then
    return jsonb_build_object('ok', false, 'reason', 'bad_link');
  end if;

  select * into c from public.nusuk_codes x where lower(x.code) = lower(v_code) and x.status <> 'rejected' limit 1;
  if c.id is null then
    return jsonb_build_object('ok', false, 'reason', 'not_found');
  end if;
  if c.status = 'active' and public.nusuk_boost_tier(c, s) = 1 then
    return jsonb_build_object('ok', false, 'reason', 'featured');
  end if;
  if exists (select 1 from public.nusuk_feature_requests r where r.code = c.code and r.status = 'pending') then
    return jsonb_build_object('ok', false, 'reason', 'exists');
  end if;
  if (select count(*) from public.nusuk_feature_requests r where r.status = 'pending') >= 500 then
    return jsonb_build_object('ok', false, 'reason', 'busy');
  end if;

  insert into public.nusuk_feature_requests (name, code, share_link) values (v_name, c.code, v_link)
  returning id into v_id;
  return jsonb_build_object('ok', true, 'id', v_id);
end $$;
grant execute on function public.nusuk_feature_request(text, text, text) to anon, authenticated;

-- ---------- Bonus: the popup saves what the visitor did ----------
-- Needs the request id AND its code (so nobody can edit other requests),
-- and only within a day of the request.
create or replace function public.nusuk_feature_bonus(p_id bigint, p_code text, p_page boolean, p_group boolean, p_fb_name text)
returns jsonb
language plpgsql volatile security definer set search_path = public as $$
declare
  v_name text := left(trim(coalesce(p_fb_name, '')), 120);
begin
  if not coalesce(p_page, false) and not coalesce(p_group, false) then
    return jsonb_build_object('ok', false, 'reason', 'none');
  end if;
  if v_name = '' then
    return jsonb_build_object('ok', false, 'reason', 'missing');
  end if;
  update public.nusuk_feature_requests r
     set page_follow = r.page_follow or coalesce(p_page, false),
         group_join  = r.group_join or coalesce(p_group, false),
         fb_name     = v_name,
         bonus_at    = now()
   where r.id = p_id
     and lower(r.code) = lower(trim(coalesce(p_code, '')))
     and r.status <> 'rejected'
     and r.created_at > now() - interval '1 day';
  if not found then
    return jsonb_build_object('ok', false, 'reason', 'not_found');
  end if;
  return jsonb_build_object('ok', true);
end $$;
grant execute on function public.nusuk_feature_bonus(bigint, text, boolean, boolean, text) to anon, authenticated;

-- ---------- Admin approve, with this feature's copy target ----------
drop function if exists public.nusuk_admin_feature_approve(bigint);
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
     set featured_at = now(), status = 'active',
         boost_quota = case when p_quota between 1 and 1000 then p_quota else null end
   where lower(c.code) = lower(r.code) and c.status <> 'rejected';
  if not found then raise exception 'code % is not in the list (deleted or rejected)', r.code; end if;

  update public.nusuk_feature_requests x set status = 'approved', decided_at = now() where x.id = p_id;
  return jsonb_build_object('ok', true, 'code', r.code);
end $$;
revoke all on function public.nusuk_admin_feature_approve(bigint, int) from public, anon;
grant execute on function public.nusuk_admin_feature_approve(bigint, int) to authenticated;
