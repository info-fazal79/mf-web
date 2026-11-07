import { useCallback, useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { CODE_RE, contentFields, defaultContent, mergeContent, parseWinners, prizeLabel, type NusukContent, type Prize, type Winner } from '../_lib/content';

/* =====================================================================
   Nusuk Manager: a standalone admin for /nusuk.
   Uses the site's Supabase sign-in; only admin/editor accounts get in.
   ===================================================================== */

type Status = 'active' | 'inactive' | 'pending' | 'rejected';
type Code = {
  id: number;
  code: string;
  status: Status;
  source: 'admin' | 'user';
  uses: number;
  max_uses: number;
  submitter: string | null;
  note: string | null;
  last_used_at: string | null;
  created_at: string;
};
type Stats = {
  total: number; active: number; remaining: number; used_up: number; inactive: number;
  pending: number; copies: number; today: number; daily: { day: string; copies: number }[];
};
type Settings = {
  enabled: boolean; submissions_enabled: boolean; default_max_uses: number;
  logo_url: string | null; notice: string | null; content: Partial<NusukContent> & { winners?: Winner[] };
};

const sb = supabase;
const fmt = (n: number | undefined) => (n ?? 0).toLocaleString('en-US');
const when = (s: string | null) => (s ? new Date(s).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' }) : '—');
const errText = (e: unknown) => (e && typeof e === 'object' && 'message' in e ? String((e as { message: string }).message) : String(e));

/* ---------------- tiny UI kit ---------------- */
function Btn({ kind = 'green', className = '', ...p }: React.ButtonHTMLAttributes<HTMLButtonElement> & { kind?: 'green' | 'gold' | 'ghost' | 'danger' }) {
  const k = kind === 'danger' ? 'bg-red-600 text-white hover:bg-red-700' : `nk-${kind}`;
  return <button type="button" {...p} className={`nk-btn ${k} px-3.5 py-2 text-sm ${className}`} />;
}
function Card({ title, actions, children, className = '' }: { title?: ReactNode; actions?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`nk-card p-4 sm:p-5 ${className}`}>
      {(title || actions) && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          {title && <h2 className="text-base font-bold text-emerald-950">{title}</h2>}
          {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
        </div>
      )}
      {children}
    </section>
  );
}
function Toggle({ on, onChange, label, hint }: { on: boolean; onChange: (v: boolean) => void; label: string; hint?: string }) {
  return (
    <label className="flex cursor-pointer items-start justify-between gap-4 rounded-xl border border-[#e7e1cf] bg-white p-3.5">
      <span>
        <span className="block font-semibold">{label}</span>
        {hint && <span className="block text-sm text-emerald-900/70">{hint}</span>}
      </span>
      <input type="checkbox" checked={on} onChange={(e) => onChange(e.target.checked)} className="sr-only" />
      <span aria-hidden className={`relative mt-0.5 h-6 w-11 shrink-0 rounded-full transition ${on ? 'bg-emerald-700' : 'bg-gray-300'}`}>
        <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${on ? 'left-[22px]' : 'left-0.5'}`} />
      </span>
    </label>
  );
}
const badge: Record<Status, string> = {
  active: 'bg-emerald-100 text-emerald-900',
  inactive: 'bg-gray-200 text-gray-700',
  pending: 'bg-gold-100 text-gold-600',
  rejected: 'bg-red-100 text-red-700',
};

type ToastFn = (t: string, ok?: boolean) => void;

/* ---------------- Login ---------------- */
function Login({ denied }: { denied: boolean }) {
  const [msg, setMsg] = useState<string | null>(denied ? 'This account is not an admin.' : null);
  const [busy, setBusy] = useState(false);
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = Object.fromEntries(new FormData(e.currentTarget)) as Record<string, string>;
    setBusy(true);
    setMsg(null);
    const { error } = await sb!.auth.signInWithPassword({ email: f.email, password: f.password });
    if (error) setMsg(error.message);
    setBusy(false);
  }
  return (
    <div className="nk-pattern grid min-h-screen place-items-center p-4">
      <form onSubmit={submit} className="nk-card w-full max-w-sm p-7">
        <Logo />
        <h1 className="mt-5 text-xl font-bold">Nusuk Manager</h1>
        <p className="mt-1 text-sm text-emerald-900/70">Sign in with your site admin account.</p>
        <div className="mt-6 grid gap-4">
          <label className="grid gap-1 text-sm font-semibold">Email<input name="email" type="email" required autoComplete="username" className="nk-input" /></label>
          <label className="grid gap-1 text-sm font-semibold">Password<input name="password" type="password" required autoComplete="current-password" className="nk-input" /></label>
          {msg && <p className="text-sm text-red-600" role="alert">{msg}</p>}
          {denied && <Btn kind="ghost" onClick={() => sb!.auth.signOut()}>Sign out</Btn>}
          <button type="submit" className="nk-btn nk-green py-3" disabled={busy}>{busy ? 'Please wait…' : 'Sign in'}</button>
        </div>
      </form>
    </div>
  );
}
function Logo() {
  return (
    <span className="grid h-11 w-11 place-items-center rounded-xl bg-emerald-900 ring-1 ring-gold-500/50">
      <svg viewBox="0 0 32 32" className="h-6 w-6" aria-hidden><path fill="#dcbc52" d="M16 2l3.6 8.4L28 14l-8.4 3.6L16 26l-3.6-8.4L4 14l8.4-3.6z" /><rect x="11" y="12" width="10" height="10" rx="1" fill="#053d2d" stroke="#dcbc52" strokeWidth="1.2" /></svg>
    </span>
  );
}

/* ---------------- Dashboard ---------------- */
function Dashboard({ toast, go }: { toast: ToastFn; go: (r: Route) => void }) {
  const [s, setS] = useState<Stats | null>(null);
  const load = useCallback(async () => {
    const { data, error } = await sb!.rpc('nusuk_admin_stats');
    if (error) toast(errText(error), false);
    else setS(data as Stats);
  }, [toast]);
  useEffect(() => { load(); }, [load]);
  const max = Math.max(1, ...(s?.daily ?? []).map((d) => d.copies));
  const tiles: [string, number | undefined, string][] = [
    ['Codes available now', s?.remaining, 'Active and not used up'],
    ['Total codes', s?.total, 'Active + inactive'],
    ['Total copies', s?.copies, 'All time'],
    ['Copies today', s?.today, 'Since midnight (server time)'],
    ['Used up', s?.used_up, 'Reached their max uses'],
    ['Inactive', s?.inactive, 'Hidden from visitors'],
    ['Waiting for review', s?.pending, 'User submissions'],
  ];
  return (
    <div className="grid gap-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {tiles.map(([label, v, hint], i) => (
          <div key={label} className={`nk-card p-4 ${i === 0 ? 'col-span-2 bg-emerald-900! text-white lg:col-span-1' : ''}`}>
            <div className={`text-xs font-semibold ${i === 0 ? 'text-gold-100' : 'text-emerald-900/70'}`}>{label}</div>
            <div className="mt-1 text-2xl font-bold">{s ? fmt(v) : '…'}</div>
            <div className={`text-xs ${i === 0 ? 'text-emerald-100/70' : 'text-emerald-900/55'}`}>{hint}</div>
          </div>
        ))}
        <button type="button" onClick={() => go('review')} className="nk-card p-4 text-left hover:bg-gold-100/40">
          <div className="text-xs font-semibold text-emerald-900/70">Quick links</div>
          <div className="mt-1 font-bold text-emerald-800">Review submissions →</div>
          <div className="text-xs text-emerald-900/55">or upload codes from the Upload tab</div>
        </button>
      </div>
      <Card title="Copies, last 14 days" actions={<Btn kind="ghost" onClick={load}>Refresh</Btn>}>
        <div className="flex h-44 items-end gap-1.5" role="img" aria-label="Daily copies bar chart">
          {(s?.daily ?? []).map((d) => (
            <div key={d.day} className="group flex h-full flex-1 flex-col items-center justify-end gap-1">
              <span className="text-[10px] font-semibold text-emerald-900 opacity-0 group-hover:opacity-100">{d.copies}</span>
              <div className="w-full rounded-t-md bg-emerald-600" style={{ height: `${Math.max(2, (d.copies / max) * 100)}%` }} title={`${d.day}: ${d.copies}`} />
              <span className="text-[10px] text-emerald-900/60">{d.day.slice(8, 10)}</span>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

/* ---------------- Codes table ---------------- */
const PAGE = 50;
function CodesPage({ toast, reviewMode = false }: { toast: ToastFn; reviewMode?: boolean }) {
  const [rows, setRows] = useState<Code[]>([]);
  const [count, setCount] = useState(0);
  const [page, setPage] = useState(0);
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState<'all' | Status | 'available' | 'used_up'>(reviewMode ? 'pending' : 'all');
  const [sel, setSel] = useState<Set<number>>(new Set());
  const [edit, setEdit] = useState<Code | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    let qb = sb!.from('nusuk_codes').select('*', { count: 'exact' });
    if (reviewMode) qb = qb.eq('status', 'pending');
    else if (filter === 'available') qb = qb.eq('available', true);
    else if (filter === 'used_up') qb = qb.eq('status', 'active').eq('available', false);
    else if (filter !== 'all') qb = qb.eq('status', filter);
    if (q.trim()) qb = qb.ilike('code', `%${q.trim()}%`);
    const { data, count: c, error } = await qb.order(reviewMode ? 'created_at' : 'id', { ascending: reviewMode }).range(page * PAGE, page * PAGE + PAGE - 1);
    setLoading(false);
    if (error) return toast(errText(error), false);
    setRows((data ?? []) as Code[]);
    setCount(c ?? 0);
    setSel(new Set());
  }, [filter, page, q, reviewMode, toast]);

  useEffect(() => { const t = setTimeout(load, q ? 250 : 0); return () => clearTimeout(t); }, [load, q]);
  useEffect(() => setPage(0), [filter, q]);

  const ids = [...sel];
  async function bulk(patch: Partial<Code> | 'delete', list = ids) {
    if (!list.length) return;
    if (patch === 'delete' && !confirm(`Delete ${list.length} code(s)? This cannot be undone.`)) return;
    const req = patch === 'delete' ? sb!.from('nusuk_codes').delete().in('id', list) : sb!.from('nusuk_codes').update(patch).in('id', list);
    const { error } = await req;
    if (error) return toast(errText(error), false);
    toast(patch === 'delete' ? `Deleted ${list.length}` : `Updated ${list.length}`);
    load();
  }
  const pages = Math.max(1, Math.ceil(count / PAGE));
  const allOn = rows.length > 0 && rows.every((r) => sel.has(r.id));

  return (
    <Card
      title={reviewMode ? `Submissions waiting for review (${fmt(count)})` : `Codes (${fmt(count)})`}
      actions={
        <>
          {sel.size > 0 && (reviewMode ? (
            <>
              <Btn onClick={() => bulk({ status: 'active' })}>Approve {sel.size}</Btn>
              <Btn kind="ghost" onClick={() => bulk({ status: 'rejected' })}>Reject</Btn>
              <Btn kind="danger" onClick={() => bulk('delete')}>Delete</Btn>
            </>
          ) : (
            <>
              <Btn onClick={() => bulk({ status: 'active' })}>Activate {sel.size}</Btn>
              <Btn kind="ghost" onClick={() => bulk({ status: 'inactive' })}>Deactivate</Btn>
              <Btn kind="ghost" onClick={() => bulk({ uses: 0, last_used_at: null })}>Reset uses</Btn>
              <Btn kind="danger" onClick={() => bulk('delete')}>Delete</Btn>
            </>
          ))}
          <Btn kind="ghost" onClick={load}>{loading ? 'Loading…' : 'Refresh'}</Btn>
        </>
      }
    >
      <div className="mb-3 flex flex-col gap-2 sm:flex-row">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search code…" className="nk-input sm:max-w-xs" aria-label="Search code" />
        {!reviewMode && (
          <select value={filter} onChange={(e) => setFilter(e.target.value as typeof filter)} className="nk-input sm:max-w-[13rem]" aria-label="Filter by status">
            <option value="all">All statuses</option>
            <option value="available">Available now</option>
            <option value="used_up">Used up</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
            <option value="pending">Pending review</option>
            <option value="rejected">Rejected</option>
          </select>
        )}
      </div>

      <div className="-mx-4 overflow-x-auto sm:mx-0">
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr className="border-b border-[#e7e1cf] text-left text-xs uppercase tracking-wide text-emerald-900/60">
              <th className="w-8 p-2"><input type="checkbox" checked={allOn} onChange={(e) => setSel(e.target.checked ? new Set(rows.map((r) => r.id)) : new Set())} aria-label="Select all on page" /></th>
              <th className="p-2">Code</th>
              <th className="p-2">Status</th>
              <th className="p-2">Uses</th>
              <th className="p-2">{reviewMode ? 'Submitted by' : 'Source'}</th>
              <th className="p-2">{reviewMode ? 'Submitted' : 'Last copied'}</th>
              <th className="p-2 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-b border-[#f0ebdc] hover:bg-cream">
                <td className="p-2"><input type="checkbox" checked={sel.has(r.id)} onChange={(e) => { const n = new Set(sel); e.target.checked ? n.add(r.id) : n.delete(r.id); setSel(n); }} aria-label={`Select ${r.code}`} /></td>
                <td className="p-2 font-mono font-bold">{r.code}{r.note && <div className="max-w-[16rem] truncate font-sans text-xs font-normal text-emerald-900/60" title={r.note}>{r.note}</div>}</td>
                <td className="p-2"><span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${badge[r.status]}`}>{r.status}</span>{r.status === 'active' && r.uses >= r.max_uses && <span className="ml-1 text-xs text-red-600">used up</span>}</td>
                <td className="p-2 tabular-nums">{r.uses} / {r.max_uses}</td>
                <td className="p-2">{reviewMode ? r.submitter ?? '—' : r.source}</td>
                <td className="p-2 text-xs">{when(reviewMode ? r.created_at : r.last_used_at)}</td>
                <td className="p-2 text-right whitespace-nowrap">
                  {reviewMode ? (
                    <>
                      <Btn className="px-2.5! py-1!" onClick={() => bulk({ status: 'active' }, [r.id])}>Approve</Btn>{' '}
                      <Btn kind="ghost" className="px-2.5! py-1!" onClick={() => bulk({ status: 'rejected' }, [r.id])}>Reject</Btn>
                    </>
                  ) : (
                    <>
                      <Btn kind="ghost" className="px-2.5! py-1!" onClick={() => bulk({ status: r.status === 'active' ? 'inactive' : 'active' }, [r.id])}>{r.status === 'active' ? 'Disable' : 'Enable'}</Btn>{' '}
                      <Btn kind="ghost" className="px-2.5! py-1!" onClick={() => setEdit(r)}>Edit</Btn>{' '}
                      <Btn kind="ghost" className="px-2.5! py-1! text-red-700" onClick={() => bulk('delete', [r.id])} aria-label={`Delete ${r.code}`}>✕</Btn>
                    </>
                  )}
                </td>
              </tr>
            ))}
            {!rows.length && (
              <tr><td colSpan={7} className="p-8 text-center text-emerald-900/60">{loading ? 'Loading…' : reviewMode ? 'No submissions waiting. 🎉' : 'No codes found.'}</td></tr>
            )}
          </tbody>
        </table>
      </div>
      {pages > 1 && (
        <div className="mt-3 flex items-center justify-end gap-2 text-sm">
          <Btn kind="ghost" disabled={page === 0} onClick={() => setPage(page - 1)}>← Prev</Btn>
          <span>Page {page + 1} / {pages}</span>
          <Btn kind="ghost" disabled={page + 1 >= pages} onClick={() => setPage(page + 1)}>Next →</Btn>
        </div>
      )}
      {edit && <EditDialog code={edit} onClose={() => setEdit(null)} onSaved={() => { setEdit(null); load(); toast('Saved'); }} toast={toast} />}
    </Card>
  );
}

