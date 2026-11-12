import { Check } from 'lucide-react';
import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { supabase } from '@/lib/supabase';
import {
  addDays,
  dhakaToday,
  fmt12,
  googleCalendarUrl,
  loadAvailability,
  slotsFor,
  weekdayOf,
  type Availability,
} from '@/lib/booking';

type Props = {
  calendarEnabled: boolean;
  slotMinutes: number;
  minNoticeHours: number;
  maxDaysAhead: number;
  note: string;
  topics: string[];
};

/** Used only when Supabase isn't reachable, so the drawer still works for review. */
const SAMPLE: Availability = {
  rules: [0, 1, 2, 3].map((w) => ({ weekday: w, start_time: '16:00', end_time: '20:00' })).concat([
    { weekday: 4, start_time: '16:00', end_time: '18:00' },
    { weekday: 6, start_time: '10:00', end_time: '13:00' },
  ]),
  overrides: [],
  booked: new Set(),
};

const WEEKDAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
const longDate = (iso: string) =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' });

const num = (v: unknown, fallback: number) => (Number.isFinite(Number(v)) && Number(v) >= 0 ? Number(v) : fallback);

export default function ConsultationForm(props: Props) {
  const { calendarEnabled, note = '', topics = [] } = props;
  const slotMinutes = Math.max(5, num(props.slotMinutes, 30));
  const minNoticeHours = num(props.minNoticeHours, 12);
  const maxDaysAhead = Math.max(1, num(props.maxDaysAhead, 60));
  const cfg = { slotMinutes, minNoticeHours, maxDaysAhead };
  const today = dhakaToday();
  const lastDay = addDays(today, maxDaysAhead);
  const [month, setMonth] = useState(today.slice(0, 7)); // YYYY-MM
  const [avail, setAvail] = useState<Availability | null>(null);
  const [loadErr, setLoadErr] = useState(false);
  const [date, setDate] = useState<string | null>(null);
  const [slot, setSlot] = useState<string | null>(null);
  const [status, setStatus] = useState<'idle' | 'sending' | 'done'>('idle');
  const [error, setError] = useState('');
  const [booked, setBooked] = useState<{ date: string | null; time: string | null }>({ date: null, time: null });

  async function refresh() {
    if (!calendarEnabled) return;
    try {
      setAvail(await loadAvailability(today, lastDay));
      setLoadErr(false);
    } catch (e) {
      console.warn('[booking] availability unavailable, using sample hours:', (e as Error).message);
      setAvail(SAMPLE);
      setLoadErr(true);
    }
  }
  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const cells = useMemo(() => {
    const first = `${month}-01`;
    const [y, m] = month.split('-').map(Number);
    const count = new Date(Date.UTC(y, m, 0)).getUTCDate();
    const out: (string | null)[] = Array(weekdayOf(first)).fill(null);
    for (let i = 0; i < count; i++) out.push(addDays(first, i));
    return out;
  }, [month]);

  const daySlots = (iso: string) => (avail ? slotsFor(iso, avail, cfg) : []);
  const hasFree = (iso: string) => daySlots(iso).some((s) => !s.taken);
  const slots = date ? daySlots(date) : [];

  const shiftMonth = (n: number) => {
    const [y, m] = month.split('-').map(Number);
    const d = new Date(Date.UTC(y, m - 1 + n, 1));
    setMonth(d.toISOString().slice(0, 7));
  };
  const canBack = month > today.slice(0, 7);
  const canNext = month < lastDay.slice(0, 7);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    if (!form.reportValidity()) return;
    if (calendarEnabled && (!date || !slot)) {
      setError('Please pick a date and a time slot.');
      return;
    }
    setError('');
    setStatus('sending');
    const data = Object.fromEntries(new FormData(form)) as Record<string, string>;
    const payload = {
      name: data.name.trim(),
      email: data.email.trim().toLowerCase(),
      phone: data.phone.trim(),
      address: data.address?.trim() || null,
      topic: data.topic || null,
      message: data.message.trim(),
      preferred_date: calendarEnabled ? date : null,
      preferred_time: calendarEnabled ? slot : null,
      duration_minutes: calendarEnabled ? slotMinutes : null,
    };
    try {
      if (supabase && !loadErr) {
        const { error: err } = await supabase.from('consultations').insert(payload);
        if (err) {
          if (err.code === '23505') {
            setError('Sorry, someone just booked that slot. Please choose another time.');
            setSlot(null);
            setStatus('idle');
            refresh();
            return;
          }
          throw err;
        }
      } else {
        await new Promise((r) => setTimeout(r, 600));
        console.info('[consultation] backend not ready; payload:', payload);
      }
      setBooked({ date: payload.preferred_date, time: payload.preferred_time });
      setStatus('done');
      form.reset();
      setDate(null);
      setSlot(null);
    } catch {
      setStatus('idle');
      setError('Something went wrong. Please try again or contact me on WhatsApp.');
    }
  }

  if (status === 'done') {
    return (
      <div className="flex flex-col items-center py-10 text-center">
        <div className="grid h-16 w-16 place-items-center rounded-full bg-accent-soft text-accent">
          <Check size={30} strokeWidth={2.2} aria-hidden="true" />
        </div>
        <h3 className="mt-5 text-lg font-bold">Request received!</h3>
        <p className="mt-2 max-w-xs text-sm text-muted">
          {booked.date && booked.time ? (
            <>
              Your requested slot: <strong className="text-fg">{longDate(booked.date)}, {fmt12(booked.time)}</strong> (Bangladesh time).{' '}
            </>
          ) : null}
          I'll confirm by email or WhatsApp shortly.
        </p>
        {booked.date && booked.time && (
          <a
            className="btn-ghost mt-5 text-xs"
            target="_blank"
            rel="noopener"
            href={googleCalendarUrl('Consultation with Muhammad Fazal', booked.date, booked.time, slotMinutes, 'Pending confirmation')}
          >
            Add to Google Calendar
          </a>
        )}
        <button type="button" className="btn-ghost mt-3" onClick={() => { setStatus('idle'); refresh(); }}>
          Book another
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-4" noValidate>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="c-name">Full name *</label>
          <input id="c-name" name="name" required maxLength={200} className="input" placeholder="Your name" autoComplete="name" />
        </div>
        <div>
          <label className="label" htmlFor="c-phone">Phone / WhatsApp *</label>
          <input id="c-phone" name="phone" required maxLength={40} className="input" placeholder="+880…" autoComplete="tel" inputMode="tel" />
        </div>
      </div>
      <div>
        <label className="label" htmlFor="c-email">Email *</label>
        <input id="c-email" name="email" type="email" required maxLength={320} className="input" placeholder="you@example.com" autoComplete="email" />
      </div>
      <div>
        <label className="label" htmlFor="c-address">Address</label>
        <input id="c-address" name="address" maxLength={300} className="input" placeholder="City, Country" autoComplete="address-level2" />
      </div>
      <div>
        <label className="label" htmlFor="c-topic">Topic *</label>
        <select id="c-topic" name="topic" required className="input" defaultValue="">
          <option value="" disabled>Choose a topic</option>
          {topics.map((t) => (
            <option key={t}>{t}</option>
          ))}
        </select>
      </div>

      {calendarEnabled && (
        <div className="rounded-2xl border border-line bg-surface-2 p-4">
          <div className="mb-3 flex items-center justify-between">
            <span className="label mb-0">Pick a date *</span>
            <div className="flex items-center gap-1">
              <button type="button" disabled={!canBack} onClick={() => shiftMonth(-1)} className="grid h-8 w-8 place-items-center rounded-lg text-muted hover:bg-surface hover:text-fg disabled:opacity-30" aria-label="Previous month">‹</button>
              <span className="min-w-28 text-center text-sm font-semibold">
                {new Date(`${month}-01T00:00:00Z`).toLocaleString('en', { month: 'long', year: 'numeric', timeZone: 'UTC' })}
              </span>
              <button type="button" disabled={!canNext} onClick={() => shiftMonth(1)} className="grid h-8 w-8 place-items-center rounded-lg text-muted hover:bg-surface hover:text-fg disabled:opacity-30" aria-label="Next month">›</button>
            </div>
          </div>

          {!avail ? (
            <p className="py-10 text-center text-sm text-muted">Loading available times…</p>
          ) : (
            <div className="grid grid-cols-7 gap-1 text-center">
              {WEEKDAYS.map((w) => (
                <span key={w} className="py-1 font-mono text-[11px] text-muted">{w}</span>
              ))}
              {cells.map((iso, i) =>
                iso === null ? (
                  <span key={`e${i}`} />
                ) : (
                  <button
                    key={iso}
                    type="button"
                    disabled={!hasFree(iso)}
                    onClick={() => {
                      setDate(iso);
                      setSlot(null);
                      setError('');
                    }}
                    aria-label={longDate(iso)}
                    aria-pressed={date === iso}
                    className={[
                      'relative aspect-square rounded-lg text-sm transition',
                      date === iso ? 'bg-accent font-bold text-accent-contrast' : hasFree(iso) ? 'font-medium text-fg hover:bg-accent-soft hover:text-accent' : 'text-muted/35',
                      iso === today ? 'ring-1 ring-line' : '',
                    ].join(' ')}
                  >
                    {Number(iso.slice(8))}
                    {hasFree(iso) && date !== iso && <span className="absolute bottom-1 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full bg-accent" />}
                  </button>
                ),
              )}
            </div>
          )}

          {date && (
            <div className="mt-4 border-t border-line pt-4">
              <span className="label">{longDate(date)} · Bangladesh time</span>
              <div className="grid grid-cols-3 gap-2">
                {slots.map((s) => (
                  <button
                    key={s.time}
                    type="button"
                    disabled={s.taken}
                    onClick={() => setSlot(s.time)}
                    title={s.taken ? 'Already booked' : undefined}
                    className={[
                      'rounded-lg border px-2 py-2 font-mono text-xs transition',
                      s.taken
                        ? 'cursor-not-allowed border-line text-muted/40 line-through'
                        : slot === s.time
                          ? 'border-accent bg-accent text-accent-contrast'
                          : 'border-line bg-surface text-fg hover:border-accent hover:text-accent',
                    ].join(' ')}
                  >
                    {fmt12(s.time)}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      <div>
        <label className="label" htmlFor="c-details">Project details *</label>
        <textarea id="c-details" name="message" required maxLength={10000} rows={4} className="input resize-y" placeholder="Tell me what you want to build or automate…" />
      </div>

      {error && <p className="text-sm text-red-500" role="alert">{error}</p>}

      <button type="submit" className="btn-primary w-full py-3" disabled={status === 'sending'}>
        {status === 'sending' ? 'Sending…' : 'Request Consultation'}
      </button>
      {note && <p className="text-center text-xs text-muted">{note}</p>}
    </form>
  );
}
