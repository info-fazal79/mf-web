/**
 * Ribat Reward Club: members sign in with Google, collect tickets for the Ribat prize draw
 * (update_31_reward_club.sql). Settings: nusuk_settings.content.club (Nusuk Manager → Reward Club).
 *
 * Members use their own Supabase client with a separate storage key, so a member signing in
 * never signs the admin out in the same browser (and the other way round).
 */
import type { SupabaseClient } from '@supabase/supabase-js';

export const SITE_LINK = 'https://muhammadfazal.com/nusuk';
export const CODE_RE = /^NG-[A-Za-z0-9]{8}$/;
export const MEMBER_KEY = 'nusuk-member-auth';
export const REF_KEY = 'nusuk:ref';

export type ClubCfg = {
  on: boolean; // open for everyone (from the server: open for the person asking)
  test: boolean; // test mode: open only for the emails in `testers`
  testers: string[]; // admin only, never sent to visitors
  public?: boolean; // from the server: open for everyone
  copy_from: string; // "HH:MM" Bangladesh time
  copy_to: string;
  title: string;
  rules: string;
  caption: string;
  card_line: string;
  notice_on: boolean; // Reward Club bar at the top of /nusuk
  notice_text: string;
  notice_btn: string;
};

export const DEFAULT_TITLE = 'রিবাত রিওয়ার্ড ক্লাব';
export const DEFAULT_NOTICE = 'অ্যাকাউন্টে লগইন করে প্রোফাইল সম্পূর্ণ করলেই ফ্রিতে পাবেন ৫০টি Nusuk Key!';
export const DEFAULT_NOTICE_BTN = 'লগইন করুন';
export const DEFAULT_CARD_LINE = 'এই কোড দিয়ে যুক্ত হলে আপনিও পাবেন ১টি বাড়তি টিকিট';
export const DEFAULT_RULES = [
  'Google দিয়ে লগইন করে প্রোফাইল পূরণ করলেই ১টি টিকিট।',
  'কারো রেফারেল কোড দিয়ে যুক্ত হলে আপনি পাবেন ১টি বাড়তি টিকিট, আর কোডের মালিক পাবেন ১টি।',
  'আপনার কোড দিয়ে যতজন যুক্ত হবেন, ততটি টিকিট আপনার।',
  'নির্দিষ্ট সময়ের মধ্যে নুসুক কোড কপি করলে দিনে ১টি টিকিট (যত কোডই কপি করুন, টিকিট ১টি)।',
  'যত বেশি টিকিট, লাকি ড্রতে তত বেশি সুযোগ। বিজয়ী নির্ধারণ হবে লটারিতে।',
  'অংশগ্রহণ সম্পূর্ণ ফ্রি। পুরস্কার দিচ্ছে রিবাত।',
  'একই মোবাইল নম্বর বা একই ডিভাইস দিয়ে একাধিক অ্যাকাউন্টে রেফারেল টিকিট গোনা হবে না।',
].join('\n');
export const DEFAULT_CAPTION = [
  '🕋 নুসুক উমরাহ প্রতিযোগিতা · রিবাত উপহার লাকি ড্র',
  '',
  '✅ হাজারো নুসুক রেফারেল কোড এক জায়গায়। কপি করুন, উমরাহ জেতার সুযোগ বাড়ান।',
  '🎁 সাথে রিবাতের ইসলামিক পণ্য জেতার লাকি ড্র!',
  '',
  '👉 আমার কোড দিয়ে যুক্ত হলে আপনিও পাবেন ১টি বাড়তি টিকিট:',
  '🔑 {code}',
  '',
  '🔗 {link}',
  'Google দিয়ে লগইন করে প্রোফাইলের "রেফারেল কোড" ঘরে {code} লিখুন।',
  '',
  '#Nusuk #NusukUmrah #উমরাহ #RibatulUmmah #রিবাত',
].join('\n');

const isTime = (t: unknown): t is string => typeof t === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(t);

export function parseClub(raw: unknown): ClubCfg {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const s = (k: string, max: number) => (typeof r[k] === 'string' ? (r[k] as string).slice(0, max) : '');
  return {
    on: r.on === true,
    test: r.test === true,
    testers: Array.isArray(r.testers) ? (r.testers as unknown[]).filter((x): x is string => typeof x === 'string' && x.includes('@')).slice(0, 50) : [],
    copy_from: isTime(r.copy_from) ? r.copy_from : '09:00',
    copy_to: isTime(r.copy_to) ? r.copy_to : '17:00',
    title: s('title', 80),
    rules: s('rules', 3000),
    caption: s('caption', 3000),
    card_line: s('card_line', 120),
    notice_on: r.notice_on !== false,
    notice_text: s('notice_text', 200),
    notice_btn: s('notice_btn', 30),
  };
}

