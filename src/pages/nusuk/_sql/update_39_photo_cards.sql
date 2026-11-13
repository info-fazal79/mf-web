-- =====================================================================
-- Nusuk · update 39 · photo card tracking
-- Run once in Supabase → SQL Editor, BEFORE pushing. Safe to run again.
--
-- /nusuk "ফটো কার্ড বানান": every Download / Share press is logged
-- (code, name, colour, message, an anonymous device id). No login.
-- Nusuk Manager → Photo cards shows the counts, a day-by-day table,
-- top codes and the latest cards.
-- =====================================================================

create table if not exists public.nusuk_photocards (
  id       bigint generated always as identity primary key,
  at       timestamptz not null default now(),
  action   text not null check (action in ('download', 'share')),
  code     text not null,
  name     text not null default '',
  theme    text not null default 'green',
  msg      smallint not null default 0,
  device   text not null default ''
);
create index if not exists nusuk_photocards_at on public.nusuk_photocards (at desc);
create index if not exists nusuk_photocards_device on public.nusuk_photocards (device, at desc);
alter table public.nusuk_photocards enable row level security;
drop policy if exists "nusuk_photocards: admin all" on public.nusuk_photocards;
create policy "nusuk_photocards: admin all" on public.nusuk_photocards for all using (public.is_admin()) with check (public.is_admin());

/** Visitor: log one Download / Share of a photo card (max 60 per device per hour) */
create or replace function public.nusuk_photocard_log(p_action text, p_code text, p_name text default '', p_theme text default 'green', p_msg int default 0, p_device text default '')
returns boolean
language plpgsql volatile security definer set search_path = public as $$
declare
  dev text := left(coalesce(p_device, ''), 64);
begin
  if p_action not in ('download', 'share') then return false; end if;
  if coalesce(p_code, '') !~ '^NG-[A-Za-z0-9]{8}$' then return false; end if;
  if dev <> '' and (select count(*) from public.nusuk_photocards where device = dev and at > now() - interval '1 hour') >= 60 then return false; end if;
  insert into public.nusuk_photocards (action, code, name, theme, msg, device)
  values (p_action, p_code, left(trim(coalesce(p_name, '')), 40),
          case when p_theme in ('green', 'gold', 'night') then p_theme else 'green' end,
          least(20, greatest(0, coalesce(p_msg, 0))), dev);
  return true;
end $$;
grant execute on function public.nusuk_photocard_log(text, text, text, text, int, text) to anon, authenticated;

/** Nusuk Manager: photo card numbers (Bangladesh days) */
create or replace function public.nusuk_admin_photocards(p_days int default 14)
returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  today date := (now() at time zone 'Asia/Dhaka')::date;
  n int := least(90, greatest(1, coalesce(p_days, 14)));
begin
  if not public.is_admin() then raise exception 'not allowed'; end if;
  return jsonb_build_object(
    'total', (select jsonb_build_object(
        'downloads', count(*) filter (where action = 'download'),
        'shares', count(*) filter (where action = 'share'),
        'people', count(distinct nullif(device, '')),
        'codes', count(distinct code)) from public.nusuk_photocards),
    'today', (select jsonb_build_object(
        'downloads', count(*) filter (where action = 'download'),
        'shares', count(*) filter (where action = 'share'),
        'people', count(distinct nullif(device, ''))) from public.nusuk_photocards
        where (at at time zone 'Asia/Dhaka')::date = today),
    'days', (select coalesce(jsonb_agg(jsonb_build_object('day', d, 'downloads', coalesce(x.dl, 0), 'shares', coalesce(x.sh, 0), 'people', coalesce(x.pp, 0)) order by d desc), '[]'::jsonb)
        from generate_series(today - (n - 1), today, interval '1 day') g(dd)
        cross join lateral (select g.dd::date as d) dd
        left join lateral (
          select count(*) filter (where action = 'download') dl, count(*) filter (where action = 'share') sh, count(distinct nullif(device, '')) pp
          from public.nusuk_photocards where (at at time zone 'Asia/Dhaka')::date = dd.d) x on true),
    'top', (select coalesce(jsonb_agg(t order by t.cards desc), '[]'::jsonb) from (
        select code, max(name) filter (where name <> '') as name, count(*) as cards
        from public.nusuk_photocards group by code order by count(*) desc limit 10) t),
    'messages', (select coalesce(jsonb_object_agg(msg, c), '{}'::jsonb) from (select msg, count(*) c from public.nusuk_photocards group by msg) m),
    'themes', (select coalesce(jsonb_object_agg(theme, c), '{}'::jsonb) from (select theme, count(*) c from public.nusuk_photocards group by theme) m),
    'recent', (select coalesce(jsonb_agg(r order by r.at desc), '[]'::jsonb) from (
        select at, action, code, name, theme, msg from public.nusuk_photocards order by at desc limit 100) r)
  );
end $$;
grant execute on function public.nusuk_admin_photocards(int) to authenticated;
