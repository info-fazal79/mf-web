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
};

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