/** Club settings out of the whole nusuk_settings.content */
export const clubOf = (content: unknown) => parseClub(content && typeof content === 'object' ? (content as Record<string, unknown>).club : null);

export type Member = { sl: number; name: string; phone: string; email: string | null; nusuk_code: string; district: string | null; umrah_done: 'yes' | 'no' | 'planning' | null; consent: boolean; referred_by: string | null; joined: string };
export type TicketKind = 'join' | 'enter' | 'ref_bonus' | 'referral' | 'copy';
export type TicketRow = { kind: TicketKind; qty: number; day: string; at: string; from: string | null; contest: string };

// ---------- competitions (table nusuk_club_contests, update_33) ----------
export type ContestKind = 'lucky' | 'window' | 'top';
export const CONTEST_KINDS: { key: ContestKind; name: string; hint: string }[] = [
  { key: 'lucky', name: 'Lucky draw', hint: 'Tickets → lucky draw. More tickets, more chance.' },
  { key: 'window', name: 'Limited-time offer', hint: 'Only what happens between the start and end time counts.' },
  { key: 'top', name: 'Top referrers', hint: 'Leaderboard by people brought in; the top members win (no lottery).' },
];
export type ContestCard = { theme?: 'green' | 'gold' | 'night'; headline?: string; sub?: string; line?: string };
export type Contest = {
  id: number;
  title: string;
  kind: ContestKind;
  active?: boolean;
  starts_at: string | null;
  ends_at: string | null;
  t_join: number; t_enter: number; t_ref_bonus: number; t_referral: number; t_copy: number;
  copy_from: string; copy_to: string;
  info: string;
  card: ContestCard;
  caption: string;
  prizes?: { place: number; prize: string }[];
  sort?: number;
  in_window?: boolean;
  my?: { total: number; today: number; referrals: number; copied_today: boolean; rank: number | null } | null;
  top?: { name: string; sl: number; refs: number }[] | null;
};

export type ClubMe = {
  cfg: ClubCfg;
  signed_in: boolean;
  email?: string;
  today?: string;
  member: Member | null;
  contests: Contest[];
  history?: TicketRow[];
  /** latest Nusuk Key gift to this member's code (update_36) */
  keys?: { keys: number; hours: number | null; at: string; delivered: number; ends: string | null } | null;
};
export type SaveResult = { ok: boolean; created?: boolean; ref_counted?: boolean; reason?: 'signin' | 'name' | 'phone' | 'phone_taken' | 'closed' | 'code' | 'code_taken' | 'bad_ref' | 'self_ref' | 'busy' };

export const SAVE_ERR: Record<NonNullable<SaveResult['reason']>, string> = {
  signin: 'আবার লগইন করুন।',
  name: 'নাম ২ থেকে ৬০ অক্ষরের মধ্যে লিখুন।',
  phone: 'সঠিক মোবাইল নম্বর দিন, যেমন: 01712345678',
  phone_taken: 'এই মোবাইল নম্বর দিয়ে আগেই একটি অ্যাকাউন্ট খোলা হয়েছে।',
  closed: 'নতুন অ্যাকাউন্ট খোলা এখন বন্ধ আছে। একটু পরে আবার চেষ্টা করুন।',
  code: 'নুসুক কোড সঠিক নয়। নুসুক অ্যাপ থেকে হুবহু কপি করে দিন, যেমন: NG-y3JkB7lU',
  code_taken: 'এই নুসুক কোড দিয়ে আগেই একটি অ্যাকাউন্ট খোলা হয়েছে।',
  bad_ref: 'এই রেফারেল কোডের কোনো সদস্য পাওয়া যায়নি। কোডটি আবার দেখুন, অথবা ঘরটি খালি রাখুন।',
  self_ref: 'নিজের কোড রেফারেল হিসেবে দেওয়া যাবে না।',
  busy: 'একটু পরে আবার চেষ্টা করুন।',
};

export const KIND_LABEL: Record<TicketKind, string> = {
  join: 'অ্যাকাউন্ট খোলার টিকিট',
  enter: 'প্রতিযোগিতায় যোগদানের টিকিট',
  ref_bonus: 'রেফারেল কোড দিয়ে যুক্ত হওয়ার বাড়তি টিকিট',
  referral: 'আপনার কোড দিয়ে নতুন সদস্য',
  copy: 'কোড কপির টিকিট',
};

