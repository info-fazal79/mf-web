-- =====================================================================
-- MF Website · Migration 0008 · Email notifications & newsletter (Phase 9)
-- Run AFTER 0007. Paste into Supabase → SQL Editor → Run. Safe to re-run.
-- If Supabase shows a Row Level Security warning, choose "Run without RLS".
--
-- How it works: database triggers call the "notify" Edge Function (using
-- pg_net) whenever something happens (new booking, order, message…). The
-- function sends the email with Resend. A random secret, created here and
-- stored in an admin-only table, proves the call came from your database.
-- Email failures never block bookings or orders.
-- =====================================================================

create extension if not exists pg_net with schema extensions;

-- ---------- Settings (admin-only) ----------
insert into public.private_settings (key, value)
values ('notify', jsonb_build_object(
  'url', 'https://mbdmdswemppcinhvjyti.supabase.co/functions/v1/notify',
  'secret', replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''),
  'enabled', true
))
on conflict (key) do nothing;

insert into public.private_settings (key, value)
values ('email', jsonb_build_object(
  'fromName', 'Muhammad Fazal',
  'fromEmail', 'onboarding@resend.dev',
  'adminEmail', '',
  'siteUrl', 'https://muhammadfazal.com'
))
on conflict (key) do nothing;

-- ---------- Fire-and-forget call to the Edge Function ----------
create or replace function public.notify_event(p_type text, p_record jsonb)
returns void language plpgsql security definer set search_path = public, extensions as $$
declare cfg jsonb;
begin
  select value into cfg from public.private_settings where key = 'notify';
  if cfg is null or coalesce((cfg->>'enabled')::boolean, false) = false or coalesce(cfg->>'url', '') = '' then return; end if;
  perform net.http_post(
    url := cfg->>'url',
    body := jsonb_build_object('type', p_type, 'record', p_record),
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-notify-secret', cfg->>'secret'),
    timeout_milliseconds := 5000
  );
exception when others then
  raise warning 'notify_event(%) failed: %', p_type, sqlerrm;
end $$;
revoke all on function public.notify_event(text, jsonb) from public, anon, authenticated;

create or replace function public.trg_notify()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_table_name = 'orders' and tg_op = 'UPDATE' then
    if new.status is distinct from old.status and new.status in ('paid', 'rejected') then
      perform public.notify_event('order.' || new.status, to_jsonb(new));
    end if;
    return new;
  end if;
  perform public.notify_event(tg_argv[0], to_jsonb(new));
  return new;
end $$;

drop trigger if exists notify_consultation on public.consultations;
create trigger notify_consultation after insert on public.consultations for each row execute function public.trg_notify('consultation.new');
drop trigger if exists notify_message on public.messages;
create trigger notify_message after insert on public.messages for each row execute function public.trg_notify('message.new');
drop trigger if exists notify_order_new on public.orders;
create trigger notify_order_new after insert on public.orders for each row execute function public.trg_notify('order.new');
drop trigger if exists notify_order_status on public.orders;
create trigger notify_order_status after update of status on public.orders for each row execute function public.trg_notify('order.status');
drop trigger if exists notify_comment on public.comments;
create trigger notify_comment after insert on public.comments for each row when (new.is_admin = false) execute function public.trg_notify('comment.new');
drop trigger if exists notify_review on public.ebook_reviews;
create trigger notify_review after insert on public.ebook_reviews for each row execute function public.trg_notify('review.new');
drop trigger if exists notify_subscriber on public.subscribers;
create trigger notify_subscriber after insert on public.subscribers for each row execute function public.trg_notify('subscriber.new');

-- ---------- Unsubscribe links ----------
alter table public.subscribers add column if not exists unsubscribe_token uuid not null default gen_random_uuid();
create unique index if not exists subscribers_token_uniq on public.subscribers (unsubscribe_token);

create or replace function public.unsubscribe(p_token uuid)
returns text language plpgsql security definer set search_path = public as $$
declare v_email text;
begin
  update public.subscribers set status = 'unsubscribed' where unsubscribe_token = p_token returning email into v_email;
  if v_email is null then return null; end if;
  return regexp_replace(v_email, '^(.).*(@.*)$', '\1•••\2');
end $$;
grant execute on function public.unsubscribe(uuid) to anon, authenticated;

-- Re-subscribing with the same email turns the subscription back on.
create or replace function public.resubscribe_on_conflict()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  update public.subscribers set status = 'active' where email = new.email and status = 'unsubscribed';
  if found then return null; end if;
  return new;
end $$;
drop trigger if exists subscribers_resubscribe on public.subscribers;
create trigger subscribers_resubscribe before insert on public.subscribers for each row execute function public.resubscribe_on_conflict();

-- ---------- Newsletter campaigns ----------
create table if not exists public.campaigns (
  id          uuid primary key default gen_random_uuid(),
  subject     text not null,
  preheader   text,
  body        text not null default '',
  status      text not null default 'draft' check (status in ('draft', 'sending', 'sent', 'failed')),
  sent_count  int not null default 0,
  error       text,
  created_at  timestamptz not null default now(),
  sent_at     timestamptz
);
alter table public.campaigns enable row level security;
drop policy if exists "campaigns: admin all" on public.campaigns;
create policy "campaigns: admin all" on public.campaigns for all using (public.is_admin()) with check (public.is_admin());

-- ---------- Delivery log (for troubleshooting in the admin) ----------
create table if not exists public.email_log (
  id          bigint generated always as identity primary key,
  event       text not null,
  recipient   text,
  subject     text,
  ok          boolean not null,
  error       text,
  created_at  timestamptz not null default now()
);
alter table public.email_log enable row level security;
drop policy if exists "email_log: admin read" on public.email_log;
create policy "email_log: admin read" on public.email_log for select using (public.is_admin());
