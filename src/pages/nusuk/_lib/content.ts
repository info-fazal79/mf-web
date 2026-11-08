/** Default text for the /nusuk info tabs. The admin can override every field (saved in nusuk_settings.content). */
export type NusukContent = {
  title: string;
  subtitle: string;
  tab1_title: string;
  tab1_body: string;
  tab2_title: string;
  tab2_body: string;
  tab3_title: string;
  tab3_body: string;
  submit_rules: string;
  feature_benefit: string;
  feature_guide: string;
  feature_post_url: string;
  disclaimer: string;
};

export const defaultContent: NusukContent = {
  title: 'নুসুক উমরাহ কোড শেয়ার',
  subtitle: 'এক ক্লিকে একটি রেফারেল কোড কপি করুন, নুসুক অ্যাপে বসিয়ে দিন। আপনার কোডও জমা দিন, অন্যরা ব্যবহার করবে।',
  tab1_title: 'নুসুক কী?',
  tab1_body:
    'নুসুক (Nusuk) সৌদি আরবের হজ ও উমরাহ মন্ত্রণালয়ের অফিশিয়াল প্ল্যাটফর্ম। এখান থেকে উমরাহর অনুমতি, রওজা মোবারকে জিয়ারতের সময় বুকিং সহ নানা সেবা পাওয়া যায়।\n\nবর্তমানে নুসুক অ্যাপে একটি উমরাহ প্রতিযোগিতা চলছে। এতে প্রশ্নের সঠিক উত্তর দিয়ে অংশগ্রহণকারীরা উমরাহ জেতার সুযোগ পাচ্ছেন। যত বেশি প্রশ্নের সঠিক উত্তর দেবেন, উমরাহ জেতার সম্ভাবনা তত বাড়বে।\n\nপ্রতিযোগিতার শেষ তারিখ ও বিস্তারিত নিয়ম নুসুক অ্যাপে দেখে নিন।',
  tab2_title: 'অংশগ্রহণের নিয়ম',
  tab2_body:
    '১. Google Play Store বা App Store থেকে অফিশিয়াল "Nusuk" অ্যাপ ইনস্টল করুন।\n২. মোবাইল নম্বর বা ইমেইল দিয়ে অ্যাকাউন্ট খুলে লগইন করুন।\n৩. অ্যাপে চলমান উমরাহ প্রতিযোগিতার পেজে যান এবং প্রশ্নের উত্তর দিন।\n৪. রেফারেল কোড দেওয়ার জায়গায় এই পেজ থেকে কপি করা কোডটি পেস্ট করুন।\n৫. কোড ব্যবহার করলে আপনি একটি নতুন Key (চাবি) পাবেন। সেই Key দিয়ে আরেকটি প্রশ্নের উত্তর দিন।\n৬. আরও Key পেতে আবার এই পেজে এসে নতুন কোড কপি করুন। প্রতিবার Copy চাপলে নতুন কোড আসে।',
  tab3_title: 'কোডের উপকারিতা',
  tab3_body:
    'এখান থেকে একটি কোড কপি করে নুসুক অ্যাপে ব্যবহার করলে আপনি একটি নতুন Key (চাবি) পাবেন।\n\nএই Key দিয়ে আপনি আরেকটি প্রশ্নের উত্তর দেওয়ার সুযোগ পাবেন। সেই উত্তর সঠিক হলে আপনার উমরাহ জেতার সম্ভাবনা আরও বেড়ে যাবে। তাই যত বেশি কোড ব্যবহার করবেন, তত বেশি প্রশ্নের উত্তর দিতে পারবেন।\n\nআপনার নিজের রেফারেল কোড এখানে জমা দিলে অন্যরা সেটি ব্যবহার করবেন। এতে তারা নতুন Key পাবেন, আর প্রতিযোগিতার নিয়ম অনুযায়ী আপনিও উপকৃত হবেন। এভাবে সবাই সবাইকে সাহায্য করি।',
  submit_rules:
    '• শুধু নিজের আসল নুসুক রেফারেল কোড দিন। নুসুকের কোড সাধারণত NG- দিয়ে শুরু হয়, যেমন: NG-y3JkB7lU\n• কোডটি নুসুক অ্যাপ থেকে হুবহু কপি করে পেস্ট করুন, ছোট-বড় হাতের অক্ষর যেন না বদলায়।\n• একই কোড একবারই জমা দেওয়া যায়।\n• যাচাই করে অনুমোদন দেওয়ার পর কোডটি সবার জন্য দেখানো হবে।',
  feature_benefit:
    'ফিচার করা কোড এই পেজে সবার আগে দেখানো হয়। ফলে অনেক বেশি মানুষ আপনার কোডটি ব্যবহার করবেন, আর আপনি অনেক বেশি Key (চাবি) পাবেন।',
  feature_guide:
    '১. প্রথমে আপনার রেফারেল কোডটি এই পেজে জমা দিন (নিচের "কোড জমা দিন" অংশে)।\n২. উপরের বাটন থেকে আমাদের ফেসবুক পোস্টটি খুলে Public করে শেয়ার করুন।\n৩. আপনার শেয়ার করা পোস্টের লিংকটি কপি করুন।\n৪. নিচের ফর্মে আপনার নাম, কোড আর শেয়ারের লিংক দিয়ে আবেদন পাঠান।\n৫. যাচাই করে অনুমোদন দিলে আপনার কোডটি ফিচার করা হবে।',
  feature_post_url: 'https://www.facebook.com/share/p/1DdpbLDgz9/',
  disclaimer:
    'এটি একটি স্বেচ্ছাসেবী কমিউনিটি উদ্যোগ। নুসুক বা সৌদি হজ ও উমরাহ মন্ত্রণালয়ের সাথে এর কোনো অফিশিয়াল সম্পর্ক নেই।',
};

