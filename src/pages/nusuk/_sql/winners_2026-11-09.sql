-- =====================================================================
-- Nusuk · add Bangladeshi winners of 9 Nov 2026 (20 cartons of Zamzam water)
-- Run once in Supabase → SQL Editor. Safe to run again: winners already in
-- the list are not added twice. Edit or remove them later in
-- Nusuk Manager → Winners.
-- Names are copied as the Nusuk app shows them (partly hidden with ***).
-- =====================================================================
update public.nusuk_settings
set content = jsonb_set(
      coalesce(content, '{}'::jsonb),
      '{winners}',
      (
        select coalesce(jsonb_agg(distinct w), '[]'::jsonb)
        from jsonb_array_elements(
          coalesce(content -> 'winners', '[]'::jsonb) || $json$[
            {"name": "I ****I **** م****د****", "prize": "zamzam", "date": "2026-11-09"},
            {"name": "MD I**** ح*** H****",     "prize": "zamzam", "date": "2026-11-09"},
            {"name": "I ***ম مد*",              "prize": "zamzam", "date": "2026-11-09"}
          ]$json$::jsonb
        ) as w
      )
    ),
    updated_at = now()
where id = 1;

-- Check the result
select jsonb_array_length(content -> 'winners') as winners from public.nusuk_settings where id = 1;