const tk = (n: number) => `${bn(n)}টি টিকিট`;
/** Rules written out from a competition's numbers, so the page always matches the settings */
export function contestRules(c: Pick<Contest, 'kind' | 't_join' | 't_enter' | 't_ref_bonus' | 't_referral' | 't_copy' | 'copy_from' | 'copy_to' | 'starts_at' | 'ends_at'>) {
  const out: string[] = [];
  if (c.t_join) out.push(`এই প্রতিযোগিতা চলাকালে নতুন অ্যাকাউন্ট খুলে প্রোফাইল পূরণ করলে ${tk(c.t_join)}।`);
  if (c.t_enter) out.push(`প্রতিযোগিতা চলাকালে লগইন করলেই (পুরোনো সদস্যরাও) একবার ${tk(c.t_enter)}।`);
  if (c.t_ref_bonus) out.push(`কারো রেফারেল কোড দিয়ে যুক্ত হলে আপনি পাবেন বাড়তি ${tk(c.t_ref_bonus)}।`);
  if (c.t_referral) out.push(c.kind === 'top'
    ? 'আপনার কোড দিয়ে যতজন নতুন সদস্য যুক্ত হবেন, লিডারবোর্ডে আপনার সংখ্যা তত বাড়বে।'
    : `আপনার কোড দিয়ে প্রতিজন নতুন সদস্য যুক্ত হলে আপনি পাবেন ${tk(c.t_referral)}।`);
  if (c.t_copy) out.push(`প্রতিদিন ${bnTime(c.copy_from)} – ${bnTime(c.copy_to)}-এর মধ্যে নুসুক কোড কপি করলে দিনে ${tk(c.t_copy)} (যত কোডই কপি করুন)।`);
  if (c.starts_at || c.ends_at) out.push(`সময়: ${c.starts_at ? bnDate(c.starts_at) : 'এখন'} থেকে ${c.ends_at ? bnDate(c.ends_at) : 'পরবর্তী ঘোষণা'} পর্যন্ত (বাংলাদেশ সময়)।`);
  out.push(c.kind === 'top'
    ? 'সময় শেষে লিডারবোর্ডের শীর্ষ সদস্যরা পুরস্কার পাবেন।'
    : 'যত বেশি টিকিট, লাকি ড্রতে তত বেশি সুযোগ। বিজয়ী নির্ধারণ হবে লটারিতে।');
  out.push('অংশগ্রহণ সম্পূর্ণ ফ্রি। একই মোবাইল নম্বর বা একই ডিভাইস দিয়ে একাধিক অ্যাকাউন্টে রেফারেল গোনা হবে না।');
  return out;
}

/** "২০ নভেম্বর, রাত ১১:৫৯" in Bangladesh time */
export function bnDate(iso: string) {
  const d = new Date(iso);
  const day = d.toLocaleDateString('bn-BD', { day: 'numeric', month: 'long', timeZone: 'Asia/Dhaka' });
  const hm = d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Dhaka' });
  return `${day}, ${bnTime(hm)}`;
}

/** Default caption per competition type */
export const CONTEST_CAPTIONS: Record<ContestKind, string> = {
  lucky: [
    '🕋 নুসুক উমরাহ প্রতিযোগিতা · রিবাত উপহার লাকি ড্র',
    '',
    '✅ হাজারো নুসুক রেফারেল কোড এক জায়গায়। কপি করুন, উমরাহ জেতার সুযোগ বাড়ান।',
    '🎁 সাথে রিবাতের ইসলামিক পণ্য জেতার লাকি ড্র!',
    '',
    '👉 আমার কোড দিয়ে যুক্ত হলে আপনিও পাবেন বাড়তি টিকিট:',
    '🔑 {code}',
    '',
    '🔗 {link}',
    'Google দিয়ে লগইন করে প্রোফাইলের "রেফারেল কোড" ঘরে {code} লিখুন।',
    '',
    '#Nusuk #NusukUmrah #উমরাহ #RibatulUmmah #রিবাত',
  ].join('\n'),
  window: [
    '⏰ সীমিত সময়ের অফার! · রিবাত উপহার',
    '',
    '{ends}',
    'এই সময়ের মধ্যে আমার কোড দিয়ে যুক্ত হলে আপনিও পাবেন বাড়তি টিকিট, আর জিততে পারেন রিবাতের ইসলামিক পণ্য।',
    '',
    '🔑 আমার রেফারেল কোড: {code}',
    '🔗 {link}',
    '',
    'সাথে পাবেন হাজারো নুসুক কোড, উমরাহ জেতার সুযোগ বাড়ান। সম্পূর্ণ ফ্রি!',
    '',
    '#Nusuk #NusukUmrah #উমরাহ #RibatulUmmah',
  ].join('\n'),
  top: [
    '🏆 সেরা রেফারার প্রতিযোগিতা · রিবাত উপহার',
    '',
    'আমাকে সাহায্য করুন! আমার কোড দিয়ে যুক্ত হলে আমি লিডারবোর্ডে এগিয়ে যাব, আর আপনিও পাবেন হাজারো নুসুক কোড ও রিবাতের পুরস্কার জেতার সুযোগ।',
    '',
    '🔑 আমার রেফারেল কোড: {code}',
    '🔗 {link}',
    'Google দিয়ে লগইন করে "রেফারেল কোড" ঘরে {code} লিখুন।',
    '{ends}',
    '',
    '#Nusuk #NusukUmrah #উমরাহ #RibatulUmmah',
  ].join('\n'),
};