export const contentFields: { key: keyof NusukContent; label: string; long?: boolean }[] = [
  { key: 'title', label: 'Page title' },
  { key: 'subtitle', label: 'Subtitle', long: true },
  { key: 'tab1_title', label: 'Tab 1 title' },
  { key: 'tab1_body', label: 'Tab 1 text', long: true },
  { key: 'tab2_title', label: 'Tab 2 title' },
  { key: 'tab2_body', label: 'Tab 2 text', long: true },
  { key: 'tab3_title', label: 'Tab 3 title' },
  { key: 'tab3_body', label: 'Tab 3 text', long: true },
  { key: 'submit_rules', label: 'Submission rules', long: true },
  { key: 'feature_benefit', label: 'Feature request: benefit text', long: true },
  { key: 'feature_guide', label: 'Feature request: steps', long: true },
  { key: 'feature_post_url', label: 'Feature request: Facebook post link to share' },
  { key: 'disclaimer', label: 'Footer disclaimer', long: true },
];

export const mergeContent = (c: unknown): NusukContent => {
  const out = { ...defaultContent };
  if (c && typeof c === 'object') {
    for (const k of Object.keys(out) as (keyof NusukContent)[]) {
      const v = (c as Record<string, unknown>)[k];
      if (typeof v === 'string' && v.trim()) out[k] = v;
    }
  }
  return out;
};

/** Bangladeshi winners list, stored in nusuk_settings.content.winners and edited from Nusuk Manager → Winners. */
export type Prize = 'umrah' | 'zamzam' | 'other';
export type Winner = { name: string; prize: Prize; prize_text?: string; date?: string; link?: string };
export const prizeLabel: Record<Prize, string> = { umrah: 'উমরাহ', zamzam: 'জমজমের পানি', other: 'পুরস্কার' };
/** Badge text on the public page, matching how Nusuk describes each prize. */
export const prizeLong: Record<Prize, string> = { umrah: '🕋 দুইজনের উমরাহ সফর', zamzam: '💧 ২০ কার্টন জমজমের পানি', other: '🎁 পুরস্কার' };

