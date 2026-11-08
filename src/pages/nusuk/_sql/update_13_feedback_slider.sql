-- =====================================================================
-- Nusuk · update 13 · visitor feedback slider
-- Run once in Supabase → SQL Editor (after update 02). Safe to run again.
-- Run this BEFORE the new site version goes live.
--
-- The feedback form now asks "may we show your name and message on the page?"
-- (allow_public). In Nusuk Manager → Feedback you can put any message that
-- said yes on the slider below the feedback section on /nusuk with one click.
-- Messages sent before this update did not give that permission (the form said
-- only the admin would see them), so they cannot go on the slider.
-- Phone and address are never shown.
-- =====================================================================

alter table public.nusuk_feedback add column if not exists allow_public boolean not null default false;
alter table public.nusuk_feedback add column if not exists on_slider   boolean not null default false;
alter table public.nusuk_feedback add column if not exists slider_at   timestamptz;
do $$ begin
  alter table public.nusuk_feedback add constraint nusuk_feedback_slider_consent check (not on_slider or allow_public);
exception when duplicate_object then null; end $$;
create index if not exists nusuk_feedback_slider_idx on public.nusuk_feedback (slider_at desc) where on_slider;

-- Stamp the time a message goes on the slider (newest first)
create or replace function public.nusuk_feedback_slider_stamp()
returns trigger
language plpgsql as $$
begin
  if new.on_slider and (tg_op = 'INSERT' or not old.on_slider) then new.slider_at := now(); end if;
  if not new.on_slider then new.slider_at := null; end if;
  return new;
end $$;
drop trigger if exists nusuk_feedback_slider_stamp on public.nusuk_feedback;
create trigger nusuk_feedback_slider_stamp
  before insert or update of on_slider on public.nusuk_feedback
  for each row execute function public.nusuk_feedback_slider_stamp();

-- ---------- Public: send feedback (now with the permission checkbox) ----------
drop function if exists public.nusuk_feedback_submit(text, text, text, text, text);
create or replace function public.nusuk_feedback_submit(
  p_kind text, p_name text, p_message text, p_phone text default null, p_address text default null, p_public boolean default false
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
  if (select count(*) from public.nusuk_feedback where status = 'new') >= 1000 then
    return jsonb_build_object('ok', false, 'reason', 'busy');
  end if;
  insert into public.nusuk_feedback (kind, name, phone, address, message, allow_public)
  values (
    case when p_kind in ('complaint', 'suggestion', 'opinion') then p_kind else 'opinion' end,
    v_name, nullif(trim(v_phone), ''), nullif(left(trim(coalesce(p_address, '')), 300), ''), v_msg,
    coalesce(p_public, false)
  );
  return jsonb_build_object('ok', true);
end $$;
grant execute on function public.nusuk_feedback_submit(text, text, text, text, text, boolean) to anon, authenticated;

-- ---------- Public: messages on the slider (name + message only) ----------
create or replace function public.nusuk_feedback_slider()
returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object(
           'kind', f.kind,
           'name', left(f.name, 60),
           'message', left(f.message, 500),
           'at', f.created_at) order by f.slider_at desc), '[]'::jsonb)
  from (select * from public.nusuk_feedback
        where on_slider and allow_public
        order by slider_at desc
        limit 30) f
  where exists (select 1 from public.nusuk_settings where id = 1 and enabled);
$$;
grant execute on function public.nusuk_feedback_slider() to anon, authenticated;
