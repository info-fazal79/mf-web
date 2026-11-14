/**
 * Live screen settings (nusuk_settings.content.livescreen), edited in Nusuk Manager → Live screen
 * and read by /nusuk/live every 10 seconds (update_30_live_screen_settings.sql).
 */
export type Theme = 'green' | 'mint' | 'cream' | 'navy';
export const THEMES: { key: Theme; name: string }[] = [
  { key: 'green', name: 'সবুজ' },
  { key: 'mint', name: 'হালকা সবুজ' },
  { key: 'cream', name: 'ক্রিম' },
  { key: 'navy', name: 'রাতের নীল' },
];
export type Slot = { from: string; theme: Theme }; // from = "HH:MM" Bangladesh time
export type LiveCfg = {
  mode: 'fixed' | 'schedule' | 'rotate';
  theme: Theme; // fixed
  schedule: Slot[]; // by time of day
  rotate_min: number; // rotate every N minutes
  rotate_themes: Theme[];
  hide: string[]; // panels to hide
  title: string;
  /** Breaking news bar above the ticker: headlines scroll right to left, one after another, in a loop */
  breaking: Breaking;
  /** Questions for the audience: the one being shown pops up at the top of the screen */
  questions: Questions;
};
/** show = index of the question on screen, or null (all hidden) */
export type Questions = { items: string[]; show: number | null };
export const SAMPLE_QUESTIONS = [
  'আজকের বিজয়ী কোন দেশ থেকে হতে পারেন বলে আপনার মনে হয়? কমেন্টে লিখুন 👇',
  'আপনি আজ কয়টি নুসুক কোড ব্যবহার করেছেন? কমেন্টে জানান 👇',
  'আপনি কোন জেলা থেকে লাইভ দেখছেন? কমেন্টে লিখুন 👇',
  'উমরাহ জিতলে প্রথমে কার জন্য দোয়া করবেন? কমেন্টে লিখুন 👇',
  'আজ কি বাংলাদেশ থেকে কেউ বিজয়ী হবেন? হ্যাঁ হলে কমেন্টে “ইনশাআল্লাহ” লিখুন 👇',
];
export type BkItem = { text: string; on: boolean }; // on = false: kept in the list but hidden from the stream
export type BkSpeed = 'slow' | 'normal' | 'fast';
export type Breaking = { on: boolean; label: string; items: BkItem[]; speed: BkSpeed };
/** scroll speed in px per second on the 1920-wide stage */
export const BK_SPEED: Record<BkSpeed, number> = { slow: 90, normal: 140, fast: 200 };
export const DEFAULT_BREAKING_LABEL = 'ব্রেকিং নিউজ';

export const defaultLiveCfg = (): LiveCfg => ({
  mode: 'fixed',
  theme: 'green',
  schedule: [
    { from: '06:00', theme: 'cream' },
    { from: '14:00', theme: 'green' },
    { from: '22:00', theme: 'navy' },
  ],
  rotate_min: 60,
  rotate_themes: ['green', 'cream', 'navy'],
  hide: [],
  title: '',
  breaking: { on: false, label: '', items: [{ text: '', on: true }], speed: 'normal' },
  questions: { items: [...SAMPLE_QUESTIONS], show: null },
});

const isTheme = (t: unknown): t is Theme => t === 'green' || t === 'mint' || t === 'cream' || t === 'navy';
const isTime = (t: unknown): t is string => typeof t === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(t);

export function parseLiveCfg(raw: unknown): LiveCfg {
  const d = defaultLiveCfg();
  if (!raw || typeof raw !== 'object') return d;
  const r = raw as Record<string, unknown>;
  const schedule = Array.isArray(r.schedule)
    ? (r.schedule as Slot[]).filter((s) => s && isTime(s.from) && isTheme(s.theme)).map((s) => ({ from: s.from, theme: s.theme }))
    : d.schedule;
  const rt = Array.isArray(r.rotate_themes) ? (r.rotate_themes as unknown[]).filter(isTheme) : d.rotate_themes;
  return {
    mode: r.mode === 'schedule' || r.mode === 'rotate' ? r.mode : 'fixed',
    theme: isTheme(r.theme) ? r.theme : d.theme,
    schedule: schedule.length ? schedule : d.schedule,
    rotate_min: Math.min(1440, Math.max(1, Math.round(Number(r.rotate_min) || d.rotate_min))),
    rotate_themes: rt.length ? rt : d.rotate_themes,
    hide: Array.isArray(r.hide) ? (r.hide as unknown[]).filter((x): x is string => typeof x === 'string').slice(0, 10) : [],
    title: typeof r.title === 'string' ? r.title.slice(0, 80) : '',
    breaking: parseBreaking(r.breaking),
    questions: parseQuestions(r.questions),
  };
}

function parseQuestions(raw: unknown): Questions {
  if (!raw || typeof raw !== 'object') return { items: [...SAMPLE_QUESTIONS], show: null };
  const q = raw as Record<string, unknown>;
  const items = Array.isArray(q.items) ? (q.items as unknown[]).filter((x): x is string => typeof x === 'string').map((x) => x.slice(0, 200)).slice(0, 30) : [];
  const show = typeof q.show === 'number' && q.show >= 0 && q.show < items.length ? q.show : null;
  return { items: items.length ? items : [''], show };
}

function parseBreaking(raw: unknown): Breaking {
  const b = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const items: BkItem[] = Array.isArray(b.items)
    ? (b.items as unknown[]).flatMap((x): BkItem[] => {
        if (typeof x === 'string') return [{ text: x.slice(0, 200), on: true }]; // first version saved plain strings
        if (x && typeof x === 'object' && typeof (x as BkItem).text === 'string') return [{ text: (x as BkItem).text.slice(0, 200), on: (x as BkItem).on !== false }];
        return [];
      }).slice(0, 20)
    : [];
  return {
    on: b.on === true,
    label: typeof b.label === 'string' ? b.label.slice(0, 30) : '',
    items: items.length ? items : [{ text: '', on: true }],
    speed: b.speed === 'slow' || b.speed === 'fast' ? b.speed : 'normal',
  };
}

/** Minutes since midnight in Bangladesh */
const dhakaMinutes = (t: number) => {
  const [h, m] = new Date(t).toLocaleTimeString('en-GB', { timeZone: 'Asia/Dhaka', hour: '2-digit', minute: '2-digit', hour12: false }).split(':').map(Number);
  return (h % 24) * 60 + m;
};
const toMin = (hhmm: string) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));

/** Which theme should be on screen at time `t` (ms). */
export function themeAt(c: LiveCfg, t: number): Theme {
  if (c.mode === 'schedule') {
    const now = dhakaMinutes(t);
    const slots = [...c.schedule].sort((a, b) => toMin(a.from) - toMin(b.from));
    // the latest slot that has started today; before the first one, yesterday's last slot is still on
    let cur = slots[slots.length - 1];
    for (const s of slots) if (toMin(s.from) <= now) cur = s;
    return cur?.theme ?? c.theme;
  }
  if (c.mode === 'rotate') {
    const list = c.rotate_themes.length ? c.rotate_themes : (['green', 'mint', 'cream', 'navy'] as Theme[]);
    const step = Math.floor(t / 60000 / c.rotate_min);
    return list[step % list.length];
  }
  return c.theme;
}
