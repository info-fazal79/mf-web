/* Nusuk Manager → Reward Club → Competitions: create, edit, turn on/off, duplicate, delete (update_33_club_contests.sql). */
import { useCallback, useEffect, useRef, useState } from 'react';
import { Copy, Pencil, Plus, Power, Trash2, Trophy } from 'lucide-react';
import { supabase as sb } from '@/lib/supabase';
import { CONTEST_CAPTIONS, CONTEST_KINDS, contestRules, type Contest, type ContestKind } from '../_lib/club';
import { CARD_THEMES, drawCard, type CardTheme } from '../_lib/clubcard';

type ToastFn = (t: string, ok?: boolean) => void;
const errText = (e: unknown) => (e && typeof e === 'object' && 'message' in e ? String((e as { message: string }).message) : String(e));
type Count = { id: number; tickets: number; people: number };

/** ISO → "YYYY-MM-DDTHH:mm" in Bangladesh time, for <input type="datetime-local"> */
function toLocal(iso: string | null) {
  if (!iso) return '';
  const d = new Date(new Date(iso).getTime() + 6 * 3600000);
  return d.toISOString().slice(0, 16);
}
/** "YYYY-MM-DDTHH:mm" typed as Bangladesh time → ISO */
const fromLocal = (v: string) => (v ? new Date(`${v}:00+06:00`).toISOString() : null);

function status(c: Contest, now: number) {
  if (!c.active) return { t: 'Off', cls: 'bg-[#f1ede1] text-emerald-900/60' };
  if (c.starts_at && now < new Date(c.starts_at).getTime()) return { t: 'Scheduled', cls: 'bg-sky-100 text-sky-900' };
  if (c.ends_at && now >= new Date(c.ends_at).getTime()) return { t: 'Ended', cls: 'bg-[#f1ede1] text-emerald-900/60' };
  return { t: 'Running', cls: 'bg-emerald-100 text-emerald-900' };
}

const blank = (): Omit<Contest, 'id'> => ({
  title: '', kind: 'lucky', active: false, starts_at: null, ends_at: null,
  t_join: 1, t_enter: 0, t_ref_bonus: 1, t_referral: 1, t_copy: 1, copy_from: '09:00', copy_to: '17:00',
  info: '', card: { theme: 'green', headline: 'নুসুক উমরাহ প্রতিযোগিতা', sub: '', line: '' }, caption: '', sort: 10,
});
const PRESET: Record<ContestKind, Partial<Contest>> = {
  lucky: { t_join: 1, t_enter: 0, t_ref_bonus: 1, t_referral: 1, t_copy: 1 },
  window: { t_join: 1, t_enter: 0, t_ref_bonus: 1, t_referral: 2, t_copy: 0 },
  top: { t_join: 0, t_enter: 0, t_ref_bonus: 0, t_referral: 1, t_copy: 0 },
};

