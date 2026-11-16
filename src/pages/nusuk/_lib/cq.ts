/**
 * Ribat quiz competition (update_44_quiz_competition.sql): types and small helpers shared by the
 * member page (/nusuk/account) and Nusuk Manager.
 */
import { bnTime } from './club';
export type SlotStatus = 'upcoming' | 'ready' | 'open' | 'right' | 'wrong' | 'late' | 'left' | 'missed';
export type CqSlot = { i: number; from: string; to: string; status: SlotStatus };
export type CqPrize = { place: number; prize: string };
export type CqMe = {
  now: string;
  campaign: null | {
    id: number; title: string; info: string; starts_at: string | null; ends_at: string | null;
    rule: 'date' | 'people' | 'tickets'; target: number; totals: { people: number; tickets: number }; full: boolean;
    prizes: CqPrize[]; caption: string; card: { theme?: 'green' | 'gold' | 'night'; headline?: string; sub?: string; line?: string };
  };
  secs?: number;
  pledge?: string;
  rules?: string;
  questions?: number;
  slots?: CqSlot[];
  ref?: { keys: number; used_today: number; per_day: number; from: string; to: string; in_window: boolean };
  my: {
    sl: number; code: string; ref_keys: number; ref_earned: number; refs: number; answered: number; correct: number;
    copies: number; gift_keys: number; tickets?: number; tickets_today?: number;
  };
};
export type CqOpen = {
  ok: boolean; reason?: string; id?: number; secs?: number; deadline?: string; now?: string;
  question?: string; options?: string[]; mark?: { sl: number; code: string };
};
export type CqAnswer = { ok: boolean; reason?: string; status?: 'right' | 'wrong' | 'late'; right?: number; tickets?: number };

/** Campaign settings stored in nusuk_club_contests.quiz */
export type CqSlotCfg = { at: string; mins: number };
export type CqCfg = {
  slots: CqSlotCfg[]; secs: number; ref_per_day: number; ref_from: string; ref_to: string;
  rule: 'date' | 'people' | 'tickets'; target: number; pledge: string; rules: string;
  bonus_done?: boolean; bonus_keys?: number; bonus_people?: number; bonus_at?: string;
};
export const DEFAULT_SLOTS: CqSlotCfg[] = [
  { at: '09:00', mins: 120 }, { at: '11:00', mins: 120 }, { at: '14:00', mins: 120 }, { at: '17:00', mins: 120 }, { at: '20:00', mins: 120 },
];
export function parseCqCfg(q: unknown): CqCfg {
  const r = (q && typeof q === 'object' ? q : {}) as Record<string, unknown>;
  const num = (v: unknown, d: number, lo: number, hi: number) => (typeof v === 'number' && Number.isFinite(v) ? Math.min(hi, Math.max(lo, Math.round(v))) : d);
  const time = (v: unknown, d: string) => (typeof v === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(v) ? v : d);
  const slots = Array.isArray(r.slots)
    ? (r.slots as unknown[]).flatMap((x) => (x && typeof x === 'object' ? [{ at: time((x as CqSlotCfg).at, '09:00'), mins: num((x as CqSlotCfg).mins, 120, 5, 1440) }] : [])).slice(0, 10)
    : [];
  return {
    slots: slots.length ? slots : DEFAULT_SLOTS.map((s) => ({ ...s })),
    secs: num(r.secs, 30, 10, 300),
    ref_per_day: num(r.ref_per_day, 10, 0, 100),
    ref_from: time(r.ref_from, '00:00'),
    ref_to: time(r.ref_to, '23:59'),
    rule: r.rule === 'people' || r.rule === 'tickets' ? r.rule : 'date',
    target: num(r.target, 0, 0, 10_000_000),
    pledge: typeof r.pledge === 'string' ? r.pledge.slice(0, 600) : '',
    rules: typeof r.rules === 'string' ? r.rules.slice(0, 4000) : '',
    bonus_done: r.bonus_done === true,
    bonus_keys: typeof r.bonus_keys === 'number' ? r.bonus_keys : undefined,
    bonus_people: typeof r.bonus_people === 'number' ? r.bonus_people : undefined,
    bonus_at: typeof r.bonus_at === 'string' ? r.bonus_at : undefined,
  };
}

export const OPEN_ERR: Record<string, string> = {
  signin: 'আবার লগইন করুন।',
  member: 'আগে প্রোফাইল পূরণ করে অ্যাকাউন্ট সম্পূর্ণ করুন।',
  closed: 'প্রতিযোগিতা এখন বন্ধ আছে।',
  no_campaign: 'এই মুহূর্তে কোনো প্রতিযোগিতা চলছে না।',
  full: 'এই প্রতিযোগিতার লক্ষ্য পূর্ণ হয়েছে। লটারির অপেক্ষায় থাকুন!',
  no_questions: 'এখনো প্রশ্ন যোগ করা হয়নি। একটু পরে আবার দেখুন।',
  window: 'এই প্রশ্নের সময় এখন নয়।',
  used: 'এই প্রশ্নটি আগেই খোলা হয়েছে।',
  slot: 'প্রশ্নটি পাওয়া যায়নি।',
  no_keys: 'আপনার কোনো বাড়তি চাবি নেই।',
  ref_window: 'বাড়তি চাবি ব্যবহারের সময় এখন নয়।',
  ref_limit: 'আজকের বাড়তি চাবি ব্যবহারের সীমা শেষ। বাকিগুলো কাল ব্যবহার করতে পারবেন।',
  kind: 'একটু পরে আবার চেষ্টা করুন।',
};

/**
 * A rough browser "fingerprint" (screen, model, language, time zone, …), hashed.
 * Only used to show the admin accounts that look like the same phone; never to block.
 */
export async function browserFp() {
  try {
    const n = navigator as Navigator & { deviceMemory?: number };
    const parts = [
      n.userAgent, n.language, (n.languages ?? []).join(','), n.platform, n.hardwareConcurrency, n.deviceMemory ?? '',
      screen.width, screen.height, screen.colorDepth, window.devicePixelRatio, Intl.DateTimeFormat().resolvedOptions().timeZone,
      n.maxTouchPoints,
    ].join('|');
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(parts));
    return [...new Uint8Array(buf)].slice(0, 16).map((b) => b.toString(16).padStart(2, '0')).join('');
  } catch { return ''; }
}

/** Tell the server the member left the page while a question was open (works while the page is closing) */
export function leaveBeacon(id: number, token: string | null) {
  const url = import.meta.env.PUBLIC_SUPABASE_URL as string | undefined;
  const key = import.meta.env.PUBLIC_SUPABASE_ANON_KEY as string | undefined;
  if (!url || !key || !token) return;
  try {
    fetch(`${url}/rest/v1/rpc/nusuk_cq_leave`, {
      method: 'POST', keepalive: true,
      headers: { apikey: key, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ p_id: id }),
    }).catch(() => {});
  } catch { /* closing */ }
}

/** ISO time → "সকাল ৯:০০" (Bangladesh time) */
export const timeBn = (iso: string) =>
  bnTime(new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Dhaka' }));
