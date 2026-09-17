import { Book, BlogPost, Project, SiteSettings, Tutorial, Comment, Consultation, Order, Playlist, PlaylistVideo } from '../types';

export const INITIAL_SITE_SETTINGS: SiteSettings = {
  id: 1,
  logo_type: 'text',
  logo_text: 'FAZAL',
  logo_width: 130,
  hero_title: "Hi, I'm Muhammad Fazal",
  hero_bio: "I specialize in creating dynamic, user-friendly websites that help brands establish a strong online presence. Beyond development, I am passionate about empowering others through expert-led MS Office training, simplifying complex tools for everyday efficiency. Additionally, I leverage my data analysis skills to transform raw information into meaningful insights, driving data-informed decisions for growth and success.",
  cv_url: 'https://raw.githubusercontent.com/FazalDev/assets/main/Muhammad_Fazal_Resume.pdf',
  contact_email: 'contact@muhammadfazal.com',
  social_links: {
    facebook: 'https://facebook.com',
    linkedin: 'https://linkedin.com/in',
    youtube: 'https://youtube.com',
    github: 'https://github.com',
    fiverr: 'https://fiverr.com',
  },
};

export const INITIAL_BOOKS: Book[] = [
  {
    id: 'book-1',
    title: 'Mastering Workplace Productivity with MS Office 365',
    slug: 'mastering-workplace-productivity-ms-office',
    description: 'The definitive handbook for corporate professionals. Master advanced Excel nested arrays, XLOOKUP, dynamic dashboards, automated Word templates, and executive PowerPoint storytelling.',
    price: 0,
    is_free: true,
    cover_url: 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?q=80&w=800&auto=format&fit=crop',
    file_url: 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf',
    pages: 145,
    featured: true,
    downloads_count: 1420,
    created_at: '2025-01-10T12:00:00Z',
  },
  {
    id: 'book-2',
    title: 'The High-Performance WordPress Blueprint',
    slug: 'high-performance-wordpress-blueprint',
    description: 'Architecting 99+ PageSpeed WordPress stores and agency sites. Includes custom Gutenberg block development, headless WP setups, database query optimization, and enterprise caching layers.',
    price: 19.99,
    is_free: false,
    cover_url: 'https://images.unsplash.com/photo-1532012164546-f432f2e3777a?q=80&w=800&auto=format&fit=crop',
    file_url: 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf',
    pages: 230,
    featured: true,
    downloads_count: 856,
    created_at: '2025-02-05T12:00:00Z',
  },
  {
    id: 'book-3',
    title: 'Data Analytics & Automated Reporting with Google Sheets & Scripts',
    slug: 'data-analytics-google-sheets-scripts',
    description: 'Transform standard spreadsheets into autonomous business intelligence pipelines. Master Apps Script triggers, auto-emailing scheduled PDF reports, and connecting third-party REST APIs.',
    price: 29.99,
    is_free: false,
    cover_url: 'https://images.unsplash.com/photo-1512820790803-83ca734da794?q=80&w=800&auto=format&fit=crop',
    file_url: 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf',
    pages: 195,
    featured: true,
    downloads_count: 612,
    created_at: '2025-02-18T12:00:00Z',
  },
];

