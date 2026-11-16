-- =====================================================================
-- Nusuk · update 49 · districts from the list only (Bangla names)
-- Run once in Supabase → SQL Editor (after update 48). Safe to run again.
--
--   • the account form now has a real drop-down (64 districts + দেশের বাইরে)
--   • names already saved in English or other spellings ("Dhaka", "Chottogram",
--     "ঢাকা জেলা" …) are turned into the Bangla name from the list
--   • from now on the database only accepts a district from the list, written in
--     any known spelling (it is saved in Bangla). Old rows that match nothing
--     (e.g. "Lebak Banten") stay as they are until that member edits the profile;
--     Nusuk Manager → Reward Club → Members shows them as they are.
-- =====================================================================

create or replace function public.nusuk_district_canon(p text)
returns text language sql immutable as $$
  with k as (
    select btrim(regexp_replace(regexp_replace(regexp_replace(normalize(lower(coalesce(p, '')), NFC),
      '(জেলা|district|sadar|সদর|zila|zilla)', '', 'g'), '[.,;:()\-_/]+', ' ', 'g'), '\s+', ' ', 'g')) as v
  )
  select m.bn from k join (values
    ('abroad', 'দেশের বাইরে'),
    ('b baria', 'ব্রাহ্মণবাড়িয়া'),
    ('bagerhat', 'বাগেরহাট'),
    ('bandarban', 'বান্দরবান'),
    ('barguna', 'বরগুনা'),
    ('barisal', 'বরিশাল'),
    ('barishal', 'বরিশাল'),
    ('bhola', 'ভোলা'),
    ('bidesh', 'দেশের বাইরে'),
    ('bogra', 'বগুড়া'),
    ('bogura', 'বগুড়া'),
    ('brahamanbaria', 'ব্রাহ্মণবাড়িয়া'),
    ('brahmanbaria', 'ব্রাহ্মণবাড়িয়া'),
    ('chandpur', 'চাঁদপুর'),
    ('chapai', 'চাঁপাইনবাবগঞ্জ'),
    ('chapai nawabganj', 'চাঁপাইনবাবগঞ্জ'),
    ('chapainawabganj', 'চাঁপাইনবাবগঞ্জ'),
    ('chatgaon', 'চট্টগ্রাম'),
    ('chattagram', 'চট্টগ্রাম'),
    ('chattogram', 'চট্টগ্রাম'),
    ('chittagong', 'চট্টগ্রাম'),
    ('chottogram', 'চট্টগ্রাম'),
    ('chuadanga', 'চুয়াডাঙ্গা'),
    ('comilla', 'কুমিল্লা'),
    ('cox bazar', 'কক্সবাজার'),
    ('cox''s bazar', 'কক্সবাজার'),
    ('coxs bazar', 'কক্সবাজার'),
    ('coxsbazar', 'কক্সবাজার'),
    ('ctg', 'চট্টগ্রাম'),
    ('cumilla', 'কুমিল্লা'),
    ('dhaka', 'ঢাকা'),
    ('dinajpur', 'দিনাজপুর'),
    ('faridpur', 'ফরিদপুর'),
    ('feni', 'ফেনী'),
    ('gaibandha', 'গাইবান্ধা'),
    ('gazipur', 'গাজীপুর'),
    ('gopalganj', 'গোপালগঞ্জ'),
    ('habiganj', 'হবিগঞ্জ'),
    ('jaipurhat', 'জয়পুরহাট'),
    ('jamalpur', 'জামালপুর'),
    ('jashore', 'যশোর'),
    ('jessore', 'যশোর'),
    ('jhalakathi', 'ঝালকাঠি'),
    ('jhalokathi', 'ঝালকাঠি'),
    ('jhalokati', 'ঝালকাঠি'),
    ('jhenaidah', 'ঝিনাইদহ'),
    ('jhenaidaha', 'ঝিনাইদহ'),
    ('joypurhat', 'জয়পুরহাট'),
    ('khagrachari', 'খাগড়াছড়ি'),
    ('khagrachhari', 'খাগড়াছড়ি'),
    ('khulna', 'খুলনা'),
    ('kishoreganj', 'কিশোরগঞ্জ'),
    ('kurigram', 'কুড়িগ্রাম'),
    ('kushtia', 'কুষ্টিয়া'),
    ('lakshmipur', 'লক্ষ্মীপুর'),
    ('lalmonirhat', 'লালমনিরহাট'),
    ('laxmipur', 'লক্ষ্মীপুর'),
    ('madaripur', 'মাদারীপুর'),
    ('magura', 'মাগুরা'),
    ('manikganj', 'মানিকগঞ্জ'),
    ('maulvibazar', 'মৌলভীবাজার'),
    ('meherpur', 'মেহেরপুর'),
    ('moulvi bazar', 'মৌলভীবাজার'),
    ('moulvibazar', 'মৌলভীবাজার'),
    ('moymonsingh', 'ময়মনসিংহ'),
    ('munshiganj', 'মুন্সিগঞ্জ'),
    ('mymensing', 'ময়মনসিংহ'),
    ('mymensingh', 'ময়মনসিংহ'),
    ('naogaon', 'নওগাঁ'),
    ('narail', 'নড়াইল'),
    ('narayanganj', 'নারায়ণগঞ্জ'),
    ('narshingdi', 'নরসিংদী'),
    ('narsingdi', 'নরসিংদী'),
    ('natore', 'নাটোর'),
    ('nawabganj', 'চাঁপাইনবাবগঞ্জ'),
    ('netrakona', 'নেত্রকোনা'),
    ('netrokona', 'নেত্রকোনা'),
    ('nilphamari', 'নীলফামারী'),
    ('noakhali', 'নোয়াখালী'),
    ('outside', 'দেশের বাইরে'),
    ('outside bangladesh', 'দেশের বাইরে'),
    ('pabna', 'পাবনা'),
    ('panchagarh', 'পঞ্চগড়'),
    ('patuakhali', 'পটুয়াখালী'),
    ('pirojpur', 'পিরোজপুর'),
    ('probash', 'দেশের বাইরে'),
    ('rajbari', 'রাজবাড়ী'),
    ('rajshahi', 'রাজশাহী'),
    ('rangamati', 'রাঙ্গামাটি'),
    ('rangpur', 'রংপুর'),
    ('satkhira', 'সাতক্ষীরা'),
    ('shariatpur', 'শরীয়তপুর'),
    ('sherpur', 'শেরপুর'),
    ('sirajganj', 'সিরাজগঞ্জ'),
    ('sunamganj', 'সুনামগঞ্জ'),
    ('sylhet', 'সিলেট'),
    ('tangail', 'টাঙ্গাইল'),
    ('thakurgaon', 'ঠাকুরগাঁও'),
    ('কক্স বাজার', 'কক্সবাজার'),
    ('কক্সবাজার', 'কক্সবাজার'),
    ('কিশোরগঞ্জ', 'কিশোরগঞ্জ'),
    ('কুড়িগ্রাম', 'কুড়িগ্রাম'),
    ('কুমিল্লা', 'কুমিল্লা'),
    ('কুষ্টিয়া', 'কুষ্টিয়া'),
    ('খাগড়াছড়ি', 'খাগড়াছড়ি'),
    ('খুলনা', 'খুলনা'),
    ('গাইবান্ধা', 'গাইবান্ধা'),
    ('গাজীপুর', 'গাজীপুর'),
    ('গোপালগঞ্জ', 'গোপালগঞ্জ'),
    ('চট্টগ্রাম', 'চট্টগ্রাম'),
    ('চট্রগ্রাম', 'চট্টগ্রাম'),
    ('চাঁদপুর', 'চাঁদপুর'),
    ('চাঁপাই', 'চাঁপাইনবাবগঞ্জ'),
    ('চাঁপাইনবাবগঞ্জ', 'চাঁপাইনবাবগঞ্জ'),
    ('চাপাইনবাবগঞ্জ', 'চাঁপাইনবাবগঞ্জ'),
    ('চুয়াডাঙ্গা', 'চুয়াডাঙ্গা'),
    ('জয়পুরহাট', 'জয়পুরহাট'),
    ('জামালপুর', 'জামালপুর'),
    ('ঝালকাঠি', 'ঝালকাঠি'),
    ('ঝালকাঠী', 'ঝালকাঠি'),
    ('ঝিনাইদহ', 'ঝিনাইদহ'),
    ('টাংগাইল', 'টাঙ্গাইল'),
    ('টাঙ্গাইল', 'টাঙ্গাইল'),
    ('ঠাকুরগাঁও', 'ঠাকুরগাঁও'),
    ('ঢাকা', 'ঢাকা'),
    ('দিনাজপুর', 'দিনাজপুর'),
    ('দেশের বাইরে', 'দেশের বাইরে'),
    ('নওগাঁ', 'নওগাঁ'),
    ('নড়াইল', 'নড়াইল'),
    ('নরসিংদি', 'নরসিংদী'),
    ('নরসিংদী', 'নরসিংদী'),
    ('নাটোর', 'নাটোর'),
    ('নারায়ণগঞ্জ', 'নারায়ণগঞ্জ'),
    ('নারায়নগঞ্জ', 'নারায়ণগঞ্জ'),
    ('নীলফামারী', 'নীলফামারী'),
    ('নেত্রকোণা', 'নেত্রকোনা'),
    ('নেত্রকোনা', 'নেত্রকোনা'),
    ('নোয়াখালী', 'নোয়াখালী'),
    ('পঞ্চগড়', 'পঞ্চগড়'),
    ('পটুয়াখালী', 'পটুয়াখালী'),
    ('পাবনা', 'পাবনা'),
    ('পিরোজপুর', 'পিরোজপুর'),
    ('প্রবাস', 'দেশের বাইরে'),
    ('প্রবাসী', 'দেশের বাইরে'),
    ('ফরিদপুর', 'ফরিদপুর'),
    ('ফেনী', 'ফেনী'),
    ('বগুড়া', 'বগুড়া'),
    ('বগুরা', 'বগুড়া'),
    ('বরগুনা', 'বরগুনা'),
    ('বরিশাল', 'বরিশাল'),
    ('বাগেরহাট', 'বাগেরহাট'),
    ('বান্দরবান', 'বান্দরবান'),
    ('বি বাড়িয়া', 'ব্রাহ্মণবাড়িয়া'),
    ('বিদেশ', 'দেশের বাইরে'),
    ('ব্রাহ্মণবাড়িয়া', 'ব্রাহ্মণবাড়িয়া'),
    ('ব্রাহ্মণবাড়ীয়া', 'ব্রাহ্মণবাড়িয়া'),
    ('ভোলা', 'ভোলা'),
    ('ময়মনসিংহ', 'ময়মনসিংহ'),
    ('মাগুরা', 'মাগুরা'),
    ('মাদারীপুর', 'মাদারীপুর'),
    ('মানিকগঞ্জ', 'মানিকগঞ্জ'),
    ('মুন্সিগঞ্জ', 'মুন্সিগঞ্জ'),
    ('মেহেরপুর', 'মেহেরপুর'),
    ('মৌলভি বাজার', 'মৌলভীবাজার'),
    ('মৌলভীবাজার', 'মৌলভীবাজার'),
    ('যশোর', 'যশোর'),
    ('যশোহর', 'যশোর'),
    ('রংপুর', 'রংপুর'),
    ('রাঙামাটি', 'রাঙ্গামাটি'),
    ('রাঙ্গামাটি', 'রাঙ্গামাটি'),
    ('রাজবাড়ী', 'রাজবাড়ী'),
    ('রাজশাহী', 'রাজশাহী'),
    ('লক্ষীপুর', 'লক্ষ্মীপুর'),
    ('লক্ষ্মীপুর', 'লক্ষ্মীপুর'),
    ('লালমনিরহাট', 'লালমনিরহাট'),
    ('শরীয়তপুর', 'শরীয়তপুর'),
    ('শেরপুর', 'শেরপুর'),
    ('সাতক্ষীরা', 'সাতক্ষীরা'),
    ('সিরাজগঞ্জ', 'সিরাজগঞ্জ'),
    ('সিলেট', 'সিলেট'),
    ('সুনামগঞ্জ', 'সুনামগঞ্জ'),
    ('হবিগঞ্জ', 'হবিগঞ্জ')
  ) as m(alias, bn) on m.alias = k.v
  limit 1
$$;

-- old rows: English / other spellings → the Bangla name
update public.nusuk_club_members m
   set district = public.nusuk_district_canon(m.district)
 where public.nusuk_district_canon(m.district) is not null
   and m.district is distinct from public.nusuk_district_canon(m.district);

-- new and edited profiles: only a district from the list
create or replace function public.nusuk_club_members_district()
returns trigger language plpgsql as $$
declare c text;
begin
  if new.district is null or btrim(new.district) = '' then return new; end if;
  c := public.nusuk_district_canon(new.district);
  if c is null then
    raise exception 'জেলা তালিকা থেকে বেছে নিন।' using errcode = '22023';
  end if;
  new.district := c;
  return new;
end $$;

drop trigger if exists nusuk_club_members_district on public.nusuk_club_members;
create trigger nusuk_club_members_district
  before insert or update of district on public.nusuk_club_members
  for each row execute function public.nusuk_club_members_district();

-- the district map is cached for 60 s: show the cleaned names right away
delete from public.nusuk_cache where k = 'district_map';
