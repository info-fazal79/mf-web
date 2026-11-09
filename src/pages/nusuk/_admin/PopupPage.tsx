/* Nusuk Manager → Popup notice: a popup when people open /nusuk (stored in nusuk_settings.content.popup). */
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { supabase as sb } from '@/lib/supabase';
import { countdownText } from '../_lib/content';
import { parseBonus } from '../_lib/bonus';
import { defaultPopup, parsePopup, popupRunning, type Popup } from '../_lib/popup';

type ToastFn = (t: string, ok?: boolean) => void;
const errText = (e: unknown) => (e && typeof e === 'object' && 'message' in e ? String((e as { message: string }).message) : String(e));
const pad = (n: number) => String(n).padStart(2, '0');
const toLocal = (iso?: string) => {
  if (!iso) return '';
  const d = new Date(iso);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};
const fromLocal = (v: string) => (v ? new Date(v).toISOString() : undefined);

function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="grid gap-1 text-sm font-semibold">
      {label}
      {children}
      {hint && <span className="text-xs font-normal text-emerald-900/60">{hint}</span>}
    </label>
  );
}
function Btn({ kind = 'green', className = '', ...p }: React.ButtonHTMLAttributes<HTMLButtonElement> & { kind?: 'green' | 'gold' | 'ghost' }) {
  return <button type="button" {...p} className={`nk-btn nk-${kind} px-3.5 py-2 text-sm ${className}`} />;
}
function useNow() {
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);
  return now;
}

type InstantRow = { id: number; code: string; uses: number; status: string; instant_quota: number; instant_base: number; instant_at: string };
type InstantResult = { added: string[]; boosted: string[]; rejected: string[]; invalid: string[]; quota: number };

