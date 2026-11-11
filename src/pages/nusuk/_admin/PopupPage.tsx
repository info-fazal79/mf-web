/* Nusuk Manager → Popup notice: a popup when people open /nusuk (stored in nusuk_settings.content.popup). */
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { supabase as sb } from '@/lib/supabase';
import { countdownText } from '../_lib/content';
import { parseBonus } from '../_lib/bonus';
import { defaultPopup, parsePopup, popupRunning, type Popup } from '../_lib/popup';
import { extractCodes } from '../_lib/extract';
import { collectorHref } from '../_lib/collector';

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
type InstantResult = { added: string[]; boosted: string[]; rejected: string[]; invalid: string[]; quota: number; already: string[] };

/** Drag-to-bookmarks button that collects NG- codes from a Facebook group page. */
function CollectorButton() {
  const ref = useRef<HTMLAnchorElement>(null);
  // React does not allow javascript: links in markup, so the link is set directly
  useEffect(() => { ref.current?.setAttribute('href', collectorHref()); }, []);
  return (
    <div className="grid gap-2 rounded-xl border border-[#1877f2]/30 bg-[#1877f2]/5 p-3.5 text-sm">
      <b>📥 Collect codes from the group (one-time setup)</b>
      <p className="text-emerald-900/75">Facebook doesn't let you copy a long page in one go (you get "Facebook Facebook…"). This button scrolls the group for you and collects every code.</p>
      <ol className="grid list-decimal gap-1 pl-5 text-emerald-950">
        <li>Show the bookmarks bar: press <b>Ctrl+Shift+B</b>.</li>
        <li>Drag this button onto the bookmarks bar:
          {' '}<a ref={ref} onClick={(e) => { e.preventDefault(); alert('Drag this button to your bookmarks bar, then click it on your Facebook group page.'); }}
            className="ml-1 inline-flex cursor-grab items-center gap-1 rounded-full bg-[#1877f2] px-3 py-1 text-xs font-bold text-white">📥 কোড সংগ্রহ</a>
        </li>
        <li>Open your group on Facebook (sorted by <b>New</b>), scroll to the top, and click <b>📥 কোড সংগ্রহ</b> in the bookmarks bar.</li>
        <li>It scrolls down by itself and counts codes. When it has gone far enough, press <b>থামান</b> (or wait until it ends), then <b>কপি করুন</b>.</li>
        <li>Paste here and press <b>⚡ Boost</b>. Codes boosted before are skipped automatically.</li>
      </ol>
    </div>
  );
}