function EditDialog({ code, onClose, onSaved, toast }: { code: Code; onClose: () => void; onSaved: () => void; toast: ToastFn }) {
  const [f, setF] = useState({ code: code.code, status: code.status, max_uses: code.max_uses, uses: code.uses, note: code.note ?? '' });
  async function save(e: FormEvent) {
    e.preventDefault();
    const v = f.code.replace(/\s/g, '');
    if (!CODE_RE.test(v)) return toast('Code must be 3–40 letters, digits, - or _', false);
    const { error } = await sb!.from('nusuk_codes').update({ code: v, status: f.status, max_uses: Math.max(1, f.max_uses), uses: Math.max(0, f.uses), note: f.note.trim() || null }).eq('id', code.id);
    if (error) return toast(error.code === '23505' ? 'That code already exists' : errText(error), false);
    onSaved();
  }
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-emerald-950/50 p-4" onClick={onClose}>
      <form onSubmit={save} onClick={(e) => e.stopPropagation()} className="nk-card grid w-full max-w-md gap-3 p-5" role="dialog" aria-modal="true" aria-label="Edit code">
        <h3 className="text-lg font-bold">Edit code</h3>
        <label className="grid gap-1 text-sm font-semibold">Code<input className="nk-input font-mono" value={f.code} onChange={(e) => setF({ ...f, code: e.target.value })} /></label>
        <div className="grid grid-cols-3 gap-3">
          <label className="grid gap-1 text-sm font-semibold">Status
            <select className="nk-input" value={f.status} onChange={(e) => setF({ ...f, status: e.target.value as Status })}>
              <option value="active">active</option><option value="inactive">inactive</option><option value="pending">pending</option><option value="rejected">rejected</option>
            </select>
          </label>
          <label className="grid gap-1 text-sm font-semibold">Uses<input type="number" min={0} className="nk-input" value={f.uses} onChange={(e) => setF({ ...f, uses: +e.target.value })} /></label>
          <label className="grid gap-1 text-sm font-semibold">Max uses<input type="number" min={1} className="nk-input" value={f.max_uses} onChange={(e) => setF({ ...f, max_uses: +e.target.value })} /></label>
        </div>
        <label className="grid gap-1 text-sm font-semibold">Note<input className="nk-input" value={f.note} maxLength={300} onChange={(e) => setF({ ...f, note: e.target.value })} /></label>
        <div className="mt-2 flex justify-end gap-2"><Btn kind="ghost" onClick={onClose}>Cancel</Btn><button type="submit" className="nk-btn nk-green px-4 py-2 text-sm">Save</button></div>
      </form>
    </div>
  );
}