/** Paste codes from the group: each goes to the very top until it gets N copies. */
function InstantCard({ toast }: { toast: ToastFn }) {
  const [text, setText] = useState('');
  const [quota, setQuota] = useState(10);
  const [busy, setBusy] = useState(false);
  const [rows, setRows] = useState<InstantRow[]>([]);
  const [missing, setMissing] = useState(false);
  const [last, setLast] = useState<InstantResult | null>(null);

  const load = useCallback(async () => {
    const { data, error } = await sb!.from('nusuk_codes')
      .select('id,code,uses,status,instant_quota,instant_base,instant_at')
      .not('instant_quota', 'is', null).order('instant_at', { ascending: false }).limit(200);
    if (error) { setMissing(/instant_/.test(error.message)); return; }
    setMissing(false);
    setRows((data ?? []) as InstantRow[]);
  }, []);
  useEffect(() => { load(); const t = setInterval(load, 15000); return () => clearInterval(t); }, [load]);

  const codes = text.split(/[\s,;]+/).map((x) => x.trim()).filter(Boolean);
  async function boost() {
    if (!codes.length) return toast('Paste at least one code', false);
    setBusy(true);
    const { data, error } = await sb!.rpc('nusuk_admin_instant', { p_codes: codes, p_quota: quota });
    setBusy(false);
    if (error) return toast(/nusuk_admin_instant/.test(error.message) ? 'Run src/pages/nusuk/_sql/update_19_instant.sql in Supabase first.' : errText(error), false);
    const r = data as InstantResult;
    setLast(r);
    toast(`⚡ ${r.boosted.length} code(s) are now at the top for ${r.quota} copies`);
    setText('');
    load();
  }
  async function stop(r: InstantRow) {
    const { error } = await sb!.from('nusuk_codes').update({ instant_quota: null }).eq('id', r.id);
    if (error) return toast(errText(error), false);
    load();
  }
  const running = rows.filter((r) => r.status === 'active' && r.uses - r.instant_base < r.instant_quota);
  const done = rows.filter((r) => !running.includes(r));

  if (missing) {
    return <section className="nk-card p-4 sm:p-5"><h2 className="text-base font-bold text-emerald-950">⚡ Instant Keys</h2><p className="mt-2 text-sm">Run <code className="font-mono">src/pages/nusuk/_sql/update_19_instant.sql</code> in Supabase → SQL Editor, then reload this page.</p></section>;
  }
  return (
    <section className="nk-card grid gap-3 p-4 sm:p-5">
      <h2 className="text-base font-bold text-emerald-950">⚡ Instant Keys (codes shared in the group)</h2>
      <p className="-mt-1 text-sm text-emerald-900/70">
        Copy the codes people shared in your group and paste them here. Each one goes to the very top of /nusuk for every visitor until it has been copied
        the number of times below, then it goes back to normal. This is instant (not spread over hours like Feature). Codes that are not in the list yet are added.
      </p>
      <Field label="Codes" hint={`One per line, or separated by spaces/commas. ${codes.length ? `${codes.length} code(s) found.` : ''}`}>
        <textarea rows={5} className="nk-input font-mono font-normal" value={text} onChange={(e) => setText(e.target.value)} placeholder={'NG-y3JkB7lU\nNG-abcd1234'} />
      </Field>
      <div className="flex flex-wrap items-end gap-3">
        <Field label="Copies each (Keys)"><input type="number" min={1} max={1000} className="nk-input w-24 font-normal" value={quota} onChange={(e) => setQuota(Math.max(1, Math.round(+e.target.value) || 1))} /></Field>
        <Btn kind="gold" onClick={boost} disabled={busy || !codes.length}>{busy ? 'Working…' : `⚡ Boost ${codes.length || ''} now`}</Btn>
      </div>
      {last && (
        <div className="rounded-xl bg-emerald-50 p-3 text-sm">
          <b>{last.boosted.length}</b> boosted{last.added.length ? <> · <b>{last.added.length}</b> new code(s) added</> : null}
          {last.rejected.length > 0 && <div className="mt-1 text-red-700">Skipped (rejected codes): {last.rejected.join(', ')}</div>}
          {last.invalid.length > 0 && <div className="mt-1 text-red-700">Not valid codes: {last.invalid.join(', ')}</div>}
        </div>
      )}
      <div className="grid gap-2">
        <div className="flex items-center justify-between"><b className="text-sm">Running now ({running.length})</b><Btn kind="ghost" className="px-2.5! py-1!" onClick={load}>Refresh</Btn></div>
        {running.map((r) => (
          <div key={r.id} className="flex flex-wrap items-center gap-2 rounded-lg border border-orange-200 bg-orange-50 px-3 py-2 text-sm">
            <b className="font-mono">{r.code}</b>
            <span className="rounded-full bg-orange-100 px-2 py-0.5 text-xs font-bold text-orange-800">⚡ {r.uses - r.instant_base}/{r.instant_quota}</span>
            <span className="text-xs text-emerald-900/60">since {new Date(r.instant_at).toLocaleTimeString()}</span>
            <Btn kind="ghost" className="ml-auto px-2.5! py-1! text-red-700" onClick={() => stop(r)}>Stop</Btn>
          </div>
        ))}
        {!running.length && <p className="text-sm text-emerald-900/60">Nothing running.</p>}
        {done.length > 0 && (
          <details className="text-sm">
            <summary className="cursor-pointer font-semibold">Finished ({done.length})</summary>
            <div className="mt-2 grid gap-1">
              {done.slice(0, 100).map((r) => (
                <div key={r.id} className="flex flex-wrap items-center gap-2 rounded-lg bg-gray-50 px-3 py-1.5">
                  <span className="font-mono">{r.code}</span>
                  <span className="text-xs text-emerald-900/60">✓ {r.uses - r.instant_base}/{r.instant_quota} · {new Date(r.instant_at).toLocaleString()}</span>
                </div>
              ))}
            </div>
          </details>
        )}
      </div>
    </section>
  );
}

