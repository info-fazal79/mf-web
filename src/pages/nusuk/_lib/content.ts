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
    'নুসুক (Nusuk) সৌদি আরবের হজ ও উমরাহ মন্ত্রণালয়ের অফিশিয়াল প্ল্যাটফর্ম। এখান থেকে উমরাহর অনুমতি, রওজা মোবারকে জিয়ারতের সময় বুকিং সহ নানা সেবা পাওয়া যায়।\n\nমাঝে মাঝে নুসুক অ্যাপে উমরাহ প্রতিযোগিতা হয়। সেখানে অংশগ্রহণকারীরা নিজের রেফারেল কোড শেয়ার করে পয়েন্ট বা সুযোগ বাড়াতে পারেন। প্রতিযোগিতার সঠিক নিয়ম ও পুরস্কার নুসুক অ্যাপে দেখে নিন।',
  tab2_title: 'অ্যাপ ইনস্টল ও অংশগ্রহণ',
  tab2_body:
    '১. Google Play Store বা App Store থেকে অফিশিয়াল "Nusuk" অ্যাপ ইনস্টল করুন।\n২. মোবাইল নম্বর বা ইমেইল দিয়ে অ্যাকাউন্ট খুলুন।\n৩. অ্যাপে চলমান উমরাহ প্রতিযোগিতার পেজ খুলুন।\n৪. রেফারেল কোড চাইলে এই পেজ থেকে একটি কোড কপি করে সেখানে পেস্ট করুন।\n৫. প্রতিযোগিতার বাকি ধাপ অ্যাপের নির্দেশনা অনুযায়ী শেষ করুন।',
  tab3_title: 'কোড শেয়ারের উপকারিতা',
  tab3_body:
    'রেফারেল কোড হলো প্রত্যেক অংশগ্রহণকারীর নিজস্ব কোড। অন্য কেউ আপনার কোড ব্যবহার করে যোগ দিলে প্রতিযোগিতার নিয়ম অনুযায়ী আপনি সুবিধা পেতে পারেন।\n\nএখানে কোড জমা দিলে অনেক মানুষ আপনার কোড দেখতে পাবেন। আর আপনি অন্যের কোড ব্যবহার করলে তারাও উপকৃত হন। এভাবে সবাই সবাইকে সাহায্য করি।',
  submit_rules:
    '• শুধু নিজের আসল নুসুক রেফারেল কোড দিন।\n• কোডে শুধু ইংরেজি অক্ষর, সংখ্যা, - বা _ থাকতে পারে (৩–৪০ অক্ষর)।\n• একই কোড একবারই জমা দেওয়া যায়।\n• অ্যাডমিন যাচাই করে অনুমোদন দিলে কোডটি সবার জন্য দেখানো হবে।',
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

export const CODE_RE = /^[A-Za-z0-9_-]{3,40}$/;
