# Muhammad Fazal (FAZAL) — Developer Portfolio & Digital Store

[![Vite](https://img.shields.io/badge/Vite-6.x-646CFF?logo=vite&logoColor=white)](https://vitejs.dev/)
[![React](https://img.shields.io/badge/React-18.x-61DAFB?logo=react&logoColor=black)](https://react.dev/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-3.x-38B2AC?logo=tailwind-css&logoColor=white)](https://tailwindcss.com/)
[![Supabase](https://img.shields.io/badge/Supabase-BaaS-3ECF8E?logo=supabase&logoColor=white)](https://supabase.com/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)

An elite, blazing-fast personal portfolio, eCommerce digital store for eBooks, YouTube video masterclasses integration, and comprehensive authenticated Admin Panel (`/admin`) for **Muhammad Fazal (Brand: FAZAL)**.

---

## 🎨 Highlights & Key Features

- **Cyber Neon Developer Aesthetic:** Custom dark theme (`#0D0F12`, `#161920`, `#1F242D`) with Cyber Neon Green (`#00E599` / `#00FF87`), frosted glassmorphism, and ambient glows.
- **Lenis Smooth Scrolling:** Ultra-smooth scrolling experience on desktop and mobile.
- **Dynamic Hero Typist:** Cycles through roles: *"Data Analyst"*, *"WordPress Developer"*, *"Lead Instructor of MS Office"*.
- **eBook Digital Store & Cart Drawer:** 
  - Slide-over cart with live quantity controls and subtotal calculation.
  - Checkout supporting **bKash**, **Nagad** TrxID verification, and **Stripe Test** mode.
  - Instant digital download delivery with confetti celebration modal.
- **Projects Showcase with Long-Screenshot Scroll:** Full webpage preview screenshots that smoothly scroll down vertically on hover.
- **Lead Capture Consultation Drawer:** Right-side slide-over lead capture form recording incoming client inquiries directly to Supabase.
- **YouTube Tutorials Hub:** Category-filtered video masterclasses with responsive 16:9 player modal.
- **Tech & Productivity Blog:** Articles with formatted Markdown rendering and dynamic visitor comment submission with admin moderation.
- **Secure Admin Dashboard (`/admin`):**
  - **Overview:** Real-time revenue metrics, active products, articles, projects, and leads.
  - **eBook & Store Manager:** CRUD for eBooks (Title, Price, Free/Paid toggle, Cover image, and PDF download URL).
  - **Project Manager:** Add/edit/delete showcase items, live demo & repo links, tags, and long-screenshot preview URLs.
  - **Blog Manager:** Draft/publish articles with Markdown support and read times.
  - **Tutorials Manager:** YouTube URL video ID parser and playlist category manager.
  - **Consultation Inbox:** Manage prospective client inquiries with status flags (`New`, `Contacted`, `Completed`) and private internal notes.
  - **Comment Moderation:** One-click comment approval/revocation system.
  - **Brand & Site Settings:** Toggle custom text vs uploaded SVG/PNG logo, adjust width slider, update CV link, and configure social profiles.

---

## 🏗️ Tech Stack

- **Frontend:** React 18, TypeScript, Vite, Tailwind CSS, Lucide Icons, Canvas Confetti, Lenis
- **State Management:** Zustand (with LocalStorage persistence)
- **Backend & Database:** Supabase (PostgreSQL, Row Level Security policies, Supabase Storage, Supabase Auth)
- **Routing:** React Router v6

---

## 🚀 Quick Start

### 1. Clone & Install Dependencies
```bash
git clone https://github.com/info-fazal79/mf-web.git
cd mf-web
npm install
```

### 2. Environment Variables
Create a `.env` file at the root:
```env
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```
*(Note: If no Supabase credentials are provided, the application automatically runs in rich Offline / Demo Mode with pre-populated seed data!)*

### 3. Run Development Server
```bash
npm run dev
```
Open [http://localhost:5173](http://localhost:5173) in your browser.

### 4. Build for Production
```bash
npm run build
npm run preview
```

---

## 🗄️ Database Setup (Supabase)

To link with Supabase:
1. Open your Supabase Dashboard &rarr; **SQL Editor**.
2. Run the migration script located in [`supabase/schema.sql`](supabase/schema.sql).
3. This creates all 9 tables (`profiles`, `books`, `orders`, `projects`, `tutorials`, `posts`, `comments`, `consultations`, `site_settings`), configures Storage buckets (`ebooks`, `covers`, `projects`, `blogs`, `resumes`), and sets up Row Level Security (RLS) policies.

---

## 🛡️ Admin Access (`/admin`)

- Navigate to `/admin` or `/admin/login`.
- For instant testing in demo mode, click the **"1-Click Demo Access"** button, or sign in with Supabase Auth credentials.

---

## 👤 Author

**Muhammad Fazal**
- Fiverr: [Level 1 Seller](https://fiverr.com)
- Lead Instructor: As-Sunnah Skill Development Institute
- Email: [contact@muhammadfazal.com](mailto:contact@muhammadfazal.com)
