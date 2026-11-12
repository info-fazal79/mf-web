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
export type TicketRow = { kind: 'join' | 'ref_bonus' | 'referral' | 'copy'; day: string; at: string; from: string | null };
export type ClubMe = {
  cfg: ClubCfg;
  signed_in: boolean;
  in_window: boolean;
  email?: string;
  today?: string;
  member: Member | null;
  tickets?: { total: number; today: number; referrals: number; referrals_today: number; copied_today: boolean };
  history?: TicketRow[];
};
export type SaveResult = { ok: boolean; created?: boolean; ref_counted?: boolean; reason?: 'signin' | 'name' | 'phone' | 'phone_taken' | 'closed' | 'code' | 'code_taken' | 'bad_ref' | 'self_ref' | 'busy' };

export const SAVE_ERR: Record<NonNullable<SaveResult['reason']>, string> = {
  signin: 'আবার লগইন করুন।',
  name: 'নাম ২ থেকে ৬০ অক্ষরের মধ্যে লিখুন।',
  phone: 'সঠিক মোবাইল নম্বর দিন, যেমন: 01712345678',
  phone_taken: 'এই মোবাইল নম্বর দিয়ে আগেই একটি অ্যাকাউন্ট খোলা হয়েছে।',
  closed: 'রিওয়ার্ড ক্লাব এখন বন্ধ আছে। একটু পরে আবার চেষ্টা করুন।',
  code: 'নুসুক কোড সঠিক নয়। নুসুক অ্যাপ থেকে হুবহু কপি করে দিন, যেমন: NG-y3JkB7lU',
  code_taken: 'এই নুসুক কোড দিয়ে আগেই একটি অ্যাকাউন্ট খোলা হয়েছে।',
  bad_ref: 'এই রেফারেল কোডের কোনো সদস্য পাওয়া যায়নি। কোডটি আবার দেখুন, অথবা ঘরটি খালি রাখুন।',
  self_ref: 'নিজের কোড রেফারেল হিসেবে দেওয়া যাবে না।',
  busy: 'একটু পরে আবার চেষ্টা করুন।',
};

export const KIND_LABEL: Record<TicketRow['kind'], string> = {
  join: 'অ্যাকাউন্ট খোলার টিকিট',
  ref_bonus: 'রেফারেল কোড দিয়ে যুক্ত হওয়ার বাড়তি টিকিট',
  referral: 'আপনার কোড দিয়ে নতুন সদস্য',
  copy: 'আজকের কোড কপির টিকিট',
};

/** Fill the caption template: {code} {name} {sl} {link} */
export function fillCaption(tpl: string, m: Pick<Member, 'nusuk_code' | 'name' | 'sl'>) {
  return (tpl.trim() || DEFAULT_CAPTION)
    .replaceAll('{code}', m.nusuk_code)
    .replaceAll('{name}', m.name)
    .replaceAll('{sl}', String(m.sl))
    .replaceAll('{link}', SITE_LINK);
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
