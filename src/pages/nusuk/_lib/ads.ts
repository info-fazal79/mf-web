/**
 * Promotional ads on /nusuk (between the info tabs and the submit card).
 * Stored in nusuk_settings.content.ads and managed from Nusuk Manager → Ads.
 * The same adHtml() renders the public page and the admin preview, so they always match.
 */
import { youtubeId } from './content';
import { lucide } from './lucide';

export type AdType = 'app' | 'image' | 'card' | 'text' | 'video' | 'social';
export type Ad = {
  id: string;
  on: boolean;
  type: AdType;
  title?: string;
  text?: string;
  link?: string;
  cta?: string;
  image?: string; // banner / card picture
  icon?: string; // app icon
  rating?: string; // app: e.g. "5.0"
  meta?: string; // app: e.g. "৫০০+ ডাউনলোড · ফ্রি"
  // social: Facebook page (link/cta/reward) + community group (link2/cta2/reward2)
  link2?: string;
  cta2?: string;
  reward?: string; // e.g. "5"
  reward2?: string;
  rewardBoth?: string; // total when they do both, e.g. "15"
  unit?: string; // e.g. "Key"
  start?: string; // YYYY-MM-DD, optional
  end?: string; // YYYY-MM-DD, optional (inclusive)
};
export type Ads = { on: boolean; label: string; interval: number; items: Ad[] };

export const adTypes: { type: AdType; name: string; hint: string }[] = [
  { type: 'app', name: 'App install', hint: 'App icon, name, rating and a download button' },
  { type: 'image', name: 'Image banner', hint: 'A picture (poster/banner) that opens a link' },
  { type: 'card', name: 'Product / offer card', hint: 'Picture + title + text + button' },
  { type: 'text', name: 'Text notice', hint: 'Short message with a button, no picture' },
  { type: 'video', name: 'YouTube video', hint: 'Video thumbnail that opens YouTube' },
  { type: 'social', name: 'Facebook page & group', hint: 'Follow page / join group buttons with rewards' },
];

/** Starting values for a new Facebook page & group ad (all editable). */
export const sampleSocialAd = (): Partial<Ad> => ({
  title: 'ফলো ও জয়েন করে ফ্রি Key নিন!',
  text: 'আমাদের ফেসবুক পেজ ফলো করলে ৫টি Key, কমিউনিটি গ্রুপে যুক্ত হলে ৫টি Key ইনস্ট্যান্ট পাবেন। আর দুটোই করলে একসাথে পাবেন ১৫টি Key!',
  cta: 'পেজ ফলো করুন',
  cta2: 'গ্রুপে জয়েন করুন',
  reward: '5',
  reward2: '5',
  rewardBoth: '15',
  unit: 'Key',
});

export const defaultAds = (): Ads => ({ on: false, label: 'বিজ্ঞাপন', interval: 6, items: [] });

const PLAY_ICON =
  'https://play-lh.googleusercontent.com/8DsJ0vSlUrJOLZObcdgFCio0V9JzPOViwgzECRMWz9ItqVrUh8R6vICWXbu32M1wB01mrnBUVjCioQmCnpQ9dWA=s192-rw';
/** Ready-made sample: the Dua After Salah app (from its Google Play page). */
export const sampleDuaAd = (): Ad => ({
  id: 'dua-after-salah',
  on: true,
  type: 'app',
  title: 'Dua After Salah',
  text: 'সালাত পরবর্তী আমল এবং সকাল-সন্ধ্যার দোয়া ও জিকির এক অ্যাপে। শায়েখ আহমাদুল্লাহর সংকলন অনুযায়ী, বাংলা উচ্চারণ ও অর্থসহ। সাথে নামাজের সময়সূচী আর ডিজিটাল তাসবীহ।',
  icon: PLAY_ICON,
  rating: '5.0',
  meta: '৫০০+ ডাউনলোড · সম্পূর্ণ বিজ্ঞাপনমুক্ত · ফ্রি',
  cta: 'Google Play থেকে ফ্রি ডাউনলোড করুন',
  // referrer lets Play Console show installs that came from this page
  link: 'https://play.google.com/store/apps/details?id=com.muhammadfazal.dua_after_salah&referrer=utm_source%3Dnusuk_page%26utm_medium%3Dad',
});

