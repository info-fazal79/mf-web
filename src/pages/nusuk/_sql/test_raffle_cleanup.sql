-- =====================================================================
-- Nusuk · remove the Raffle TEST data (from test_raffle.sql)
-- Deletes the "🧪 TEST giveaway" with all its entries and drawn winners,
-- and any NG-TEST… code that "Give Keys" may have added to the code list.
-- Real giveaways and codes are not touched.
-- =====================================================================
delete from public.nusuk_giveaways where title = '🧪 TEST giveaway';
delete from public.nusuk_codes where code ~ '^NG-TEST[0-9]{4}$';

select
  (select count(*) from public.nusuk_giveaways where title = '🧪 TEST giveaway') as test_giveaways_left,
  (select count(*) from public.nusuk_codes where code ~ '^NG-TEST[0-9]{4}$') as test_codes_left;
