-- =====================================================================
-- Nusuk · add Bangladeshi winners (from Nusuk app screenshots, 7 Nov 2026)
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
            {"name": "MD KHALED HUSSAIN CHOWDHURY", "prize": "umrah",  "date": "2026-11-03"},
            {"name": "محمد أ*** ح***",               "prize": "zamzam", "date": "2026-11-03"},
            {"name": "MD O*** F**** ف**ع**** N****", "prize": "zamzam", "date": "2026-11-03"},
            {"name": "أفنان ن** ع***",               "prize": "zamzam", "date": "2026-11-04"},
            {"name": "RAHIMA BEGUM",                 "prize": "umrah",  "date": "2026-11-06"}
          ]$json$::jsonb
        ) as w
      )
    ),
    updated_at = now()
where id = 1;

-- Check the result
select jsonb_array_length(content -> 'winners') as winners from public.nusuk_settings where id = 1;
