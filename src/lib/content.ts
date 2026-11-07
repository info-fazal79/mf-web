/**
 * Content layer: CV defaults (src/data/site.ts) merged with whatever the admin
 * panel saved in Supabase (`site_settings` + `testimonials`).
 *
 * The public site reads this at build time (and on every request in dev), so
 * pages stay static and fast. Admin changes go live on the next build.
 */
import { createClient } from '@supabase/supabase-js';
import * as d from '@/data/site';

export const defaults = {
  general: { ...d.site, logoUrl: '', faviconUrl: '' },
  nav: { items: d.nav },
  /** Logo block in the header (and footer). Empty fields fall back to General settings. */
  header: {
    name: d.site.name,
    subtitle: '<automation · dev />',
    showText: true,
    logoUrl: '',
    /** Optional logo shown in light mode (e.g. a dark-text version). Empty = use the main logo. */
    logoUrlLight: '',
    logoSize: 36,
    initials: d.site.shortName,
  },
  hero: {
    ...d.hero,
    /** Slideshow (Admin → Home page → Hero). Empty list = use the single `photo`. */
    photos: [] as { url: string; caption: string }[],
    photoTemplate: 'classic',
    slideEffect: 'fade',
    slideInterval: 5,
    showBadges: true,
    showDots: true,
  },
  stats: { items: d.stats },
  services: { items: d.services },
  tools: { items: d.tools },
  featured: { items: d.featuredProjects },
  socials: { items: d.socials },
  footer: d.footer,
  about: {
    ...d.aboutIntro,
    experience: d.experience,
    skills: d.skills,
    education: d.education,
    certifications: d.certifications,
    achievements: d.achievements,
  },
  consultation: d.consultation,
  floating: { enabled: true, whatsapp: true, call: true, email: true },
  /** Site-wide colour palette. 'classic' = green (default), 'mono' = black & white developer theme. */
  appearance: { theme: 'classic' },
  payments: {
    bkashEnabled: true,
    bkashNumber: '',
    bkashType: 'Personal',
    nagadEnabled: true,
    nagadNumber: '',
    nagadType: 'Personal',
    note: 'Use "Send Money", then copy the Transaction ID (TrxID) from the confirmation SMS.',
    verifyHours: 6,
  },
  sections: {
    services: true,
    tools: true,
    featured: true,
    discover: true,
    experience: true,
    testimonials: true,
    blog: true,
    cta: true,
  },
};

/** Site palettes (Admin → Settings → Theme). Unknown values fall back to 'classic'. */
export const PALETTES = ['classic', 'mono', 'ink', 'forest'] as const;
export type Palette = (typeof PALETTES)[number];
export const paletteOf = (theme: unknown): Palette =>
  (PALETTES as readonly string[]).includes(String(theme)) ? (theme as Palette) : 'classic';
/** Extra Google Fonts a palette needs (loaded only when that palette is active). */
const GEIST = 'https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600;700;800&family=Geist+Mono:wght@400;500;600&display=swap';
export const paletteFonts: Partial<Record<Palette, string>> = { ink: GEIST, forest: GEIST };
export const paletteThemeColor: Record<Palette, string> = { classic: '#07100b', mono: '#000000', ink: '#09090b', forest: '#0a0c0b' };

export type SettingsKey = keyof typeof defaults;
export type Settings = typeof defaults;
export type Content = Settings & { testimonials: d.Testimonial[] };

let cache: { at: number; promise: Promise<Content> } | null = null;
const TTL = import.meta.env.DEV ? 1500 : Infinity;

async function load(): Promise<Content> {
  const url = import.meta.env.PUBLIC_SUPABASE_URL as string | undefined;
  const key = import.meta.env.PUBLIC_SUPABASE_ANON_KEY as string | undefined;
  const base: Content = { ...structuredClone(defaults), testimonials: d.testimonials };
  if (!url || !key) return base;

  try {
    const sb = createClient(url, key, { auth: { persistSession: false } });
    const [settings, testimonials] = await Promise.all([
      sb.from('site_settings').select('key,value'),
      sb.from('testimonials').select('name,role,quote,rating,avatar_url').eq('published', true).order('sort_order'),
    ]);
    if (settings.error) throw settings.error;

    for (const row of settings.data ?? []) {
      const k = row.key as SettingsKey;
      if (k in base && row.value && typeof row.value === 'object') {
        (base as Record<string, unknown>)[k] = { ...base[k], ...(row.value as object) };
      }
    }
    if (!testimonials.error && testimonials.data.length > 0) {
      base.testimonials = testimonials.data.map((t) => ({
        name: t.name,
        role: t.role ?? '',
        quote: t.quote,
        rating: t.rating,
        avatar: t.avatar_url ?? '',
      }));
    }
  } catch (err) {
    // Tables missing or network error: fall back to defaults so the site always builds.
    console.warn('[content] Using defaults:', (err as Error).message);
  }
  return base;
}

export function getContent(): Promise<Content> {
  if (!cache || Date.now() - cache.at > TTL) cache = { at: Date.now(), promise: load() };
  return cache.promise;
}
