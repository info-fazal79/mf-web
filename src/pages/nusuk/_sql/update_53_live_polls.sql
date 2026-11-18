-- =====================================================================
-- Nusuk · update 53 · live voting (Nusuk Manager → Live screen → Voting)
-- Run once in Supabase → SQL Editor (after update 52), BEFORE pushing.
-- Safe to run again.
--
-- The poll and its options live in nusuk_settings.content.livescreen.polls;
-- livescreen.poll_show = the id of the poll on screen (voting is open only then).
-- Viewers scan the QR code (muhammadfazal.com/nusuk/vote), no account needed:
--   • one vote per phone/browser per poll (device id), at most 30 votes per
--     internet connection (IP) per poll, so a family or office can still vote
--   • counts are kept in one small row per poll, so the live screen never
--     counts the votes again (it reads that row every few seconds)
-- =====================================================================

create table if not exists public.nusuk_poll_votes (
  poll        text not null,
  device      uuid not null,
  choice      smallint not null,
  ip          text,
  created_at  timestamptz not null default now(),
  primary key (poll, device)
);
create index if not exists nusuk_poll_votes_ip on public.nusuk_poll_votes (poll, ip);

create table if not exists public.nusuk_poll_counts (
  poll        text primary key,
  counts      int[] not null default '{}',
  total       int not null default 0,
  updated_at  timestamptz not null default now()
);

alter table public.nusuk_poll_votes enable row level security;
alter table public.nusuk_poll_counts enable row level security;
drop policy if exists "nusuk_poll_votes: admin all" on public.nusuk_poll_votes;
create policy "nusuk_poll_votes: admin all" on public.nusuk_poll_votes for all using (public.is_admin()) with check (public.is_admin());
drop policy if exists "nusuk_poll_counts: admin all" on public.nusuk_poll_counts;
create policy "nusuk_poll_counts: admin all" on public.nusuk_poll_counts for all using (public.is_admin()) with check (public.is_admin());

/** The poll on the live screen right now (null when none) */
create or replace function public.nusuk_poll_on()
returns jsonb
language sql stable security definer set search_path = public as $$
  select p
  from public.nusuk_settings s,
       jsonb_array_elements(case when jsonb_typeof(s.content->'livescreen'->'polls') = 'array' then s.content->'livescreen'->'polls' else '[]'::jsonb end) p
  where s.id = 1 and p->>'id' = s.content->'livescreen'->>'poll_show'
  limit 1
$$;
revoke all on function public.nusuk_poll_on() from public, anon, authenticated;

/** Counts of one poll (one row read) */
create or replace function public.nusuk_poll_results(p_poll text)
returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce(
    (select jsonb_build_object('poll', poll, 'counts', to_jsonb(counts), 'total', total) from public.nusuk_poll_counts where poll = p_poll),
    jsonb_build_object('poll', p_poll, 'counts', '[]'::jsonb, 'total', 0))
$$;
grant execute on function public.nusuk_poll_results(text) to anon, authenticated;

/** The vote page: the poll on screen, its counts, and this phone's vote (if any) */
create or replace function public.nusuk_poll_current(p_device text default null)
returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare p jsonb := public.nusuk_poll_on(); mine int;
begin
  if p is null then return jsonb_build_object('poll', null); end if;
  if p_device ~ '^[0-9a-fA-F-]{36}$' then
    select choice into mine from public.nusuk_poll_votes where poll = p->>'id' and device = p_device::uuid;
  end if;
  return jsonb_build_object(
    'poll', jsonb_build_object('id', p->>'id', 'q', p->>'q', 'options', p->'options'),
    'results', public.nusuk_poll_results(p->>'id'),
    'mine', mine);
end $$;
grant execute on function public.nusuk_poll_current(text) to anon, authenticated;

/** Cast a vote (only for the poll on screen; one per device) */
create or replace function public.nusuk_poll_vote(p_poll text, p_choice int, p_device text)
returns jsonb
language plpgsql volatile security definer set search_path = public as $$
declare
  p jsonb := public.nusuk_poll_on();
  n int;
  v_ip text;
  done int;
begin
  if p is null or p->>'id' is distinct from p_poll then return jsonb_build_object('ok', false, 'reason', 'closed'); end if;
  n := jsonb_array_length(coalesce(p->'options', '[]'::jsonb));
  if p_choice is null or p_choice < 0 or p_choice >= n then return jsonb_build_object('ok', false, 'reason', 'choice'); end if;
  if p_device is null or p_device !~ '^[0-9a-fA-F-]{36}$' then return jsonb_build_object('ok', false, 'reason', 'device'); end if;
  begin
    v_ip := split_part(coalesce((current_setting('request.headers', true)::jsonb)->>'x-forwarded-for', ''), ',', 1);
  exception when others then v_ip := null;
  end;
  v_ip := nullif(btrim(v_ip), '');
  if v_ip is not null and (select count(*) from public.nusuk_poll_votes where poll = p_poll and ip = v_ip) >= 30 then
    return jsonb_build_object('ok', false, 'reason', 'busy');
  end if;
  insert into public.nusuk_poll_votes (poll, device, choice, ip) values (p_poll, p_device::uuid, p_choice, v_ip)
  on conflict (poll, device) do nothing;
  get diagnostics done = row_count;
  if done = 0 then
    return jsonb_build_object('ok', false, 'reason', 'voted', 'results', public.nusuk_poll_results(p_poll),
      'mine', (select choice from public.nusuk_poll_votes where poll = p_poll and device = p_device::uuid));
  end if;
  insert into public.nusuk_poll_counts (poll, counts, total) values (p_poll, array_fill(0, array[n]), 0) on conflict (poll) do nothing;
  update public.nusuk_poll_counts
     set counts[p_choice + 1] = coalesce(counts[p_choice + 1], 0) + 1, total = total + 1, updated_at = now()
   where poll = p_poll;
  return jsonb_build_object('ok', true, 'results', public.nusuk_poll_results(p_poll), 'mine', p_choice);
end $$;
grant execute on function public.nusuk_poll_vote(text, int, text) to anon, authenticated;

/** Nusuk Manager: start a poll again from zero */
create or replace function public.nusuk_admin_poll_reset(p_poll text)
returns jsonb
language plpgsql volatile security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'not allowed'; end if;
  delete from public.nusuk_poll_votes where poll = p_poll;
  delete from public.nusuk_poll_counts where poll = p_poll;
  return jsonb_build_object('ok', true);
end $$;
grant execute on function public.nusuk_admin_poll_reset(text) to authenticated;