export const INITIAL_PROJECTS: Project[] = [
  {
    id: 'proj-1',
    title: 'Ultra-Modern Corporate Agency Portal',
    description: 'High-performance WordPress platform built for a global marketing agency. Features custom Gutenberg components, tailored micro-animations, and a verified 99/100 Google PageSpeed score.',
    // Long screenshot mock showing clean developer/agency layout
    image_url: 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?q=80&w=1200&auto=format&fit=crop',
    live_url: 'https://example.com/corporate-agency',
    github_url: 'https://github.com/example/agency-wp',
    tags: ['WordPress', 'Custom Gutenberg', 'TailwindCSS', 'PageSpeed 99', 'PHP'],
    featured: true,
    sort_order: 1,
    created_at: '2024-11-12T00:00:00Z',
  },
  {
    id: 'proj-2',
    title: 'Enterprise Financial Insights & Automated Reporting',
    description: 'Cloud data pipeline connecting multi-branch financial figures into interactive Google Sheets dashboards, with scheduled Google Apps Script cron triggers generating automated board reports.',
    image_url: 'https://images.unsplash.com/photo-1551288049-bebda4e38f71?q=80&w=1200&auto=format&fit=crop',
    live_url: 'https://example.com/finance-dash',
    github_url: 'https://github.com/example/finance-automation',
    tags: ['Data Analysis', 'Google Sheets', 'Google Apps Script', 'Financial Modeling'],
    featured: true,
    sort_order: 2,
    created_at: '2024-12-05T00:00:00Z',
  },
  {
    id: 'proj-3',
    title: 'Global E-Commerce Storefront (WooCommerce)',
    description: 'Multi-currency WooCommerce store with customized frictionless checkout, Stripe & PayPal integrations, real-time inventory management, and automated shipment tracking notifications.',
    image_url: 'https://images.unsplash.com/photo-1557821552-17105176677c?q=80&w=1200&auto=format&fit=crop',
    live_url: 'https://example.com/global-store',
    github_url: 'https://github.com/example/woocommerce-elite',
    tags: ['WordPress', 'WooCommerce', 'Stripe', 'Elementor Pro', 'Conversion Rate'],
    featured: true,
    sort_order: 3,
    created_at: '2025-01-15T00:00:00Z',
  },
  {
    id: 'proj-4',
    title: 'Automated Client Onboarding & CRM Sync Engine',
    description: 'Event-driven Google Workspace automation. Submits contracts, generates personalized Google Drive folders, updates Google Sheets CRM, and sends instant confirmation emails.',
    image_url: 'https://images.unsplash.com/photo-1507238691740-187a5b1d37b8?q=80&w=1200&auto=format&fit=crop',
    live_url: 'https://example.com/onboarding-crm',
    github_url: 'https://github.com/example/apps-script-crm',
    tags: ['Google Scripts', 'Google Drive', 'Automation', 'REST APIs'],
    featured: true,
    sort_order: 4,
    created_at: '2025-02-01T00:00:00Z',
  },
];

export const INITIAL_TUTORIALS: Tutorial[] = [
  {
    id: 'tut-1',
    title: 'Advanced Excel Formulas: XLOOKUP, INDEX-MATCH & Nested Dynamic Arrays',
    youtube_url: 'https://www.youtube.com/watch?v=0kPspP8z908',
    video_id: '0kPspP8z908',
    category: 'MS Office',
    duration: '24:15',
    views_count: 18450,
    created_at: '2025-01-20T00:00:00Z',
  },
  {
    id: 'tut-2',
    title: 'Building a Blazing-Fast WordPress Site from Scratch (Complete Guide)',
    youtube_url: 'https://www.youtube.com/watch?v=8AZ8GqW5iak',
    video_id: '8AZ8GqW5iak',
    category: 'WordPress',
    duration: '42:10',
    views_count: 26200,
    created_at: '2025-01-28T00:00:00Z',
  },
  {
    id: 'tut-3',
    title: 'Automate Google Sheets with Apps Script: Auto-Email Reports & Invoices',
    youtube_url: 'https://www.youtube.com/watch?v=k_OkA4hYv2w',
    video_id: 'k_OkA4hYv2w',
    category: 'Automation',
    duration: '31:05',
    views_count: 14900,
    created_at: '2025-02-10T00:00:00Z',
  },
  {
    id: 'tut-4',
    title: 'Data Cleaning & Transformation Crash Course for Business Analysts',
    youtube_url: 'https://www.youtube.com/watch?v=r-uOLxNrNk8',
    video_id: 'r-uOLxNrNk8',
    category: 'Data Analysis',
    duration: '18:40',
    views_count: 12800,
    created_at: '2025-02-22T00:00:00Z',
  },
];

