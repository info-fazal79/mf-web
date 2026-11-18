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
  /** Full-screen announcements: several drafts, the one at announce_show is on screen (null = none) */
  announces: Announce[];
  announce_show: number | null;
  /** TV program: scenes that follow one another by themselves (auto) or the one picked (pin) */
  tv: Tv;
  /** Promo ads shown in the "L" around the shrunk screen */
  promos: Promo[];
  /** Short notices: a card in the middle over the blurred screen; notice_show = id on screen */
  notices: Notice[];
  notice_show: string | null;
  /** YouTube videos played in the video scene */
  videos: Video[];
  /** Background music played by the live page (instead of OBS) */
  music: Music;
  /** The "join" scene: QR code to the site + your links */
  join: Join;
};

// ---------------------------------------------------------------- TV program
export type SceneKey = 'home' | 'stats' | 'winners' | 'lastwin' | 'join' | 'promo' | 'video';
export const SCENES: { key: SceneKey; name: string; hint: string; secs: number }[] = [
  { key: 'home', name: 'Main dashboard', hint: 'Numbers, charts, activity feed, quiz and winner cards', secs: 60 },
  { key: 'stats', name: 'Live numbers + active users chart', hint: 'Big numbers and the active-users graph', secs: 25 },
  { key: 'winners', name: 'Bangladeshi Umrah winners', hint: 'One winner at a time, big', secs: 30 },
  { key: 'lastwin', name: 'Latest Nusuk winner', hint: "Today's / yesterday's winner, big", secs: 20 },
  { key: 'join', name: 'Join: QR code + links', hint: 'Scan to open the site, with your links', secs: 20 },
  { key: 'promo', name: 'Promo ads (L-shape)', hint: 'The screen shrinks; promos fill the left and bottom', secs: 30 },
  { key: 'video', name: 'Videos', hint: 'YouTube videos from the list, one after another', secs: 0 },
];
export type Scene = { key: SceneKey; on: boolean; secs: number };
export type Fx = 'fade' | 'slide' | 'zoom';
export type Tv = { auto: boolean; pin: SceneKey; fx: Fx; scenes: Scene[] };
export type Promo = { id: string; on: boolean; tag: string; title: string; text: string; points: string[]; image: string };
export type Notice = { id: string; tag: string; title: string; text: string };
export type Video = { id: string; on: boolean; title: string; url: string };
export type Track = { id: string; on: boolean; title: string; url: string };
export type Music = { on: boolean; volume: number; tracks: Track[] };
export type Join = { title: string; text: string; links: { label: string; url: string }[] };
export const uid = () => Math.random().toString(36).slice(2, 10);
export const defaultTv = (): Tv => ({
  auto: false, pin: 'home', fx: 'fade',
  scenes: SCENES.map((x) => ({ key: x.key, on: x.key !== 'video', secs: x.secs })),
});
export const DEFAULT_JOIN: Join = {
  title: 'আপনিও যুক্ত হোন!',
  text: 'ফোনের ক্যামেরায় QR কোডটি স্ক্যান করুন: হাজারো নুসুক কোড, দৈনিক কুইজ আর পুরস্কার জেতার সুযোগ।',
  links: [{ label: 'ওয়েবসাইট', url: 'muhammadfazal.com/nusuk' }],
};
/** YouTube video id from any YouTube link (watch, youtu.be, shorts, embed) */
export function ytId(url: string) {
  const m = url.trim().match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?(?:.*&)?v=|shorts\/|embed\/|live\/))([\w-]{11})/);
  return m ? m[1] : /^[\w-]{11}$/.test(url.trim()) ? url.trim() : '';
}
export type Announce = { on: boolean; tag: string; title: string; body: string; points: string[]; ask: string; choices: string[]; footer: string };
export const DEFAULT_ANNOUNCE: Announce = {
  on: false,
  tag: '📣 বিশেষ ঘোষণা',
  title: 'আসছে বাংলাদেশি ভাই-বোনদের জন্য বিশেষ প্রতিযোগিতা',
  body: 'রিবাতুল উম্মাহর পক্ষ থেকে খুব শীঘ্রই বাংলাদেশি ভাই-বোনদের জন্য একটি বিশেষ প্রতিযোগিতার আয়োজন করা হচ্ছে, ইনশাআল্লাহ। বিস্তারিত নিয়মকানুন ও পুরস্কারের ঘোষণা খুব শীঘ্রই এই লাইভে ও আমাদের পেজে জানানো হবে।',
  points: ['সবার জন্য সহজ অংশগ্রহণ', 'আকর্ষণীয় পুরস্কার', 'সম্পূর্ণ স্বচ্ছ লাইভ ড্র'],
  ask: 'আপনার মতামত দিন: কোন ধরনের প্রতিযোগিতা হলে ভালো হয়? কমেন্টে নম্বর লিখুন 👇',
  choices: ['ইসলামিক কুইজ প্রতিযোগিতা', 'নুসুক কোড শেয়ার প্রতিযোগিতা', 'ফটো কার্ড শেয়ার প্রতিযোগিতা'],
  footer: 'muhammadfazal.com/nusuk',
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
  announces: [{ ...DEFAULT_ANNOUNCE, points: [...DEFAULT_ANNOUNCE.points], choices: [...DEFAULT_ANNOUNCE.choices] }],
  announce_show: null,
  tv: defaultTv(),
  promos: [],
  notices: [],
  notice_show: null,
  videos: [],
  music: { on: false, volume: 40, tracks: [] },
  join: { ...DEFAULT_JOIN, links: DEFAULT_JOIN.links.map((l) => ({ ...l })) },
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
    ...parseAnnounces(r),
    tv: parseTv(r.tv),
    promos: parsePromos(r.promos),
    ...parseNotices(r),
    videos: list(r.videos, 30).map((v) => ({ id: str(v.id, 20) || uid(), on: v.on !== false, title: str(v.title, 120), url: str(v.url, 300) })),
    music: parseMusic(r.music),
    join: parseJoin(r.join),
  };
}

