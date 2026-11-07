# Nusuk কোড শেয়ার মডিউল

এই ফিচারের সবকিছু এই একটা ফোল্ডারেই (`src/pages/nusuk/`)। মূল সাইটের অন্য কোনো ফাইল এর উপর নির্ভর করে না।

| পাথ | কী |
|---|---|
| `/nusuk` | পাবলিক পেজ ([index.astro](index.astro)) |
| `/nusuk/admin` | আলাদা অ্যাডমিন, Nusuk Manager ([admin.astro](admin.astro), [_admin/NusukAdmin.tsx](_admin/NusukAdmin.tsx)) |
| `_lib/` | পেজের লেখা (ডিফল্ট), স্টাইল, Supabase RPC |
| `_sql/install.sql` | ডেটাবেজ সেটআপ + ২০টা নমুনা কোড |
| `_sql/uninstall.sql` | ডেটাবেজ থেকে সব মুছে ফেলা |

`_` দিয়ে শুরু ফাইল/ফোল্ডার Astro পেজ হিসেবে বানায় না।

## চালু করা
1. Supabase → SQL Editor → `_sql/install.sql` পেস্ট করে Run।
2. `/nusuk/admin`-এ মূল সাইটের অ্যাডমিন ইমেইল/পাসওয়ার্ড দিয়ে লগইন।

## সাময়িক বন্ধ
Nusuk Manager → Settings → "Nusuk page is ON" বন্ধ করুন।

## পুরোপুরি মুছে ফেলা
1. Supabase-এ `_sql/uninstall.sql` চালান।
2. `src/pages/nusuk/` ফোল্ডার ডিলিট করে push করুন।
