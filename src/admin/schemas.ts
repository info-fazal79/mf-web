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
    key: 'appearance',
    title: 'Theme',
    sub: 'Colour theme for the whole website (public pages, reader and this admin panel).',
    fields: [
      {
        key: 'theme',
        label: 'Site theme',
        type: 'select',
        wide: true,
        options: [
          { value: 'classic', label: 'Classic Green (default)' },
          { value: 'mono', label: 'Black & White (developer mode)' },
          { value: 'ink', label: 'Ink & Indigo (developer pro)' },
          { value: 'forest', label: 'Forest Pro (professional green)' },
        ],
        help: 'Black & White: monochrome with monospace type. Ink & Indigo: neutral dark surfaces, Geist type, silver headings and a restrained indigo accent. Forest Pro: the same professional look built on your brand green. Visitors can still switch light/dark mode with the sun icon.',
      },
    ],
  },
  {
    key: 'general',
    title: 'General',
    sub: 'Site name, contact details, logo and CV.',
    fields: [
      { key: 'name', label: 'Site / your name', type: 'text' },
      { key: 'tagline', label: 'Tagline', type: 'text', wide: true },
      { key: 'description', label: 'SEO description', type: 'textarea', help: 'Shown on Google and when the site is shared. Keep it near 155 characters.' },
      { key: 'email', label: 'Email', type: 'email' },
      { key: 'phone', label: 'Phone', type: 'text' },
      { key: 'whatsapp', label: 'WhatsApp number', type: 'text', help: 'Digits only with country code, e.g. 8801317947048' },
      { key: 'location', label: 'Location', type: 'text' },
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
    key: 'header',
    title: 'Header',
    sub: 'Logo, name and subtitle at the top-left of every page (also used in the footer).',
    fields: [
      { key: 'logoUrl', label: 'Logo image (dark mode)', type: 'image', help: 'PNG or SVG. Transparent background looks best. Leave empty to show the initials badge.' },
      { key: 'logoUrlLight', label: 'Logo image (light mode)', type: 'image', help: 'Shown when visitors use light mode, e.g. a version with dark text. Leave empty to use the logo above in both modes.' },      { key: 'logoSize', label: 'Logo size', type: 'range', min: 12, max: 80, unit: 'px', wide: true, help: 'Height of the logo. Wide logos keep their shape.' },
      { key: 'showText', label: 'Show name and subtitle next to the logo', type: 'toggle', wide: true, help: 'Turn off if your logo image already contains your name.' },
      { key: 'name', label: 'Name', type: 'text' },
      { key: 'subtitle', label: 'Subtitle', type: 'text', placeholder: '<automation · dev />' },
      { key: 'initials', label: 'Initials (when no logo image)', type: 'text', help: '1–3 letters shown in the badge.' },
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
      { key: 'photo', label: 'Photo (single)', type: 'image', help: 'Used when the slideshow below is empty. Portrait works best (4:5).' },
      {
        key: 'photos',
        label: 'Slideshow photos',
        type: 'list',
        itemLabel: 'caption',
        help: 'Add 2 or more photos and they rotate automatically. Order = play order. Portrait (4:5) photos fit best.',
        fields: [
          { key: 'url', label: 'Photo', type: 'image' },
          { key: 'caption', label: 'Caption (optional)', type: 'text', wide: true, help: 'Shown in the Polaroid and Window templates, and used as alt text.' },
        ],
      },
      {
        key: 'photoTemplate',
        label: 'Photo template',
        type: 'select',
        options: [
          { value: 'classic', label: 'Classic card (dashed frame)' },
          { value: 'window', label: 'Code window (browser bar)' },
          { value: 'stack', label: 'Photo stack (cards behind)' },
          { value: 'circle', label: 'Circle with orbit ring' },
          { value: 'polaroid', label: 'Polaroid (tilted, caption)' },
          { value: 'arch', label: 'Arch (rounded top)' },
        ],
      },
      {
        key: 'slideEffect',
        label: 'Transition effect',
        type: 'select',
        options: [
          { value: 'fade', label: 'Fade' },
          { value: 'slide', label: 'Slide' },
          { value: 'zoom', label: 'Zoom' },
          { value: 'kenburns', label: 'Ken Burns (slow zoom)' },
          { value: 'blink', label: 'Blink' },
          { value: 'flip', label: 'Flip (3D)' },
          { value: 'blur', label: 'Blur' },
          { value: 'wipe', label: 'Wipe' },
        ],
      },
      { key: 'slideInterval', label: 'Seconds per photo', type: 'range', min: 2, max: 15, unit: 's', wide: true },
      { key: 'showBadges', label: 'Show floating badges (Apps Script / AI Automation)', type: 'toggle' },
      { key: 'showDots', label: 'Show slide dots under the photo', type: 'toggle' },
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
          { key: 'logo', label: 'Logo (optional)', type: 'image', help: 'Leave empty: known tools (Excel, Word, PowerPoint, Sheets, Apps Script, Tally, WordPress, Elementor, Claude, ChatGPT, AI Studio, NotebookLM) show their official logo automatically. Others show the letter badge below.' },
          { key: 'short', label: 'Badge text', type: 'text', help: '1–2 characters, used when there is no logo' },
          { key: 'color', label: 'Badge color', type: 'color' },
        ],
      },
    ],
  },
  {
    key: 'featured',
    title: 'Featured projects',
    sub: 'Fallback list for the home page. Once you publish projects in Projects, those are shown instead (featured first).',
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
    sub: 'Your story, experience, skills and achievements.',
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
    key: 'payments',
    title: 'Payment settings',
    sub: 'bKash and Nagad numbers shown at checkout. Buyers send money, then enter their Transaction ID.',
    fields: [
      { key: 'bkashEnabled', label: 'Accept bKash', type: 'toggle' },
      { key: 'nagadEnabled', label: 'Accept Nagad', type: 'toggle' },
      { key: 'bkashNumber', label: 'bKash number', type: 'text', placeholder: '01XXXXXXXXX' },
      { key: 'nagadNumber', label: 'Nagad number', type: 'text', placeholder: '01XXXXXXXXX' },
      { key: 'bkashType', label: 'bKash account type', type: 'select', options: ['Personal', 'Merchant', 'Agent'], help: 'Personal → buyers use "Send Money". Merchant → "Payment".' },
      { key: 'nagadType', label: 'Nagad account type', type: 'select', options: ['Personal', 'Merchant', 'Agent'] },
      { key: 'note', label: 'Extra instruction for buyers', type: 'textarea' },
      { key: 'verifyHours', label: 'Usual verification time (hours)', type: 'number', help: 'Shown to buyers: "Your order will be verified within X hours".' },
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