export default function ContestsPanel({ toast, onChange }: { toast: ToastFn; onChange: (list: Contest[]) => void }) {
  const [list, setList] = useState<Contest[] | null>(null);
  const [counts, setCounts] = useState<Record<number, Count>>({});
  const [edit, setEdit] = useState<(Omit<Contest, 'id'> & { id?: number }) | null>(null);
  const [busy, setBusy] = useState(false);
  const now = Date.now();

  const load = useCallback(async () => {
    const { data, error } = await sb!.from('nusuk_club_contests').select('*').order('sort').order('id');
    if (error) { toast(errText(error).includes('nusuk_club_contests') ? 'Run update_33_club_contests.sql in Supabase first' : errText(error), false); setList([]); return; }
    const l = (data ?? []) as Contest[];
    setList(l);
    onChange(l);
    const { data: n } = await sb!.rpc('nusuk_admin_club_contests');
    setCounts(Object.fromEntries(((n ?? []) as Count[]).map((x) => [x.id, x])));
  }, [toast, onChange]);
  useEffect(() => { load(); }, [load]);

  async function save() {
    if (!edit) return;
    if (edit.title.trim().length < 2) return toast('Give the competition a name', false);
    if (edit.starts_at && edit.ends_at && new Date(edit.starts_at) >= new Date(edit.ends_at)) return toast('End time must be after the start time', false);
    setBusy(true);
    const { id, my: _m, top: _t, in_window: _w, ...row } = edit as Contest;
    const clean = { ...row, title: row.title.trim() };
    const { error } = id
      ? await sb!.from('nusuk_club_contests').update(clean).eq('id', id)
      : await sb!.from('nusuk_club_contests').insert(clean);
    setBusy(false);
    if (error) return toast(errText(error), false);
    toast(id ? 'Competition saved' : 'Competition created');
    setEdit(null);
    load();
  }
  async function toggle(c: Contest) {
    const { error } = await sb!.from('nusuk_club_contests').update({ active: !c.active }).eq('id', c.id);
    if (error) return toast(errText(error), false);
    toast(c.active ? `"${c.title}" is off` : `"${c.title}" is on`);
    load();
  }
  async function remove(c: Contest) {
    const n = counts[c.id]?.tickets ?? 0;
    if (!confirm(`Delete "${c.title}"?${n ? `\n\nIts ${n} tickets will be deleted too.` : ''}\nThis cannot be undone.`)) return;
    const { error } = await sb!.from('nusuk_club_contests').delete().eq('id', c.id);
    if (error) return toast(errText(error), false);
    toast('Deleted');
    load();
  }
  const duplicate = (c: Contest) => {
    const { id: _i, ...rest } = c;
    setEdit({ ...rest, title: `${c.title} (copy)`, active: false });
  };

  return (
    <section className="nk-card p-4 sm:p-5">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-base font-bold text-emerald-950"><Trophy className="h-5 w-5" aria-hidden /> Competitions</h2>
        <button type="button" className="nk-btn nk-green flex items-center gap-1.5 px-4 py-2 text-sm" onClick={() => setEdit(blank())}><Plus className="h-4 w-4" aria-hidden /> New competition</button>
      </div>
      <p className="mb-3 text-xs text-emerald-900/65">
        Every running competition gives its own tickets at the same time (a member can be in several). Tickets are counted separately per competition.
        Members only see competitions that are On and inside their start/end time.
      </p>
      {!list && <p className="text-sm text-emerald-900/60">Loading…</p>}
      <div className="grid gap-2">
        {list?.map((c) => {
          const st = status(c, now);
          const k = CONTEST_KINDS.find((x) => x.key === c.kind);
          return (
            <div key={c.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#e7e1cf] p-3">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <b>{c.title}</b>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${st.cls}`}>{st.t}</span>
                  <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs">{k?.name}</span>
                </div>
                <div className="mt-0.5 text-xs text-emerald-900/65">
                  Join {c.t_join} · Enter {c.t_enter} · Joined-with-code {c.t_ref_bonus} · Per referral {c.t_referral} · Daily copy {c.t_copy}
                  {(c.starts_at || c.ends_at) && <> · {c.starts_at ? new Date(c.starts_at).toLocaleString('en-GB', { timeZone: 'Asia/Dhaka', dateStyle: 'medium', timeStyle: 'short' }) : 'now'} → {c.ends_at ? new Date(c.ends_at).toLocaleString('en-GB', { timeZone: 'Asia/Dhaka', dateStyle: 'medium', timeStyle: 'short' }) : 'no end'}</>}
                  {' · '}<b>{counts[c.id]?.tickets ?? 0}</b> tickets / {counts[c.id]?.people ?? 0} people
                </div>
              </div>
              <div className="flex shrink-0 gap-1.5">
                <button type="button" className={`nk-btn flex items-center gap-1 px-3 py-1.5 text-sm ${c.active ? 'nk-green' : 'nk-ghost'}`} onClick={() => toggle(c)} title={c.active ? 'Turn off' : 'Turn on'}><Power className="h-4 w-4" aria-hidden />{c.active ? 'On' : 'Off'}</button>
                <button type="button" className="nk-btn nk-ghost px-2.5 py-1.5" onClick={() => setEdit({ ...c })} aria-label="Edit"><Pencil className="h-4 w-4" aria-hidden /></button>
                <button type="button" className="nk-btn nk-ghost px-2.5 py-1.5" onClick={() => duplicate(c)} aria-label="Duplicate"><Copy className="h-4 w-4" aria-hidden /></button>
                <button type="button" className="nk-btn nk-ghost px-2.5 py-1.5 text-red-700" onClick={() => remove(c)} aria-label="Delete"><Trash2 className="h-4 w-4" aria-hidden /></button>
              </div>
            </div>
          );
        })}
      </div>

      {edit && <Editor value={edit} onChange={setEdit} onSave={save} onCancel={() => setEdit(null)} busy={busy} />}
    </section>
  );
}

function Num({ label, hint, value, onChange }: { label: string; hint: string; value: number; onChange: (n: number) => void }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-semibold">{label}</span>
      <input type="number" min={0} max={100} className="nk-input py-1.5" value={value} onChange={(e) => onChange(Math.max(0, Math.min(100, Math.round(Number(e.target.value) || 0))))} />
      <span className="mt-0.5 block text-[11px] leading-snug text-emerald-900/55">{hint}</span>
    </label>
  );
}

