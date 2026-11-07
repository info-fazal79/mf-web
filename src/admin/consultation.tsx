import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { addDays, dhakaToday, fmt12, googleCalendarUrl, weekdayOf } from '@/lib/booking';
import { StatusBadge } from './pages';
import { Empty, I, Modal, PageTitle, Panel, useToast } from './ui';

type Booking = {
  id: string;
  name: string;
  email: string;
  phone: string;
  address: string | null;
  topic: string | null;
  message: string;
  preferred_date: string | null;
  preferred_time: string | null;
  duration_minutes: number | null;
  status: 'pending' | 'confirmed' | 'completed' | 'cancelled';
  meeting_link: string | null;
  admin_notes: string | null;
  created_at: string;
};
type Rule = { id?: string; weekday: number; start_time: string; end_time: string };
type Override = { id?: string; date: string; is_closed: boolean; start_time: string | null; end_time: string | null; note: string | null };

const STATUSES = ['pending', 'confirmed', 'completed', 'cancelled'] as const;
const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const sb = () => supabase!;
const slotLabel = (b: Booking) => (b.preferred_date ? `${b.preferred_date} · ${b.preferred_time ? fmt12(b.preferred_time) : ''}` : 'No slot');
const digits = (p: string) => p.replace(/\D/g, '').replace(/^0/, '880');

export function Consultations({ go }: { go: (r: string) => void }) {
  const [tab, setTab] = useState<'list' | 'calendar' | 'availability'>('list');
  const toast = useToast();
  const [rows, setRows] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState<Booking | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    const { data, error } = await sb().from('consultations').select('*').order('created_at', { ascending: false });
    if (error) toast(error.message, false);
    setRows((data as Booking[]) ?? []);
    setLoading(false);
  }, [toast]);
  useEffect(() => {
    reload();
  }, [reload]);

  async function update(b: Booking, patch: Partial<Booking>) {
    const { error } = await sb().from('consultations').update(patch).eq('id', b.id);
    if (error) {
      toast(error.code === '23505' ? 'Another active booking already uses that slot.' : error.message, false);
      return;
    }
    setRows((x) => x.map((r) => (r.id === b.id ? { ...r, ...patch } : r)));
    setOpen((o) => (o?.id === b.id ? { ...o, ...patch } : o));
    toast('Updated');
  }
  async function remove(b: Booking) {
    if (!confirm(`Delete the request from ${b.name}? This cannot be undone.`)) return;
    const { error } = await sb().from('consultations').delete().eq('id', b.id);
    if (error) return toast(error.message, false);
    setRows((x) => x.filter((r) => r.id !== b.id));
    setOpen(null);
  }

  return (
    <div>
      <PageTitle
        title="Consultations"
        sub="Booking requests, your calendar and open hours."
        actions={
          <button type="button" className="btn-ghost" onClick={() => go('s/consultation')}>
            <I n="settings" s={15} /> Booking settings
          </button>
        }
      />
      <div className="mb-5 inline-flex rounded-xl border border-line bg-surface p-1">
        {(
          [
            ['list', 'Requests'],
            ['calendar', 'Calendar'],
            ['availability', 'Availability'],
          ] as const
        ).map(([k, l]) => (
          <button key={k} type="button" onClick={() => setTab(k)} className={`rounded-lg px-4 py-1.5 text-sm font-semibold transition ${tab === k ? 'bg-accent text-accent-contrast' : 'text-muted hover:text-fg'}`}>
            {l}
          </button>
        ))}
      </div>

      {tab === 'list' && <RequestList rows={rows} loading={loading} onOpen={setOpen} />}
      {tab === 'calendar' && <BookingCalendar rows={rows} onOpen={setOpen} />}
      {tab === 'availability' && <AvailabilityEditor />}

      <BookingModal booking={open} onClose={() => setOpen(null)} onUpdate={update} onDelete={remove} />
    </div>
  );
}

