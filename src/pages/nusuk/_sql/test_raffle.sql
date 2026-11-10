-- =====================================================================
-- Nusuk · TEST data for the Raffle draw (safe: visitors never see it)
-- Run in Supabase → SQL Editor. It creates ONE hidden giveaway called
-- "🧪 TEST giveaway" with 24 fake entries (codes NG-TEST0001 … NG-TEST0024)
-- and three prizes, so you can try the wheel in Nusuk Manager → Raffle draw.
--
--   • It is hidden (is_on = false), so it never appears in the top bar.
--   • The fake codes are NOT added to the code list.
--   • ⚠️ Do NOT press "Give Keys" for these test winners: that would add the
--     fake code to the real list. (If you do, the cleanup below removes it.)
--
-- When you're done, run test_raffle_cleanup.sql to delete everything.
-- =====================================================================
do $$
declare g bigint;
begin
  -- Start fresh if a test giveaway already exists
  delete from public.nusuk_giveaways where title = '🧪 TEST giveaway';

  insert into public.nusuk_giveaways (title, prize, details, is_on, starts_at, ends_at, need_page, need_group, need_share, prizes)
  values ('🧪 TEST giveaway', '৫০টি Key', 'শুধু পরীক্ষার জন্য। ভিজিটররা এটা দেখতে পায় না।', false,
          now() - interval '2 hours', now() - interval '1 hour', true, true, false,
          '[{"place":1,"prize":"১০০টি Key","keys":100},{"place":2,"prize":"৫০টি Key","keys":50},{"place":3,"prize":"একটি বই","keys":null}]'::jsonb)
  returning id into g;

  insert into public.nusuk_giveaway_entries (giveaway_id, code, fb_name, did_page, did_group, status)
  select g,
         'NG-TEST' || lpad(i::text, 4, '0'),
         (array['Rahim Uddin','Karim Mia','Salma Begum','Abdullah Al Mamun','Fatema Khatun','Hasan Ali',
                'Nusrat Jahan','Tanvir Ahmed','Ayesha Siddika','Mizanur Rahman','Sumaiya Akter','Rafiq Islam'])[1 + (i - 1) % 12]
           || ' ' || i,
         true, true,
         case when i in (7, 19) then 'invalid' else 'ok' end   -- two marked invalid: they must NOT be on the wheel
  from generate_series(1, 24) as i;

  raise notice 'Test giveaway id: % (22 valid entries on the wheel, 2 invalid)', g;
end $$;

select id, title, (select count(*) from public.nusuk_giveaway_entries e where e.giveaway_id = g.id and e.status = 'ok') as on_wheel
from public.nusuk_giveaways g where title = '🧪 TEST giveaway';