function Editor({ value: c, onChange, onSave, onCancel, busy }: {
  value: Omit<Contest, 'id'> & { id?: number };
  onChange: (c: Omit<Contest, 'id'> & { id?: number }) => void;
  onSave: () => void; onCancel: () => void; busy: boolean;
}) {
  const set = (p: Partial<Contest>) => onChange({ ...c, ...p });
  const setCard = (p: Partial<Contest['card']>) => onChange({ ...c, card: { ...c.card, ...p } });
  const canvas = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (!canvas.current) return;
    const t = setTimeout(() => {
      drawCard(canvas.current!, { code: 'NG-y3JkB7lU', sl: 1001, name: 'নমুনা নাম', theme: c.card.theme, headline: c.card.headline, sub: c.card.sub || c.title, line: c.card.line, badge: c.ends_at ? 'শেষ: ২০ নভেম্বর, রাত ১১:৫৯' : undefined });
    }, 250);
    return () => clearTimeout(t);
  }, [c.card, c.title, c.ends_at]);

  const label = 'mb-1 block text-sm font-semibold';
  return (
    <div className="mt-4 grid gap-4 rounded-2xl border-2 border-emerald-600/40 bg-emerald-50/40 p-4">
      <h3 className="text-base font-bold">{c.id ? 'Edit competition' : 'New competition'}</h3>
      <div className="grid gap-3 sm:grid-cols-[1fr_14rem]">
        <label><span className={label}>Name (members see this)</span>
          <input className="nk-input" value={c.title} maxLength={80} onChange={(e) => set({ title: e.target.value })} placeholder="যেমন: সীমিত সময়ের রেফারেল অফার" /></label>
        <label><span className={label}>Type</span>
          <select className="nk-input" value={c.kind} onChange={(e) => { const k = e.target.value as ContestKind; set({ kind: k, ...(c.id ? {} : PRESET[k]) }); }}>
            {CONTEST_KINDS.map((k) => <option key={k.key} value={k.key}>{k.name}</option>)}
          </select>
          <span className="mt-0.5 block text-[11px] text-emerald-900/55">{CONTEST_KINDS.find((k) => k.key === c.kind)?.hint}</span></label>
      </div>
      <label className="flex items-center gap-2.5 text-sm font-semibold">
        <input type="checkbox" className="h-4 w-4 accent-emerald-700" checked={!!c.active} onChange={(e) => set({ active: e.target.checked })} /> On (members see it while inside the time below)
      </label>
      <div className="grid gap-3 sm:grid-cols-2">
        <label><span className={label}>Starts (Bangladesh time, empty = now)</span>
          <input type="datetime-local" className="nk-input" value={toLocal(c.starts_at)} onChange={(e) => set({ starts_at: fromLocal(e.target.value) })} /></label>
        <label><span className={label}>Ends (empty = no end)</span>
          <input type="datetime-local" className="nk-input" value={toLocal(c.ends_at)} onChange={(e) => set({ ends_at: fromLocal(e.target.value) })} /></label>
      </div>

      <div>
        <div className={label}>Tickets (0 = off)</div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          <Num label="New account" hint="Account made while it runs" value={c.t_join} onChange={(n) => set({ t_join: n })} />
          <Num label="Enter (all members)" hint="Once, old members too" value={c.t_enter} onChange={(n) => set({ t_enter: n })} />
          <Num label="Joined with a code" hint="Extra for the new member" value={c.t_ref_bonus} onChange={(n) => set({ t_ref_bonus: n })} />
          <Num label="Per referral" hint="To the code owner, each new member" value={c.t_referral} onChange={(n) => set({ t_referral: n })} />
          <Num label="Daily code copy" hint="Once a day in the copy time" value={c.t_copy} onChange={(n) => set({ t_copy: n })} />
        </div>
        {c.t_copy > 0 && (
          <div className="mt-3 grid max-w-md grid-cols-2 gap-3">
            <label><span className="mb-1 block text-xs font-semibold">Copy time from</span><input type="time" className="nk-input py-1.5" value={c.copy_from} onChange={(e) => set({ copy_from: e.target.value })} /></label>
            <label><span className="mb-1 block text-xs font-semibold">until</span><input type="time" className="nk-input py-1.5" value={c.copy_to} onChange={(e) => set({ copy_to: e.target.value })} /></label>
          </div>
        )}
      </div>

      <label><span className={label}>Short description for members</span>
        <textarea className="nk-input text-sm" rows={2} value={c.info} maxLength={500} onChange={(e) => set({ info: e.target.value })} /></label>
      <details className="rounded-xl bg-white p-3 text-sm">
        <summary className="cursor-pointer font-semibold">Rules members will see (written from the numbers above)</summary>
        <ul className="mt-2 list-disc space-y-1 pl-5">{contestRules({ ...c }).map((r, i) => <li key={i}>{r}</li>)}</ul>
      </details>

      <div className="grid gap-4 lg:grid-cols-[1fr_16rem]">
        <div className="grid content-start gap-3">
          <div className={label}>Photo card</div>
          <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Card design">
            {CARD_THEMES.map((t) => (
              <button key={t.key} type="button" role="radio" aria-checked={c.card.theme === t.key} onClick={() => setCard({ theme: t.key as CardTheme })}
                className={`rounded-xl border p-2 text-sm font-semibold ${ (c.card.theme ?? 'green') === t.key ? 'border-emerald-600 bg-white ring-2 ring-emerald-600/20' : 'border-[#e7e1cf] bg-white'}`}>{t.name}</button>
            ))}
          </div>
          <label><span className="mb-1 block text-xs font-semibold">Headline</span><input className="nk-input" maxLength={60} value={c.card.headline ?? ''} onChange={(e) => setCard({ headline: e.target.value })} placeholder="নুসুক উমরাহ প্রতিযোগিতা" /></label>
          <label><span className="mb-1 block text-xs font-semibold">Second line (empty = competition name)</span><input className="nk-input" maxLength={60} value={c.card.sub ?? ''} onChange={(e) => setCard({ sub: e.target.value })} /></label>
          <label><span className="mb-1 block text-xs font-semibold">Line under the code</span><input className="nk-input" maxLength={120} value={c.card.line ?? ''} onChange={(e) => setCard({ line: e.target.value })} placeholder="এই কোড দিয়ে যুক্ত হলে আপনিও পাবেন ১টি বাড়তি টিকিট" /></label>
        </div>
        <canvas ref={canvas} className="w-full rounded-xl border border-[#e7e1cf]" aria-label="Card preview" />
      </div>

      <label>
        <span className="mb-1 flex flex-wrap items-center justify-between gap-2 text-sm font-semibold">Facebook caption (saved = the default every member gets)
          <button type="button" className="nk-btn nk-ghost px-3 py-1 text-xs" onClick={() => set({ caption: CONTEST_CAPTIONS[c.kind] })}>Start from the sample caption</button>
        </span>
        <textarea className="nk-input font-mono text-sm" rows={12} value={c.caption} placeholder={CONTEST_CAPTIONS[c.kind]} onChange={(e) => set({ caption: e.target.value })} />
        <span className="mt-1 block text-xs text-emerald-900/60">Empty = the sample caption for this type. Use {'{code}'}, {'{name}'}, {'{sl}'}, {'{link}'} and {'{ends}'} (end time). Members can still change their own copy before posting.</span>
      </label>

      <div className="flex flex-wrap gap-2">
        <button type="button" className="nk-btn nk-green px-5 py-2" disabled={busy} onClick={onSave}>{busy ? 'Saving…' : 'Save competition'}</button>
        <button type="button" className="nk-btn nk-ghost px-5 py-2" onClick={onCancel}>Cancel</button>
      </div>
    </div>
  );
}
