# MF Website: লাইভ করার আগের চেকলিস্ট

প্রতিটা কাজ শেষ হলে `[ ]` বদলে `[x]` লিখে রাখুন।

## ১. ইমেইল (Resend), ধাপ ৯
- [ ] resend.com-এ অ্যাকাউন্ট খুলে **API Key** তৈরি করা
- [ ] Supabase → **Edge Functions → Secrets**-এ `RESEND_API_KEY` বসানো
- [ ] Supabase → **Edge Functions → Deploy a new function → Via Editor**: নাম `notify`, [supabase/functions/notify/index.ts](supabase/functions/notify/index.ts)-এর কোড পেস্ট করা, **Verify JWT বন্ধ**, তারপর Deploy
- [ ] SQL Editor-এ [0008_emails.sql](supabase/migrations/0008_emails.sql) চালানো
- [ ] Admin → **Settings → Email**-এ নিজের ইমেইল দিয়ে **Send test email**
- [ ] (লাইভের সময়) Resend-এ `muhammadfazal.com` ডোমেইন যোগ করে cPanel-এর **Zone Editor**-এ DNS রেকর্ড বসানো, তারপর Sender email `hello@muhammadfazal.com` করা
- [ ] (লাইভের সময়) Supabase → **Authentication → Emails → SMTP Settings**-এ Resend SMTP বসানো (host `smtp.resend.com`, port 465, user `resend`, password = API key)

## ২. পেমেন্ট
- [ ] Admin → **Settings → Payments**-এ bKash আর Nagad নম্বর দেওয়া
- [ ] একটা আসল ছোট পেমেন্ট দিয়ে পুরো অর্ডারের প্রক্রিয়া একবার পরীক্ষা করা

## ৩. কনটেন্ট
- [ ] SQL Editor-এ [remove_demo_content.sql](supabase/seed/remove_demo_content.sql) চালিয়ে ডামি পোস্ট, প্রজেক্ট আর ই-বুক মুছে ফেলা
- [ ] পরীক্ষার ব্লগ পোস্ট ("tdre") মুছে ফেলা
- [ ] পরীক্ষার অর্ডার আর কাস্টমার অ্যাকাউন্ট দরকার না হলে মুছে ফেলা
- [ ] আসল Testimonials যোগ করা (তাহলে নমুনা রিভিউগুলো আর দেখাবে না)
- [ ] Admin → General-এ লোগো, ফেভিকন আর পাবলিক CV (PDF) দেওয়া
- [ ] Admin → Social links-এ Facebook, YouTube আর GitHub-এর লিংক দেওয়া
- [ ] Consultations → Availability-তে নিজের আসল সময় বসানো
- [ ] Excel Lecture-10 যোগ করা আর Excel লেসনগুলোর শিরোনাম ঠিক করা

## ৪. হোস্টিং (cPanel), ধাপ ১০
- [ ] GitHub Actions দিয়ে অটো ডিপ্লয় (FTP-এর তথ্য GitHub Secrets-এ)
- [ ] `.htaccess`: HTTPS-এ পাঠানো, পরিষ্কার URL, ক্যাশ আর সিকিউরিটি হেডার
- [ ] Supabase → Authentication → **URL Configuration**: Site URL `https://muhammadfazal.com`, Redirect URLs-এ `https://muhammadfazal.com/**`
- [ ] অ্যাডমিন থেকে কিছু Publish করলে সাইট নিজে থেকে আবার build হওয়ার ব্যবস্থা
- [ ] SSL (cPanel → SSL/TLS Status → AutoSSL)

## ৫. লাইভের পরে
- [ ] Google Search Console-এ সাইট যোগ করে `https://muhammadfazal.com/sitemap.xml` জমা দেওয়া
- [ ] Facebook/LinkedIn-এ লিংক শেয়ার করে প্রিভিউ ঠিক আসে কিনা দেখা
- [ ] মোবাইলে সাইট খুলে "Add to Home screen" দিয়ে অ্যাপের মতো ইনস্টল করে দেখা
- [ ] Supabase Pro প্ল্যান নেওয়ার কথা ভাবা (ফ্রি প্ল্যানে ৭ দিন কোনো ব্যবহার না হলে প্রজেক্ট pause হয়ে যায়)
