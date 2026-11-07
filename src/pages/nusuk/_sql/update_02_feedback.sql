-- =====================================================================
-- Nusuk · update 02 · visitor feedback (complaint / suggestion / opinion)
-- Run once in Supabase → SQL Editor. Safe to run again.
-- Visitors send it from the button at the bottom of /nusuk; you read it in
-- Nusuk Manager → Feedback.
-- =====================================================================

create table if not exists public.nusuk_feedback (
  id          bigint generated always as identity primary key,
  kind        text not null default 'opinion' check (kind in ('complaint', 'suggestion', 'opinion')),
  name        text not null check (char_length(name) between 1 and 120),
  phone       text check (char_length(phone) <= 30),
  address     text check (char_length(address) <= 300),
  message     text not null check (char_length(message) between 1 and 3000),
  status      text not null default 'new' check (status in ('new', 'read', 'resolved')),
  admin_note  text check (char_length(admin_note) <= 1000),
  created_at  timestamptz not null default now()
);
create index if not exists nusuk_feedback_status_idx on public.nusuk_feedback (status, created_at desc);

alter table public.nusuk_feedback enable row level security;
-- No public policies: visitors can only send through nusuk_feedback_submit(), never read.
drop policy if exists "nusuk_feedback: admin all" on public.nusuk_feedback;
create policy "nusuk_feedback: admin all" on public.nusuk_feedback
  for all using (public.is_admin()) with check (public.is_admin());

create or replace function public.nusuk_feedback_submit(
  p_kind text, p_name text, p_message text, p_phone text default null, p_address text default null
)
returns jsonb
language plpgsql volatile security definer set search_path = public as $$
declare
  v_name text := left(trim(coalesce(p_name, '')), 120);
  v_msg  text := left(trim(coalesce(p_message, '')), 3000);
  v_phone text := nullif(left(regexp_replace(coalesce(p_phone, ''), '[^0-9+ -]', '', 'g'), 30), '');
begin
  if v_name = '' or v_msg = '' then
    return jsonb_build_object('ok', false, 'reason', 'missing');
  end if;
  -- Light flood guard: stop accepting while 1000 unread messages are waiting.
  if (select count(*) from public.nusuk_feedback where status = 'new') >= 1000 then
    return jsonb_build_object('ok', false, 'reason', 'busy');
  end if;
  insert into public.nusuk_feedback (kind, name, phone, address, message)
  values (
    case when p_kind in ('complaint', 'suggestion', 'opinion') then p_kind else 'opinion' end,
    v_name, nullif(trim(v_phone), ''), nullif(left(trim(coalesce(p_address, '')), 300), ''), v_msg
  );
  return jsonb_build_object('ok', true);
end $$;
grant execute on function public.nusuk_feedback_submit(text, text, text, text, text) to anon, authenticated;