export const INITIAL_PLAYLISTS: Playlist[] = [
  {
    id: 'pl-1',
    title: 'Complete MS Office 365 & Excel Mastery Course',
    slug: 'complete-ms-office-excel-mastery',
    description: 'Master high-impact Excel formulas, dynamic arrays, executive dashboard modeling, and Word document automation from corporate trainer Muhammad Fazal.',
    category: 'MS Office',
    thumbnail_url: 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?q=80&w=800&auto=format&fit=crop',
    youtube_playlist_url: 'https://www.youtube.com/playlist?list=PLexample_msoffice',
    video_count: 3,
    created_at: '2025-01-10T00:00:00Z',
  },
  {
    id: 'pl-2',
    title: 'Full-Stack WordPress & Custom Gutenberg Architecture',
    slug: 'full-stack-wordpress-gutenberg-architecture',
    description: 'End-to-end masterclass on building lightning-fast WordPress websites, sub-second PageSpeed benchmarks, headless patterns, and custom block development.',
    category: 'WordPress',
    thumbnail_url: 'https://images.unsplash.com/photo-1507238691740-187a5b1d37b8?q=80&w=800&auto=format&fit=crop',
    youtube_playlist_url: 'https://www.youtube.com/playlist?list=PLexample_wordpress',
    video_count: 3,
    created_at: '2025-01-15T00:00:00Z',
  },
  {
    id: 'pl-3',
    title: 'Google Apps Script & Cloud Automation Engine',
    slug: 'google-apps-script-cloud-automation',
    description: 'Automate enterprise workflows with Google Apps Script: sync Gmail, Google Sheets, Drive, REST APIs, and automated PDF invoice generation.',
    category: 'Automation',
    thumbnail_url: 'https://images.unsplash.com/photo-1551288049-bebda4e38f71?q=80&w=800&auto=format&fit=crop',
    youtube_playlist_url: 'https://www.youtube.com/playlist?list=PLexample_automation',
    video_count: 3,
    created_at: '2025-02-01T00:00:00Z',
  },
  {
    id: 'pl-4',
    title: 'Business Intelligence & Data Analysis Blueprint',
    slug: 'business-intelligence-data-analysis-blueprint',
    description: 'Transform messy data into actionable executive insights: data cleaning, query modeling, KPI tracking, and automated reporting systems.',
    category: 'Data Analysis',
    thumbnail_url: 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?q=80&w=800&auto=format&fit=crop',
    youtube_playlist_url: 'https://www.youtube.com/playlist?list=PLexample_dataanalysis',
    video_count: 2,
    created_at: '2025-02-15T00:00:00Z',
  },
];

