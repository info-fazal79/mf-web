-- =====================================================================
-- Nusuk · update 06 · visitor counter (total visitors + active now)
-- Run once in Supabase → SQL Editor. Safe to run again.
-- The page hides the counter until this has been run, so order does not matter.
--
-- Every browser gets a random id (kept in localStorage, no personal data).
-- While the page is open it pings every ~45 seconds.
--   total  = every browser that has ever opened /nusuk
--   active = browsers that pinged in the last 2 minutes
-- =====================================================================

create table if not exists public.nusuk_visitors (
  device      uuid primary key,
  first_seen  timestamptz not null default now(),
  last_seen   timestamptz not null default now()
);
create index if not exists nusuk_visitors_last_seen_idx on public.nusuk_visitors (last_seen desc);

alter table public.nusuk_visitors enable row level security;
drop policy if exists "nusuk_visitors: admin read" on public.nusuk_visitors;
create policy "nusuk_visitors: admin read" on public.nusuk_visitors
  for select using (public.is_admin());

-- ---------- Public: record this browser as online, return the counts ----------
create or replace function public.nusuk_ping(p_device uuid)
returns jsonb
language plpgsql volatile security definer set search_path = public as $$
begin
  if p_device is not null then
    insert into public.nusuk_visitors (device) values (p_device)
    on conflict (device) do update set last_seen = now()
      where public.nusuk_visitors.last_seen < now() - interval '20 seconds';
  end if;
  return jsonb_build_object(
    'total',  (select count(*) from public.nusuk_visitors),
    'active', (select count(*) from public.nusuk_visitors where last_seen > now() - interval '2 minutes')
  );
end $$;
revoke all on function public.nusuk_ping(uuid) from public;
grant execute on function public.nusuk_ping(uuid) to anon, authenticated;
