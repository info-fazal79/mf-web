import { useMemo, useState, type FormEvent } from 'react';
import { supabase } from '@/lib/supabase';

type Props = {
  calendarEnabled: boolean;
  slotMinutes: number;
  topics: string[];
};

/**
 * Sample weekly availability (0 = Sunday). Phase 3 replaces this with the
 * schedule you set in the admin panel, minus already-booked slots.
 */
const SAMPLE_AVAILABILITY: Record<number, [string, string][]> = {
  0: [['16:00', '20:00']],
  1: [['16:00', '20:00']],
  2: [['16:00', '20:00']],
  3: [['16:00', '20:00']],
  4: [['16:00', '18:00']],
  6: [['10:00', '13:00']],
};

const WEEKDAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

function toMinutes(t: string) {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}
function fmtTime(mins: number) {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  const ampm = h >= 12 ? 'PM' : 'AM';
  const hh = h % 12 || 12;
  return `${hh}:${m.toString().padStart(2, '0')} ${ampm}`;
}
function sameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}
function isoDate(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export default function ConsultationForm({ calendarEnabled, slotMinutes, topics }: Props) {
  const today = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);
  const [view, setView] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1));
  const [date, setDate] = useState<Date | null>(null);
  const [slot, setSlot] = useState<number | null>(null);
  const [status, setStatus] = useState<'idle' | 'sending' | 'done' | 'error'>('idle');
  const [error, setError] = useState('');

  const days = useMemo(() => {
    const first = new Date(view.getFullYear(), view.getMonth(), 1);
    const count = new Date(view.getFullYear(), view.getMonth() + 1, 0).getDate();
    const cells: (Date | null)[] = Array(first.getDay()).fill(null);
    for (let i = 1; i <= count; i++) cells.push(new Date(view.getFullYear(), view.getMonth(), i));
    return cells;
  }, [view]);

  const isAvailable = (d: Date) => d > today && Boolean(SAMPLE_AVAILABILITY[d.getDay()]);

  const slots = useMemo(() => {
    if (!date) return [];
    const ranges = SAMPLE_AVAILABILITY[date.getDay()] ?? [];
    const out: number[] = [];
    for (const [s, e] of ranges) {
      for (let t = toMinutes(s); t + slotMinutes <= toMinutes(e); t += slotMinutes) out.push(t);
    }
    return out;
  }, [date, slotMinutes]);

  const canGoBack = view > new Date(today.getFullYear(), today.getMonth(), 1);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    if (!form.reportValidity()) return;
    if (calendarEnabled && (date === null || slot === null)) {
      setError('Please pick a date and a time slot.');
      return;
    }
    setError('');
    setStatus('sending');
    const data = Object.fromEntries(new FormData(form)) as Record<string, string>;
    const payload = {
      ...data,
      preferred_date: date ? isoDate(date) : null,
      preferred_time: slot !== null ? fmtTime(slot) : null,
    };
    try {
      if (supabase) {
        const { error: err } = await supabase.from('consultations').insert(payload);
        if (err) throw err;
      } else {
        // Backend not connected yet (Phase 3). Simulate success for UI review.
        await new Promise((r) => setTimeout(r, 700));
        console.info('[consultation] Supabase not configured. Payload:', payload);
      }
      setStatus('done');
      form.reset();
    } catch {
      setStatus('error');
      setError('Something went wrong. Please try again or contact me on WhatsApp.');
    }
  }

  if (status === 'done') {
    return (
      <div className="flex flex-col items-center py-10 text-center">
        <div className="grid h-16 w-16 place-items-center rounded-full bg-accent-soft text-accent">
          <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
        </div>
        <h3 className="mt-5 text-lg font-bold">Request received!</h3>
        <p className="mt-2 max-w-xs text-sm text-muted">
          Thanks for reaching out.{' '}
          {date && slot !== null && (
            <>
              Your preferred slot is <strong className="text-fg">{date.toDateString()}, {fmtTime(slot)}</strong>.{' '}
            </>
          )}
          I'll confirm by email shortly.
        </p>
        <button
          type="button"
          className="btn-ghost mt-6"
          onClick={() => {
            setStatus('idle');
            setDate(null);
            setSlot(null);
          }}
        >
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
          <input id="c-name" name="name" required className="input" placeholder="Your name" autoComplete="name" />
        </div>
        <div>
          <label className="label" htmlFor="c-phone">Phone *</label>
          <input id="c-phone" name="phone" required className="input" placeholder="+880…" autoComplete="tel" inputMode="tel" />
        </div>
      </div>
      <div>
        <label className="label" htmlFor="c-email">Email *</label>
        <input id="c-email" name="email" type="email" required className="input" placeholder="you@example.com" autoComplete="email" />
      </div>
      <div>
        <label className="label" htmlFor="c-address">Address</label>
        <input id="c-address" name="address" className="input" placeholder="City, Country" autoComplete="address-level2" />
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
              <button
                type="button"
                disabled={!canGoBack}
                onClick={() => setView(new Date(view.getFullYear(), view.getMonth() - 1, 1))}
                className="grid h-8 w-8 place-items-center rounded-lg text-muted hover:bg-surface hover:text-fg disabled:opacity-30"
                aria-label="Previous month"
              >
                ‹
              </button>
              <span className="min-w-28 text-center text-sm font-semibold">
                {view.toLocaleString('en', { month: 'long', year: 'numeric' })}
              </span>
              <button
                type="button"
                onClick={() => setView(new Date(view.getFullYear(), view.getMonth() + 1, 1))}
                className="grid h-8 w-8 place-items-center rounded-lg text-muted hover:bg-surface hover:text-fg"
                aria-label="Next month"
              >
                ›
              </button>
            </div>
          </div>
          <div className="grid grid-cols-7 gap-1 text-center">
            {WEEKDAYS.map((w) => (
              <span key={w} className="py-1 font-mono text-[11px] text-muted">{w}</span>
            ))}
            {days.map((d, i) =>
              d === null ? (
                <span key={`e${i}`} />
              ) : (
                <button
                  key={d.toISOString()}
                  type="button"
                  disabled={!isAvailable(d)}
                  onClick={() => {
                    setDate(d);
                    setSlot(null);
                  }}
                  className={[
                    'aspect-square rounded-lg text-sm transition',
                    date && sameDay(d, date)
                      ? 'bg-accent font-bold text-accent-contrast'
                      : isAvailable(d)
                        ? 'font-medium text-fg hover:bg-accent-soft hover:text-accent'
                        : 'text-muted/40',
                    sameDay(d, today) ? 'ring-1 ring-line' : '',
                  ].join(' ')}
                >
                  {d.getDate()}
                </button>
              ),
            )}
          </div>

          {date && (
            <div className="mt-4 border-t border-line pt-4">
              <span className="label">Available times (Bangladesh time)</span>
              <div className="grid grid-cols-3 gap-2">
                {slots.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setSlot(s)}
                    className={[
                      'rounded-lg border px-2 py-2 font-mono text-xs transition',
                      slot === s
                        ? 'border-accent bg-accent text-accent-contrast'
                        : 'border-line bg-surface text-fg hover:border-accent hover:text-accent',
                    ].join(' ')}
                  >
                    {fmtTime(s)}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      <div>
        <label className="label" htmlFor="c-details">Project details *</label>
        <textarea
          id="c-details"
          name="message"
          required
          rows={4}
          className="input resize-y"
          placeholder="Tell me what you want to build or automate…"
        />
      </div>

      {error && <p className="text-sm text-red-500" role="alert">{error}</p>}

      <button type="submit" className="btn-primary w-full py-3" disabled={status === 'sending'}>
        {status === 'sending' ? 'Sending…' : 'Request Consultation'}
      </button>
      <p className="text-center text-xs text-muted">Free 30-minute discovery call · Reply within 24 hours</p>
    </form>
  );
}