const str = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const isHttps = (u: string) => /^https:\/\/[^\s"'<>]+$/i.test(u);
const isDate = (d: string) => /^\d{4}-\d{2}-\d{2}$/.test(d);

export function parseAds(c: unknown): Ads {
  const raw = c && typeof c === 'object' ? (c as Record<string, unknown>).ads : null;
  const base = defaultAds();
  if (!raw || typeof raw !== 'object') return base;
  const a = raw as Partial<Ads>;
  const items = Array.isArray(a.items) ? a.items : [];
  return {
    on: a.on === true,
    label: str(a.label, 30) || base.label,
    interval: Math.min(30, Math.max(3, Number(a.interval) || base.interval)),
    items: items
      .filter((x): x is Ad => !!x && typeof x === 'object' && adTypes.some((t) => t.type === (x as Ad).type))
      .map((x, i) => ({
        id: str(x.id, 40) || `ad-${i}`,
        on: x.on !== false,
        type: x.type,
        title: str(x.title, 120),
        text: str(x.text, 600),
        link: isHttps(str(x.link, 1000)) ? str(x.link, 1000) : '',
        cta: str(x.cta, 60),
        image: isHttps(str(x.image, 1000)) ? str(x.image, 1000) : '',
        icon: isHttps(str(x.icon, 1000)) ? str(x.icon, 1000) : '',
        rating: str(x.rating, 6),
        meta: str(x.meta, 120),
        link2: isHttps(str(x.link2, 1000)) ? str(x.link2, 1000) : '',
        cta2: str(x.cta2, 60),
        reward: str(x.reward, 8),
        reward2: str(x.reward2, 8),
        rewardBoth: str(x.rewardBoth, 8),
        unit: str(x.unit, 20),
        start: isDate(str(x.start, 10)) ? str(x.start, 10) : '',
        end: isDate(str(x.end, 10)) ? str(x.end, 10) : '',
      })),
  };
}

const today = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Dhaka' }); // YYYY-MM-DD in Bangladesh

/** Is this ad complete enough to show? (Returns what is missing, or '' when ready.) */
export function adMissing(ad: Ad): string {
  if (ad.type === 'image') return ad.image ? '' : 'picture';
  if (ad.type === 'video') return ad.link && youtubeId(ad.link) ? '' : 'YouTube link';
  if (ad.type === 'social') return ad.link || ad.link2 ? '' : 'page or group link';
  if (!ad.title) return 'title';
  if (ad.type === 'app' && !ad.link) return 'app link';
  return '';
}

/** Ads that should be on the page right now: switched on, complete, and inside their dates. */
export function liveAds(ads: Ads, d = today()): Ad[] {
  return ads.items.filter((a) => a.on && !adMissing(a) && (!a.start || a.start <= d) && (!a.end || a.end >= d));
}

const esc = (t = '') => t.replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]!);
const bnNum = (t: string) => t.replace(/\d/g, (x) => '০১২৩৪৫৬৭৮৯'[+x]);
const wrap = (ad: Ad, cls: string, inner: string) =>
  ad.link
    ? `<a href="${esc(ad.link)}" target="_blank" rel="noopener sponsored" class="${cls}" data-ad="${esc(ad.id)}">${inner}</a>`
    : `<div class="${cls}">${inner}</div>`;