/* ---------------- Requests list ---------------- */
function RequestList({ rows, loading, onOpen }: { rows: Booking[]; loading: boolean; onOpen: (b: Booking) => void }) {
  const [filter, setFilter] = useState<string>('all');
  const [q, setQ] = useState('');
  const [when, setWhen] = useState<'all' | 'upcoming' | 'past'>('all');
  const today = dhakaToday();

  const shown = rows.filter((r) => {
    if (filter !== 'all' && r.status !== filter) return false;
    if (when === 'upcoming' && (!r.preferred_date || r.preferred_date < today)) return false;
    if (when === 'past' && (!r.preferred_date || r.preferred_date >= today)) return false;
    if (q) {
      const s = q.toLowerCase();
      return [r.name, r.email, r.phone, r.topic, r.message].some((v) => v?.toLowerCase().includes(s));
    }
    return true;
  });

  function exportCsv() {
    const esc = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const head = ['name', 'email', 'phone', 'address', 'topic', 'date', 'time', 'status', 'meeting_link', 'message', 'created_at'];
    const lines = shown.map((r) => [r.name, r.email, r.phone, r.address, r.topic, r.preferred_date, r.preferred_time, r.status, r.meeting_link, r.message, r.created_at].map(esc).join(','));
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([[head.join(','), ...lines].join('\n')], { type: 'text/csv' }));
    a.download = `consultations-${today}.csv`;
    a.click();
  }

  return (
    <Panel>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {['all', ...STATUSES].map((s) => (
          <button key={s} type="button" onClick={() => setFilter(s)} className={`rounded-lg px-3 py-1.5 text-xs font-semibold capitalize ${filter === s ? 'bg-accent text-accent-contrast' : 'border border-line text-muted hover:text-fg'}`}>
            {s} <span className="opacity-70">{s === 'all' ? rows.length : rows.filter((r) => r.status === s).length}</span>
          </button>
        ))}
        <select value={when} onChange={(e) => setWhen(e.target.value as typeof when)} className="input ml-auto w-auto py-1.5 text-xs">
          <option value="all">Any date</option>
          <option value="upcoming">Upcoming</option>
          <option value="past">Past</option>
        </select>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search…" className="input w-44 py-1.5 text-xs" />
        <button type="button" onClick={exportCsv} disabled={!shown.length} className="btn-ghost px-3 py-1.5 text-xs"><I n="file" s={14} /> CSV</button>
      </div>
      {loading ? (
        <p className="py-8 text-center text-sm text-muted">Loading…</p>
      ) : shown.length === 0 ? (
        <Empty text="No consultation requests here." icon="calendar" />
      ) : (
        <ul className="divide-y divide-line">
          {shown.map((r) => (
            <li key={r.id}>
              <button type="button" onClick={() => onOpen(r)} className="flex w-full flex-wrap items-center gap-x-4 gap-y-1 py-3 text-left text-sm hover:bg-surface-2/50">
                <span className="w-44 truncate font-semibold">{r.name}</span>
                <span className="min-w-0 flex-1 truncate text-muted">{r.topic ?? ''} · {r.message}</span>
                <span className="font-mono text-xs text-muted">{slotLabel(r)}</span>
                <StatusBadge s={r.status} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

/* ---------------- Calendar view ---------------- */
function BookingCalendar({ rows, onOpen }: { rows: Booking[]; onOpen: (b: Booking) => void }) {
  const today = dhakaToday();
  const [month, setMonth] = useState(today.slice(0, 7));
  const byDate = useMemo(() => {
    const m = new Map<string, Booking[]>();
    for (const r of rows) {
      if (!r.preferred_date || r.status === 'cancelled') continue;
      m.set(r.preferred_date, [...(m.get(r.preferred_date) ?? []), r]);
    }
    for (const list of m.values()) list.sort((a, b) => (a.preferred_time ?? '').localeCompare(b.preferred_time ?? ''));
    return m;
  }, [rows]);

  const first = `${month}-01`;
  const [y, mo] = month.split('-').map(Number);
  const count = new Date(Date.UTC(y, mo, 0)).getUTCDate();
  const cells: (string | null)[] = Array(weekdayOf(first)).fill(null);
  for (let i = 0; i < count; i++) cells.push(addDays(first, i));
  const shift = (n: number) => setMonth(new Date(Date.UTC(y, mo - 1 + n, 1)).toISOString().slice(0, 7));

  return (
    <Panel>
      <div className="mb-4 flex items-center justify-between">
        <button type="button" onClick={() => shift(-1)} className="btn-ghost px-3 py-1.5">‹</button>
        <h2 className="font-bold">{new Date(`${first}T00:00:00Z`).toLocaleString('en', { month: 'long', year: 'numeric', timeZone: 'UTC' })}</h2>
        <button type="button" onClick={() => shift(1)} className="btn-ghost px-3 py-1.5">›</button>
      </div>
      <div className="grid grid-cols-7 gap-1.5">
        {DAYS.map((d) => (
          <span key={d} className="pb-1 text-center font-mono text-[11px] text-muted">{d.slice(0, 3)}</span>
        ))}
        {cells.map((iso, i) =>
          iso === null ? (
            <span key={`e${i}`} />
          ) : (
            <div key={iso} className={`min-h-24 rounded-lg border p-1.5 ${iso === today ? 'border-accent' : 'border-line'} ${iso < today ? 'opacity-60' : ''}`}>
              <p className={`text-xs font-semibold ${iso === today ? 'text-accent' : 'text-muted'}`}>{Number(iso.slice(8))}</p>
              <div className="mt-1 grid gap-1">
                {(byDate.get(iso) ?? []).map((b) => (
                  <button
                    key={b.id}
                    type="button"
                    onClick={() => onOpen(b)}
                    className={`truncate rounded px-1.5 py-0.5 text-left text-[11px] font-medium ${b.status === 'confirmed' ? 'bg-accent text-accent-contrast' : b.status === 'completed' ? 'bg-blue-500/20 text-blue-500' : 'bg-yellow-500/20 text-yellow-600 dark:text-yellow-400'}`}
                    title={`${b.name} · ${b.topic ?? ''}`}
                  >
                    {b.preferred_time ? fmt12(b.preferred_time) : ''} {b.name}
                  </button>
                ))}
              </div>
            </div>
          ),
        )}
      </div>
      <p className="mt-3 flex flex-wrap gap-4 text-xs text-muted">
        <span><span className="mr-1 inline-block h-2 w-2 rounded-sm bg-yellow-500/60" />Pending</span>
        <span><span className="mr-1 inline-block h-2 w-2 rounded-sm bg-accent" />Confirmed</span>
        <span><span className="mr-1 inline-block h-2 w-2 rounded-sm bg-blue-500/60" />Completed</span>
      </p>
    </Panel>
  );
}

/* ---------------- Booking detail ---------------- */
function BookingModal({
  booking: b,
  onClose,
  onUpdate,
  onDelete,
}: {
  booking: Booking | null;
  onClose: () => void;
  onUpdate: (b: Booking, p: Partial<Booking>) => void;
  onDelete: (b: Booking) => void;
}) {
  const [link, setLink] = useState('');
  const [notes, setNotes] = useState('');
  useEffect(() => {
    setLink(b?.meeting_link ?? '');
    setNotes(b?.admin_notes ?? '');
  }, [b?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!b) return null;
  const when = b.preferred_date && b.preferred_time ? `${new Date(`${b.preferred_date}T00:00:00Z`).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' })} at ${fmt12(b.preferred_time)} (Bangladesh time)` : '';
  const confirmMsg = `Assalamu Alaikum ${b.name}, your consultation${when ? ` on ${when}` : ''} is confirmed.${link ? ` Meeting link: ${link}` : ''} — Muhammad Fazal`;

  return (
    <Modal open onClose={onClose} title={`Consultation · ${b.name}`}>
      <div className="grid gap-4 text-sm">
        <dl className="grid grid-cols-[100px_1fr] gap-y-2">
          <dt className="text-muted">Email</dt><dd><a className="text-accent" href={`mailto:${b.email}`}>{b.email}</a></dd>
          <dt className="text-muted">Phone</dt><dd><a className="text-accent" href={`tel:${b.phone}`}>{b.phone}</a></dd>
          <dt className="text-muted">Address</dt><dd>{b.address || '—'}</dd>
          <dt className="text-muted">Topic</dt><dd>{b.topic || '—'}</dd>
          <dt className="text-muted">Slot</dt><dd>{when || 'Not selected'}</dd>
          <dt className="text-muted">Received</dt><dd>{new Date(b.created_at).toLocaleString()}</dd>
        </dl>
        <p className="rounded-xl bg-surface-2 p-3 whitespace-pre-wrap">{b.message}</p>

        <div>
          <span className="label">Status</span>
          <div className="flex flex-wrap gap-2">
            {STATUSES.map((s) => (
              <button key={s} type="button" onClick={() => s !== b.status && onUpdate(b, { status: s })} className={`rounded-lg px-3 py-1.5 text-xs font-semibold capitalize ${b.status === s ? 'bg-accent text-accent-contrast' : 'border border-line text-muted hover:text-fg'}`}>
                {s}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="label" htmlFor="bk-link">Meeting link</label>
          <input id="bk-link" className="input" value={link} onChange={(e) => setLink(e.target.value)} onBlur={() => link !== (b.meeting_link ?? '') && onUpdate(b, { meeting_link: link || null })} placeholder="https://meet.google.com/…" />
        </div>
        <div>
          <label className="label" htmlFor="bk-notes">Private notes</label>
          <textarea id="bk-notes" className="input" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} onBlur={() => notes !== (b.admin_notes ?? '') && onUpdate(b, { admin_notes: notes || null })} />
        </div>

        <div className="flex flex-wrap justify-end gap-2 border-t border-line pt-4">
          <button type="button" className="btn-ghost text-red-500" onClick={() => onDelete(b)}><I n="trash" s={15} /> Delete</button>
          {b.preferred_date && b.preferred_time && (
            <a className="btn-ghost" target="_blank" rel="noopener" href={googleCalendarUrl(`Consultation: ${b.name}`, b.preferred_date, b.preferred_time, b.duration_minutes ?? 30, `${b.topic ?? ''}\n${b.email} · ${b.phone}\n\n${b.message}`)}>
              <I n="calendar" s={15} /> Google Calendar
            </a>
          )}
          <a className="btn-ghost" target="_blank" rel="noopener" href={`https://wa.me/${digits(b.phone)}?text=${encodeURIComponent(confirmMsg)}`}>WhatsApp</a>
          <a className="btn-primary" href={`mailto:${b.email}?subject=${encodeURIComponent('Your consultation with Muhammad Fazal')}&body=${encodeURIComponent(confirmMsg)}`}>
            <I n="mail" s={15} /> Email
          </a>
        </div>
      </div>
    </Modal>
  );
}

/* ---------------- Availability ---------------- */
function AvailabilityEditor() {
  const toast = useToast();
  const [rules, setRules] = useState<Rule[]>([]);
  const [saved, setSaved] = useState('');
  const [overrides, setOverrides] = useState<Override[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState<Override>({ date: '', is_closed: true, start_time: '10:00', end_time: '13:00', note: '' });

  const load = useCallback(async () => {
    setLoading(true);
    const [r, o] = await Promise.all([
      sb().from('availability_rules').select('*').order('weekday').order('start_time'),
      sb().from('availability_overrides').select('*').gte('date', dhakaToday()).order('date'),
    ]);
    if (r.error || o.error) toast((r.error || o.error)!.message, false);
    const rr = ((r.data as Rule[]) ?? []).map((x) => ({ ...x, start_time: x.start_time.slice(0, 5), end_time: x.end_time.slice(0, 5) }));
    setRules(rr);
    setSaved(JSON.stringify(rr));
    setOverrides(((o.data as Override[]) ?? []).map((x) => ({ ...x, start_time: x.start_time?.slice(0, 5) ?? null, end_time: x.end_time?.slice(0, 5) ?? null })));
    setLoading(false);
  }, [toast]);
  useEffect(() => {
    load();
  }, [load]);

  const dirty = JSON.stringify(rules) !== saved;
  const setRule = (i: number, p: Partial<Rule>) => setRules((x) => x.map((r, j) => (j === i ? { ...r, ...p } : r)));

  async function saveRules() {
    const bad = rules.find((r) => r.end_time <= r.start_time);
    if (bad) return toast(`${DAYS[bad.weekday]}: end time must be after start time`, false);
    setSaving(true);
    const del = await sb().from('availability_rules').delete().not('id', 'is', null);
    if (del.error) {
      setSaving(false);
      return toast(del.error.message, false);
    }
    if (rules.length) {
      const ins = await sb().from('availability_rules').insert(rules.map(({ weekday, start_time, end_time }) => ({ weekday, start_time, end_time })));
      if (ins.error) toast(ins.error.message, false);
    }
    setSaving(false);
    toast('Weekly hours saved');
    load();
  }

  async function addOverride() {
    if (!draft.date) return toast('Pick a date', false);
    if (!draft.is_closed && (!draft.start_time || !draft.end_time || draft.end_time <= draft.start_time)) return toast('Set a valid time range', false);
    const row = { date: draft.date, is_closed: draft.is_closed, start_time: draft.is_closed ? null : draft.start_time, end_time: draft.is_closed ? null : draft.end_time, note: draft.note || null };
    const { error } = await sb().from('availability_overrides').insert(row);
    if (error) return toast(error.message, false);
    toast('Date added');
    setDraft({ ...draft, date: '', note: '' });
    load();
  }
  async function removeOverride(o: Override) {
    const { error } = await sb().from('availability_overrides').delete().eq('id', o.id!);
    if (error) return toast(error.message, false);
    setOverrides((x) => x.filter((y) => y.id !== o.id));
  }

  if (loading) return <Panel><p className="py-8 text-center text-sm text-muted">Loading…</p></Panel>;

  return (
    <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
      <Panel title="Weekly hours (Bangladesh time)">
        <div className="grid gap-3">
          {DAYS.map((day, w) => {
            const list = rules.map((r, i) => ({ r, i })).filter((x) => x.r.weekday === w);
            return (
              <div key={day} className="flex flex-wrap items-start gap-3 border-b border-line pb-3 last:border-0">
                <span className={`w-24 pt-2 text-sm font-semibold ${list.length ? '' : 'text-muted'}`}>{day}</span>
                <div className="grid flex-1 gap-2">
                  {list.length === 0 && <span className="pt-2 text-sm text-muted">Unavailable</span>}
                  {list.map(({ r, i }) => (
                    <div key={i} className="flex items-center gap-2">
                      <input type="time" step={900} value={r.start_time} onChange={(e) => setRule(i, { start_time: e.target.value })} className="input w-32 py-1.5" />
                      <span className="text-muted">–</span>
                      <input type="time" step={900} value={r.end_time} onChange={(e) => setRule(i, { end_time: e.target.value })} className="input w-32 py-1.5" />
                      <button type="button" onClick={() => setRules((x) => x.filter((_, j) => j !== i))} className="grid h-8 w-8 place-items-center rounded-lg text-muted hover:text-red-500" aria-label="Remove range"><I n="trash" s={15} /></button>
                    </div>
                  ))}
                </div>
                <button type="button" onClick={() => setRules((x) => [...x, { weekday: w, start_time: '10:00', end_time: '12:00' }])} className="btn-ghost px-2.5 py-1.5 text-xs" aria-label={`Add hours on ${day}`}>
                  <I n="plus" s={14} />
                </button>
              </div>
            );
          })}
        </div>
        <div className="mt-4 flex justify-end">
          <button type="button" className="btn-primary" disabled={!dirty || saving} onClick={saveRules}>
            <I n="check" s={15} /> {saving ? 'Saving…' : dirty ? 'Save weekly hours' : 'Saved'}
          </button>
        </div>
      </Panel>

      <Panel title="Holidays & special dates">
        <div className="grid gap-3 rounded-xl border border-line bg-surface-2 p-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label" htmlFor="ov-date">Date</label>
              <input id="ov-date" type="date" min={dhakaToday()} value={draft.date} onChange={(e) => setDraft({ ...draft, date: e.target.value })} className="input" />
            </div>
            <div>
              <label className="label" htmlFor="ov-type">Type</label>
              <select id="ov-type" value={draft.is_closed ? 'closed' : 'custom'} onChange={(e) => setDraft({ ...draft, is_closed: e.target.value === 'closed' })} className="input">
                <option value="closed">Closed all day</option>
                <option value="custom">Custom hours</option>
              </select>
            </div>
          </div>
          {!draft.is_closed && (
            <div className="flex items-center gap-2">
              <input type="time" step={900} value={draft.start_time ?? ''} onChange={(e) => setDraft({ ...draft, start_time: e.target.value })} className="input" />
              <span className="text-muted">–</span>
              <input type="time" step={900} value={draft.end_time ?? ''} onChange={(e) => setDraft({ ...draft, end_time: e.target.value })} className="input" />
            </div>
          )}
          <input value={draft.note ?? ''} onChange={(e) => setDraft({ ...draft, note: e.target.value })} placeholder="Note (e.g. Eid holiday)" className="input" />
          <button type="button" onClick={addOverride} className="btn-primary"><I n="plus" s={15} /> Add date</button>
          <p className="text-xs text-muted">Custom hours replace that day's weekly hours. Add several for multiple ranges.</p>
        </div>
        {overrides.length === 0 ? (
          <p className="mt-4 text-center text-sm text-muted">No upcoming special dates.</p>
        ) : (
          <ul className="mt-4 divide-y divide-line">
            {overrides.map((o) => (
              <li key={o.id} className="flex items-center gap-3 py-2.5 text-sm">
                <span className="font-mono text-xs">{o.date}</span>
                <span className={`rounded-md px-2 py-0.5 text-xs font-semibold ${o.is_closed ? 'bg-red-500/15 text-red-500' : 'bg-accent-soft text-accent'}`}>
                  {o.is_closed ? 'Closed' : `${fmt12(o.start_time!)} – ${fmt12(o.end_time!)}`}
                </span>
                <span className="flex-1 truncate text-muted">{o.note}</span>
                <button type="button" onClick={() => removeOverride(o)} className="text-muted hover:text-red-500" aria-label="Remove"><I n="trash" s={15} /></button>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}