/** Fill the caption template: {code} {name} {sl} {link} {ends} */
export function fillCaption(tpl: string, m: Pick<Member, 'nusuk_code' | 'name' | 'sl'>, contest?: Pick<Contest, 'kind' | 'ends_at'>) {
  const base = tpl.trim() || (contest ? CONTEST_CAPTIONS[contest.kind] : DEFAULT_CAPTION);
  return base
    .replaceAll('{code}', m.nusuk_code)
    .replaceAll('{name}', m.name)
    .replaceAll('{sl}', String(m.sl))
    .replaceAll('{link}', SITE_LINK)
    .replaceAll('{ends}', contest?.ends_at ? `⏳ শেষ: ${bnDate(contest.ends_at)}` : '')
    .replace(/\n{3,}/g, '\n\n');
}

/** Personal link inside the QR code: opens /nusuk with the referral code filled in */
export const refLink = (code: string) => `${SITE_LINK}?ref=${encodeURIComponent(code)}`;

/** 24h "HH:MM" → Bengali 12h text, e.g. "সকাল ৯:০০" */
export function bnTime(hhmm: string) {
  const h = Number(hhmm.slice(0, 2));
  const m = hhmm.slice(3, 5);
  const part = h < 4 ? 'রাত' : h < 12 ? 'সকাল' : h < 15 ? 'দুপুর' : h < 18 ? 'বিকাল' : h < 20 ? 'সন্ধ্যা' : 'রাত';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${part} ${bn(h12)}:${bn(m)}`;
}
export const bn = (n: number | string) => String(n).replace(/\d/g, (d) => '০১২৩৪৫৬৭৮৯'[Number(d)]);

// ---------- referral code remembered from ?ref= ----------
export function rememberRef(search = typeof location !== 'undefined' ? location.search : '') {
  const r = new URLSearchParams(search).get('ref')?.trim();
  if (r && CODE_RE.test(r)) try { localStorage.setItem(REF_KEY, r); } catch {}
}
export function savedRef() {
  try { const r = localStorage.getItem(REF_KEY) ?? ''; return CODE_RE.test(r) ? r : ''; } catch { return ''; }
}

// ---------- member Supabase client (loaded only when needed) ----------
let client: Promise<SupabaseClient | null> | null = null;
export function memberClient() {
  client ??= (async () => {
    const url = import.meta.env.PUBLIC_SUPABASE_URL as string | undefined;
    const key = import.meta.env.PUBLIC_SUPABASE_ANON_KEY as string | undefined;
    if (!url || !key) return null;
    const { createClient } = await import('@supabase/supabase-js');
    return createClient(url, key, { auth: { storageKey: MEMBER_KEY, persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: 'pkce' } });
  })();
  return client;
}

/** True when this browser has a member session saved (cheap check, no network, no supabase-js). */
const JOINED_KEY = 'nusuk:member:joined';
/** Remember on this browser that the signed-in person has a finished account (set by the account page). */
export function markJoined(joined: boolean) {
  try { if (joined) localStorage.setItem(JOINED_KEY, '1'); else localStorage.removeItem(JOINED_KEY); } catch {}
}
/** Signed in here AND already made their account (profile saved). */
export function isJoinedMember() {
  try { return hasMemberSession() && localStorage.getItem(JOINED_KEY) === '1'; } catch { return false; }
}

export function hasMemberSession() {
  try { return Boolean(localStorage.getItem(MEMBER_KEY)); } catch { return false; }
}

/** Access token of the signed-in member (refreshed if needed), or null. */
export async function memberToken() {
  if (!hasMemberSession()) return null;
  const sb = await memberClient();
  if (!sb) return null;
  const { data } = await sb.auth.getSession();
  return data.session?.access_token ?? null;
}