/** Paste codes from the group: each goes to the very top until it gets N copies. */
function InstantCard({ toast }: { toast: ToastFn }) {
  const [text, setText] = useState('');
  const [quota, setQuota] = useState(10);
  const [busy, setBusy] = useState(false);
  const [rows, setRows] = useState<InstantRow[]>([]);
  const [missing, setMissing] = useState(false);
  const [last, setLast] = useState<InstantResult | null>(null);
  const [again, setAgain] = useState(false);

  const load = useCallback(async () => {
    const { data, error } = await sb!.from('nusuk_codes')
      .select('id,code,uses,status,instant_quota,instant_base,instant_at')
      .not('instant_quota', 'is', null).order('instant_at', { ascending: false }).limit(200);
    if (error) { setMissing(/instant_/.test(error.message)); return; }
    setMissing(false);
    setRows((data ?? []) as InstantRow[]);
  }, []);
  useEffect(() => { load(); const t = setInterval(load, 15000); return () => clearInterval(t); }, [load]);

  // Only NG- codes are taken from whatever is pasted (whole comments are fine); repeats count once
  const ex = useMemo(() => extractCodes(text), [text]);
  const codes = ex.unique;
  async function boost() {
    if (!codes.length) return toast('No NG- codes found in the pasted text', false);
    setBusy(true);
    // Codes that already had an instant boost (running or finished) are skipped, so a code is never boosted twice by mistake
    let already: string[] = [];
    if (!again) {
      const { data: prev, error: e0 } = await sb!.from('nusuk_codes').select('code').in('code', codes).not('instant_at', 'is', null);
      if (e0) { setBusy(false); return toast(errText(e0), false); }
      const set = new Set((prev ?? []).map((x: { code: string }) => x.code.toLowerCase()));
      already = codes.filter((c) => set.has(c.toLowerCase()));
    }
    const fresh = codes.filter((c) => !already.includes(c));
    if (!fresh.length) {
      setBusy(false);
      setLast({ added: [], boosted: [], rejected: [], invalid: [], quota, already });
      return toast('All of these codes were already boosted before', false);
    }
    const { data, error } = await sb!.rpc('nusuk_admin_instant', { p_codes: fresh, p_quota: quota });
    setBusy(false);
    if (error) return toast(/nusuk_admin_instant/.test(error.message) ? 'Run src/pages/nusuk/_sql/update_19_instant.sql in Supabase first.' : errText(error), false);
    const r = { ...(data as InstantResult), already };
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
      <CollectorButton />
      <Field label="Paste the group comments (or just the codes)" hint="Paste everything as it is: names, text, emojis. Only NG- codes are picked out, and each code counts once.">
        <textarea rows={6} className="nk-input font-normal" value={text} onChange={(e) => setText(e.target.value)} placeholder={'Rahim Uddin\nআমার কোড NG-y3JkB7lU দয়া করে ব্যবহার করুন 🤲\n\nKarim\nNG-abcd1234'} />
      </Field>
      {text.trim() && (
        <div className="rounded-xl border border-[#e7e1cf] bg-cream p-3 text-sm">
          <div><b>{codes.length}</b> code(s) found{ex.repeats > 0 && <span className="text-emerald-900/60"> · {ex.repeats} repeat(s) removed</span>}</div>
          {codes.length > 0 && <div className="mt-1.5 flex flex-wrap gap-1">{codes.map((c) => <span key={c} className="rounded bg-white px-1.5 py-0.5 font-mono text-xs ring-1 ring-emerald-900/10">{c}</span>)}</div>}
        </div>
      )}
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" className="h-4 w-4 accent-emerald-700" checked={again} onChange={(e) => setAgain(e.target.checked)} />
        Also boost codes that were boosted before <span className="text-xs text-emerald-900/55">(off = skip them, so nobody is boosted twice by mistake)</span>
      </label>
      <div className="flex flex-wrap items-end gap-3">
        <Field label="Copies each (Keys)"><input type="number" min={1} max={1000} className="nk-input w-24 font-normal" value={quota} onChange={(e) => setQuota(Math.max(1, Math.round(+e.target.value) || 1))} /></Field>
        <Btn kind="gold" onClick={boost} disabled={busy || !codes.length}>{busy ? 'Working…' : `⚡ Boost ${codes.length || ''} now`}</Btn>
      </div>
      {last && (
        <div className="rounded-xl bg-emerald-50 p-3 text-sm">
          <b>{last.boosted.length}</b> boosted{last.added.length ? <> · <b>{last.added.length}</b> new code(s) added</> : null}
          {last.already.length > 0 && <div className="mt-1 text-amber-700">Skipped, already boosted before: {last.already.join(', ')}</div>}
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
        <div className="mt-4 grid gap-2 sm:grid-cols-2" role="radiogroup" aria-label="Popup type">
          {([
            ['offer', '🎁 Offer', 'Shows "অফার শেষ হতে বাকি" with a live countdown when you set a deadline.'],
            ['notice', '📢 Simple notice', 'Just a message and a button. No timer and no "offer" words are shown.'],
          ] as const).map(([k, t, h]) => (
            <button key={k} type="button" role="radio" aria-checked={p.kind === k} onClick={() => set({ kind: k })}
              className={`rounded-xl border p-3 text-left transition ${p.kind === k ? 'border-emerald-600 bg-emerald-50 ring-2 ring-emerald-600/20' : 'border-[#e7e1cf] bg-white hover:border-emerald-600/40'}`}>
              <div className="font-bold">{t}{p.kind === k ? ' ✓' : ''}</div>
              <div className="mt-0.5 text-xs text-emerald-900/65">{h}</div>
            </button>
          ))}
        </div>
        <div className={`mt-3 flex flex-wrap items-center gap-3 rounded-xl border p-3.5 ${running ? 'border-emerald-600/40 bg-emerald-50' : 'border-[#e7e1cf] bg-cream'}`}>
          <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${running ? 'bg-emerald-600 text-white' : 'bg-gray-200 text-gray-700'}`}>{status}</span>
          <span className="ml-auto flex gap-2">
            {p.on ? <Btn kind="ghost" onClick={() => { const n = { ...p, on: false }; setP(n); save(n); }}>Turn off</Btn>
                  : <Btn kind="ghost" onClick={() => { const n = { ...p, on: true }; setP(n); save(n); }}>Turn on (keep deadline)</Btn>}
          </span>
        </div>
      </section>

      <section className="nk-card grid gap-3 p-4 sm:p-5">
        <h2 className="text-base font-bold text-emerald-950">{p.kind === 'notice' ? '🕒 Show until (optional)' : '⏳ Deadline'}</h2>
        {p.kind === 'notice' && <p className="-mt-1 text-xs text-emerald-900/65">For a simple notice the time is never shown to visitors. It only stops the popup by itself at that time. Leave empty to keep it on until you turn it off.</p>}
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
        <p className="text-xs text-emerald-900/60">"Start now" turns the popup on and saves at once{p.kind === 'notice' ? '; it switches off by itself after that many minutes' : '. The countdown starts from that moment'}.</p>
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
            <option value="once">Don't show this popup to them again</option>
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
            {p.kind !== 'notice' && p.until && left > 0 && (
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
