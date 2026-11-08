-- =====================================================================
-- Nusuk · update 12 · "is my code listed?" search for visitors
-- Run once in Supabase → SQL Editor. Safe to run again.
-- Run this BEFORE the new site version goes live.
--
-- Visitors type their own code in the submit card and see whether it is
-- in the database: listed (active), waiting for review, hidden, rejected,
-- or not found. Only the status of that one exact code is returned, nothing
-- else, so the list of codes cannot be read through it.
-- =====================================================================

create or replace function public.nusuk_check_code(p_code text)
returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v text := regexp_replace(coalesce(p_code, ''), '\s', '', 'g');
  c public.nusuk_codes;
  s public.nusuk_settings;
begin
  select * into s from public.nusuk_settings where id = 1;
  if s is null or not s.enabled then
    return jsonb_build_object('ok', false, 'reason', 'closed');
  end if;
  if v !~ '^[A-Za-z0-9_-]{3,40}$' then
    return jsonb_build_object('ok', false, 'reason', 'invalid');
  end if;

  -- Same letters, any case (the database never holds two codes that differ only by case)
  select * into c from public.nusuk_codes where lower(code) = lower(v) limit 1;
  if c.id is null then
    return jsonb_build_object('ok', true, 'found', false);
  end if;

  return jsonb_build_object(
    'ok', true,
    'found', true,
    'status', c.status,
    'exact_case', c.code = v,
    'featured', c.status = 'active' and c.featured_at is not null
                and c.featured_at > now() - make_interval(hours => greatest(1, coalesce(s.feature_hours, 12)))
  );
end $$;
revoke all on function public.nusuk_check_code(text) from public;
grant execute on function public.nusuk_check_code(text) to anon, authenticated;