// ---------------------------------------------------------------- helpers for the TV parts
type Obj = Record<string, unknown>;
const str = (v: unknown, n: number) => (typeof v === 'string' ? v.slice(0, n) : '');
const list = (v: unknown, n: number): Obj[] => (Array.isArray(v) ? (v as unknown[]).filter((x): x is Obj => !!x && typeof x === 'object').slice(0, n) : []);
const lines = (v: unknown, n: number) => (Array.isArray(v) ? (v as unknown[]).filter((x): x is string => typeof x === 'string').map((x) => x.slice(0, 140)).slice(0, n) : []);

function parseAnnounces(r: Obj): { announces: Announce[]; announce_show: number | null } {
  // first version: one announcement with its own on/off
  if (!Array.isArray(r.announces)) {
    const a = parseAnnounce(r.announce);
    return { announces: [a], announce_show: a.on ? 0 : null };
  }
  const items = (r.announces as unknown[]).slice(0, 20).map((x) => parseAnnounce(x));
  const all = items.length ? items : [parseAnnounce(null)];
  const show = typeof r.announce_show === 'number' && r.announce_show >= 0 && r.announce_show < all.length ? r.announce_show : null;
  return { announces: all, announce_show: show };
}
function parseTv(raw: unknown): Tv {
  const d = defaultTv();
  if (!raw || typeof raw !== 'object') return d;
  const t = raw as Obj;
  const keys = SCENES.map((x) => x.key);
  const saved = list(t.scenes, 20).filter((x) => keys.includes(x.key as SceneKey));
  // saved order first, then any scene added later
  const scenes: Scene[] = [
    ...saved.map((x) => ({ key: x.key as SceneKey, on: x.on !== false, secs: Math.min(3600, Math.max(0, Math.round(Number(x.secs) || 0))) })),
    ...d.scenes.filter((x) => !saved.some((y) => y.key === x.key)),
  ];
  return {
    auto: t.auto === true,
    pin: keys.includes(t.pin as SceneKey) ? (t.pin as SceneKey) : 'home',
    fx: t.fx === 'slide' || t.fx === 'zoom' ? t.fx : 'fade',
    scenes,
  };
}
function parsePromos(raw: unknown): Promo[] {
  return list(raw, 20).map((p) => ({
    id: str(p.id, 20) || uid(), on: p.on !== false, tag: str(p.tag, 60), title: str(p.title, 140), text: str(p.text, 500),
    points: lines(p.points, 6), image: str(p.image, 500),
  }));
}
function parseNotices(r: Obj): { notices: Notice[]; notice_show: string | null } {
  const notices = list(r.notices, 20).map((n) => ({ id: str(n.id, 20) || uid(), tag: str(n.tag, 60), title: str(n.title, 140), text: str(n.text, 500) }));
  const show = typeof r.notice_show === 'string' && notices.some((n) => n.id === r.notice_show) ? r.notice_show : null;
  return { notices, notice_show: show };
}
function parseMusic(raw: unknown): Music {
  const m = (raw && typeof raw === 'object' ? raw : {}) as Obj;
  return {
    on: m.on === true,
    volume: Math.min(100, Math.max(0, Math.round(Number(m.volume ?? 40)))),
    tracks: list(m.tracks, 40).map((t) => ({ id: str(t.id, 20) || uid(), on: t.on !== false, title: str(t.title, 120), url: str(t.url, 500) })),
  };
}
function parseJoin(raw: unknown): Join {
  if (!raw || typeof raw !== 'object') return { ...DEFAULT_JOIN, links: DEFAULT_JOIN.links.map((l) => ({ ...l })) };
  const j = raw as Obj;
  return {
    title: str(j.title, 100) || DEFAULT_JOIN.title,
    text: str(j.text, 300),
    links: list(j.links, 6).map((l) => ({ label: str(l.label, 40), url: str(l.url, 200) })),
  };
}

function parseAnnounce(raw: unknown): Announce {
  const d = DEFAULT_ANNOUNCE;
  if (!raw || typeof raw !== 'object') return { ...d, points: [...d.points], choices: [...d.choices] };
  const a = raw as Record<string, unknown>;
  const str = (v: unknown, n: number, f: string) => (typeof v === 'string' ? v.slice(0, n) : f);
  const list = (v: unknown, f: string[]) => (Array.isArray(v) ? (v as unknown[]).filter((x): x is string => typeof x === 'string').map((x) => x.slice(0, 120)).slice(0, 6) : [...f]);
  return {
    on: a.on === true,
    tag: str(a.tag, 60, d.tag), title: str(a.title, 160, d.title), body: str(a.body, 600, d.body),
    points: list(a.points, d.points), ask: str(a.ask, 200, d.ask), choices: list(a.choices, d.choices), footer: str(a.footer, 80, d.footer),
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
