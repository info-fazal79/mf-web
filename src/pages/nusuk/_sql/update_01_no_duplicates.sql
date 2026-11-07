-- =====================================================================
-- Nusuk · update 01 · no duplicate codes, ever
-- Run once in Supabase → SQL Editor (after install.sql). Safe to run again.
--
-- 1. Removes duplicates that differ only by letter case (abc123 / ABC123),
--    keeping the best copy (active first, then most used, then oldest).
-- 2. Adds a case-insensitive unique index so the database itself refuses
--    any duplicate, whoever adds it (admin upload, edit or visitor form).
-- 3. Adds nusuk_admin_add_codes(): bulk upload that inserts only new codes
--    and reports which ones were skipped.
-- 4. Makes the visitor submit form race-safe and case-insensitive.
-- =====================================================================

-- 1. Clean up existing case-variant duplicates
delete from public.nusuk_codes
where id in (
  select id from (
    select id, row_number() over (
      partition by lower(code)
      order by (status = 'active') desc, uses desc, id
    ) as rn
    from public.nusuk_codes
  ) t
  where t.rn > 1
);

-- 2. One code = one row, regardless of letter case
create unique index if not exists nusuk_codes_code_ci_key on public.nusuk_codes (lower(code));

-- Format rule for every new or edited code (existing rows are not re-checked)
do $$ begin
  alter table public.nusuk_codes
    add constraint nusuk_codes_code_format check (code ~ '^[A-Za-z0-9_-]{3,40}$') not valid;
exception when duplicate_object then null; end $$;

-- 3. Admin bulk upload: insert only codes that are not in the database yet
create or replace function public.nusuk_admin_add_codes(p_codes text[], p_max_uses int default 1, p_status text default 'active')
returns jsonb
language plpgsql volatile security definer set search_path = public as $$
declare
  added text[];
begin
  if not public.is_admin() then raise exception 'not allowed'; end if;
  if p_status not in ('active', 'inactive') then raise exception 'bad status'; end if;

  with input as (
    -- strip spaces, keep valid ones, dedupe inside the list itself (case-insensitive)
    select distinct on (lower(c)) c
    from (select regexp_replace(x, '\s', '', 'g') as c from unnest(p_codes) as x) s
    where c ~ '^[A-Za-z0-9_-]{3,40}$'
    order by lower(c)
  ),
  ins as (
    insert into public.nusuk_codes (code, status, source, max_uses)
    select c, p_status, 'admin', greatest(1, coalesce(p_max_uses, 1)) from input
    on conflict do nothing
    returning code
  )
  select coalesce(array_agg(code), '{}') into added from ins;

  return jsonb_build_object('added', added);
end $$;
revoke all on function public.nusuk_admin_add_codes(text[], int, text) from public, anon;
grant execute on function public.nusuk_admin_add_codes(text[], int, text) to authenticated;

-- 4. Visitor submissions: case-insensitive check + race-safe insert
create or replace function public.nusuk_submit(p_code text, p_name text default null, p_note text default null)
returns jsonb
language plpgsql volatile security definer set search_path = public as $$
declare
  v text := regexp_replace(coalesce(p_code, ''), '\s', '', 'g');
  st text;
begin
  if not exists (select 1 from public.nusuk_settings where id = 1 and enabled and submissions_enabled) then
    return jsonb_build_object('ok', false, 'reason', 'closed');
  end if;
  if v !~ '^[A-Za-z0-9_-]{3,40}$' then
    return jsonb_build_object('ok', false, 'reason', 'invalid');
  end if;
  select status into st from public.nusuk_codes where lower(code) = lower(v);
  if st is not null then
    return jsonb_build_object('ok', false, 'reason', 'exists', 'status', st);
  end if;
  if (select count(*) from public.nusuk_codes where status = 'pending') >= 300 then
    return jsonb_build_object('ok', false, 'reason', 'busy');
  end if;
  insert into public.nusuk_codes (code, status, source, max_uses, submitter, note)
  values (
    v, 'pending', 'user',
    (select default_max_uses from public.nusuk_settings where id = 1),
    nullif(left(trim(coalesce(p_name, '')), 120), ''),
    nullif(left(trim(coalesce(p_note, '')), 300), '')
  )
  on conflict do nothing;
  if not found then
    -- someone submitted the same code at the same moment
    return jsonb_build_object('ok', false, 'reason', 'exists', 'status', 'pending');
  end if;
  return jsonb_build_object('ok', true);
end $$;
grant execute on function public.nusuk_submit(text, text, text) to anon, authenticated;