const arrow = lucide('arrowRight', 'h-4 w-4', 2.4);
const fbLogo = '<svg viewBox="0 0 24 24" class="h-5 w-5" fill="currentColor" aria-hidden="true"><path d="M14 8.5V6.8c0-.8.5-1 .9-1H17V2.1L14.1 2C10.9 2 10.2 4.4 10.2 6v2.5H8V12h2.2v10H14V12h2.7l.4-3.5z"/></svg>';
const fbGroup = lucide('users', 'h-5 w-5');
const playBadge = '<svg viewBox="0 0 24 24" class="h-5 w-5" aria-hidden="true"><path fill="#00d7fe" d="M3.6 1.8 13.4 12 3.6 22.2c-.4-.2-.6-.7-.6-1.2V3c0-.5.2-1 .6-1.2z"/><path fill="#ffce00" d="m16.8 8.6-3.4 3.4 3.4 3.4 3.9-2.2c.8-.5.8-1.7 0-2.2z"/><path fill="#ff3a44" d="M13.4 12 3.6 22.2c.4.2.9.2 1.4-.1l11.8-6.7z"/><path fill="#00f076" d="M3.6 1.8c.5-.3 1-.3 1.4-.1l11.8 6.9-3.4 3.4z"/></svg>';

/** The markup of one ad (Tailwind classes; all text is escaped). */
export function adHtml(ad: Ad): string {
  const title = esc(ad.title);
  const text = esc(ad.text).replace(/\n/g, '<br>');
  const cta = esc(ad.cta);
  switch (ad.type) {
    case 'app':
      return wrap(ad, 'nk-ad nk-ad-app block rounded-2xl p-4 text-white sm:p-5', `
        <div class="flex items-center gap-3.5">
          ${ad.icon ? `<img src="${esc(ad.icon)}" alt="" width="64" height="64" loading="lazy" referrerpolicy="no-referrer" class="h-16 w-16 shrink-0 rounded-2xl bg-white shadow-lg ring-1 ring-white/30">` : ''}
          <div class="min-w-0 flex-1">
            <div class="truncate text-lg font-bold leading-tight">${title}</div>
            <div class="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-emerald-50/85">
              ${ad.rating ? `<span class="font-bold text-gold-100">★ ${esc(bnNum(ad.rating))}</span>` : ''}
              ${ad.meta ? `<span>${esc(ad.meta)}</span>` : ''}
            </div>
          </div>
        </div>
        ${text ? `<p class="mt-3 text-sm leading-relaxed text-emerald-50/90">${text}</p>` : ''}
        ${ad.link ? `<span class="mt-3.5 flex w-full items-center justify-center gap-2 rounded-xl bg-white py-2.5 text-[15px] font-bold text-emerald-950 shadow">${playBadge}${cta || 'ডাউনলোড করুন'}</span>` : ''}`);
    case 'image':
      return wrap(ad, 'nk-ad block overflow-hidden rounded-2xl', `<img src="${esc(ad.image)}" alt="${title}" loading="lazy" referrerpolicy="no-referrer" class="block h-auto w-full">`);
    case 'card':
      return wrap(ad, 'nk-ad flex flex-col overflow-hidden rounded-2xl border border-[#e7e1cf] bg-cream sm:flex-row', `
        ${ad.image ? `<img src="${esc(ad.image)}" alt="" loading="lazy" referrerpolicy="no-referrer" class="aspect-video w-full object-cover sm:aspect-square sm:w-40 sm:shrink-0">` : ''}
        <div class="flex flex-1 flex-col p-4">
          <div class="text-[17px] font-bold leading-snug text-emerald-950">${title}</div>
          ${text ? `<p class="mt-1.5 text-sm leading-relaxed text-emerald-900/80">${text}</p>` : ''}
          ${ad.link ? `<span class="nk-btn nk-gold mt-3 self-start px-4 py-2 text-sm">${cta || 'বিস্তারিত দেখুন'} ${arrow}</span>` : ''}
        </div>`);
    case 'text':
      return wrap(ad, 'nk-ad nk-ad-text block rounded-2xl p-4 sm:p-5', `
        <div class="text-[17px] font-bold leading-snug text-emerald-950">${title}</div>
        ${text ? `<p class="mt-1.5 text-sm leading-relaxed text-emerald-950/80">${text}</p>` : ''}
        ${ad.link ? `<span class="mt-3 inline-flex items-center gap-1.5 text-sm font-bold text-emerald-800">${cta || 'বিস্তারিত দেখুন'} ${arrow}</span>` : ''}`);
    case 'social': {
      const unit = esc(ad.unit || 'Key');
      const row = (link: string | undefined, label: string, sub: string, reward: string | undefined, cta: string, group: boolean) =>
        link
          ? `<a href="${esc(link)}" target="_blank" rel="noopener" data-ad="${esc(ad.id)}" class="flex items-center gap-3 rounded-xl bg-white/95 p-2.5 pr-3 text-emerald-950 shadow-sm transition hover:bg-white">
              <span class="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[#1877f2] text-white">${group ? fbGroup : fbLogo}</span>
              <span class="min-w-0 flex-1">
                <span class="block text-sm font-bold leading-tight">${label}</span>
                ${reward ? `<span class="mt-1 inline-block rounded-full bg-gold-100 px-2 py-0.5 text-xs font-bold whitespace-nowrap text-emerald-950 ring-1 ring-gold-500/50">+${esc(bnNum(reward))} ${unit}</span>` : `<span class="block text-xs text-emerald-900/65">${sub}</span>`}
              </span>
              <span class="shrink-0 rounded-lg bg-[#1877f2] px-3 py-2 text-xs font-bold whitespace-nowrap text-white">${esc(cta)}</span>
            </a>`
          : '';
      const both = ad.link && ad.link2 && ad.rewardBoth;
      return `<div class="nk-ad nk-ad-social rounded-2xl p-4 text-white sm:p-5">
        ${ad.icon ? `<img src="${esc(ad.icon)}" alt="" width="48" height="48" loading="lazy" referrerpolicy="no-referrer" class="float-right ml-3 h-12 w-12 rounded-full bg-white object-cover ring-2 ring-white/40">` : ''}
        ${title ? `<div class="text-lg font-bold leading-tight">${title}</div>` : ''}
        ${text ? `<p class="mt-1.5 text-sm leading-relaxed text-white/90">${text}</p>` : ''}
        <div class="clear-both mt-3.5 grid gap-2">
          ${row(ad.link, 'ফেসবুক পেজ', 'ফলো করুন', ad.reward, ad.cta || 'ফলো করুন', false)}
          ${row(ad.link2, 'কমিউনিটি গ্রুপ', 'জয়েন করুন', ad.reward2, ad.cta2 || 'জয়েন করুন', true)}
        </div>
        ${both ? `<div class="mt-3 rounded-xl bg-gold-100 px-3 py-2 text-center text-sm font-bold text-emerald-950">🎁 দুটোই করলে একসাথে <span class="text-base">${esc(bnNum(ad.rewardBoth!))} ${unit}</span></div>` : ''}
      </div>`;
    }
    case 'video': {
      const id = youtubeId(ad.link ?? '') ?? '';
      return wrap(ad, 'nk-ad block overflow-hidden rounded-2xl bg-emerald-950 text-white', `
        <span class="relative block aspect-video">
          <img src="https://i.ytimg.com/vi/${id}/hqdefault.jpg" alt="" loading="lazy" referrerpolicy="no-referrer" class="h-full w-full object-cover opacity-90">
          <span class="absolute inset-0 grid place-items-center"><span class="grid h-12 w-16 place-items-center rounded-2xl bg-[#ff0000] shadow-lg"><svg viewBox="0 0 24 24" class="h-6 w-6" fill="#fff" aria-hidden="true"><path d="M8 5v14l11-7z"/></svg></span></span>
        </span>
        ${title || text ? `<span class="block p-3.5"><span class="block font-bold leading-snug">${title}</span>${text ? `<span class="mt-0.5 block text-xs text-white/75">${text}</span>` : ''}</span>` : ''}`);
    }
  }
}
