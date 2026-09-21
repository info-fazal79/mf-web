-- ==============================================================================
-- MUHAMMAD FAZAL (BRAND: FAZAL) — SUPABASE DATABASE SCHEMA & RLS POLICIES
-- ==============================================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. PROFILES / ADMINS TABLE
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  full_name TEXT DEFAULT 'Muhammad Fazal',
  role TEXT DEFAULT 'admin',
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. BOOKS / EBOOKS TABLE
CREATE TABLE IF NOT EXISTS public.books (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  description TEXT NOT NULL,
  price NUMERIC(10, 2) DEFAULT 0.00,
  is_free BOOLEAN DEFAULT false,
  cover_url TEXT NOT NULL,
  file_url TEXT NOT NULL,
  pages INT DEFAULT 100,
  featured BOOLEAN DEFAULT false,
  downloads_count INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. ORDERS TABLE
CREATE TABLE IF NOT EXISTS public.orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_name TEXT NOT NULL,
  customer_email TEXT NOT NULL,
  book_id UUID REFERENCES public.books(id) ON DELETE SET NULL,
  amount NUMERIC(10, 2) NOT NULL,
  payment_method TEXT NOT NULL, -- 'bkash', 'nagad', 'stripe_test', 'free_download'
  trx_id TEXT,
  status TEXT DEFAULT 'pending', -- 'pending', 'approved', 'completed', 'cancelled'
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. PROJECTS TABLE
CREATE TABLE IF NOT EXISTS public.projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  image_url TEXT NOT NULL,
  live_url TEXT,
  github_url TEXT,
  tags TEXT[] DEFAULT '{}',
  featured BOOLEAN DEFAULT true,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. TUTORIALS TABLE
CREATE TABLE IF NOT EXISTS public.tutorials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  youtube_url TEXT NOT NULL,
  video_id TEXT NOT NULL,
  playlist_id TEXT,
  category TEXT NOT NULL, -- 'MS Office', 'WordPress', 'Data Analysis', 'Automation'
  duration TEXT,
  views_count INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5.1 PLAYLISTS TABLE
CREATE TABLE IF NOT EXISTS public.playlists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  description TEXT,
  category TEXT NOT NULL, -- e.g., 'MS Office', 'WordPress', 'Automation', 'Data Analysis'
  thumbnail_url TEXT,
  youtube_playlist_url TEXT,
  video_count INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5.2 PLAYLIST VIDEOS TABLE
CREATE TABLE IF NOT EXISTS public.playlist_videos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  playlist_id UUID REFERENCES public.playlists(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  youtube_url TEXT NOT NULL,
  youtube_video_id TEXT NOT NULL,
  duration TEXT,
  order_index INT DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. BLOG POSTS TABLE
CREATE TABLE IF NOT EXISTS public.posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  content TEXT NOT NULL,
  summary TEXT,
  category TEXT NOT NULL,
  tags TEXT[] DEFAULT '{}',
  featured_image TEXT NOT NULL,
  published BOOLEAN DEFAULT true,
  read_time TEXT DEFAULT '5 min read',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. COMMENTS TABLE
CREATE TABLE IF NOT EXISTS public.comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID REFERENCES public.posts(id) ON DELETE CASCADE,
  author_name TEXT NOT NULL,
  author_email TEXT NOT NULL,
  comment_text TEXT NOT NULL,
  is_approved BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8. CONSULTATIONS / LEADS TABLE
CREATE TABLE IF NOT EXISTS public.consultations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  service TEXT NOT NULL, -- 'WordPress Development', 'Data Analysis', 'MS Office Corporate Training', 'Workflow Automation'
  message TEXT NOT NULL,
  status TEXT DEFAULT 'new', -- 'new', 'contacted', 'completed', 'archived'
  admin_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 9. SITE SETTINGS TABLE
CREATE TABLE IF NOT EXISTS public.site_settings (
  id INT PRIMARY KEY DEFAULT 1,
  site_url TEXT DEFAULT 'https://muhammadfazal.com',
  logo_type TEXT DEFAULT 'text', -- 'text' or 'image'
  logo_text TEXT DEFAULT 'FAZAL',
  logo_image_url TEXT,
  logo_width INT DEFAULT 120,
  hero_title TEXT DEFAULT 'Hi, I''m Muhammad Fazal',
  hero_bio TEXT DEFAULT 'I specialize in creating dynamic, user-friendly websites that help brands establish a strong online presence. Beyond development, I am passionate about empowering others through expert-led MS Office training, simplifying complex tools for everyday efficiency. Additionally, I leverage my data analysis skills to transform raw information into meaningful insights, driving data-informed decisions for growth and success.',
  cv_url TEXT DEFAULT 'https://example.com/muhammad-fazal-cv.pdf',
  social_links JSONB DEFAULT '{
    "facebook": "https://facebook.com",
    "linkedin": "https://linkedin.com",
    "youtube": "https://youtube.com",
    "github": "https://github.com"
  }'::jsonb,
  contact_email TEXT DEFAULT 'contact@muhammadfazal.com',
  is_maintenance_mode BOOLEAN DEFAULT FALSE,
  maintenance_title TEXT DEFAULT 'Upgrading System & Infrastructure',
  maintenance_message TEXT DEFAULT 'We are currently deploying new features and performance enhancements. We will be back online shortly.',
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT single_settings_row CHECK (id = 1)
);

-- Migration statement if table already exists:
ALTER TABLE public.site_settings 
ADD COLUMN IF NOT EXISTS is_maintenance_mode BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS maintenance_title TEXT DEFAULT 'Upgrading System & Infrastructure',
ADD COLUMN IF NOT EXISTS maintenance_message TEXT DEFAULT 'We are currently deploying new features and performance enhancements. We will be back online shortly.';

-- ==============================================================================
-- STORAGE BUCKETS SETUP
-- ==============================================================================
INSERT INTO storage.buckets (id, name, public) 
VALUES 
  ('media', 'media', true),
  ('logos', 'logos', true),
  ('ebooks', 'ebooks', true),
  ('covers', 'covers', true),
  ('projects', 'projects', true),
  ('blogs', 'blogs', true),
  ('tutorials', 'tutorials', true),
  ('resumes', 'resumes', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Storage Policies for Direct Admin WebP Uploads
DROP POLICY IF EXISTS "Public Storage Read" ON storage.objects;
CREATE POLICY "Public Storage Read" 
  ON storage.objects FOR SELECT 
  USING (bucket_id IN ('media', 'logos', 'ebooks', 'covers', 'projects', 'blogs', 'tutorials', 'resumes'));

DROP POLICY IF EXISTS "Public Storage Insert" ON storage.objects;
CREATE POLICY "Public Storage Insert" 
  ON storage.objects FOR INSERT 
  WITH CHECK (bucket_id IN ('media', 'logos', 'ebooks', 'covers', 'projects', 'blogs', 'tutorials', 'resumes'));

DROP POLICY IF EXISTS "Public Storage Update" ON storage.objects;
CREATE POLICY "Public Storage Update" 
  ON storage.objects FOR UPDATE 
  USING (bucket_id IN ('media', 'logos', 'ebooks', 'covers', 'projects', 'blogs', 'tutorials', 'resumes'));

DROP POLICY IF EXISTS "Public Storage Delete" ON storage.objects;
CREATE POLICY "Public Storage Delete" 
  ON storage.objects FOR DELETE 
  USING (bucket_id IN ('media', 'logos', 'ebooks', 'covers', 'projects', 'blogs', 'tutorials', 'resumes'));

-- ==============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ==============================================================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.books ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tutorials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.playlists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.playlist_videos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.consultations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.site_settings ENABLE ROW LEVEL SECURITY;

-- 1. Profiles Policies
CREATE POLICY "Public profiles are viewable by everyone" 
  ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Users can update own profile" 
  ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- 2. Books Policies (Public can view, Authenticated can manage)
DROP POLICY IF EXISTS "Allow public read books" ON public.books;
CREATE POLICY "Allow public read books" 
  ON public.books FOR SELECT USING (true);
CREATE POLICY "Allow admin manage books" 
  ON public.books FOR ALL TO authenticated USING (true);

-- 3. Orders Policies (Anyone can create orders, Admin can view/update)
CREATE POLICY "Allow public insert order" 
  ON public.orders FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow admin manage orders" 
  ON public.orders FOR ALL TO authenticated USING (true);

-- 4. Projects Policies (Public can view, Admin can manage)
DROP POLICY IF EXISTS "Allow public read projects" ON public.projects;
CREATE POLICY "Allow public read projects" 
  ON public.projects FOR SELECT USING (true);
CREATE POLICY "Allow admin manage projects" 
  ON public.projects FOR ALL TO authenticated USING (true);

-- 5. Tutorials Policies (Public can view, Admin can manage)
CREATE POLICY "Allow public read tutorials" 
  ON public.tutorials FOR SELECT USING (true);
CREATE POLICY "Allow admin manage tutorials" 
  ON public.tutorials FOR ALL TO authenticated USING (true);

-- 5.1 Playlists Policies (Public can view, Admin can manage)
DROP POLICY IF EXISTS "Allow public read playlists" ON public.playlists;
CREATE POLICY "Allow public read playlists" 
  ON public.playlists FOR SELECT USING (true);
CREATE POLICY "Allow admin manage playlists" 
  ON public.playlists FOR ALL TO authenticated USING (true);

-- 5.2 Playlist Videos Policies (Public can view, Admin can manage)
DROP POLICY IF EXISTS "Allow public read playlist_videos" ON public.playlist_videos;
CREATE POLICY "Allow public read playlist_videos" 
  ON public.playlist_videos FOR SELECT USING (true);
CREATE POLICY "Allow admin manage playlist_videos" 
  ON public.playlist_videos FOR ALL TO authenticated USING (true);

-- 6. Posts Policies (Public can view, Admin can manage all)
DROP POLICY IF EXISTS "Allow public read published posts" ON public.posts;
DROP POLICY IF EXISTS "Allow public read posts" ON public.posts;
CREATE POLICY "Allow public read posts" 
  ON public.posts FOR SELECT USING (true);
CREATE POLICY "Allow admin manage all posts" 
  ON public.posts FOR ALL TO authenticated USING (true);

-- 7. Comments Policies (Public can read approved, Public can insert, Admin can manage all)
CREATE POLICY "Allow public read approved comments" 
  ON public.comments FOR SELECT USING (is_approved = true);
CREATE POLICY "Allow public submit comment" 
  ON public.comments FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow admin manage all comments" 
  ON public.comments FOR ALL TO authenticated USING (true);

-- 8. Consultations Policies (Public can submit leads, Admin can view/update)
CREATE POLICY "Allow public submit consultation" 
  ON public.consultations FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow admin manage consultations" 
  ON public.consultations FOR ALL TO authenticated USING (true);

-- 9. Site Settings Policies (Public can read, Admin can update)
DROP POLICY IF EXISTS "Allow public read site settings" ON public.site_settings;
DROP POLICY IF EXISTS "Allow public read site_settings" ON public.site_settings;
CREATE POLICY "Allow public read site_settings" 
  ON public.site_settings FOR SELECT USING (true);
CREATE POLICY "Allow admin update site settings" 
  ON public.site_settings FOR ALL TO authenticated USING (true);

-- Storage bucket access policies
CREATE POLICY "Allow public view storage objects" 
  ON storage.objects FOR SELECT USING (bucket_id IN ('ebooks', 'covers', 'projects', 'blogs', 'resumes'));
CREATE POLICY "Allow admin upload storage objects" 
  ON storage.objects FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Allow admin update storage objects" 
  ON storage.objects FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Allow admin delete storage objects" 
  ON storage.objects FOR DELETE TO authenticated USING (true);

-- ==============================================================================
-- INITIAL SEED DATA
-- ==============================================================================

-- Site Settings
INSERT INTO public.site_settings (id, logo_type, logo_text, logo_width, cv_url)
VALUES (1, 'text', 'FAZAL', 120, 'https://raw.githubusercontent.com/FazalDev/assets/main/Muhammad_Fazal_Resume.pdf')
ON CONFLICT (id) DO NOTHING;

-- Projects
INSERT INTO public.projects (title, description, image_url, live_url, github_url, tags, featured, sort_order) VALUES
(
  'Ultra-Modern Corporate Agency Portal',
  'Full-stack WordPress headless CMS architecture paired with dynamic animations, custom Gutenberg blocks, and 99+ Google PageSpeed rating.',
  'https://images.unsplash.com/photo-1460925895917-afdab827c52f?q=80&w=1200&auto=format&fit=crop',
  'https://example.com/project-agency',
  'https://github.com/example/agency-wp',
  ARRAY['WordPress', 'Custom Gutenberg', 'TailwindCSS', 'PHP', 'PageSpeed 99'],
  true,
  1
),
(
  'Enterprise Financial Insights & Automated Reporting',
  'Automated end-to-end data pipelines combining Google Sheets, BigQuery, and Google Apps Script to auto-generate weekly financial executive decks.',
  'https://images.unsplash.com/photo-1551288049-bebda4e38f71?q=80&w=1200&auto=format&fit=crop',
  'https://example.com/finance-dash',
  'https://github.com/example/financial-automation',
  ARRAY['Data Analysis', 'Google Sheets', 'Google Apps Script', 'Financial Modeling'],
  true,
  2
),
(
  'E-Commerce Global Storefront (WooCommerce)',
  'Multi-currency, high-converting WooCommerce platform customized for global clients with automated checkout flows and payment gateways.',
  'https://images.unsplash.com/photo-1557821552-17105176677c?q=80&w=1200&auto=format&fit=crop',
  'https://example.com/global-store',
  'https://github.com/example/woocommerce-elite',
  ARRAY['WordPress', 'WooCommerce', 'Stripe', 'Elementor Pro', 'Optimization'],
  true,
  3
),
(
  'Automated Client Onboarding & CRM Sync Engine',
  'Custom cloud automation utilizing Google Apps Script, Google Drive API, and webhooks to orchestrate client onboarding and contract generation.',
  'https://images.unsplash.com/photo-1507238691740-187a5b1d37b8?q=80&w=1200&auto=format&fit=crop',
  'https://example.com/onboarding-crm',
  'https://github.com/example/apps-script-crm',
  ARRAY['Google Scripts', 'Google Drive', 'Automation', 'REST APIs'],
  true,
  4
);

-- eBooks
INSERT INTO public.books (title, slug, description, price, is_free, cover_url, file_url, pages, featured) VALUES
(
  'Mastering Workplace Productivity with MS Office 365',
  'mastering-workplace-productivity-ms-office',
  'The definitive, practical guide to Excel advanced formulas, dynamic dashboards, PowerPoint executive storytelling, and Word document automation.',
  0.00,
  true,
  'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?q=80&w=600&auto=format&fit=crop',
  'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf',
  140,
  true
),
(
  'The High-Performance WordPress Blueprint',
  'high-performance-wordpress-blueprint',
  'Deep dive into building sub-second WordPress websites, custom theme development, database indexing, caching strategies, and security hardening.',
  19.99,
  false,
  'https://images.unsplash.com/photo-1532012164546-f432f2e3777a?q=80&w=600&auto=format&fit=crop',
  'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf',
  210,
  true
),
(
  'Data Analytics & Automated Reporting with Google Sheets & Scripts',
  'data-analytics-google-sheets-scripts',
  'Learn how to turn Google Sheets into an automated business intelligence machine with custom formulas, Apps Script macros, and scheduled alerts.',
  29.99,
  false,
  'https://images.unsplash.com/photo-1512820790803-83ca734da794?q=80&w=600&auto=format&fit=crop',
  'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf',
  185,
  true
);

-- Tutorials
INSERT INTO public.tutorials (title, youtube_url, video_id, category, duration, views_count) VALUES
(
  'Advanced Excel Formulas: XLOOKUP, INDEX-MATCH & Nested Dynamic Arrays',
  'https://www.youtube.com/watch?v=0kPspP8z908',
  '0kPspP8z908',
  'MS Office',
  '24:15',
  18400
),
(
  'Building a Blazing-Fast WordPress Site from Scratch (Complete 2025 Guide)',
  'https://www.youtube.com/watch?v=8AZ8GqW5iak',
  '8AZ8GqW5iak',
  'WordPress',
  '42:10',
  26200
),
(
  'Automate Google Sheets with Apps Script: Auto-Email Reports & PDF Invoices',
  'https://www.youtube.com/watch?v=k_OkA4hYv2w',
  'k_OkA4hYv2w',
  'Automation',
  '31:05',
  14900
),
(
  'Data Cleaning & Transformation Crash Course for Beginners',
  'https://www.youtube.com/watch?v=r-uOLxNrNk8',
  'r-uOLxNrNk8',
  'Data Analysis',
  '18:40',
  12800
);

-- Playlists Seed Data
INSERT INTO public.playlists (id, title, slug, description, category, thumbnail_url, youtube_playlist_url, video_count) VALUES
(
  'c0000000-0000-0000-0000-000000000001',
  'Complete MS Office 365 & Excel Mastery Course',
  'complete-ms-office-excel-mastery',
  'Master high-impact Excel formulas, dynamic arrays, executive dashboard modeling, and Word document automation from corporate trainer Muhammad Fazal.',
  'MS Office',
  'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?q=80&w=800&auto=format&fit=crop',
  'https://www.youtube.com/playlist?list=PLexample_msoffice',
  3
),
(
  'c0000000-0000-0000-0000-000000000002',
  'Full-Stack WordPress & Custom Gutenberg Architecture',
  'full-stack-wordpress-gutenberg-architecture',
  'End-to-end masterclass on building lightning-fast WordPress websites, sub-second PageSpeed benchmarks, headless patterns, and custom block development.',
  'WordPress',
  'https://images.unsplash.com/photo-1507238691740-187a5b1d37b8?q=80&w=800&auto=format&fit=crop',
  'https://www.youtube.com/playlist?list=PLexample_wordpress',
  3
),
(
  'c0000000-0000-0000-0000-000000000003',
  'Google Apps Script & Cloud Automation Engine',
  'google-apps-script-cloud-automation',
  'Automate enterprise workflows with Google Apps Script: sync Gmail, Google Sheets, Drive, REST APIs, and automated PDF invoice generation.',
  'Automation',
  'https://images.unsplash.com/photo-1551288049-bebda4e38f71?q=80&w=800&auto=format&fit=crop',
  'https://www.youtube.com/playlist?list=PLexample_automation',
  3
),
(
  'c0000000-0000-0000-0000-000000000004',
  'Business Intelligence & Data Analysis Blueprint',
  'business-intelligence-data-analysis-blueprint',
  'Transform messy data into actionable executive insights: data cleaning, query modeling, KPI tracking, and automated reporting systems.',
  'Data Analysis',
  'https://images.unsplash.com/photo-1460925895917-afdab827c52f?q=80&w=800&auto=format&fit=crop',
  'https://www.youtube.com/playlist?list=PLexample_dataanalysis',
  2
)
ON CONFLICT (id) DO NOTHING;

-- Playlist Videos Seed Data
INSERT INTO public.playlist_videos (playlist_id, title, youtube_url, youtube_video_id, duration, order_index) VALUES
-- MS Office Playlist Videos
('c0000000-0000-0000-0000-000000000001', 'Lesson 1: Advanced Excel Formulas (XLOOKUP & Dynamic Arrays)', 'https://www.youtube.com/watch?v=0kPspP8z908', '0kPspP8z908', '24:15', 1),
('c0000000-0000-0000-0000-000000000001', 'Lesson 2: Interactive Executive KPI Dashboards in Excel', 'https://www.youtube.com/watch?v=r-uOLxNrNk8', 'r-uOLxNrNk8', '35:20', 2),
('c0000000-0000-0000-0000-000000000001', 'Lesson 3: Automating Reports with Power Query & Pivot Tables', 'https://www.youtube.com/watch?v=k_OkA4hYv2w', 'k_OkA4hYv2w', '28:40', 3),

-- WordPress Playlist Videos
('c0000000-0000-0000-0000-000000000002', 'Lesson 1: Building a Blazing-Fast WordPress Site (Complete Setup)', 'https://www.youtube.com/watch?v=8AZ8GqW5iak', '8AZ8GqW5iak', '42:10', 1),
('c0000000-0000-0000-0000-000000000002', 'Lesson 2: Developing Custom Gutenberg Block Patterns with Tailwind', 'https://www.youtube.com/watch?v=0kPspP8z908', '0kPspP8z908', '38:50', 2),
('c0000000-0000-0000-0000-000000000002', 'Lesson 3: Achieving 99+ Google PageSpeed and Core Web Vitals', 'https://www.youtube.com/watch?v=r-uOLxNrNk8', 'r-uOLxNrNk8', '29:15', 3),

-- Automation Playlist Videos
('c0000000-0000-0000-0000-000000000003', 'Lesson 1: Automate Google Sheets with Apps Script (Email Invoices)', 'https://www.youtube.com/watch?v=k_OkA4hYv2w', 'k_OkA4hYv2w', '31:05', 1),
('c0000000-0000-0000-0000-000000000003', 'Lesson 2: Connecting External REST APIs to Google Sheets', 'https://www.youtube.com/watch?v=8AZ8GqW5iak', '8AZ8GqW5iak', '26:40', 2),
('c0000000-0000-0000-0000-000000000003', 'Lesson 3: Scheduled Cron Triggers and Automatic PDF Generation', 'https://www.youtube.com/watch?v=0kPspP8z908', '0kPspP8z908', '33:10', 3),

-- Data Analysis Playlist Videos
('c0000000-0000-0000-0000-000000000004', 'Lesson 1: Data Cleaning & Transformation Crash Course', 'https://www.youtube.com/watch?v=r-uOLxNrNk8', 'r-uOLxNrNk8', '18:40', 1),
('c0000000-0000-0000-0000-000000000004', 'Lesson 2: Designing Modern Business Intelligence Decks', 'https://www.youtube.com/watch?v=k_OkA4hYv2w', 'k_OkA4hYv2w', '25:30', 2)
ON CONFLICT DO NOTHING;

-- Blog Posts
INSERT INTO public.posts (title, slug, content, summary, category, tags, featured_image, published, read_time) VALUES
(
  'How I Built a 99/100 PageSpeed WordPress Website for Global Enterprise Clients',
  'how-i-built-99-pagespeed-wordpress-website',
  '### The WordPress Performance Paradox

Many developers believe WordPress is inherently sluggish. However, with the right architecture, headless principles, aggressive asset deferral, and query optimization, you can easily achieve 99+ mobile and desktop scores on Google PageSpeed Insights.

#### 1. Zero Bloat Philosophy
Eliminate all-in-one plugin suites that inject CSS and JS across every single page. Instead, rely on modular block patterns or lightweight custom Gutenberg blocks.

#### 2. Next-Gen Image Formats & Dynamic Caching
Serve AVIF/WebP assets and implement Redis object caching alongside Cloudflare edge page caching.

#### 3. Database Indexing
Regularly clean up post revisions, optimize the `wp_options` autoloaded payload, and index custom table queries.',
  'A deep dive into how architectural choices, asset pruning, and custom Gutenberg blocks helped achieve sub-second load times on WordPress.',
  'WordPress',
  ARRAY['WordPress', 'Web Performance', 'PageSpeed', 'Gutenberg'],
  'https://images.unsplash.com/photo-1507238691740-187a5b1d37b8?q=80&w=1200&auto=format&fit=crop',
  true,
  '6 min read'
),
(
  'Automating Office Tasks: From Zero to Hero with Google Apps Script',
  'automating-office-tasks-google-apps-script',
  '### Why Manual Data Entry is Dead

In corporate environments, hundreds of hours are wasted every month copying data from email attachments into spreadsheets and re-formatting PDF reports.

#### The Magic of Apps Script
With less than 50 lines of Google Apps Script, you can:
- Automatically poll Gmail for vendor invoices
- Extract structured tables into Google Sheets
- Trigger Slack/WhatsApp notifications
- Dispatch approved PDF receipts automatically

Empower your team with automation and focus your energy on strategic decision making.',
  'Learn how automating mundane data workflows with Google Apps Script saves hundreds of hours and eliminates human error.',
  'Automation',
  ARRAY['Google Apps Script', 'Google Sheets', 'Workflow Automation'],
  'https://images.unsplash.com/photo-1551288049-bebda4e38f71?q=80&w=1200&auto=format&fit=crop',
  true,
  '5 min read'
);

-- Sample Approved Comment
INSERT INTO public.comments (post_id, author_name, author_email, comment_text, is_approved)
SELECT id, 'Sarah Jenkins', 'sarah.j@agency.co.uk', 'Brilliant breakdown Fazal! The tips on pruning wp_options autoload slashed our database queries in half.', true
FROM public.posts
WHERE slug = 'how-i-built-99-pagespeed-wordpress-website'
LIMIT 1;

-- Sample Consultations
INSERT INTO public.consultations (name, email, service, message, status) VALUES
('David Miller', 'david.miller@techfirm.com', 'WordPress Development', 'We need a complete redesign of our SaaS marketing website with fast page speeds.', 'new'),
('Ayesha Rahman', 'ayesha.r@fintech.bd', 'Data Analysis', 'Looking for an automated financial reporting system in Google Sheets and dashboard.', 'contacted');