export const INITIAL_PLAYLIST_VIDEOS: PlaylistVideo[] = [
  // MS Office
  {
    id: 'pv-1',
    playlist_id: 'pl-1',
    title: 'Lesson 1: Advanced Excel Formulas (XLOOKUP, INDEX-MATCH & Nested Dynamic Arrays)',
    youtube_url: 'https://www.youtube.com/watch?v=0kPspP8z908',
    youtube_video_id: '0kPspP8z908',
    duration: '24:15',
    order_index: 1,
    created_at: '2025-01-10T00:00:00Z',
  },
  {
    id: 'pv-2',
    playlist_id: 'pl-1',
    title: 'Lesson 2: Interactive Executive KPI Dashboards in Excel',
    youtube_url: 'https://www.youtube.com/watch?v=r-uOLxNrNk8',
    youtube_video_id: 'r-uOLxNrNk8',
    duration: '35:20',
    order_index: 2,
    created_at: '2025-01-11T00:00:00Z',
  },
  {
    id: 'pv-3',
    playlist_id: 'pl-1',
    title: 'Lesson 3: Automating Reports with Power Query & Pivot Tables',
    youtube_url: 'https://www.youtube.com/watch?v=k_OkA4hYv2w',
    youtube_video_id: 'k_OkA4hYv2w',
    duration: '28:40',
    order_index: 3,
    created_at: '2025-01-12T00:00:00Z',
  },

  // WordPress
  {
    id: 'pv-4',
    playlist_id: 'pl-2',
    title: 'Lesson 1: Building a Blazing-Fast WordPress Site from Scratch (Complete Guide)',
    youtube_url: 'https://www.youtube.com/watch?v=8AZ8GqW5iak',
    youtube_video_id: '8AZ8GqW5iak',
    duration: '42:10',
    order_index: 1,
    created_at: '2025-01-15T00:00:00Z',
  },
  {
    id: 'pv-5',
    playlist_id: 'pl-2',
    title: 'Lesson 2: Developing Custom Gutenberg Block Patterns with Tailwind',
    youtube_url: 'https://www.youtube.com/watch?v=0kPspP8z908',
    youtube_video_id: '0kPspP8z908',
    duration: '38:50',
    order_index: 2,
    created_at: '2025-01-16T00:00:00Z',
  },
  {
    id: 'pv-6',
    playlist_id: 'pl-2',
    title: 'Lesson 3: Achieving 99+ Google PageSpeed and Core Web Vitals',
    youtube_url: 'https://www.youtube.com/watch?v=r-uOLxNrNk8',
    youtube_video_id: 'r-uOLxNrNk8',
    duration: '29:15',
    order_index: 3,
    created_at: '2025-01-17T00:00:00Z',
  },

  // Automation
  {
    id: 'pv-7',
    playlist_id: 'pl-3',
    title: 'Lesson 1: Automate Google Sheets with Apps Script: Auto-Email Reports & Invoices',
    youtube_url: 'https://www.youtube.com/watch?v=k_OkA4hYv2w',
    youtube_video_id: 'k_OkA4hYv2w',
    duration: '31:05',
    order_index: 1,
    created_at: '2025-02-01T00:00:00Z',
  },
  {
    id: 'pv-8',
    playlist_id: 'pl-3',
    title: 'Lesson 2: Connecting External REST APIs to Google Sheets with OAuth',
    youtube_url: 'https://www.youtube.com/watch?v=8AZ8GqW5iak',
    youtube_video_id: '8AZ8GqW5iak',
    duration: '26:40',
    order_index: 2,
    created_at: '2025-02-02T00:00:00Z',
  },
  {
    id: 'pv-9',
    playlist_id: 'pl-3',
    title: 'Lesson 3: Scheduled Cron Triggers and Automatic PDF Generation',
    youtube_url: 'https://www.youtube.com/watch?v=0kPspP8z908',
    youtube_video_id: '0kPspP8z908',
    duration: '33:10',
    order_index: 3,
    created_at: '2025-02-03T00:00:00Z',
  },

  // Data Analysis
  {
    id: 'pv-10',
    playlist_id: 'pl-4',
    title: 'Lesson 1: Data Cleaning & Transformation Crash Course for Business Analysts',
    youtube_url: 'https://www.youtube.com/watch?v=r-uOLxNrNk8',
    youtube_video_id: 'r-uOLxNrNk8',
    duration: '18:40',
    order_index: 1,
    created_at: '2025-02-15T00:00:00Z',
  },
  {
    id: 'pv-11',
    playlist_id: 'pl-4',
    title: 'Lesson 2: Designing Modern Executive Business Intelligence Decks',
    youtube_url: 'https://www.youtube.com/watch?v=k_OkA4hYv2w',
    youtube_video_id: 'k_OkA4hYv2w',
    duration: '25:30',
    order_index: 2,
    created_at: '2025-02-16T00:00:00Z',
  },
];

export const INITIAL_POSTS: BlogPost[] = [
  {
    id: 'post-1',
    title: 'How I Built a 99/100 PageSpeed WordPress Website for Global Enterprise Clients',
    slug: 'how-i-built-99-pagespeed-wordpress-website',
    summary: 'A deep dive into how architectural choices, asset pruning, and custom Gutenberg blocks helped achieve sub-second load times on WordPress.',
    content: `### The WordPress Performance Paradox

Many developers believe WordPress is inherently sluggish. However, with the right architecture, headless principles, aggressive asset deferral, and query optimization, you can easily achieve 99+ mobile and desktop scores on Google PageSpeed Insights.

#### 1. Zero Bloat Philosophy
Eliminate all-in-one plugin suites that inject CSS and JS across every single page. Instead, rely on modular block patterns or lightweight custom Gutenberg blocks.

#### 2. Next-Gen Image Formats & Dynamic Caching
Serve AVIF/WebP assets and implement Redis object caching alongside Cloudflare edge page caching.

#### 3. Database Indexing
Regularly clean up post revisions, optimize the \`wp_options\` autoloaded payload, and index custom table queries.`,
    category: 'WordPress',
    tags: ['WordPress', 'Web Performance', 'PageSpeed', 'Gutenberg'],
    featured_image: 'https://images.unsplash.com/photo-1507238691740-187a5b1d37b8?q=80&w=1200&auto=format&fit=crop',
    published: true,
    read_time: '6 min read',
    created_at: '2025-02-01T10:00:00Z',
  },
  {
    id: 'post-2',
    title: 'Automating Office Tasks: From Zero to Hero with Google Apps Script',
    slug: 'automating-office-tasks-google-apps-script',
    summary: 'Learn how automating mundane data workflows with Google Apps Script saves hundreds of hours and eliminates human error.',
    content: `### Why Manual Data Entry is Dead

In corporate environments, hundreds of hours are wasted every month copying data from email attachments into spreadsheets and re-formatting PDF reports.

#### The Magic of Apps Script
With less than 50 lines of Google Apps Script, you can:
- Automatically poll Gmail for vendor invoices
- Extract structured tables into Google Sheets
- Trigger Slack/WhatsApp notifications
- Dispatch approved PDF receipts automatically

Empower your team with automation and focus your energy on strategic decision making.`,
    category: 'Automation',
    tags: ['Google Apps Script', 'Google Sheets', 'Workflow Automation'],
    featured_image: 'https://images.unsplash.com/photo-1551288049-bebda4e38f71?q=80&w=1200&auto=format&fit=crop',
    published: true,
    read_time: '5 min read',
    created_at: '2025-02-14T14:30:00Z',
  },
];

