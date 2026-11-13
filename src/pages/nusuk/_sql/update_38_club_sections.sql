-- update_38: Reward Club account page sections on/off (Nusuk Manager → Reward Club → Account page sections).
-- Adds a `show` object to nusuk_club_cfg(): invite (কারো আমন্ত্রণে এসেছেন?), tickets (টিকিটের হিসাব), contests.
-- Missing values count as shown, so nothing changes until you switch something off.
-- Safe to run more than once.

create or replace function public.nusuk_club_cfg()
returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'on', public.nusuk_club_active(),
    'public', coalesce((s.content->'club'->>'on')::boolean, false),
    'test', coalesce((s.content->'club'->>'test')::boolean, false) and not coalesce((s.content->'club'->>'on')::boolean, false),
    'copy_from', coalesce(nullif(s.content->'club'->>'copy_from', ''), '09:00'),
    'copy_to', coalesce(nullif(s.content->'club'->>'copy_to', ''), '17:00'),
    'title', coalesce(s.content->'club'->>'title', ''),
    'rules', coalesce(s.content->'club'->>'rules', ''),
    'caption', coalesce(s.content->'club'->>'caption', ''),
    'card_line', coalesce(s.content->'club'->>'card_line', ''),
    'show', jsonb_build_object(
      'invite', coalesce((s.content->'club'->'show'->>'invite')::boolean, true),
      'tickets', coalesce((s.content->'club'->'show'->>'tickets')::boolean, true),
      'contests', coalesce((s.content->'club'->'show'->>'contests')::boolean, true)
    )
  )
  from public.nusuk_settings s where s.id = 1
$$;