export const parseWinners = (c: unknown): Winner[] => {
  const list = c && typeof c === 'object' ? (c as Record<string, unknown>).winners : null;
  if (!Array.isArray(list)) return [];
  // Same person + prize + date counts once; keep the entry that has a proof link.
  const byKey = new Map<string, Winner>();
  for (const raw of list) {
    if (!raw || typeof raw !== 'object' || typeof (raw as Winner).name !== 'string' || !(raw as Winner).name.trim()) continue;
    const w = raw as Winner;
    const v: Winner = { ...w, prize: (['umrah', 'zamzam', 'other'] as const).includes(w.prize) ? w.prize : 'other' };
    const key = `${v.name.trim().toLowerCase()}|${v.prize}|${v.date ?? ''}`;
    const prev = byKey.get(key);
    if (!prev || (!prev.link && v.link)) byKey.set(key, v);
  }
  return [...byKey.values()];
};

/** "Today's winner" card, stored in nusuk_settings.content.today_winner and edited from Nusuk Manager → Today's winner. */
export type TodayWinner = { name: string; country: string; prize: Prize; prize_text?: string; date: string; link?: string };

export const parseToday = (c: unknown): TodayWinner | null => {
  const t = c && typeof c === 'object' ? (c as Record<string, unknown>).today_winner : null;
  if (!t || typeof t !== 'object') return null;
  const w = t as TodayWinner;
  if (typeof w.name !== 'string' || !w.name.trim() || typeof w.country !== 'string' || !COUNTRY_CODES.includes(w.country)) return null;
  return { ...w, prize: (['umrah', 'zamzam', 'other'] as const).includes(w.prize) ? w.prize : 'other' };
};

/** ISO 3166-1 alpha-2 codes, most common Nusuk winner countries first. Names come from Intl.DisplayNames. */
const PINNED = 'sa eg pk bd in id my tr ng dz ma jo ae iq ye sd gb us'.split(' ');
const ALL =
  'ad ae af ag ai al am ao ar as at au aw az ba bb bd be bf bg bh bi bj bm bn bo br bs bt bw by bz ca cd cf cg ch ci ck cl cm cn co cr cu cv cw cy cz de dj dk dm do dz ec ee eg eh er es et fi fj fk fm fo fr ga gb gd ge gf gg gh gi gl gm gn gp gq gr gt gu gw gy hk hn hr ht hu id ie il im in iq ir is it je jm jo jp ke kg kh ki km kn kp kr kw ky kz la lb lc li lk lr ls lt lu lv ly ma mc md me mg mh mk ml mm mn mo mq mr ms mt mu mv mw mx my mz na nc ne ng ni nl no np nr nu nz om pa pe pf pg ph pk pl pr ps pt pw py qa re ro rs ru rw sa sb sc sd se sg si sk sl sm sn so sr ss st sv sy sz tc td tg th tj tl tm tn to tr tt tv tw tz ua ug us uy uz va vc ve vg vi vn vu ws xk ye yt za zm zw'.split(' ');
export const COUNTRY_CODES = [...PINNED, ...ALL.filter((c) => !PINNED.includes(c))];
export const PINNED_COUNT = PINNED.length;

const names = new Map<string, Intl.DisplayNames | null>();
export function countryName(code: string, lang: 'en' | 'bn' = 'en') {
  if (!names.has(lang)) { try { names.set(lang, new Intl.DisplayNames([lang], { type: 'region' })); } catch { names.set(lang, null); } }
  try { return names.get(lang)?.of(code.toUpperCase()) ?? code.toUpperCase(); } catch { return code.toUpperCase(); }
}
/** Flag image (works on every OS, unlike flag emoji). */
export const flagUrl = (code: string, w: 40 | 80 | 160 = 80) => `https://flagcdn.com/w${w}/${code}.png`;

/** A Nusuk referral code: always "NG-" followed by exactly 8 letters/digits, e.g. NG-y3JkB7lU. */
export const CODE_RE = /^NG-[A-Za-z0-9]{8}$/;