export const INITIAL_COMMENTS: Comment[] = [
  {
    id: 'com-1',
    post_id: 'post-1',
    author_name: 'Sarah Jenkins',
    author_email: 'sarah.j@agency.co.uk',
    comment_text: 'Brilliant breakdown Fazal! The tips on pruning wp_options autoload slashed our database queries in half.',
    is_approved: true,
    created_at: '2025-02-03T16:20:00Z',
  },
  {
    id: 'com-2',
    post_id: 'post-2',
    author_name: 'Tanvir Hossain',
    author_email: 'tanvir@fintech.bd',
    comment_text: 'The Google Apps Script invoice extraction snippet worked like a charm for our accounting team. Thanks for sharing!',
    is_approved: true,
    created_at: '2025-02-16T09:15:00Z',
  },
];

export const INITIAL_CONSULTATIONS: Consultation[] = [
  {
    id: 'cons-1',
    name: 'David Miller',
    email: 'david.miller@techfirm.com',
    service: 'WordPress Development',
    message: 'We need a complete redesign of our SaaS marketing website with fast page speeds and custom Gutenberg blocks.',
    status: 'new',
    admin_notes: 'Replied with portfolio case studies and rate sheet.',
    created_at: '2025-03-01T08:30:00Z',
  },
  {
    id: 'cons-2',
    name: 'Ayesha Rahman',
    email: 'ayesha.r@fintech.bd',
    service: 'Data Analysis',
    message: 'Looking for an automated financial reporting system in Google Sheets and executive dashboard.',
    status: 'contacted',
    admin_notes: 'Scheduled discovery call for Thursday.',
    created_at: '2025-03-02T11:45:00Z',
  },
];

export const INITIAL_ORDERS: Order[] = [
  {
    id: 'ord-1',
    customer_name: 'Michael Chang',
    customer_email: 'michael.chang@corp.io',
    book_id: 'book-2',
    book: INITIAL_BOOKS[1],
    amount: 19.99,
    payment_method: 'stripe_test',
    trx_id: 'pi_3MtwBwLkdIwHu7ix28a3tq5V',
    status: 'completed',
    created_at: '2025-02-20T14:10:00Z',
  },
  {
    id: 'ord-2',
    customer_name: 'Farhan Kabir',
    customer_email: 'farhan@dhaka.com',
    book_id: 'book-3',
    book: INITIAL_BOOKS[2],
    amount: 29.99,
    payment_method: 'bkash',
    trx_id: '9H4J8K2L1M',
    status: 'approved',
    created_at: '2025-02-25T17:40:00Z',
  },
];

