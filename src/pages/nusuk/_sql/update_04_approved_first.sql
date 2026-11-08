-- =====================================================================
-- Nusuk · update 04 · approved codes are shown first
-- Run once in Supabase → SQL Editor (after update 03). Safe to run again.
-- No site rebuild needed: the public page asks the database for the next code.
--
-- Before: visitors got the least-used active code, so a freshly approved
--   submission sat somewhere among thousands of uploaded codes.
-- Now:   every user submission the admin approves (Review → Approve) jumps to
--   the front. A visitor sees all approved codes they have not copied yet
--   before any of the bulk-uploaded codes. Among approved codes the least-used
--   comes first; on a tie, the most recently approved comes first.
-- =====================================================================

alter table public.nusuk_codes add column if not exists approved_at timestamptz;

-- Already-approved user submissions also count as approved
update public.nusuk_codes
   set approved_at = created_at
 where source = 'user' and status = 'active' and approved_at is null;

-- Stamp approved_at whenever a user submission becomes active (Approve button,
-- bulk approve, or editing the status). Disable/enable later keeps the stamp.
create or replace function public.nusuk_codes_mark_approved()
returns trigger
language plpgsql as $$
begin
  if new.source = 'user' and new.status = 'active' and new.approved_at is null then
    if tg_op = 'INSERT' then
      new.approved_at := now();
    elsif old.status is distinct from 'active' then
      new.approved_at := now();
    end if;
  end if;
  return new;
end $$;

drop trigger if exists nusuk_codes_mark_approved on public.nusuk_codes;
create trigger nusuk_codes_mark_approved
  before insert or update of status on public.nusuk_codes
  for each row execute function public.nusuk_codes_mark_approved();

-- Fast lookup in the new order
create index if not exists nusuk_codes_pick4_idx on public.nusuk_codes
  ((approved_at is null), uses, approved_at desc, last_used_at nulls first, id)
  where status = 'active';

-- ---------- Internal: next code for a visitor (approved submissions first) ----------
create or replace function public.nusuk_pick(p_exclude bigint[])
returns table (id bigint, code text)
language sql stable security definer set search_path = public as $$
  select c.id, c.code
  from public.nusuk_codes c
  where c.status = 'active'
    and not (c.id = any (coalesce(p_exclude, '{}')))
  order by (c.approved_at is null), c.uses, c.approved_at desc, c.last_used_at nulls first, c.id
  limit 1;
$$;
revoke all on function public.nusuk_pick(bigint[]) from public, anon, authenticated;
