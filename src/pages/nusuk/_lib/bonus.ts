/**
 * Bonus popup: shown right after someone sends a feature request.
 * It invites them to follow the Facebook page and join the community group
 * for extra Keys (extra copies of their code when the request is approved).
 * Stored in nusuk_settings.content.bonus and edited in Nusuk Manager → Bonus popup.
 */
export type Bonus = {
  on: boolean;
  title: string;
  text: string;
  page_url: string;
  group_url: string;
  /** Extra copies added on approval. Shown to visitors only when show_numbers is on. */
  page_keys: number;
  group_keys: number;
  both_keys: number;
  show_numbers: boolean;
};

export const defaultBonus = (): Bonus => ({
  on: true,
  title: 'উমরাহর পথে আমরা একসাথে 🤍',
  text:
    'নুসুক কোড, উমরাহ প্রতিযোগিতার সর্বশেষ আপডেট আর জরুরি তথ্য আমরা নিয়মিত আমাদের ফেসবুক পেজ ও কমিউনিটি গ্রুপে শেয়ার করি। সেখানে সবাই একে অপরকে সাহায্য করছেন, যাতে কেউ কোনো সুযোগ হারিয়ে না ফেলেন।\n\nনিচের দুটি কাজ করলে আপনার কোডটি আরও বেশি মানুষের কাছে পৌঁছে দেওয়া হবে, অর্থাৎ আপনি পাবেন বাড়তি Key, ইনশাআল্লাহ।',
  page_url: '',
  group_url: '',
  page_keys: 5,
  group_keys: 5,
  both_keys: 15,
  show_numbers: false,
});

const str = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const int = (v: unknown, d: number) => {
  const n = Math.round(Number(v));
  return Number.isFinite(n) && n >= 0 && n <= 1000 && v !== '' && v !== null ? n : d;
};
export const isFbUrl = (u: string) => /^https:\/\/([a-z0-9-]+\.)*(facebook\.com|fb\.com|fb\.me)(\/|$)/i.test(u);

export function parseBonus(c: unknown): Bonus {
  const base = defaultBonus();
  const raw = c && typeof c === 'object' ? (c as Record<string, unknown>).bonus : null;
  if (!raw || typeof raw !== 'object') return base;
  const b = raw as Record<string, unknown>;
  const url = (v: unknown) => (isFbUrl(str(v, 600)) ? str(v, 600) : '');
  return {
    on: b.on !== false,
    title: str(b.title, 120) || base.title,
    text: str(b.text, 1000) || base.text,
    page_url: url(b.page_url),
    group_url: url(b.group_url),
    page_keys: int(b.page_keys, base.page_keys),
    group_keys: int(b.group_keys, base.group_keys),
    both_keys: int(b.both_keys, base.both_keys),
    show_numbers: b.show_numbers === true,
  };
}

/** Will the popup show at all? (switched on and at least one link) */
export const bonusReady = (b: Bonus) => b.on && !!(b.page_url || b.group_url);

/** Extra copies for what the visitor said they did. */
export const bonusFor = (b: Bonus, page?: boolean, group?: boolean) =>
  page && group ? b.both_keys : page ? b.page_keys : group ? b.group_keys : 0;
