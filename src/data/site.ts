/**
 * Default site content, taken from the CV.
 * Every field here will be editable from the admin panel once Supabase is
 * connected (Phase 2). Supabase values override these defaults.
 */

export type NavItem = { label: string; href: string };
export type Social = { name: string; href: string; icon: IconName };
export type Stat = { value: number; suffix: string; label: string };
export type Service = { title: string; text: string; icon: IconName };
export type Tool = { name: string; group: string; color: string; short: string };
export type Experience = {
  role: string;
  org: string;
  period: string;
  points: string[];
};
export type Testimonial = {
  name: string;
  role: string;
  quote: string;
  rating: number;
  sample?: boolean;
};
export type FeaturedProject = {
  title: string;
  category: string;
  text: string;
  tags: string[];
  href?: string;
};

export type IconName =
  | 'linkedin'
  | 'facebook'
  | 'youtube'
  | 'github'
  | 'whatsapp'
  | 'mail'
  | 'phone'
  | 'pin'
  | 'globe'
  | 'sheet'
  | 'code'
  | 'chart'
  | 'teach'
  | 'bolt'
  | 'spark';

export const site = {
  name: 'Muhammad Fazal',
  shortName: 'MF',
  tagline: 'Office Automation Specialist & Developer',
  description:
    'Muhammad Fazal: office automation specialist, data analyst, WordPress developer and MS Office lead instructor. Google Sheets and Apps Script systems, dashboards, websites and training.',
  email: 'fazal.assdi39@gmail.com',
  phone: '+880 1317-947048',
  whatsapp: '8801317947048',
  location: 'Magura, Bangladesh',
  cvUrl: '', // set from admin → upload a public CV (without private details)
};

export const nav: NavItem[] = [
  { label: 'Home', href: '/' },
  { label: 'About', href: '/about' },
  { label: 'E-books', href: '/ebooks' },
  { label: 'Projects', href: '/projects' },
  { label: 'Tutorials', href: '/tutorials' },
  { label: 'Blog', href: '/blog' },
  { label: 'Contact', href: '/contact' },
];

export const socials: Social[] = [
  { name: 'LinkedIn', href: 'https://linkedin.com/in/fazal79', icon: 'linkedin' },
  { name: 'WhatsApp', href: 'https://wa.me/8801317947048', icon: 'whatsapp' },
  { name: 'Email', href: 'mailto:fazal.assdi39@gmail.com', icon: 'mail' },
  // Add Facebook / YouTube / GitHub links from admin
];

export const hero = {
  greeting: "Hi, I'm",
  name: 'Muhammad Fazal',
  roles: [
    'Office Automation Specialist',
    'Data Analyst',
    'Google Apps Script Developer',
    'WordPress Developer',
    'MS Office Lead Instructor',
  ],
  intro:
    'I turn messy manual work into clean, automated systems. From Google Sheets and Apps Script ERPs to data dashboards and modern WordPress websites, I build tools that save hours every week. As a lead instructor I have trained students and professionals to master MS Office, Google Workspace and AI-assisted productivity, and I bring the same practical, results-first approach to every client project.',
  photo: '', // upload from admin
  available: true,
};

export const stats: Stat[] = [
  { value: 50, suffix: '+', label: 'Projects delivered' },
  { value: 4, suffix: '+', label: 'Years in MS Office' },
  { value: 1.5, suffix: 'K+', label: 'Students trained' },
];

export const services: Service[] = [
  {
    title: 'Office Automation',
    text: 'Custom Google Sheets & Apps Script systems: leave, student, stock, sales and task management that run themselves.',
    icon: 'bolt',
  },
  {
    title: 'Data & Dashboards',
    text: 'Clean data, XLOOKUP and pivot magic, and live dashboards that turn raw numbers into decisions.',
    icon: 'chart',
  },
  {
    title: 'Websites',
    text: 'Fast, responsive WordPress & modern websites with clean UI/UX, built end to end and handed over properly.',
    icon: 'code',
  },
  {
    title: 'Training & Workshops',
    text: 'Project-based MS Office, Google Workspace and AI productivity training for teams and individuals.',
    icon: 'teach',
  },
];

export const tools: Tool[] = [
  { name: 'Microsoft Excel', group: 'Data', color: '#1d6f42', short: 'X' },
  { name: 'Google Sheets', group: 'Data', color: '#0f9d58', short: 'S' },
  { name: 'Apps Script', group: 'Automation', color: '#4285f4', short: '{}' },
  { name: 'Microsoft Word', group: 'Office', color: '#2b579a', short: 'W' },
  { name: 'PowerPoint', group: 'Office', color: '#c43e1c', short: 'P' },
  { name: 'Tally ERP', group: 'Accounting', color: '#1a4b8c', short: 'T' },
  { name: 'WordPress', group: 'Web', color: '#21759b', short: 'WP' },
  { name: 'Elementor', group: 'Web', color: '#92003b', short: 'E' },
  { name: 'Claude', group: 'AI', color: '#d97757', short: 'C' },
  { name: 'ChatGPT', group: 'AI', color: '#10a37f', short: 'G' },
  { name: 'Google AI Studio', group: 'AI', color: '#8e75ff', short: 'AI' },
  { name: 'NotebookLM', group: 'AI', color: '#5f6368', short: 'N' },
];

