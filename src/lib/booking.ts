/**
 * Booking slot logic. All dates/times are Bangladesh time (UTC+6, no DST),
 * so visitors anywhere see the same slots you set in the admin panel.
 */
import { supabase } from './supabase';

export const TZ_OFFSET_MIN = 6 * 60;

export type Rule = { weekday: number; start_time: string; end_time: string };
export type Override = { date: string; is_closed: boolean; start_time: string | null; end_time: string | null; note?: string | null };
export type BookingConfig = { slotMinutes: number; minNoticeHours: number; maxDaysAhead: number };
export type Availability = { rules: Rule[]; overrides: Override[]; booked: Set<string> };

export const toMin = (t: string) => {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + (m || 0);
};
export const toHHMM = (mins: number) => `${String(Math.floor(mins / 60)).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}`;
export const fmt12 = (hhmm: string) => {
  const m = toMin(hhmm);
  const h = Math.floor(m / 60);
  return `${h % 12 || 12}:${String(m % 60).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`;
};

/** "YYYY-MM-DD" for today in Bangladesh. */
export function dhakaToday(now = Date.now()) {
  return new Date(now + TZ_OFFSET_MIN * 60_000).toISOString().slice(0, 10);
}
export function addDays(iso: string, n: number) {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
export const weekdayOf = (iso: string) => new Date(`${iso}T00:00:00Z`).getUTCDay();
/** Epoch ms for a Bangladesh-local date + time. */
export const slotEpoch = (iso: string, hhmm: string) => Date.parse(`${iso}T00:00:00Z`) + (toMin(hhmm) - TZ_OFFSET_MIN) * 60_000;

/** Opening ranges for a day: overrides replace the weekly rules for that date. */
export function rangesFor(iso: string, a: Pick<Availability, 'rules' | 'overrides'>): [number, number][] {
  const ov = a.overrides.filter((o) => o.date === iso);
  if (ov.some((o) => o.is_closed)) return [];
  if (ov.length) return ov.map((o) => [toMin(o.start_time!), toMin(o.end_time!)]);
  return a.rules.filter((r) => r.weekday === weekdayOf(iso)).map((r) => [toMin(r.start_time), toMin(r.end_time)]);
}

export function slotsFor(iso: string, a: Availability, cfg: BookingConfig, now = Date.now()) {
  const today = dhakaToday(now);
  if (iso < today || iso > addDays(today, cfg.maxDaysAhead)) return [];
  const earliest = now + cfg.minNoticeHours * 3_600_000;
  const out: { time: string; taken: boolean }[] = [];
  const step = Math.max(5, cfg.slotMinutes);
  for (const [s, e] of rangesFor(iso, a).sort((x, y) => x[0] - y[0])) {
    for (let t = s; t + step <= e; t += step) {
      const time = toHHMM(t);
      if (slotEpoch(iso, time) < earliest) continue;
      out.push({ time, taken: a.booked.has(`${iso} ${time}`) });
    }
  }
  return out;
}

export async function loadAvailability(from: string, to: string): Promise<Availability> {
  if (!supabase) throw new Error('not-configured');
  const [rules, overrides, booked] = await Promise.all([
    supabase.from('availability_rules').select('weekday,start_time,end_time'),
    supabase.from('availability_overrides').select('date,is_closed,start_time,end_time').gte('date', from).lte('date', to),
    supabase.rpc('booked_slots', { from_date: from, to_date: to }),
  ]);
  const err = rules.error || overrides.error || booked.error;
  if (err) throw err;
  return {
    rules: (rules.data as Rule[]).map((r) => ({ ...r, start_time: r.start_time.slice(0, 5), end_time: r.end_time.slice(0, 5) })),
    overrides: (overrides.data as Override[]).map((o) => ({ ...o, start_time: o.start_time?.slice(0, 5) ?? null, end_time: o.end_time?.slice(0, 5) ?? null })),
    booked: new Set((booked.data as { slot_date: string; slot_time: string }[]).map((b) => `${b.slot_date} ${b.slot_time}`)),
  };
}

/** Google Calendar "add event" link for a booking. */
export function googleCalendarUrl(title: string, iso: string, hhmm: string, minutes: number, details = '') {
  const start = new Date(slotEpoch(iso, hhmm));
  const end = new Date(start.getTime() + minutes * 60_000);
  const f = (d: Date) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const p = new URLSearchParams({ action: 'TEMPLATE', text: title, dates: `${f(start)}/${f(end)}`, details });
  return `https://calendar.google.com/calendar/render?${p}`;
}
