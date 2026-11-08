-- =====================================================================
-- Nusuk · update 05 · featured codes
-- Run once in Supabase → SQL Editor (after update 04). Safe to run again.
-- Run this BEFORE the new admin version goes live (the Codes page sorts by it).
--
-- Admin → Codes → ★ Feature pins a code to the very top for every visitor.
-- Several codes can be featured; the one featured most recently is first.
-- Order a visitor gets codes in (codes they already copied are skipped):
--   1. featured codes, newest featured first
--   2. approved user submissions (update 04)
--   3. everything else, least-used first
-- =====================================================================

alter table public.nusuk_codes add column if not exists featured_at timestamptz;

create index if not exists nusuk_codes_featured_idx on public.nusuk_codes (featured_at desc)
  where featured_at is not null;

-- ---------- Internal: next code for a visitor ----------
create or replace function public.nusuk_pick(p_exclude bigint[])
returns table (id bigint, code text)
language sql stable security definer set search_path = public as $$
  select c.id, c.code
  from public.nusuk_codes c
  where c.status = 'active'
    and not (c.id = any (coalesce(p_exclude, '{}')))
  order by c.featured_at desc nulls last,
           (c.approved_at is null), c.uses, c.approved_at desc, c.last_used_at nulls first, c.id
  limit 1;
$$;
revoke all on function public.nusuk_pick(bigint[]) from public, anon, authenticated;
