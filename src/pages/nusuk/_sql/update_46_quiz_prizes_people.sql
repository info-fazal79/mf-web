-- =====================================================================
-- Nusuk · update 46 · quiz: prize cards on the home page, participants list,
--                     and "draw" instead of "lottery" in saved texts
-- Run once in Supabase → SQL Editor (after update 45), BEFORE pushing.
-- Safe to run again.
--
--   • nusuk_cq_public()       – public, cached 60 s: the running quiz campaign for the
--                               /nusuk home page card (only when Reward Club → "Show the
--                               competition card on the home page" is on)
--   • nusuk_admin_cq_people() – Nusuk Manager: everyone taking part, with their numbers
--   • saved texts: "লটারি" → "ড্র"
-- =====================================================================

-- ---------- "lottery" → "draw" in texts already saved ----------
update public.nusuk_club_contests
   set info = replace(replace(replace(info, 'লটারির', 'ড্রয়ের'), 'লটারিতে', 'ড্রয়ে'), 'লটারি', 'ড্র'),
       caption = replace(replace(replace(caption, 'লটারির', 'ড্রয়ের'), 'লটারিতে', 'ড্রয়ে'), 'লটারি', 'ড্র'),
       quiz = replace(replace(replace(quiz::text, 'লটারির', 'ড্রয়ের'), 'লটারিতে', 'ড্রয়ে'), 'লটারি', 'ড্র')::jsonb
 where info like '%লটারি%' or caption like '%লটারি%' or quiz::text like '%লটারি%';
update public.nusuk_settings
   set content = replace(replace(replace(content::text, 'লটারির', 'ড্রয়ের'), 'লটারিতে', 'ড্রয়ে'), 'লটারি', 'ড্র')::jsonb
 where id = 1 and content::text like '%লটারি%';

-- ---------- home page card ----------
create or replace function public.nusuk_cq_public_raw()
returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  c public.nusuk_club_contests;
  cfg jsonb;
  v_show boolean;
begin
  select coalesce((s.content->'club'->>'home_card')::boolean, false) into v_show from public.nusuk_settings s where s.id = 1;
  if not coalesce(v_show, false) then return jsonb_build_object('show', false); end if;
  c := public.nusuk_cq_live();
  if c.id is null then return jsonb_build_object('show', false); end if;
  cfg := public.nusuk_cq_cfg(c.quiz);
  return jsonb_build_object(
    'show', true,
    'id', c.id, 'title', c.title, 'info', c.info, 'starts_at', c.starts_at, 'ends_at', c.ends_at,
    'prizes', c.prizes, 'rules', cfg->'rules', 'slots', jsonb_array_length(cfg->'slots'),
    'rule', cfg->'rule', 'target', cfg->'target', 'totals', public.nusuk_cq_totals(c.id));
end $$;
revoke all on function public.nusuk_cq_public_raw() from public, anon, authenticated;

create or replace function public.nusuk_cq_public()
returns jsonb
language plpgsql volatile security definer set search_path = public as $$
declare v jsonb;
begin
  v := public.nusuk_cache_get('cq_public', interval '60 seconds');
  if v is null then v := public.nusuk_cache_put('cq_public', public.nusuk_cq_public_raw()); end if;
  return v;
end $$;
grant execute on function public.nusuk_cq_public() to anon, authenticated;

-- ---------- Nusuk Manager: participants ----------
create or replace function public.nusuk_admin_cq_people(p_contest int, p_search text default '', p_limit int default 50, p_offset int default 0)
returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  q text := lower(btrim(coalesce(p_search, '')));
  today date := public.nusuk_today();
begin
  if not public.is_admin() then raise exception 'not allowed'; end if;
  return jsonb_build_object(
    'total', (select count(*) from public.nusuk_cq_entries e join public.nusuk_club_members m on m.user_id = e.user_id
              where e.contest_id = p_contest
                and (q = '' or lower(m.name) like '%' || q || '%' or m.phone like '%' || q || '%' or lower(m.nusuk_code) like '%' || q || '%'
                     or lower(coalesce(m.email, '')) like '%' || q || '%' or m.sl::text = q)),
    'rows', coalesce((
      select jsonb_agg(r order by r.tickets desc, r.sl)
      from (
        select m.sl, m.name, m.phone, m.email, m.nusuk_code as code, m.district, m.created_at as joined,
               e.tickets, e.answered,
               coalesce(s.correct, 0) as correct_all, coalesce(s.refs, 0) as refs, coalesce(s.ref_keys, 0) as ref_keys,
               (select count(*) from public.nusuk_cq_attempts a where a.user_id = e.user_id and a.contest_id = p_contest and a.day = today and a.status = 'right') as today,
               (select count(*) from public.nusuk_cq_attempts a where a.user_id = e.user_id and a.contest_id = p_contest and a.status = 'left') as left_page
        from public.nusuk_cq_entries e
        join public.nusuk_club_members m on m.user_id = e.user_id
        left join public.nusuk_cq_state s on s.user_id = e.user_id
        where e.contest_id = p_contest
          and (q = '' or lower(m.name) like '%' || q || '%' or m.phone like '%' || q || '%' or lower(m.nusuk_code) like '%' || q || '%'
               or lower(coalesce(m.email, '')) like '%' || q || '%' or m.sl::text = q)
        order by e.tickets desc, m.sl
        limit greatest(1, least(p_limit, 5000)) offset greatest(0, p_offset)
      ) r), '[]'::jsonb)
  );
end $$;
grant execute on function public.nusuk_admin_cq_people(int, text, int, int) to authenticated;