export const featuredProjects: FeaturedProject[] = [
  {
    title: 'Dua After Salah',
    category: 'Android App',
    text: 'Designed, developed and published on the Google Play Store.',
    tags: ['Android', 'Mobile'],
  },
  {
    title: 'Apps Script ERP Suite',
    category: 'Automation',
    text: 'Custom ERP with leave, student, task and admin systems, dashboards and automated reporting.',
    tags: ['Apps Script', 'Google Sheets'],
  },
  {
    title: 'Stock & Sales Tracker',
    category: 'Google Sheets',
    text: 'Inventory and sales tracking with live dashboards that replaced manual registers.',
    tags: ['Sheets', 'Dashboard'],
  },
];

export const experience: Experience[] = [
  {
    role: 'Lead Instructor, MS Office & Digital Tools',
    org: 'As-Sunnah Skill Development Institute (ASSDI)',
    period: '2024 – Present',
    points: [
      'Mentored and trained 1,200+ students and professionals in Advanced MS Office, Google Workspace and practical IT tools.',
      'Engineered automation with Google Sheets & Apps Script: leave management, student databases, admin dashboards, task, sales and stock trackers.',
      "Spearheaded the institute's digital transformation by centralising reporting and data workflows.",
      'Integrated generative AI tools into training to teach prompt engineering and AI-assisted productivity.',
    ],
  },
  {
    role: 'Freelance Web & CMS Specialist (Level 1 Seller)',
    org: 'Fiverr Marketplace',
    period: '2021 – 2024',
    points: [
      'Built modern, responsive WordPress websites with Elementor for international clients.',
      'Maintained consistent 5-star ratings and earned the Level 1 Seller badge.',
      'Managed the full client lifecycle, from requirements to handover.',
    ],
  },
  {
    role: 'Administrative & MS Office Specialist',
    org: 'Institutional Administration',
    period: '2020 – 2024',
    points: [
      'Managed institutional records, digital reporting and database entry with MS Office.',
      'Converted manual workflows into structured spreadsheet reports, improving accuracy.',
    ],
  },
];

export const skills: { group: string; items: string[] }[] = [
  {
    group: 'Data & Spreadsheet Automation',
    items: ['Advanced Excel', 'XLOOKUP / VLOOKUP', 'Pivot Tables', 'Data Cleaning', 'Dashboards', 'Google Sheets', 'Apps Script'],
  },
  { group: 'Office & ERP', items: ['MS Word', 'MS PowerPoint', 'Tally ERP', 'Practical Accounting'] },
  { group: 'Web & App', items: ['WordPress', 'Elementor', 'Web Design', 'UI/UX Fundamentals', 'Android Apps'] },
  {
    group: 'AI & Productivity',
    items: ['Claude', 'ChatGPT', 'Google AI Studio', 'NotebookLM', 'Gen-AI APIs', 'Prompt Engineering'],
  },
  { group: 'Marketing & Content', items: ['Digital Marketing', 'Content Marketing', 'Copywriting'] },
  { group: 'Languages', items: ['English (professional)', 'Bengali (native)', 'Bijoy & Unicode typing'] },
];

export const education = [
  { title: "Bachelor's Degree (Pass Course)", org: 'Abu Dhar Ghifari College, Malibagh, Dhaka', period: 'Ongoing' },
  { title: 'HSC, Science', org: 'Govt. Yasin College · Dhaka Board · GPA 3.92', period: '2018' },
  { title: 'SSC, Science', org: 'Babukhali Aftab Uddin High School · Jessore Board · GPA 4.89', period: '2016' },
];

export const certifications = [
  { title: 'Small Business Management', org: 'As-Sunnah Skill Development Institute', period: '2024 · 3 months' },
  { title: 'WordPress & Elementor Development', org: 'Professional Course', period: '2020 · 5 months' },
  { title: 'Web Design & Development', org: 'IT-Bari', period: '2018 · 6 months' },
  { title: 'MS Office Professional Course', org: 'Professional Course', period: '2016 · 3 months' },
];

export const achievements = [
  { title: 'Fiverr Level 1 Seller', text: 'Consistent 5-star ratings from international clients.' },
  { title: 'Play Store Publisher', text: 'Dua After Salah, live on Google Play.' },
  { title: '1,200+ Learners', text: 'Trained in MS Office, Google Workspace and AI tools.' },
];

/** Placeholder testimonials, shown only in local dev until real ones are added from admin. */
export const testimonials: Testimonial[] = [
  {
    name: 'Sample Client',
    role: 'Replace from admin',
    quote: 'This is a placeholder testimonial. Real client reviews will be added from the admin panel.',
    rating: 5,
    sample: true,
  },
  {
    name: 'Sample Student',
    role: 'Replace from admin',
    quote: 'Another placeholder so you can see how the section looks with more than one review.',
    rating: 5,
    sample: true,
  },
];

export const footer = {
  about:
    'Office automation specialist and developer helping teams replace manual work with smart systems, clean dashboards and fast websites.',
  specializations: ['Office Automation', 'Google Apps Script', 'Data Dashboards', 'WordPress Websites', 'MS Office Training'],
};

export const consultation = {
  calendarEnabled: true,
  slotMinutes: 30,
  topics: ['Office Automation', 'Google Sheets / Apps Script', 'Dashboard & Reporting', 'Website', 'Training', 'Other'],
};