export const TIMELINE_EXPERIENCE = [
  {
    period: '2016 – 2020',
    title: 'Practical MS Office Specialist',
    organization: 'Corporate Productivity & Documentation',
    description: 'Extensive hands-on mastery in advanced Excel formula architecture, multi-sheet workbook modeling, executive PowerPoint design, and document automation across enterprise workflows.',
    tags: ['Excel Formulas', 'VBA Macros', 'Data Cleaning', 'PowerPoint Design'],
  },
  {
    period: '2020 – 2024',
    title: 'WordPress Developer (Fiverr Level 1)',
    organization: 'Global Freelance Services (UK, USA, Canada, Germany)',
    description: 'Delivered 120+ successful projects for international clients. Engineered custom Gutenberg layouts, e-commerce stores (WooCommerce), speed optimizations, and seamless mobile responsiveness.',
    tags: ['WordPress', 'WooCommerce', 'Elementor / Gutenberg', 'PHP', 'Speed Optimization'],
  },
  {
    period: '2024 – 2025',
    title: 'Data Analyst & Automation Engineer',
    organization: 'Business Intelligence & Cloud Workflows',
    description: 'Transformed chaotic business data into actionable executive insights. Developed automated Google Apps Script workflows, Google Drive integrations, and automated client reporting engines.',
    tags: ['Google Sheets', 'Google Apps Script', 'Data Insights', 'ETL Pipelines'],
  },
  {
    period: '2024 – Present',
    title: 'Lead Instructor of MS Office',
    organization: 'As-Sunnah Skill Development Institute',
    description: 'Mentoring thousands of aspiring professionals and students in digital workplace literacy, professional spreadsheet automation, and modern corporate productivity skills.',
    tags: ['Instructor', 'Curriculum Design', 'Corporate Training', 'Mentorship'],
  },
];

export const SKILLS_LIST = [
  {
    name: 'Microsoft Office',
    level: 'Mastery (98%)',
    description: 'Advanced Excel formulas (XLOOKUP, Dynamic Arrays), pivot modeling, professional PowerPoint decks & document workflows.',
    iconName: 'FileSpreadsheet',
    badge: 'Enterprise Productivity',
  },
  {
    name: 'Google Sheets',
    level: 'Advanced (95%)',
    description: 'Cloud collaborative data modeling, dynamic QUERY/IMPORTRANGE formulas, interactive executive dashboards.',
    iconName: 'Table',
    badge: 'Cloud Analytics',
  },
  {
    name: 'Google Scripts',
    level: 'Proficient (90%)',
    description: 'Google Workspace JavaScript automation, email triggers, scheduled cron jobs, PDF report generators, and REST API syncs.',
    iconName: 'Code2',
    badge: 'Workflow Automation',
  },
  {
    name: 'Google Drive',
    level: 'Advanced (92%)',
    description: 'Automated file architecture, client onboarding document vaults, secure permission hierarchies, and programmatic folder backups.',
    iconName: 'Cloud',
    badge: 'Cloud Management',
  },
  {
    name: 'WordPress',
    level: 'Expert (96%)',
    description: 'Custom Gutenberg blocks, responsive themes, WooCommerce stores, speed optimization (99+ PageSpeed), and technical SEO.',
    iconName: 'Globe',
    badge: 'Web Architecture',
  },
];

export const TESTIMONIALS = [
  {
    name: 'Marcus Vance',
    role: 'CEO, Vance Digital Media (UK)',
    designation: 'WordPress Architecture Client',
    avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?q=80&w=300&auto=format&fit=crop',
    rating: 5,
    text: 'Fazal revamped our entire company website into WordPress with blazing sub-second load times. His communication is stellar, and his attention to design precision is world-class.',
  },
  {
    name: 'Alexander Wright',
    role: 'Operations Director, Nexa Analytics (USA)',
    designation: 'Data Analytics & Automation Client',
    avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?q=80&w=300&auto=format&fit=crop',
    rating: 5,
    text: 'Fazal created an automated Google Sheets and Apps Script system that saved our team over 15 hours every single week. Truly an expert at cloud data automation and dashboards.',
  },
  {
    name: 'Dr. Rafiqul Islam',
    role: 'Academic Coordinator, As-Sunnah Skill Institute',
    designation: 'MS Office Corporate Partner',
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?q=80&w=300&auto=format&fit=crop',
    rating: 5,
    text: 'As Lead Instructor, Muhammad Fazal has trained hundreds of students and corporate professionals with patience, deep technical knowledge, and an inspiring teaching methodology.',
  },
  {
    name: 'David Campbell',
    role: 'Managing Director, Apex eCommerce (Australia)',
    designation: 'WooCommerce & Web Platform Client',
    avatar: 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?q=80&w=300&auto=format&fit=crop',
    rating: 5,
    text: 'Working with Fazal on our high-traffic WooCommerce platform was seamless. Sub-second PageSpeed benchmarks, custom Gutenberg blocks, and zero plugin bloat.',
  },
];