/* ---------------- Bulk upload ---------------- */
function Upload({ toast, defaultMax }: { toast: ToastFn; defaultMax: number }) {
  const [text, setText] = useState('');
  const [max, setMax] = useState(defaultMax);
  const [status, setStatus] = useState<'active' | 'inactive'>('active');
  const [progress, setProgress] = useState<{ done: number; total: number; added: number } | null>(null);
  const [result, setResult] = useState<{ added: number; skipped: string[] } | null>(null);
  useEffect(() => setMax(defaultMax), [defaultMax]);

  const parsed = useMemo(() => {
    const tokens = text.split(/[\s,;|"']+/).map((t) => t.trim()).filter(Boolean);
    const seen = new Set<string>();
    const valid: string[] = [];
    let invalid = 0, dupes = 0;
    for (const t of tokens) {
      if (!CODE_RE.test(t)) { invalid++; continue; }
      const key = t.toLowerCase(); // ABC123 and abc123 count as the same code
      if (seen.has(key)) { dupes++; continue; }
      seen.add(key);
      valid.push(t);
    }
    return { valid, invalid, dupes };
  }, [text]);

  async function readFile(file: File) {
    const t = await file.text();
    setText((cur) => (cur ? `${cur}\n${t}` : t));
  }
  async function upload() {
    const list = parsed.valid;
    if (!list.length) return;
    const CHUNK = 1000;
    let added = 0;
    const skipped: string[] = [];
    setResult(null);
    setProgress({ done: 0, total: list.length, added: 0 });
    for (let i = 0; i < list.length; i += CHUNK) {
      const chunk = list.slice(i, i + CHUNK);
      // The database inserts only codes it doesn't have yet (case-insensitive) and returns those.
      const { data, error } = await sb!.rpc('nusuk_admin_add_codes', { p_codes: chunk, p_max_uses: Math.max(1, max), p_status: status });
      if (error) {
        const missing = /nusuk_admin_add_codes/.test(error.message);
        toast(missing ? 'Run update_01_no_duplicates.sql in Supabase first' : errText(error), false);
        setProgress(null);
        return;
      }
      const got = new Set(((data as { added: string[] })?.added ?? []).map((c) => c.toLowerCase()));
      added += got.size;
      for (const c of chunk) if (!got.has(c.toLowerCase())) skipped.push(c);
      setProgress({ done: Math.min(list.length, i + CHUNK), total: list.length, added });
    }
    setResult({ added, skipped });
    toast(`Added ${fmt(added)} new code(s). ${fmt(skipped.length)} duplicate(s) skipped.`);
    setText('');
  }
  const busy = progress !== null && progress.done < progress.total;

  return (
    <Card title="Bulk upload codes">
      <p className="mb-3 text-sm text-emerald-900/75">Paste codes, one per line or separated by commas or spaces, or pick a .csv / .txt file. Each valid token (3–40 letters, digits, - or _) becomes a code. Only new codes are added: anything already in the database (ignoring upper/lower case) or repeated in your list is skipped. Remove a CSV header word like "code" first, or it may be added as a code.</p>
      <textarea value={text} onChange={(e) => setText(e.target.value)} rows={10} className="nk-input font-mono text-sm" placeholder={'ABC123\nXYZ789\nQWE456'} aria-label="Codes to upload" />
      <div className="mt-3 flex flex-wrap items-end gap-3">
        <label className="nk-btn nk-ghost cursor-pointer px-3.5 py-2 text-sm">
          Choose file…
          <input type="file" accept=".csv,.txt,text/csv,text/plain" className="sr-only" onChange={(e) => { const f = e.target.files?.[0]; if (f) readFile(f); e.target.value = ''; }} />
        </label>
        <label className="grid gap-1 text-sm font-semibold">Max uses per code<input type="number" min={1} value={max} onChange={(e) => setMax(+e.target.value)} className="nk-input w-32" /></label>
        <label className="grid gap-1 text-sm font-semibold">Status
          <select value={status} onChange={(e) => setStatus(e.target.value as 'active' | 'inactive')} className="nk-input w-36"><option value="active">active</option><option value="inactive">inactive</option></select>
        </label>
        {text && <Btn kind="ghost" onClick={() => setText('')}>Clear</Btn>}
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-3 rounded-xl bg-emerald-50 p-3 text-sm">
        <span><b>{fmt(parsed.valid.length)}</b> valid</span>
        {parsed.dupes > 0 && <span className="text-gold-600">{fmt(parsed.dupes)} duplicate in list</span>}
        {parsed.invalid > 0 && <span className="text-red-600">{fmt(parsed.invalid)} invalid (ignored)</span>}
        <Btn kind="gold" className="ml-auto" disabled={!parsed.valid.length || busy} onClick={upload}>{busy ? 'Uploading…' : `Upload ${fmt(parsed.valid.length)} codes`}</Btn>
      </div>
      {progress && (
        <div className="mt-3">
          <div className="h-2 overflow-hidden rounded-full bg-emerald-100"><div className="h-full bg-emerald-600 transition-all" style={{ width: `${(progress.done / progress.total) * 100}%` }} /></div>
          <p className="mt-1 text-xs text-emerald-900/70">{fmt(progress.done)} / {fmt(progress.total)} processed · {fmt(progress.added)} added</p>
        </div>
      )}
      {result && (
        <div className="mt-4 rounded-xl border border-[#e7e1cf] p-3.5 text-sm">
          <p><b className="text-emerald-800">{fmt(result.added)} new code(s) added.</b>{' '}
            {result.skipped.length > 0 ? <span className="text-gold-600">{fmt(result.skipped.length)} already in the database, skipped.</span> : 'No duplicates found.'}</p>
          {result.skipped.length > 0 && (
            <details className="mt-2">
              <summary className="cursor-pointer text-emerald-900/75">Show skipped codes</summary>
              <p className="mt-2 max-h-40 overflow-auto break-all font-mono text-xs">{result.skipped.join(', ')}</p>
            </details>
          )}
        </div>
      )}
    </Card>
  );
}

/* ---------------- Settings ---------------- */
function SettingsPage({ toast, settings, reload }: { toast: ToastFn; settings: Settings; reload: () => void }) {
  const [s, setS] = useState<Settings>(settings);
  const [content, setContent] = useState<NusukContent>(mergeContent(settings.content));
  const [confirmText, setConfirmText] = useState('');
  useEffect(() => { setS(settings); setContent(mergeContent(settings.content)); }, [settings]);

  async function save(patch?: Partial<Settings>) {
    const next = { ...s, ...patch };
    // Store only fields that differ from the defaults, so later default-text edits still flow through.
    const diff: Partial<NusukContent> = {};
    for (const k of Object.keys(content) as (keyof NusukContent)[]) if (content[k] !== defaultContent[k]) diff[k] = content[k];
    const winners = settings.content?.winners; // edited on the Winners page; keep as is
    const { error } = await sb!.from('nusuk_settings').update({
      enabled: next.enabled, submissions_enabled: next.submissions_enabled,
      default_max_uses: Math.max(1, next.default_max_uses || 1),
      logo_url: next.logo_url?.trim() || null, notice: next.notice?.trim() || null,
      content: winners ? { ...diff, winners } : diff, updated_at: new Date().toISOString(),
    }).eq('id', 1);
    if (error) return toast(errText(error), false);
    toast('Settings saved');
    reload();
  }
  async function danger(kind: 'reset' | 'delete') {
    if (confirmText !== 'DELETE') return toast('Type DELETE in the box first', false);
    const req = kind === 'reset'
      ? sb!.from('nusuk_codes').update({ uses: 0, last_used_at: null }).gte('id', 0)
      : sb!.from('nusuk_codes').delete().gte('id', 0);
    const { error } = await req;
    if (error) return toast(errText(error), false);
    if (kind === 'reset') await sb!.from('nusuk_daily').delete().gte('copies', 0);
    setConfirmText('');
    toast(kind === 'reset' ? 'All usage counts reset' : 'All codes deleted');
  }

  return (
    <div className="grid gap-4">
      <Card title="Module status">
        <div className="grid gap-3">
          <Toggle on={s.enabled} onChange={(v) => { setS({ ...s, enabled: v }); save({ enabled: v }); }} label="Nusuk page is ON" hint="Turn off to pause the whole page. Visitors see the notice below instead of codes." />
          <Toggle on={s.submissions_enabled} onChange={(v) => { setS({ ...s, submissions_enabled: v }); save({ submissions_enabled: v }); }} label="Accept user submissions" hint="Show the 'submit your code' form." />
        </div>
      </Card>
      <Card title="General" actions={<Btn onClick={() => save()}>Save</Btn>}>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="grid gap-1 text-sm font-semibold">Default max uses per code
            <input type="number" min={1} className="nk-input" value={s.default_max_uses} onChange={(e) => setS({ ...s, default_max_uses: +e.target.value })} />
            <span className="text-xs font-normal text-emerald-900/60">How many visitors can copy one code before it's used up. Applies to new uploads and approved submissions.</span>
          </label>
          <label className="grid gap-1 text-sm font-semibold">Logo image URL
            <input className="nk-input" placeholder="https://…/nusuk-logo.png" value={s.logo_url ?? ''} onChange={(e) => setS({ ...s, logo_url: e.target.value })} />
            <span className="text-xs font-normal text-emerald-900/60">Upload a logo in the main admin's Media library and paste its URL. Empty = built-in emblem.</span>
          </label>
          <label className="grid gap-1 text-sm font-semibold sm:col-span-2">Notice banner (optional)
            <textarea rows={2} className="nk-input" value={s.notice ?? ''} onChange={(e) => setS({ ...s, notice: e.target.value })} placeholder="e.g. প্রতিযোগিতা ৩০ নভেম্বর শেষ হবে" />
          </label>
        </div>
      </Card>
      <Card title="Page text (Bangla)" actions={<><Btn kind="ghost" onClick={() => setContent(defaultContent)}>Restore defaults</Btn><Btn onClick={() => save()}>Save</Btn></>}>
        <div className="grid gap-3">
          {contentFields.map((f) => (
            <label key={f.key} className="grid gap-1 text-sm font-semibold">{f.label}
              {f.long
                ? <textarea rows={f.key.endsWith('body') ? 6 : 3} className="nk-input font-normal" value={content[f.key]} onChange={(e) => setContent({ ...content, [f.key]: e.target.value })} />
                : <input className="nk-input font-normal" value={content[f.key]} onChange={(e) => setContent({ ...content, [f.key]: e.target.value })} />}
            </label>
          ))}
        </div>
      </Card>
      <Card title={<span className="text-red-700">Danger zone</span>}>
        <p className="text-sm text-emerald-900/75">Type <b>DELETE</b> to unlock these buttons. They cannot be undone.</p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <input className="nk-input w-40" value={confirmText} onChange={(e) => setConfirmText(e.target.value)} placeholder="DELETE" aria-label="Type DELETE to confirm" />
          <Btn kind="ghost" disabled={confirmText !== 'DELETE'} onClick={() => danger('reset')}>Reset all usage counts</Btn>
          <Btn kind="danger" disabled={confirmText !== 'DELETE'} onClick={() => danger('delete')}>Delete ALL codes</Btn>
        </div>
        <div className="mt-4 rounded-xl bg-cream p-3.5 text-sm leading-relaxed">
          <b>Remove the module completely:</b> run <code className="font-mono">src/pages/nusuk/_sql/uninstall.sql</code> in Supabase SQL Editor, then delete the folder <code className="font-mono">src/pages/nusuk/</code> and push. Nothing else on the site depends on it.
        </div>
      </Card>
    </div>
  );
}

/* ---------------- Winners ---------------- */
const blankWinner = (): Winner => ({ name: '', prize: 'umrah', date: new Date().toISOString().slice(0, 10), link: '' });
function WinnersPage({ toast, settings, reload }: { toast: ToastFn; settings: Settings; reload: () => void }) {
  const [list, setList] = useState<Winner[]>(() => parseWinners(settings.content));
  const [busy, setBusy] = useState(false);
  useEffect(() => setList(parseWinners(settings.content)), [settings]);
  const set = (i: number, patch: Partial<Winner>) => setList((l) => l.map((w, j) => (j === i ? { ...w, ...patch } : w)));

  async function save() {
    const clean = list
      .map((w) => ({ name: w.name.trim(), prize: w.prize, prize_text: w.prize === 'other' ? w.prize_text?.trim() || undefined : undefined, date: w.date || undefined, link: w.link?.trim() || undefined }))
      .filter((w) => w.name);
    if (clean.some((w) => w.link && !/^https:\/\//.test(w.link))) return toast('Links must start with https://', false);
    setBusy(true);
    // Read the latest content first so page-text edits made elsewhere are not lost.
    const { data, error: e1 } = await sb!.from('nusuk_settings').select('content').eq('id', 1).single();
    if (e1) { setBusy(false); return toast(errText(e1), false); }
    const content = { ...((data?.content as object) ?? {}), winners: clean };
    const { error } = await sb!.from('nusuk_settings').update({ content, updated_at: new Date().toISOString() }).eq('id', 1);
    setBusy(false);
    if (error) return toast(errText(error), false);
    toast(`Saved ${clean.length} winner(s)`);
    reload();
  }

  return (
    <Card title={`Bangladeshi winners (${list.filter((w) => w.name.trim()).length})`} actions={<><Btn kind="ghost" onClick={() => setList([blankWinner(), ...list])}>+ Add winner</Btn><Btn onClick={save} disabled={busy}>{busy ? 'Saving…' : 'Save'}</Btn></>}>
      <p className="mb-4 text-sm text-emerald-900/75">Shown on /nusuk as "বাংলাদেশি বিজয়ীরা", newest date first. Copy names exactly as Nusuk announced them, and add the Facebook post link as proof if you can. Leave the list empty to hide the section.</p>
      <div className="grid gap-3">
        {list.map((w, i) => (
          <div key={i} className="grid gap-2 rounded-xl border border-[#e7e1cf] bg-cream p-3 sm:grid-cols-[1.4fr_0.9fr_0.8fr_auto] sm:items-end">
            <label className="grid gap-1 text-xs font-semibold">Name<input className="nk-input" value={w.name} maxLength={120} onChange={(e) => set(i, { name: e.target.value })} placeholder="Winner's name" /></label>
            <label className="grid gap-1 text-xs font-semibold">Prize
              <select className="nk-input" value={w.prize} onChange={(e) => set(i, { prize: e.target.value as Prize })}>
                <option value="umrah">{prizeLabel.umrah} (Umrah)</option>
                <option value="zamzam">{prizeLabel.zamzam} (Zamzam)</option>
                <option value="other">Other…</option>
              </select>
            </label>
            <label className="grid gap-1 text-xs font-semibold">Date<input type="date" className="nk-input" value={w.date ?? ''} onChange={(e) => set(i, { date: e.target.value })} /></label>
            <Btn kind="ghost" className="text-red-700" onClick={() => setList(list.filter((_, j) => j !== i))} aria-label={`Remove ${w.name || 'winner'}`}>Remove</Btn>
            {w.prize === 'other' && <label className="grid gap-1 text-xs font-semibold sm:col-span-2">Prize text<input className="nk-input" value={w.prize_text ?? ''} maxLength={60} onChange={(e) => set(i, { prize_text: e.target.value })} placeholder="e.g. গিফট বক্স" /></label>}
            <label className={`grid gap-1 text-xs font-semibold ${w.prize === 'other' ? 'sm:col-span-2' : 'sm:col-span-4'}`}>Facebook post link (optional)<input className="nk-input" value={w.link ?? ''} onChange={(e) => set(i, { link: e.target.value })} placeholder="https://www.facebook.com/MyNusuk/posts/…" /></label>
          </div>
        ))}
        {!list.length && <p className="rounded-xl bg-emerald-50 p-6 text-center text-sm text-emerald-900/70">No winners yet. Click "+ Add winner".</p>}
      </div>
    </Card>
  );
}

/* ---------------- Shell ---------------- */
type Route = 'dashboard' | 'codes' | 'review' | 'upload' | 'winners' | 'settings';
const nav: { r: Route; label: string; icon: string }[] = [
  { r: 'dashboard', label: 'Dashboard', icon: 'M3 13h8V3H3zm10 8h8V11h-8zM3 21h8v-6H3zm10-18v6h8V3z' },
  { r: 'codes', label: 'Codes', icon: 'M4 6h16M4 12h16M4 18h10' },
  { r: 'review', label: 'Review', icon: 'M9 12l2 2 4-4M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z' },
  { r: 'upload', label: 'Upload', icon: 'M12 16V4m0 0l-4 4m4-4l4 4M4 20h16' },
  { r: 'winners', label: 'Winners', icon: 'M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0zM7 6H4a3 3 0 0 0 3 4M17 6h3a3 3 0 0 1-3 4' },
  { r: 'settings', label: 'Settings', icon: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z' },
];

export default function NusukAdmin() {
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [route, setRouteState] = useState<Route>(() => ((typeof location !== 'undefined' && (location.hash.slice(2) as Route)) || 'dashboard'));
  const [settings, setSettings] = useState<Settings | null>(null);
  const [setupError, setSetupError] = useState<string | null>(null);
  const [toastMsg, setToastMsg] = useState<{ t: string; ok: boolean } | null>(null);

  const toast = useCallback<ToastFn>((t, ok = true) => {
    setToastMsg({ t, ok });
    setTimeout(() => setToastMsg((m) => (m?.t === t ? null : m)), 3500);
  }, []);
  const go = (r: Route) => { location.hash = `/${r}`; setRouteState(r); };
  useEffect(() => {
    const on = () => setRouteState((location.hash.slice(2) as Route) || 'dashboard');
    addEventListener('hashchange', on);
    return () => removeEventListener('hashchange', on);
  }, []);

  useEffect(() => {
    if (!sb) return;
    sb.auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = sb.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => data.subscription.unsubscribe();
  }, []);
  useEffect(() => {
    if (!session) { setIsAdmin(null); return; }
    sb!.rpc('is_admin').then(({ data }) => setIsAdmin(Boolean(data)));
  }, [session]);

  const loadSettings = useCallback(async () => {
    const { data, error } = await sb!.from('nusuk_settings').select('*').eq('id', 1).maybeSingle();
    if (error || !data) setSetupError(error ? errText(error) : 'Settings row missing');
    else { setSetupError(null); setSettings(data as Settings); }
  }, []);
  useEffect(() => { if (isAdmin) loadSettings(); }, [isAdmin, loadSettings]);

  if (!sb) return <Centered>Supabase is not configured. Add PUBLIC_SUPABASE_URL and PUBLIC_SUPABASE_ANON_KEY to .env.local.</Centered>;
  if (session === undefined) return <Centered>Loading…</Centered>;
  if (!session || isAdmin === false) return <Login denied={isAdmin === false} />;
  if (isAdmin === null) return <Centered>Checking access…</Centered>;
  if (setupError) {
    return (
      <Centered>
        <b className="block text-lg">Database not set up yet</b>
        <span className="mt-2 block text-sm">Open Supabase → SQL Editor, paste the file <code className="font-mono">src/pages/nusuk/_sql/install.sql</code> and Run. Then reload this page.</span>
        <span className="mt-2 block text-xs text-red-700">{setupError}</span>
      </Centered>
    );
  }

  return (
    <div className="min-h-screen lg:flex">
      <aside className="nk-pattern sticky top-0 z-30 text-white lg:h-screen lg:w-60 lg:shrink-0">
        <div className="flex items-center gap-3 px-4 py-3 lg:py-5">
          <Logo />
          <div className="min-w-0 flex-1 leading-tight">
            <div className="font-bold">Nusuk Manager</div>
            <div className="truncate text-xs text-gold-100/80">{session.user.email}</div>
          </div>
        </div>
        <nav className="flex gap-1 overflow-x-auto px-2 pb-2 lg:flex-col lg:px-3" aria-label="Nusuk admin">
          {nav.map((n) => (
            <a key={n.r} href={`#/${n.r}`} onClick={() => setRouteState(n.r)} aria-current={route === n.r ? 'page' : undefined}
              className={`flex shrink-0 items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-semibold ${route === n.r ? 'bg-gold-500 text-emerald-950' : 'text-emerald-50 hover:bg-white/10'}`}>
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d={n.icon} /></svg>
              {n.label}
            </a>
          ))}
        </nav>
        <div className="hidden gap-1 px-3 pt-4 lg:grid">
          <a href="/nusuk" target="_blank" rel="noopener" className="rounded-lg px-3 py-2 text-sm text-emerald-50 hover:bg-white/10">View public page ↗</a>
          <button type="button" onClick={() => sb.auth.signOut()} className="rounded-lg px-3 py-2 text-left text-sm text-emerald-50 hover:bg-white/10">Sign out</button>
        </div>
      </aside>

      <main className="mx-auto w-full max-w-6xl flex-1 p-4 sm:p-6">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h1 className="text-xl font-bold text-emerald-950">{nav.find((n) => n.r === route)?.label ?? 'Dashboard'}</h1>
          <div className="flex items-center gap-2">
            <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${settings?.enabled ? 'bg-emerald-100 text-emerald-900' : 'bg-red-100 text-red-700'}`}>{settings?.enabled ? 'Page ON' : 'Page OFF'}</span>
            <a href="/nusuk" target="_blank" rel="noopener" className="text-sm font-semibold text-emerald-700 lg:hidden">View ↗</a>
            <button type="button" onClick={() => sb.auth.signOut()} className="text-sm text-emerald-900/70 lg:hidden">Sign out</button>
          </div>
        </div>
        {route === 'dashboard' && <Dashboard toast={toast} go={go} />}
        {route === 'codes' && <CodesPage key="codes" toast={toast} />}
        {route === 'review' && <CodesPage key="review" toast={toast} reviewMode />}
        {route === 'upload' && <Upload toast={toast} defaultMax={settings?.default_max_uses ?? 1} />}
        {route === 'winners' && settings && <WinnersPage toast={toast} settings={settings} reload={loadSettings} />}
        {route === 'settings' && settings && <SettingsPage toast={toast} settings={settings} reload={loadSettings} />}
      </main>

      {toastMsg && (
        <div className="fixed inset-x-0 bottom-5 z-[60] flex justify-center px-4" role="status">
          <span className={`rounded-full px-5 py-2.5 text-sm font-semibold shadow-xl ${toastMsg.ok ? 'bg-emerald-950 text-gold-100' : 'bg-red-700 text-white'}`}>{toastMsg.t}</span>
        </div>
      )}
    </div>
  );
}

function Centered({ children }: { children: ReactNode }) {
  return <div className="grid min-h-screen place-items-center p-6 text-center"><div className="nk-card max-w-md p-6">{children}</div></div>;
}
