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

export const parseWinners = (c: unknown): Winner[] => {
  const list = c && typeof c === 'object' ? (c as Record<string, unknown>).winners : null;
  if (!Array.isArray(list)) return [];
  return list
    .filter((w): w is Winner => !!w && typeof w === 'object' && typeof (w as Winner).name === 'string' && (w as Winner).name.trim() !== '')
    .map((w) => ({ ...w, prize: (['umrah', 'zamzam', 'other'] as const).includes(w.prize) ? w.prize : 'other' }));
};

export const CODE_RE =/^[A-Za-z0-9_-]{3,40}$/;
