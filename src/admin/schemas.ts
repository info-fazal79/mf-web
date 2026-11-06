import type { SettingsKey } from '@/lib/content';
import type { Field } from './SchemaForm';

const icons = ['bolt', 'chart', 'code', 'teach', 'sheet', 'spark', 'globe', 'mail', 'phone', 'pin'];
const socialIcons = ['linkedin', 'facebook', 'youtube', 'github', 'whatsapp', 'mail', 'globe'];

export type SettingsPage = {
  key: SettingsKey;
  title: string;
  sub: string;
  fields: Field[];
};

export const settingsPages: SettingsPage[] = [
  {
    key: 'general',
    title: 'General',
    sub: 'Site name, contact details, logo and CV.',
    fields: [
      { key: 'name', label: 'Site / your name', type: 'text' },
      { key: 'shortName', label: 'Logo initials', type: 'text', help: 'Shown in the logo badge when no logo image is set.' },
      { key: 'tagline', label: 'Tagline', type: 'text', wide: true },
      { key: 'description', label: 'SEO description', type: 'textarea', help: 'Shown on Google and when the site is shared. Keep it near 155 characters.' },
      { key: 'email', label: 'Email', type: 'email' },
      { key: 'phone', label: 'Phone', type: 'text' },
      { key: 'whatsapp', label: 'WhatsApp number', type: 'text', help: 'Digits only with country code, e.g. 8801317947048' },
      { key: 'location', label: 'Location', type: 'text' },
      { key: 'logoUrl', label: 'Logo image', type: 'image' },
      { key: 'faviconUrl', label: 'Favicon', type: 'image', help: 'Square image, 64×64 or larger.' },
      { key: 'cvUrl', label: 'Public CV (PDF)', type: 'file', help: 'Powers the "Download CV" button. Upload a version without private details.' },
    ],
  },
  {
    key: 'nav',
    title: 'Navigation',
    sub: 'Header menu items and their order.',
    fields: [
      {
        key: 'items',
        label: 'Menu items',
        type: 'list',
        itemLabel: 'label',
        fields: [
          { key: 'label', label: 'Label', type: 'text' },
          { key: 'href', label: 'Link', type: 'text', placeholder: '/about' },
        ],
      },
    ],
  },
  {
    key: 'socials',
    title: 'Social links',
    sub: 'Shown in the footer and on the contact page.',
    fields: [
      {
        key: 'items',
        label: 'Links',
        type: 'list',
        itemLabel: 'name',
        fields: [
          { key: 'name', label: 'Name', type: 'text' },
          { key: 'href', label: 'URL', type: 'url' },
          { key: 'icon', label: 'Icon', type: 'select', options: socialIcons },
        ],
      },
    ],
  },
  {
    key: 'footer',
    title: 'Footer',
    sub: 'About text and specialization list.',
    fields: [
      { key: 'about', label: 'About text', type: 'textarea' },
      { key: 'specializations', label: 'Specializations', type: 'tags' },
    ],
  },
  {
    key: 'floating',
    title: 'Floating contact',
    sub: 'The round contact button at the bottom-right of every page.',
    fields: [
      { key: 'enabled', label: 'Show floating contact button', type: 'toggle', wide: true },
      { key: 'whatsapp', label: 'WhatsApp', type: 'toggle' },
      { key: 'call', label: 'Phone call', type: 'toggle' },
      { key: 'email', label: 'Email', type: 'toggle' },
    ],
  },
  {
    key: 'hero',
    title: 'Hero',
    sub: 'The first section of the home page.',
    fields: [
      { key: 'greeting', label: 'Greeting', type: 'text' },
      { key: 'name', label: 'Name', type: 'text' },
      { key: 'roles', label: 'Roles (typing animation)', type: 'tags' },
      { key: 'intro', label: 'Intro paragraph', type: 'textarea' },
      { key: 'photo', label: 'Photo', type: 'image', help: 'Portrait works best (4:5). A transparent PNG looks great.' },
      { key: 'available', label: 'Show "Available for new projects" badge', type: 'toggle', wide: true },
    ],
  },
  {
    key: 'stats',
    title: 'Stats',
    sub: 'Animated counters under the hero.',
    fields: [
      {
        key: 'items',
        label: 'Counters',
        type: 'list',
        itemLabel: 'label',
        fields: [
          { key: 'value', label: 'Number', type: 'number' },
          { key: 'suffix', label: 'Suffix', type: 'text', placeholder: '+, K+, %' },
          { key: 'label', label: 'Label', type: 'text', wide: true },
        ],
      },
    ],
  },
  {
    key: 'sections',
    title: 'Home sections',
    sub: 'Show or hide each home page section.',
    fields: [
      { key: 'services', label: 'What I do', type: 'toggle' },
      { key: 'tools', label: 'Software / toolkit', type: 'toggle' },
      { key: 'featured', label: 'Featured projects', type: 'toggle' },
      { key: 'discover', label: 'Discover everything', type: 'toggle' },
      { key: 'experience', label: 'Experience', type: 'toggle' },
      { key: 'testimonials', label: 'Testimonials', type: 'toggle' },
      { key: 'blog', label: 'Latest blog posts', type: 'toggle' },
      { key: 'cta', label: 'Call to action', type: 'toggle' },
    ],
  },
  {
    key: 'services',
    title: 'Services',
    sub: '"What I do" cards on the home page.',
    fields: [
      {
        key: 'items',
        label: 'Services',
        type: 'list',
        itemLabel: 'title',
        fields: [
          { key: 'title', label: 'Title', type: 'text' },
          { key: 'icon', label: 'Icon', type: 'select', options: icons },
          { key: 'text', label: 'Description', type: 'textarea' },
        ],
      },
    ],
  },
  {
    key: 'tools',
    title: 'Toolkit',
    sub: 'Software cards in the scrolling strip.',
    fields: [
      {
        key: 'items',
        label: 'Tools',
        type: 'list',
        itemLabel: 'name',
        fields: [
          { key: 'name', label: 'Name', type: 'text' },
          { key: 'group', label: 'Group', type: 'text' },
          { key: 'short', label: 'Badge text', type: 'text', help: '1–2 characters' },
          { key: 'color', label: 'Badge color', type: 'color' },
        ],
      },
    ],
  },
  {
    key: 'featured',
    title: 'Featured projects',
    sub: 'Shown on the home page until the Projects module lands (Phase 5).',
    fields: [
      {
        key: 'items',
        label: 'Projects',
        type: 'list',
        itemLabel: 'title',
        fields: [
          { key: 'title', label: 'Title', type: 'text' },
          { key: 'category', label: 'Category', type: 'text' },
          { key: 'text', label: 'Description', type: 'textarea' },
          { key: 'tags', label: 'Tags', type: 'tags' },
          { key: 'href', label: 'Link (optional)', type: 'url', wide: true },
        ],
      },
    ],
  },
  {
    key: 'about',
    title: 'About page',
    sub: 'Your story, experience, skills, education and certifications.',
    fields: [
      { key: 'heading', label: 'Heading', type: 'text' },
      { key: 'photo', label: 'Photo (falls back to hero photo)', type: 'image' },
      { key: 'subtitle', label: 'Subtitle', type: 'textarea' },
      { key: 'paragraphs', label: 'About paragraphs', type: 'textlist' },
      {
        key: 'experience',
        label: 'Experience',
        type: 'list',
        itemLabel: 'role',
        fields: [
          { key: 'role', label: 'Role', type: 'text', wide: true },
          { key: 'org', label: 'Organization', type: 'text' },
          { key: 'period', label: 'Period', type: 'text', placeholder: '2024 – Present' },
          { key: 'points', label: 'Highlights', type: 'textlist' },
        ],
      },
      {
        key: 'skills',
        label: 'Skill groups',
        type: 'list',
        itemLabel: 'group',
        fields: [
          { key: 'group', label: 'Group name', type: 'text', wide: true },
          { key: 'items', label: 'Skills', type: 'tags' },
        ],
      },
      {
        key: 'education',
        label: 'Education',
        type: 'list',
        itemLabel: 'title',
        fields: [
          { key: 'title', label: 'Degree', type: 'text' },
          { key: 'period', label: 'Year', type: 'text' },
          { key: 'org', label: 'Institution / details', type: 'text', wide: true },
        ],
      },
      {
        key: 'certifications',
        label: 'Training & certifications',
        type: 'list',
        itemLabel: 'title',
        fields: [
          { key: 'title', label: 'Title', type: 'text' },
          { key: 'period', label: 'Year / duration', type: 'text' },
          { key: 'org', label: 'Provider', type: 'text', wide: true },
        ],
      },
      {
        key: 'achievements',
        label: 'Achievements',
        type: 'list',
        itemLabel: 'title',
        fields: [
          { key: 'title', label: 'Title', type: 'text' },
          { key: 'text', label: 'Description', type: 'text' },
        ],
      },
    ],
  },
  {
    key: 'consultation',
    title: 'Consultation settings',
    sub: 'Booking drawer options. Set your open hours under Consultations → Availability.',
    fields: [
      { key: 'calendarEnabled', label: 'Show calendar in the booking form', type: 'toggle', wide: true, help: 'When off, visitors send a request without choosing a time.' },
      { key: 'slotMinutes', label: 'Slot length (minutes)', type: 'number' },
      { key: 'minNoticeHours', label: 'Minimum notice (hours)', type: 'number', help: 'How soon a slot can be booked, e.g. 12 = no bookings within the next 12 hours.' },
      { key: 'maxDaysAhead', label: 'Book up to (days ahead)', type: 'number' },
      { key: 'note', label: 'Note under the button', type: 'text', wide: true },
      { key: 'topics', label: 'Topics', type: 'tags' },
    ],
  },
];
