-- =====================================================================
-- Nusuk · update 40 · live screen "Winner" view
-- Run once in Supabase → SQL Editor (after update 39), BEFORE pushing.
-- Safe to run again.
--
-- A third live-screen mode next to Normal and Raffle draw: a full screen for
-- Nusuk's official winner announcement. It shows the countdown to the next
-- announcement, the latest winner and the Bangladeshi winners list; when a new
-- winner is saved in Nusuk Manager → Winners → Today's winner, the screen
-- announces it within a few seconds.
-- =====================================================================

alter table public.nusuk_club_draw_state drop constraint if exists nusuk_club_draw_state_mode_check;
alter table public.nusuk_club_draw_state add constraint nusuk_club_draw_state_mode_check check (mode in ('normal', 'raffle', 'winner'));

create or replace function public.nusuk_club_live_draw()
returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  s public.nusuk_club_draw_state;
  c public.nusuk_club_contests;
begin
  select * into s from public.nusuk_club_draw_state where id = 1;
  -- Winner view: Nusuk's official winner (Nusuk Manager → Winners → Today's winner) + the winners list
  if s.mode = 'winner' then
    return jsonb_build_object(
      'mode', 'winner',
      'now', now(),
      'today', (select st.content -> 'today_winner' from public.nusuk_settings st where st.id = 1),
      'winners', coalesce((select case when jsonb_typeof(st.content -> 'winners') = 'array' then st.content -> 'winners' end
                           from public.nusuk_settings st where st.id = 1), '[]'::jsonb)
    );
  end if;
  if s.id is null or s.mode <> 'raffle' or s.contest_id is null then
    return jsonb_build_object('mode', 'normal', 'now', now());
  end if;
  select * into c from public.nusuk_club_contests where id = s.contest_id;
  if c.id is null then return jsonb_build_object('mode', 'normal', 'now', now()); end if;
  return jsonb_build_object(
    'mode', 'raffle',
    'now', now(),
    'countdown_end', s.countdown_end,
    'scope', s.scope,
    'contest', jsonb_build_object('id', c.id, 'title', c.title, 'kind', c.kind, 'prizes', c.prizes),
    'total', (select coalesce(sum(n), 0) from public.nusuk_club_pool(c.id, s.scope)),
    'people', (select count(*) from public.nusuk_club_pool(c.id, s.scope)),
    'wheel', coalesce((
      select jsonb_agg(jsonb_build_object('k', m.sl, 'name', split_part(m.name, ' ', 1), 't', p.n) order by p.n desc, m.sl)
      from (select * from public.nusuk_club_pool(c.id, s.scope) order by n desc limit 300) p
      join public.nusuk_club_members m on m.user_id = p.user_id), '[]'::jsonb),
    'winners', coalesce((
      select jsonb_agg(jsonb_build_object('id', w.id, 'place', w.place, 'prize', w.prize, 'tickets', w.tickets,
               'k', m.sl, 'name', m.name, 'code', public.nusuk_club_mask(m.nusuk_code)) order by w.created_at)
      from public.nusuk_club_winners w
      join public.nusuk_club_members m on m.user_id = w.user_id
      where w.contest_id = c.id and w.scope = s.scope), '[]'::jsonb)
  );
end $$;

grant execute on function public.nusuk_club_live_draw() to anon, authenticated;