export default function PopupPage({ toast, settings, reload }: { toast: ToastFn; settings: { content: unknown }; reload: () => void }) {
  const stored = useMemo(() => parsePopup(settings.content), [settings]);
  const groupLink = parseBonus(settings.content).group_url;
  const [p, setP] = useState<Popup>(stored);
  const [mins, setMins] = useState(20);
  const [busy, setBusy] = useState(false);
  const [dirty, setDirty] = useState(false);
  useEffect(() => { setP(stored); setDirty(false); }, [stored]);
  const set = (x: Partial<Popup>) => { setP({ ...p, ...x }); setDirty(true); };
  const now = useNow();

  async function save(next = p) {
    const link = next.link.trim();
    if (link && !/^https:\/\//i.test(link)) return toast('Link must start with https://', false);
    if (next.on && !link && !groupLink) return toast('Add a link, or set the group link in Community & bonus', false);
    setBusy(true);
    const { data, error: e1 } = await sb!.from('nusuk_settings').select('content').eq('id', 1).single();
    if (e1) { setBusy(false); return toast(errText(e1), false); }
    const content = { ...((data?.content as object) ?? {}), popup: { ...next, link } };
    const { error } = await sb!.from('nusuk_settings').update({ content, updated_at: new Date().toISOString() }).eq('id', 1);
    setBusy(false);
    if (error) return toast(errText(error), false);
    setDirty(false);
    toast(popupRunning(next) ? 'Saved · the popup is showing on /nusuk' : next.on ? 'Saved · the deadline has passed, so it is not showing' : 'Saved · popup is OFF');
    reload();
  }
  /** Turn on now with a deadline of `m` minutes from now. */
  function startFor(m: number) {
    const n = { ...p, on: true, until: new Date(Date.now() + m * 60000).toISOString() };
    setP(n);
    save(n);
  }

  const left = p.until ? Date.parse(p.until) - now : NaN;
  const running = popupRunning(p, now);
  const status = !p.on ? 'OFF' : !p.until ? 'ON · no time limit' : left > 0 ? `ON · ends in ${countdownText(left)}` : 'Ended (deadline passed)';

  return (
    <div className="grid gap-4">
      <section className="nk-card p-4 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-emerald-950">Popup notice</h2>
            <p className="mt-0.5 max-w-xl text-sm text-emerald-900/70">A popup that opens when people come to /nusuk, with a button (for example to your group) and an optional deadline countdown. Visitors can close it. After the deadline it stops showing by itself.</p>
          </div>
          <Btn onClick={() => save()} disabled={busy || !dirty}>{busy ? 'Saving…' : dirty ? 'Save' : 'Saved'}</Btn>
        </div>
        <div className={`mt-4 flex flex-wrap items-center gap-3 rounded-xl border p-3.5 ${running ? 'border-emerald-600/40 bg-emerald-50' : 'border-[#e7e1cf] bg-cream'}`}>
          <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${running ? 'bg-emerald-600 text-white' : 'bg-gray-200 text-gray-700'}`}>{status}</span>
          <span className="ml-auto flex gap-2">
            {p.on ? <Btn kind="ghost" onClick={() => { const n = { ...p, on: false }; setP(n); save(n); }}>Turn off</Btn>
                  : <Btn kind="ghost" onClick={() => { const n = { ...p, on: true }; setP(n); save(n); }}>Turn on (keep deadline)</Btn>}
          </span>
        </div>
      </section>

      <section className="nk-card grid gap-3 p-4 sm:p-5">
        <h2 className="text-base font-bold text-emerald-950">⏳ Deadline</h2>
        <div className="flex flex-wrap items-end gap-2">
          <Field label="Start now for">
            <div className="flex items-center gap-2">
              <input type="number" min={1} max={10080} className="nk-input w-24 font-normal" value={mins} onChange={(e) => setMins(Math.max(1, Math.round(+e.target.value) || 1))} />
              <span className="text-sm font-normal">minutes</span>
            </div>
          </Field>
          <Btn kind="gold" onClick={() => startFor(mins)} disabled={busy}>▶ Start now</Btn>
          <span className="flex flex-wrap gap-1.5 pb-1.5">
            {[10, 20, 30, 60].map((m) => <Btn key={m} kind="ghost" className="px-2.5! py-1! text-xs!" onClick={() => startFor(m)} disabled={busy}>{m} min</Btn>)}
          </span>
        </div>
        <p className="text-xs text-emerald-900/60">"Start now" turns the popup on and saves at once. The countdown starts from that moment.</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="…or ends at" hint="Your computer's time. Visitors anywhere see the right time left.">
            <input type="datetime-local" className="nk-input font-normal" value={toLocal(p.until)} onChange={(e) => set({ until: fromLocal(e.target.value) })} />
          </Field>
          <div className="flex items-end pb-1">{p.until && <Btn kind="ghost" className="text-red-700" onClick={() => set({ until: undefined })}>No time limit</Btn>}</div>
        </div>
      </section>

      <section className="nk-card grid gap-3 p-4 sm:p-5">
        <h2 className="text-base font-bold text-emerald-950">Text &amp; button</h2>
        <Field label="Title"><input className="nk-input font-normal" maxLength={120} value={p.title} onChange={(e) => set({ title: e.target.value })} /></Field>
        <Field label="Message"><textarea rows={4} maxLength={800} className="nk-input font-normal" value={p.text} onChange={(e) => set({ text: e.target.value })} /></Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Button text"><input className="nk-input font-normal" maxLength={60} value={p.button} onChange={(e) => set({ button: e.target.value })} /></Field>
          <Field label="Button link" hint={groupLink ? `Empty = your group: ${groupLink}` : 'Empty = the group link from Community & bonus (not set yet).'}>
            <input className="nk-input font-normal" value={p.link} onChange={(e) => set({ link: e.target.value })} placeholder="https://www.facebook.com/groups/…" />
          </Field>
        </div>
        <Field label="After someone closes it">
          <select className="nk-input font-normal" value={p.again} onChange={(e) => set({ again: e.target.value as Popup['again'] })}>
            <option value="visit">Show again on their next visit</option>
            <option value="once">Don't show this offer to them again</option>
          </select>
        </Field>
        <button type="button" className="self-start text-xs font-semibold text-emerald-800 underline" onClick={() => { const d = defaultPopup(); set({ title: d.title, text: d.text, button: d.button }); }}>Reset text to the default</button>
      </section>

      <InstantCard toast={toast} />

      <section className="nk-card p-4 sm:p-5">
        <h2 className="mb-3 text-base font-bold text-emerald-950">Preview</h2>
        <div className="mx-auto max-w-sm overflow-hidden rounded-[1.25rem] border border-[#e7e1cf] shadow-lg">
          <div className="nk-pp-head px-5 pt-6 pb-5 text-center text-white">
            <div className="text-xl font-bold leading-snug">{p.title}</div>
            {p.until && left > 0 && (
              <div className="mt-3">
                <div className="text-xs font-semibold text-gold-100/90">⏳ অফার শেষ হতে বাকি</div>
                <div className="nk-pp-clock mt-1 inline-block rounded-xl bg-white/15 px-4 py-1.5 font-mono text-2xl font-bold tabular-nums">{countdownText(left)}</div>
              </div>
            )}
          </div>
          <div className="grid gap-4 bg-white p-5">
            <p className="nk-pre text-[15px] leading-relaxed text-emerald-950">{p.text}</p>
            <span className="nk-btn flex w-full items-center justify-center bg-[#1877f2] py-3 text-base text-white">{p.button}</span>
            <span className="text-center text-sm font-semibold text-emerald-900/60 underline">এখন না</span>
          </div>
        </div>
      </section>
    </div>
  );
}
