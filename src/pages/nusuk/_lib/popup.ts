/**
 * Popup notice: shows when someone opens /nusuk (e.g. "share your code in our
 * group within 20 minutes and get 10 Keys instantly"), with an optional live
 * deadline. Stored in nusuk_settings.content.popup, edited in Nusuk Manager → Popup notice.
 */
export type Popup = {
  on: boolean;
  title: string;
  text: string;
  button: string;
  /** Where the button goes. Empty = the community group link (Community & bonus). */
  link: string;
  /** Deadline (ISO). After it passes the popup stops showing. Empty = no time limit. */
  until?: string;
  /** After someone closes it: show again on their next visit, or never again for this offer. */
  again: 'visit' | 'once';
};

export const defaultPopup = (): Popup => ({
  on: false,
  title: '🎁 ইনস্ট্যান্ট ১০টি Key পাওয়ার সুযোগ!',
  text: 'আমাদের কমিউনিটি গ্রুপে যুক্ত হয়ে আপনার নুসুক রেফারেল কোডটি শেয়ার করুন। গ্রুপে কোড শেয়ার করলেই ইনস্ট্যান্ট ১০টি Key পেয়ে যাবেন, ইনশাআল্লাহ!',
  button: 'গ্রুপে গিয়ে কোড শেয়ার করুন',
  link: '',
  again: 'visit',
});

const str = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

export function parsePopup(c: unknown): Popup {
  const base = defaultPopup();
  const raw = c && typeof c === 'object' ? (c as Record<string, unknown>).popup : null;
  if (!raw || typeof raw !== 'object') return base;
  const p = raw as Record<string, unknown>;
  const link = str(p.link, 600);
  const until = typeof p.until === 'string' && !Number.isNaN(Date.parse(p.until)) ? p.until : undefined;
  return {
    on: p.on === true,
    title: str(p.title, 120) || base.title,
    text: str(p.text, 800) || base.text,
    button: str(p.button, 60) || base.button,
    link: /^https:\/\//i.test(link) ? link : '',
    until,
    again: p.again === 'once' ? 'once' : 'visit',
  };
}

/** Is the offer still running? */
export const popupRunning = (p: Popup, now = Date.now()) => p.on && (!p.until || Date.parse(p.until) > now);
