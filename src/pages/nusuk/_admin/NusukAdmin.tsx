import { useCallback, useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import AdsPage from './AdsPage';
import BonusPage from './BonusPage';
import { bonusFor, parseBonus } from '../_lib/bonus';
import { CODE_RE, COUNTRY_CODES, PINNED_COUNT, contentFields, countryName, defaultContent, flagUrl, mergeContent, parseToday, parseTopBar, parseVideo, parseWinners, youtubeId, subscribeUrl, defaultVideoLabel, defaultTopBarText, defaultTopBarDoneText, countdownText, prizeLabel, type NusukContent, type Prize, type TodayWinner, type TopBar, type VideoMode, type Winner } from '../_lib/content';

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
  featured_at?: string | null;
  featured_base?: number;
  boost_quota?: number | null;
  approved_at?: string | null;
  approved_base?: number;
};
type Stats = {
  total: number; active: number; remaining: number; used_up: number; inactive: number;
  pending: number; copies: number; today: number; daily: { day: string; copies: number }[];
};
type Settings = {
  enabled: boolean; submissions_enabled: boolean; default_max_uses: number;
  feature_quota?: number; feature_hours?: number; approved_quota?: number; boost_share?: number;
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
/** Mirrors nusuk_boost_tier() in update_08: which priority tier a code is in right now. */
type Boost = { tier: 1 | 2 | 3; text: string; cls: string } | null;
function boostOf(r: Code, s: Settings | null): Boost {
  const fh = s?.feature_hours ?? 12, aq = s?.approved_quota ?? 2;
  const fq = r.boost_quota ?? s?.feature_quota ?? 10;
  if (r.featured_at) {
    const got = r.uses - (r.featured_base ?? 0);
    const leftMs = new Date(r.featured_at).getTime() + fh * 3600e3 - Date.now();
    if (r.status === 'active' && leftMs > 0 && got < fq) {
      const h = Math.floor(leftMs / 3600e3), m = Math.floor((leftMs % 3600e3) / 60e3);
      // Paced like nusuk_pick (update 09): next copy is due at featured_at + got × (time limit ÷ quota)
      const nextMs = new Date(r.featured_at).getTime() + (got * fh * 3600e3) / fq - Date.now();
      const next = nextMs > 0 ? ` · next in ${Math.ceil(nextMs / 60e3)}m` : ' · showing now';
      return { tier: 1, text: `★ featured ${got}/${fq} · ${h}h ${m}m left${next}`, cls: 'bg-amber-100 text-amber-800' };
    }
    return { tier: 3, text: `★ feature ended${got >= fq ? ` (${got}/${fq})` : ' (time up)'}`, cls: 'bg-gray-100 text-gray-600' };
  }
  if (r.approved_at && r.status === 'active' && r.uses - (r.approved_base ?? 0) < aq) {
    return { tier: 2, text: `new ${r.uses - (r.approved_base ?? 0)}/${aq}`, cls: 'bg-sky-100 text-sky-800' };
  }
  return null;
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
type Pt = { t: string; n: number };
type Day = { day: string; new: number; unique: number | null; copies: number; submitted: number; approved: number };
type CodeRow = { code: string; uses: number; source: 'admin' | 'user'; featured: boolean };
type Dash = {
  today: string; tracked_from: string;
  visitors: { total: number; active_now: number; unique_today: number; unique_yday: number; new_today: number; new_yday: number; peak_today: number; peak_today_at: string | null; peak_ever: number };
  copies: { total: number; today: number; yday: number; last_hour: number };
  daily: Day[]; active_log: Pt[]; hourly: Pt[];
  codes: { active: number; inactive: number; never_used: number; avg_uses: number; from_admin: number; from_users: number; buckets: { label: string; n: number }[]; top: CodeRow[]; bottom: CodeRow[] };
  review: { pending: number; submitted: number; approved: number; rejected: number; submitted_today: number; approved_today: number };
  featured: { running: number; ever: number; today: number; req_pending: number; req_approved: number; req_rejected: number; req_today: number };
  feedback: { new: number; total: number; today: number };
};

// Chart colors (validated: emerald + dark gold pass CVD, normal-vision and 3:1 contrast on white)
const C1 = '#0a7a59';
const C2 = '#a8841f';
const dhakaTime = (iso: string, withDay = false) =>
  new Date(iso).toLocaleString('en-GB', { timeZone: 'Asia/Dhaka', hour: '2-digit', minute: '2-digit', ...(withDay ? { day: 'numeric', month: 'short' } : {}) });
const shortDay = (d: string) => new Date(`${d}T00:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });

/** Change vs yesterday, e.g. "+12% vs yesterday". */
function Delta({ now, before }: { now: number; before: number }) {
  if (!before) return <span className="text-emerald-900/55">Yesterday: {fmt(before)}</span>;
  const p = Math.round(((now - before) / before) * 100);
  return <span className={p >= 0 ? 'text-emerald-700' : 'text-red-700'}>{p >= 0 ? '▲' : '▼'} {Math.abs(p)}% <span className="text-emerald-900/55">vs yesterday ({fmt(before)})</span></span>;
}

function Stat({ label, value, sub, hero = false }: { label: string; value: ReactNode; sub?: ReactNode; hero?: boolean }) {
  return (
    <div className={`nk-card p-4 ${hero ? 'bg-emerald-900! text-white' : ''}`}>
      <div className={`text-xs font-semibold ${hero ? 'text-gold-100' : 'text-emerald-900/70'}`}>{label}</div>
      <div className="mt-1 text-2xl font-bold tabular-nums">{value}</div>
      {sub && <div className={`mt-0.5 text-xs ${hero ? 'text-emerald-100/75' : 'text-emerald-900/60'}`}>{sub}</div>}
    </div>
  );
}

/** Vertical bars: one series, or two either stacked (parts of a whole) or grouped side by side. Hover tooltip per bar. */
function Bars({ rows, series, label, grouped = false }: { rows: { key: string; tick: string; tip: string; values: (number | null)[] }[]; series: { name: string; color: string }[]; label: string; grouped?: boolean }) {
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(1, ...rows.map((r) => (grouped ? Math.max(0, ...r.values.map((v) => v ?? 0)) : r.values.reduce<number>((a, v) => a + (v ?? 0), 0))));
  const every = Math.ceil(rows.length / 10);
  return (
    <div>
      {series.length > 1 && (
        <div className="mb-2 flex flex-wrap gap-3 text-xs text-emerald-900/75">
          {series.map((s) => <span key={s.name} className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm" style={{ background: s.color }} />{s.name}</span>)}
        </div>
      )}
      <div className="relative">
        <div className="flex h-40 items-end gap-[2px]" role="img" aria-label={label} onMouseLeave={() => setHover(null)}>
          {rows.map((r, i) => (
            <div key={r.key} className="flex h-full flex-1 cursor-default flex-col justify-end" onMouseEnter={() => setHover(i)} onFocus={() => setHover(i)} tabIndex={-1}>
              <div className={`flex gap-[2px] ${grouped ? 'items-end' : 'flex-col-reverse'} ${hover === null || hover === i ? 'opacity-100' : 'opacity-60'}`}>
                {r.values.map((v, j) => (v ? <div key={j} className={grouped ? 'flex-1 rounded-t-[4px]' : 'w-full last:rounded-t-[4px]'} style={{ height: `${(v / max) * 152}px`, minHeight: 2, background: series[j].color }} /> : grouped ? <div key={j} className="flex-1" /> : null))}
                {!r.values.some(Boolean) && <div className="h-[2px] w-full bg-emerald-900/10" />}
              </div>
            </div>
          ))}
        </div>
        {hover !== null && rows[hover] && (
          <div className="pointer-events-none absolute -top-2 z-10 -translate-x-1/2 -translate-y-full rounded-lg bg-emerald-950 px-2.5 py-1.5 text-xs whitespace-nowrap text-white shadow-lg"
            style={{ left: `${((hover + 0.5) / rows.length) * 100}%` }}>
            <div className="font-semibold">{rows[hover].tip}</div>
            {series.map((s, j) => (
              <div key={s.name} className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-sm" style={{ background: s.color }} />{s.name}: <b className="tabular-nums">{rows[hover].values[j] === null ? '—' : fmt(rows[hover].values[j]!)}</b></div>
            ))}
          </div>
        )}
      </div>
      <div className="mt-1 flex gap-[2px] text-[10px] text-emerald-900/55">
        {rows.map((r, i) => <span key={r.key} className="flex-1 text-center">{i % every === 0 || i === rows.length - 1 ? r.tick : ''}</span>)}
      </div>
    </div>
  );
}

/** Area line with a crosshair tooltip. */
function Line({ pts, label, unit, color = C1 }: { pts: Pt[]; label: string; unit: string; color?: string }) {
  const [hover, setHover] = useState<number | null>(null);
  if (pts.length < 2) return <p className="rounded-xl bg-emerald-50 p-6 text-center text-sm text-emerald-900/70">Not enough data yet. The graph fills in as visitors come (one point every 10 minutes).</p>;
  const W = 600, H = 160, max = Math.max(1, ...pts.map((p) => p.n));
  const t0 = Date.parse(pts[0].t), t1 = Date.parse(pts[pts.length - 1].t);
  const x = (p: Pt) => ((Date.parse(p.t) - t0) / Math.max(1, t1 - t0)) * W;
  const y = (p: Pt) => H - (p.n / max) * (H - 8);
  const d = pts.map((p, i) => `${i ? 'L' : 'M'}${x(p).toFixed(1)},${y(p).toFixed(1)}`).join('');
  const onMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const tx = t0 + ((e.clientX - r.left) / r.width) * (t1 - t0);
    let best = 0;
    pts.forEach((p, i) => { if (Math.abs(Date.parse(p.t) - tx) < Math.abs(Date.parse(pts[best].t) - tx)) best = i; });
    setHover(best);
  };
  const h = hover !== null ? pts[hover] : null;
  return (
    <div>
      <div className="flex gap-2">
        <div className="flex h-40 shrink-0 flex-col justify-between text-right text-[10px] text-emerald-900/55 tabular-nums"><span>{fmt(max)}</span><span>{fmt(Math.round(max / 2))}</span><span>0</span></div>
        <div className="relative min-w-0 flex-1">
          <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="block h-40 w-full overflow-visible" role="img" aria-label={label} onMouseMove={onMove} onMouseLeave={() => setHover(null)}>
            {[0, 0.5, 1].map((f) => <line key={f} x1={0} x2={W} y1={H - f * (H - 8)} y2={H - f * (H - 8)} stroke="#053d2d" strokeOpacity={0.08} vectorEffect="non-scaling-stroke" />)}
            <path d={`${d}L${W},${H}L0,${H}Z`} fill={color} fillOpacity={0.12} />
            <path d={d} fill="none" stroke={color} strokeWidth={2} vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
            {h && <line x1={x(h)} x2={x(h)} y1={0} y2={H} stroke="#053d2d" strokeOpacity={0.35} strokeDasharray="3 3" vectorEffect="non-scaling-stroke" />}
          </svg>
          {h && (
            <div className="pointer-events-none absolute top-0 z-10 -translate-x-1/2 -translate-y-full rounded-lg bg-emerald-950 px-2.5 py-1.5 text-xs whitespace-nowrap text-white shadow-lg" style={{ left: `${(x(h) / W) * 100}%` }}>
              <div className="font-semibold">{dhakaTime(h.t, true)}</div>
              <div><b className="tabular-nums">{fmt(h.n)}</b> {unit}</div>
            </div>
          )}
          <div className="mt-1 flex justify-between text-[10px] text-emerald-900/55"><span>{dhakaTime(pts[0].t, true)}</span><span>{dhakaTime(pts[pts.length - 1].t, true)}</span></div>
        </div>
      </div>
    </div>
  );
}

function CodeList({ rows, empty }: { rows: CodeRow[]; empty: string }) {
  if (!rows.length) return <p className="text-sm text-emerald-900/60">{empty}</p>;
  const max = Math.max(1, ...rows.map((r) => r.uses));
  return (
    <ol className="grid gap-1.5">
      {rows.map((r, i) => (
        <li key={r.code} className="grid grid-cols-[1.5rem_1fr_auto] items-center gap-2 text-sm">
          <span className="text-xs text-emerald-900/50 tabular-nums">{i + 1}</span>
          <span className="min-w-0">
            <span className="flex items-center gap-1.5 font-mono font-semibold text-emerald-950">{r.code}{r.featured && <span title="Featured" className="text-gold-600">★</span>}{r.source === 'user' && <span className="rounded bg-emerald-50 px-1 font-sans text-[10px] text-emerald-800">user</span>}</span>
            <span className="mt-0.5 block h-1.5 rounded-full bg-emerald-50"><span className="block h-1.5 rounded-full" style={{ width: `${Math.max(2, (r.uses / max) * 100)}%`, background: C1 }} /></span>
          </span>
          <span className="font-bold tabular-nums text-emerald-950">{fmt(r.uses)}</span>
        </li>
      ))}
    </ol>
  );
}

function Dashboard({ toast, go }: { toast: ToastFn; go: (r: Route) => void }) {
  const [d, setD] = useState<Dash | null>(null);
  const [old, setOld] = useState<Stats | null>(null);
  const [missing, setMissing] = useState(false);
  const [range, setRange] = useState<'24h' | '7d'>('24h');
  const [at, setAt] = useState<Date | null>(null);
  const load = useCallback(async () => {
    const { data, error } = await sb!.rpc('nusuk_admin_dashboard');
    if (!error) { setD(data as Dash); setMissing(false); setAt(new Date()); return; }
    // update_11 not run yet: fall back to the basic numbers
    setMissing(true);
    const r = await sb!.rpc('nusuk_admin_stats');
    if (r.error) toast(errText(r.error), false); else setOld(r.data as Stats);
  }, [toast]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    const t = setInterval(() => { if (document.visibilityState === 'visible') load(); }, 60000);
    return () => clearInterval(t);
  }, [load]);

  if (missing) {
    return (
      <Card title="Dashboard" actions={<Btn kind="ghost" onClick={load}>Refresh</Btn>}>
        <p className="mb-4 rounded-xl bg-gold-100 p-3 text-sm">Run <code className="font-mono">src/pages/nusuk/_sql/update_11_dashboard.sql</code> in Supabase → SQL Editor for the detailed dashboard, then click Refresh.</p>
        {old && <div className="grid grid-cols-2 gap-3 lg:grid-cols-4"><Stat label="Active codes" value={fmt(old.active)} /><Stat label="Total copies" value={fmt(old.copies)} /><Stat label="Copies today" value={fmt(old.today)} /><Stat label="Waiting for review" value={fmt(old.pending)} /></div>}
      </Card>
    );
  }
  if (!d) return <Card title="Dashboard"><p className="text-sm text-emerald-900/60">Loading…</p></Card>;

  const v = d.visitors;
  const returning = Math.max(0, v.unique_today - v.new_today);
  const perVisitor = v.unique_today ? (d.copies.today / v.unique_today).toFixed(1) : '—';
  const cutoff = Date.now() - (range === '24h' ? 24 : 168) * 3600e3;
  const activePts = d.active_log.filter((p) => Date.parse(p.t) >= cutoff);
  const days14 = d.daily.slice(-14);
  const tracked = d.tracked_from;

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-emerald-900/60">All times in Bangladesh time. Updates every minute{at ? ` · last ${at.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}` : ''}.</p>
        <Btn kind="ghost" onClick={load}>Refresh</Btn>
      </div>

      {/* Visitors */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat hero label="Active right now" value={<span className="inline-flex items-center gap-2"><span className="relative flex h-2.5 w-2.5"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-300 opacity-70" /><span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-300" /></span>{fmt(v.active_now)}</span>}
          sub={`Peak today ${fmt(v.peak_today)}${v.peak_today_at ? ` at ${dhakaTime(v.peak_today_at)}` : ''} · best ever ${fmt(v.peak_ever)}`} />
        <Stat label="Visitors today" value={fmt(v.unique_today)} sub={<Delta now={v.unique_today} before={v.unique_yday} />} />
        <Stat label="New visitors today" value={fmt(v.new_today)} sub={<Delta now={v.new_today} before={v.new_yday} />} />
        <Stat label="Returning today" value={fmt(returning)} sub="Came before, back again today" />
        <Stat label="All-time visitors" value={fmt(v.total)} sub="Different browsers that opened /nusuk" />
        <Stat label="Copies today" value={fmt(d.copies.today)} sub={<Delta now={d.copies.today} before={d.copies.yday} />} />
        <Stat label="Copies, last hour" value={fmt(d.copies.last_hour)} sub={`${perVisitor} copies per visitor today`} />
        <Stat label="All-time copies" value={fmt(d.copies.total)} sub={`Avg ${d.codes.avg_uses} per active code`} />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card title="Active users" actions={<div className="flex rounded-full border border-[#e7e1cf] p-0.5 text-xs font-semibold">{(['24h', '7d'] as const).map((r) => <button key={r} type="button" onClick={() => setRange(r)} className={`rounded-full px-3 py-1 ${range === r ? 'bg-emerald-900 text-white' : 'text-emerald-900'}`}>{r === '24h' ? '24 hours' : '7 days'}</button>)}</div>}>
          <p className="-mt-2 mb-3 text-xs text-emerald-900/60">Highest number of people on the page at the same time, every 10 minutes.</p>
          <Line pts={activePts} label="Active users" unit="active" />
        </Card>
        <Card title="Copies per hour (48 h)">
          <p className="-mt-2 mb-3 text-xs text-emerald-900/60">How many codes were copied in each hour.</p>
          <Line pts={d.hourly} label="Copies per hour" unit="copies" />
        </Card>
      </div>

      <Card title="Visitors per day (30 days)">
        <p className="-mt-2 mb-3 text-xs text-emerald-900/60">New = first visit ever. Returning = came before. Returning visitors are counted from {shortDay(tracked)}; earlier days show new visitors only.</p>
        <Bars label="Visitors per day" series={[{ name: 'New', color: C1 }, { name: 'Returning', color: C2 }]}
          rows={d.daily.map((x) => ({ key: x.day, tick: shortDay(x.day), tip: shortDay(x.day), values: [x.new, x.unique === null ? null : Math.max(0, x.unique - x.new)] }))} />
      </Card>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card title="Copies per day (30 days)">
          <Bars label="Copies per day" series={[{ name: 'Copies', color: C1 }]} rows={d.daily.map((x) => ({ key: x.day, tick: shortDay(x.day), tip: shortDay(x.day), values: [x.copies] }))} />
        </Card>
        <Card title="Submissions (14 days)" actions={<Btn kind="ghost" onClick={() => go('review')}>Review →</Btn>}>
          <Bars grouped label="Submitted and approved codes per day" series={[{ name: 'Submitted', color: C2 }, { name: 'Approved', color: C1 }]}
            rows={days14.map((x) => ({ key: x.day, tick: shortDay(x.day), tip: shortDay(x.day), values: [x.submitted, x.approved] }))} />
        </Card>
      </div>

      {/* Codes, review, featured */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card title="Codes">
          <dl className="grid grid-cols-2 gap-x-3 gap-y-2 text-sm">
            <dt className="text-emerald-900/70">Active</dt><dd className="text-right font-bold tabular-nums">{fmt(d.codes.active)}</dd>
            <dt className="text-emerald-900/70">Inactive</dt><dd className="text-right font-bold tabular-nums">{fmt(d.codes.inactive)}</dd>
            <dt className="text-emerald-900/70">Uploaded by you</dt><dd className="text-right font-bold tabular-nums">{fmt(d.codes.from_admin)}</dd>
            <dt className="text-emerald-900/70">From visitors (approved)</dt><dd className="text-right font-bold tabular-nums">{fmt(d.codes.from_users)}</dd>
            <dt className="text-emerald-900/70">Never copied yet</dt><dd className="text-right font-bold tabular-nums">{fmt(d.codes.never_used)}</dd>
          </dl>
          <h3 className="mt-4 mb-2 text-xs font-bold text-emerald-900/70">Active codes by number of copies</h3>
          <div className="grid gap-1.5">
            {d.codes.buckets.map((b) => {
              const max = Math.max(1, ...d.codes.buckets.map((x) => x.n));
              return (
                <div key={b.label} className="grid grid-cols-[3.5rem_1fr_3.5rem] items-center gap-2 text-xs">
                  <span className="text-emerald-900/70">{b.label}</span>
                  <span className="h-2.5 rounded-full bg-emerald-50"><span className="block h-2.5 rounded-full" style={{ width: `${b.n ? Math.max(2, (b.n / max) * 100) : 0}%`, background: C1 }} /></span>
                  <span className="text-right font-semibold tabular-nums">{fmt(b.n)}</span>
                </div>
              );
            })}
          </div>
        </Card>
        <Card title="Review" actions={d.review.pending ? <Btn onClick={() => go('review')}>{fmt(d.review.pending)} waiting →</Btn> : undefined}>
          <dl className="grid grid-cols-2 gap-x-3 gap-y-2 text-sm">
            <dt className="text-emerald-900/70">Submitted by visitors</dt><dd className="text-right font-bold tabular-nums">{fmt(d.review.submitted)}</dd>
            <dt className="text-emerald-900/70">Approved (added)</dt><dd className="text-right font-bold tabular-nums">{fmt(d.review.approved)}</dd>
            <dt className="text-emerald-900/70">Rejected</dt><dd className="text-right font-bold tabular-nums">{fmt(d.review.rejected)}</dd>
            <dt className="text-emerald-900/70">Waiting</dt><dd className="text-right font-bold tabular-nums">{fmt(d.review.pending)}</dd>
            <dt className="text-emerald-900/70">Submitted today</dt><dd className="text-right font-bold tabular-nums">{fmt(d.review.submitted_today)}</dd>
            <dt className="text-emerald-900/70">Approved today</dt><dd className="text-right font-bold tabular-nums">{fmt(d.review.approved_today)}</dd>
          </dl>
        </Card>
        <Card title="Featured" actions={d.featured.req_pending ? <Btn onClick={() => go('features')}>{fmt(d.featured.req_pending)} requests →</Btn> : undefined}>
          <dl className="grid grid-cols-2 gap-x-3 gap-y-2 text-sm">
            <dt className="text-emerald-900/70">Featured right now</dt><dd className="text-right font-bold tabular-nums">{fmt(d.featured.running)}</dd>
            <dt className="text-emerald-900/70">Featured today</dt><dd className="text-right font-bold tabular-nums">{fmt(d.featured.today)}</dd>
            <dt className="text-emerald-900/70">Featured, all time</dt><dd className="text-right font-bold tabular-nums">{fmt(d.featured.ever)}</dd>
            <dt className="text-emerald-900/70">Requests today</dt><dd className="text-right font-bold tabular-nums">{fmt(d.featured.req_today)}</dd>
            <dt className="text-emerald-900/70">Requests approved</dt><dd className="text-right font-bold tabular-nums">{fmt(d.featured.req_approved)}</dd>
            <dt className="text-emerald-900/70">Requests rejected</dt><dd className="text-right font-bold tabular-nums">{fmt(d.featured.req_rejected)}</dd>
          </dl>
          <div className="mt-4 border-t border-[#e7e1cf] pt-3">
            <button type="button" onClick={() => go('feedback')} className="flex w-full items-center justify-between text-sm">
              <span className="text-emerald-900/70">Feedback: {fmt(d.feedback.total)} total, {fmt(d.feedback.today)} today</span>
              {d.feedback.new > 0 && <span className="rounded-full bg-red-600 px-2 text-xs font-bold leading-5 text-white">{d.feedback.new} new</span>}
            </button>
          </div>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Most copied codes (top 10)"><CodeList rows={d.codes.top} empty="No copies yet." /></Card>
        <Card title="Least copied codes (bottom 10)"><CodeList rows={d.codes.bottom} empty="No active codes." /></Card>
      </div>
    </div>
  );
}

/* ---------------- Codes table ---------------- */
const PAGE = 50;
function CodesPage({ toast, reviewMode = false, settings = null }: { toast: ToastFn; reviewMode?: boolean; settings?: Settings | null }) {
  const [rows, setRows] = useState<Code[]>([]);
  const [count, setCount] = useState(0);
  const [page, setPage] = useState(0);
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState<'all' | 'featured' | Status>(reviewMode ? 'pending' : 'all');
  const [sel, setSel] = useState<Set<number>>(new Set());
  const [edit, setEdit] = useState<Code | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    let qb = sb!.from('nusuk_codes').select('*', { count: 'exact' });
    if (reviewMode) qb = qb.eq('status', 'pending');
    else if (filter === 'featured') qb = qb.not('featured_at', 'is', null);
    else if (filter !== 'all') qb = qb.eq('status', filter);
    if (q.trim()) qb = qb.ilike('code', `%${q.trim()}%`);
    // Featured codes are listed first (newest featured on top), like visitors see them
    if (!reviewMode) qb = qb.order('featured_at', { ascending: false, nullsFirst: false });
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
              <Btn kind="gold" onClick={() => bulk({ featured_at: new Date().toISOString(), status: 'active', boost_quota: null })}>★ Feature {sel.size}</Btn>
              <Btn kind="ghost" onClick={() => bulk({ featured_at: null, boost_quota: null })}>Unfeature</Btn>
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
      {reviewMode && (
        <p className="mb-3 text-xs text-emerald-900/60">Approved codes go to the top until they get {settings?.approved_quota ?? 2} copies, then they join the normal pool.</p>
      )}
      {!reviewMode && (
        <p className="mb-3 text-xs text-emerald-900/60">☆ Feature gives a code {settings?.feature_quota ?? 10} top-priority copies spread evenly over {settings?.feature_hours ?? 12} hours, then it drops back to normal. Approved submissions stay on top for {settings?.approved_quota ?? 2} copies. Change these in Settings → Priority & balance.</p>
      )}
      <div className="mb-3 flex flex-col gap-2 sm:flex-row">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search code…" className="nk-input sm:max-w-xs" aria-label="Search code" />
        {!reviewMode && (
          <select value={filter} onChange={(e) => setFilter(e.target.value as typeof filter)} className="nk-input sm:max-w-[13rem]" aria-label="Filter by status">
            <option value="all">All statuses</option>
            <option value="featured">★ Featured</option>
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
                <td className="p-2 font-mono font-bold">{r.code}{(() => { const b = boostOf(r, settings); return b && <span className={`ml-2 whitespace-nowrap rounded-full px-2 py-0.5 font-sans text-xs font-semibold ${b.cls}`} title={r.featured_at ? `Featured ${when(r.featured_at)}` : `Approved ${when(r.approved_at ?? null)}`}>{b.text}</span>; })()}{r.note && <div className="max-w-[16rem] truncate font-sans text-xs font-normal text-emerald-900/60" title={r.note}>{r.note}</div>}</td>
                <td className="p-2"><span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${badge[r.status]}`}>{r.status}</span></td>
                <td className="p-2 tabular-nums">{r.uses}</td>
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
                      {(() => { const on = boostOf(r, settings)?.tier === 1; return <Btn kind="ghost" className={`px-2.5! py-1! ${on ? 'text-amber-600' : ''}`} title={on ? 'Unfeature' : r.featured_at ? 'Feature again (restarts quota and timer)' : 'Feature: show this code first'} aria-label={on ? `Unfeature ${r.code}` : `Feature ${r.code}`} onClick={() => bulk(on ? { featured_at: null, boost_quota: null } : { featured_at: new Date().toISOString(), status: 'active', boost_quota: null }, [r.id])}>{on ? '★' : '☆'}</Btn>; })()}{' '}
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
    if (!CODE_RE.test(v)) return toast('Code must be NG- followed by exactly 8 letters/digits, e.g. NG-y3JkB7lU', false);
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

/* ---------------- Paste & upload (NG- codes only) ---------------- */
// A Nusuk referral code is always "NG-" + exactly 8 letters/digits, e.g. NG-y3JkB7lU.
// The lookbehind stops matches inside a longer word; the lookahead rejects a 9th character
// and codes Facebook cut short with "..." / "…" (from "See more").
const NG_RE = /(?<![A-Za-z0-9_-])NG-[A-Za-z0-9]{8}(?![A-Za-z0-9_-]|\.\.\.|…)/g;

function extractCodes(text: string) {
  const all = text.match(NG_RE) ?? [];
  const seen = new Map<string, string>(); // lower-case key -> first spelling seen
  for (const c of all) if (!seen.has(c.toLowerCase())) seen.set(c.toLowerCase(), c);
  return { found: all.length, unique: [...seen.values()], repeats: all.length - seen.size };
}

type UploadResult = { unique: number; added: string[]; skipped: string[]; repeats: number };

function Upload({ toast, defaultMax }: { toast: ToastFn; defaultMax: number }) {
  const [text, setText] = useState('');
  const [max, setMax] = useState(defaultMax);
  const [status, setStatus] = useState<'active' | 'inactive'>('active');
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [result, setResult] = useState<UploadResult | null>(null);
  useEffect(() => setMax(defaultMax), [defaultMax]);

  const ex = useMemo(() => extractCodes(text), [text]);
  const busy = progress !== null && progress.done < progress.total;

  async function readFile(file: File) {
    const t = await file.text();
    setText((cur) => (cur ? `${cur}\n${t}` : t));
  }
  async function copyList() {
    try { await navigator.clipboard.writeText(ex.unique.join('\n')); toast(`Copied ${ex.unique.length} code(s)`); } catch { toast('Copy failed', false); }
  }

  async function submit() {
    const list = ex.unique;
    if (!list.length) return;
    const CHUNK = 1000;
    const added: string[] = [];
    setResult(null);
    setProgress({ done: 0, total: list.length });
    for (let i = 0; i < list.length; i += CHUNK) {
      const chunk = list.slice(i, i + CHUNK);
      // The database inserts only codes it doesn't have yet (case-insensitive) and returns those.
      const { data, error } = await sb!.rpc('nusuk_admin_add_codes', { p_codes: chunk, p_max_uses: Math.max(1, max), p_status: status });
      if (error) {
        toast(/nusuk_admin_add_codes/.test(error.message) ? 'Run update_01_no_duplicates.sql in Supabase first' : errText(error), false);
        setProgress(null);
        return;
      }
      added.push(...((data as { added: string[] })?.added ?? []));
      setProgress({ done: Math.min(list.length, i + CHUNK), total: list.length });
    }
    const got = new Set(added.map((c) => c.toLowerCase()));
    const skipped = list.filter((c) => !got.has(c.toLowerCase()));
    setResult({ unique: list.length, added, skipped, repeats: ex.repeats });
    toast(`${fmt(added.length)} new code(s) saved · ${fmt(skipped.length)} already in database`);
    setText('');
  }

  return (
    <div className="grid gap-4">
      <Card title="Paste comments → get NG- codes">
        <p className="mb-4 text-sm text-emerald-900/75">
          Copy all the comments from a Nusuk Facebook post (or any text) and paste on the left. Only real Nusuk codes are picked up: <b className="font-mono">NG-</b> followed by exactly 8 letters/digits (e.g. <span className="font-mono">NG-y3JkB7lU</span>). Everything else is ignored.
          Repeated codes are counted once. On Submit, codes already in your database are skipped and you'll see how many.
        </p>
        <div className="grid gap-4 lg:grid-cols-2">
          {/* Left: raw paste */}
          <div className="flex min-w-0 flex-col">
            <div className="mb-1.5 flex items-center justify-between gap-2">
              <span className="text-sm font-semibold">1. Paste text here</span>
              <span className="flex gap-2">
                <label className="cursor-pointer text-xs font-semibold text-emerald-700 hover:underline">
                  Open file…
                  <input type="file" accept=".csv,.txt,text/csv,text/plain" className="sr-only" onChange={(e) => { const f = e.target.files?.[0]; if (f) readFile(f); e.target.value = ''; }} />
                </label>
                {text && <button type="button" className="text-xs font-semibold text-red-700 hover:underline" onClick={() => { setText(''); setResult(null); }}>Clear</button>}
              </span>
            </div>
            <textarea
              value={text}
              onChange={(e) => { setText(e.target.value); setResult(null); }}
              rows={16}
              className="nk-input min-h-[18rem] flex-1 text-sm"
              placeholder={'لمياء صديق · 1d\nNG-HMdxQq03\nReply\nView 134 replies\nMarwan Hazo · 1d\nNG-M50W5sQP\n…'}
              aria-label="Pasted comments"
            />
          </div>

          {/* Right: extracted codes */}
          <div className="flex min-w-0 flex-col">
            <div className="mb-1.5 flex items-center justify-between gap-2">
              <span className="text-sm font-semibold">2. Unique NG- codes found <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs text-emerald-900">{fmt(ex.unique.length)}</span></span>
              {ex.unique.length > 0 && <button type="button" className="text-xs font-semibold text-emerald-700 hover:underline" onClick={copyList}>Copy list</button>}
            </div>
            <div className="min-h-[18rem] flex-1 overflow-auto rounded-xl border border-[#d9d2bd] bg-cream p-2" aria-live="polite">
              {ex.unique.length ? (
                <ol className="grid gap-0.5 font-mono text-sm">
                  {ex.unique.map((c, i) => (
                    <li key={c} className="flex gap-3 rounded px-2 py-0.5 odd:bg-white/70">
                      <span className="w-8 shrink-0 text-right text-xs leading-5 text-emerald-900/45">{i + 1}</span>
                      <span className="break-all">{c}</span>
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="grid h-full place-items-center p-6 text-center text-sm text-emerald-900/55">{text ? 'No NG- codes in this text.' : 'Codes will appear here as soon as you paste.'}</p>
              )}
            </div>
          </div>
        </div>

        {/* Summary + submit */}
        <div className="mt-4 flex flex-wrap items-end gap-3 rounded-xl bg-emerald-50 p-3 text-sm">
          <span><b>{fmt(ex.found)}</b> NG- codes in text</span>
          <span className="text-emerald-900/40">→</span>
          <span><b className="text-emerald-800">{fmt(ex.unique.length)}</b> unique</span>
          {ex.repeats > 0 && <span className="rounded-full bg-gold-100 px-2 py-0.5 text-gold-600">⚠ {fmt(ex.repeats)} repeated in the paste (counted once)</span>}
          <span className="ml-auto flex flex-wrap items-end gap-3">
            <label className="grid gap-1 text-xs font-semibold">Max uses<input type="number" min={1} value={max} onChange={(e) => setMax(+e.target.value)} className="nk-input w-24 py-1.5!" /></label>
            <label className="grid gap-1 text-xs font-semibold">Status
              <select value={status} onChange={(e) => setStatus(e.target.value as 'active' | 'inactive')} className="nk-input w-28 py-1.5!"><option value="active">active</option><option value="inactive">inactive</option></select>
            </label>
            <Btn kind="gold" className="py-2.5!" disabled={!ex.unique.length || busy} onClick={submit}>{busy ? 'Submitting…' : `Submit ${fmt(ex.unique.length)} codes`}</Btn>
          </span>
        </div>
        {progress && busy && (
          <div className="mt-3">
            <div className="h-2 overflow-hidden rounded-full bg-emerald-100"><div className="h-full bg-emerald-600 transition-all" style={{ width: `${(progress.done / progress.total) * 100}%` }} /></div>
            <p className="mt-1 text-xs text-emerald-900/70">{fmt(progress.done)} / {fmt(progress.total)} processed</p>
          </div>
        )}
      </Card>

      {result && (
        <Card title="Result">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-xl bg-emerald-50 p-3"><div className="text-xs text-emerald-900/70">Unique codes submitted</div><div className="text-2xl font-bold">{fmt(result.unique)}</div></div>
            <div className="rounded-xl bg-emerald-100 p-3"><div className="text-xs text-emerald-900">✓ New, saved</div><div className="text-2xl font-bold text-emerald-800">{fmt(result.added.length)}</div></div>
            <div className="rounded-xl bg-gold-100 p-3"><div className="text-xs text-gold-600">⚠ Already in database</div><div className="text-2xl font-bold text-gold-600">{fmt(result.skipped.length)}</div></div>
            <div className="rounded-xl bg-gold-100/60 p-3"><div className="text-xs text-gold-600">⚠ Repeated in paste</div><div className="text-2xl font-bold text-gold-600">{fmt(result.repeats)}</div></div>
          </div>
          {result.skipped.length > 0 && (
            <details className="mt-3 text-sm">
              <summary className="cursor-pointer text-emerald-900/75">Show {fmt(result.skipped.length)} duplicate code(s) that were skipped</summary>
              <p className="mt-2 max-h-40 overflow-auto break-all font-mono text-xs">{result.skipped.join(', ')}</p>
            </details>
          )}
          {result.added.length > 0 && (
            <details className="mt-2 text-sm">
              <summary className="cursor-pointer text-emerald-900/75">Show {fmt(result.added.length)} new code(s)</summary>
              <p className="mt-2 max-h-40 overflow-auto break-all font-mono text-xs">{result.added.join(', ')}</p>
            </details>
          )}
        </Card>
      )}
    </div>
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
    // Keep everything that isn't page text (winners list, today's winner…) exactly as it is in the database now.
    const { data: cur } = await sb!.from('nusuk_settings').select('content').eq('id', 1).single();
    const keep = Object.fromEntries(Object.entries((cur?.content as Record<string, unknown>) ?? {}).filter(([k]) => !(k in defaultContent)));
    const { error } = await sb!.from('nusuk_settings').update({
      enabled: next.enabled, submissions_enabled: next.submissions_enabled,
      default_max_uses: Math.max(1, next.default_max_uses || 1),
      ...(next.feature_quota !== undefined && {
        feature_quota: Math.max(1, Math.round(next.feature_quota || 10)),
        feature_hours: Math.min(8760, Math.max(1, Math.round(next.feature_hours || 12))),
        approved_quota: Math.max(0, Math.round(next.approved_quota ?? 2)),
        boost_share: Math.min(100, Math.max(0, Math.round(next.boost_share ?? 80))),
      }),
      logo_url: next.logo_url?.trim() || null, notice: next.notice?.trim() || null,
      content: { ...keep, ...diff }, updated_at: new Date().toISOString(),
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
      <Card title="Priority & balance" actions={<Btn onClick={() => save()}>Save</Btn>}>
        {s.feature_quota === undefined ? (
          <p className="text-sm">Run <code className="font-mono">src/pages/nusuk/_sql/update_08_boost_quotas.sql</code> in Supabase → SQL Editor, then reload this page.</p>
        ) : (
          <>
            <p className="mb-3 text-sm text-emerald-900/75">Visitors get codes in this order: <b>1. Featured</b> → <b>2. New approved submissions</b> → <b>3. All other codes</b> (least copied first). A boosted code drops back to the normal pool once it reaches its quota, so the flow keeps moving.</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="grid gap-1 text-sm font-semibold">Featured: copies before it drops
                <input type="number" min={1} className="nk-input" value={s.feature_quota} onChange={(e) => setS({ ...s, feature_quota: +e.target.value })} />
                <span className="text-xs font-normal text-emerald-900/60">A featured code stays on top until this many visitors copy it.</span>
              </label>
              <label className="grid gap-1 text-sm font-semibold">Featured: time limit (hours)
                <select className="nk-input" value={[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].includes(s.feature_hours ?? 12) ? s.feature_hours : 'custom'} onChange={(e) => e.target.value !== 'custom' && setS({ ...s, feature_hours: +e.target.value })}>
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((h) => <option key={h} value={h}>{h} {h === 1 ? 'hour' : 'hours'}</option>)}
                  {![1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].includes(s.feature_hours ?? 12) && <option value="custom">{s.feature_hours} hours</option>}
                </select>
                <span className="text-xs font-normal text-emerald-900/60">The copies are spread evenly over this time (e.g. 20 copies in 1 hour ≈ one every 3 minutes). The feature ends when the time is up.</span>
              </label>
              <label className="grid gap-1 text-sm font-semibold">New approved submission: copies on top
                <input type="number" min={0} className="nk-input" value={s.approved_quota} onChange={(e) => setS({ ...s, approved_quota: +e.target.value })} />
                <span className="text-xs font-normal text-emerald-900/60">0 = approved codes go straight to the normal pool.</span>
              </label>
              <label className="grid gap-1 text-sm font-semibold">Balance: boosted share ({s.boost_share}%)
                <input type="range" min={0} max={100} step={5} value={s.boost_share} onChange={(e) => setS({ ...s, boost_share: +e.target.value })} />
                <span className="text-xs font-normal text-emerald-900/60">Out of every 100 code views, about {s.boost_share} try featured/new codes first and {100 - (s.boost_share ?? 80)} go to the normal pool, so normal codes keep getting copied too. 100% = boosted always first.</span>
              </label>
            </div>
          </>
        )}
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

/* ---------------- Feedback inbox ---------------- */
type Feedback = {
  id: number; kind: 'complaint' | 'suggestion' | 'opinion'; name: string; phone: string | null; address: string | null;
  message: string; status: 'new' | 'read' | 'resolved'; created_at: string;
  allow_public?: boolean; on_slider?: boolean; // update 13
  slider_text?: string | null; slider_name?: string | null; // update 15
};
/** Join short lines into paragraphs: a blank line stays a paragraph break, single line breaks become spaces. */
const toParagraphs = (t: string) =>
  t.replace(/\r/g, '').split(/\n\s*\n/).map((p) => p.split('\n').map((l) => l.trim()).filter(Boolean).join(' ')).filter(Boolean).join('\n\n');
const kindLabel: Record<Feedback['kind'], [string, string]> = {
  complaint: ['Complaint · অভিযোগ', 'bg-red-100 text-red-700'],
  suggestion: ['Suggestion · পরামর্শ', 'bg-emerald-100 text-emerald-900'],
  opinion: ['Opinion · মতামত', 'bg-gold-100 text-gold-600'],
};
function FeedbackPage({ toast, onChange }: { toast: ToastFn; onChange: () => void }) {
  const [rows, setRows] = useState<Feedback[]>([]);
  const [filter, setFilter] = useState<'open' | 'new' | 'resolved' | 'slider' | 'all'>('open');
  const [loading, setLoading] = useState(false);
  const [missing, setMissing] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    let q = sb!.from('nusuk_feedback').select('*').order('created_at', { ascending: false }).limit(200);
    if (filter === 'open') q = q.in('status', ['new', 'read']);
    else if (filter === 'slider') q = q.eq('on_slider', true);
    else if (filter !== 'all') q = q.eq('status', filter);
    const { data, error } = await q;
    setLoading(false);
    if (error) {
      if (/nusuk_feedback/.test(error.message)) setMissing(true);
      else toast(errText(error), false);
      return;
    }
    setMissing(false);
    setRows((data ?? []) as Feedback[]);
  }, [filter, toast]);
  useEffect(() => { load(); }, [load]);

  async function setStatus(id: number, status: Feedback['status']) {
    const { error } = await sb!.from('nusuk_feedback').update({ status }).eq('id', id);
    if (error) return toast(errText(error), false);
    setRows((r) => (filter === 'all' || (filter === 'open' && status !== 'resolved') ? r.map((x) => (x.id === id ? { ...x, status } : x)) : r.filter((x) => x.id !== id)));
    onChange();
  }
  const [editing, setEditing] = useState<number | null>(null);
  const [draft, setDraft] = useState({ text: '', name: '' });
  const [saving, setSaving] = useState(false);
  function startEdit(f: Feedback) {
    setEditing(f.id);
    setDraft({ text: f.slider_text ?? f.message, name: f.slider_name ?? f.name });
  }
  async function saveEdit(f: Feedback) {
    const text = draft.text.trim();
    const name = draft.name.trim();
    if (!text) return toast('Message cannot be empty', false);
    if (!name) return toast('Name cannot be empty', false);
    // Store only what differs from the original, so "reset" is just clearing it
    const patch = { slider_text: text === f.message.trim() ? null : text, slider_name: name === f.name.trim() ? null : name };
    setSaving(true);
    const { error } = await sb!.from('nusuk_feedback').update(patch).eq('id', f.id);
    setSaving(false);
    if (error) return toast(/slider_text|slider_name/.test(error.message) ? 'Run src/pages/nusuk/_sql/update_15_slider_edit.sql in Supabase first' : errText(error), false);
    setRows((r) => r.map((x) => (x.id === f.id ? { ...x, ...patch } : x)));
    setEditing(null);
    toast(f.on_slider ? 'Saved. The slider shows the new text.' : 'Saved');
  }
  async function setSlider(f: Feedback, on: boolean) {
    const { error } = await sb!.from('nusuk_feedback').update({ on_slider: on }).eq('id', f.id);
    if (error) return toast(/on_slider|slider_consent/.test(error.message) ? 'Run update_13 and update_14 (src/pages/nusuk/_sql) in Supabase first' : errText(error), false);
    setRows((r) => (filter === 'slider' && !on ? r.filter((x) => x.id !== f.id) : r.map((x) => (x.id === f.id ? { ...x, on_slider: on } : x))));
    toast(on ? 'Added to the slider on /nusuk' : 'Removed from the slider');
  }
  async function remove(id: number) {
    if (!confirm('Delete this message? This cannot be undone.')) return;
    const { error } = await sb!.from('nusuk_feedback').delete().eq('id', id);
    if (error) return toast(errText(error), false);
    setRows((r) => r.filter((x) => x.id !== id));
    toast('Deleted');
    onChange();
  }

  if (missing) {
    return <Card title="Feedback"><p className="text-sm">Run <code className="font-mono">src/pages/nusuk/_sql/update_02_feedback.sql</code> in Supabase → SQL Editor, then reload this page.</p></Card>;
  }
  return (
    <Card
      title={`Feedback (${fmt(rows.length)})`}
      actions={
        <>
          <select value={filter} onChange={(e) => setFilter(e.target.value as typeof filter)} className="nk-input w-40 py-1.5!" aria-label="Filter feedback">
            <option value="open">Open (new + read)</option>
            <option value="new">New only</option>
            <option value="resolved">Resolved</option>
            <option value="slider">On slider</option>
            <option value="all">All</option>
          </select>
          <Btn kind="ghost" onClick={load}>{loading ? 'Loading…' : 'Refresh'}</Btn>
        </>
      }
    >
      <div className="grid gap-3">
        {rows.map((f) => (
          <article key={f.id} className={`rounded-xl border p-4 ${f.status === 'new' ? 'border-gold-500/60 bg-gold-100/30' : 'border-[#e7e1cf] bg-white'}`}>
            <div className="flex flex-wrap items-center gap-2">
              <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${kindLabel[f.kind][1]}`}>{kindLabel[f.kind][0]}</span>
              {f.status === 'new' && <span className="rounded-full bg-gold-500 px-2 py-0.5 text-xs font-bold text-emerald-950">NEW</span>}
              {f.status === 'resolved' && <span className="rounded-full bg-gray-200 px-2 py-0.5 text-xs font-bold text-gray-700">Resolved</span>}
              {f.on_slider && <span className="rounded-full bg-emerald-800 px-2 py-0.5 text-xs font-bold text-white">★ On slider</span>}
              {f.allow_public && <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-800" title="The visitor ticked: my name and message may be shown on the page">✓ Public OK</span>}
              <span className="ml-auto text-xs text-emerald-900/60">{when(f.created_at)}</span>
            </div>
            <div className="mt-2 font-semibold">{f.name}</div>
            <div className="flex flex-wrap gap-x-4 text-sm text-emerald-900/75">
              {f.phone && <a href={`tel:${f.phone.replace(/\s/g, '')}`} className="hover:underline">📞 {f.phone}</a>}
              {f.address && <span>📍 {f.address}</span>}
            </div>
            <p className="mt-2 whitespace-pre-line break-words text-sm leading-relaxed">{f.message}</p>
            {editing !== f.id && (f.slider_text || f.slider_name) && (
              <div className="mt-3 rounded-lg border-l-4 border-gold-500 bg-cream px-3 py-2 text-sm">
                <div className="mb-1 text-xs font-bold text-gold-600">Slider version (edited)</div>
                <p className="whitespace-pre-line break-words leading-relaxed">{f.slider_text ?? f.message}</p>
                <div className="mt-1 text-xs font-semibold text-emerald-900/70">— {f.slider_name ?? f.name}</div>
              </div>
            )}
            {editing === f.id && (
              <div className="mt-3 grid gap-2 rounded-xl border border-emerald-600/30 bg-emerald-50/50 p-3">
                <div className="text-xs font-bold text-emerald-900">Edit how this looks on the slider · the original above stays unchanged</div>
                <label className="grid gap-1 text-xs font-semibold">Name shown
                  <input className="nk-input py-1.5! text-sm font-normal" maxLength={120} value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
                </label>
                <label className="grid gap-1 text-xs font-semibold">Message shown
                  <textarea rows={5} maxLength={3000} className="nk-input text-sm font-normal leading-relaxed" value={draft.text} onChange={(e) => setDraft({ ...draft, text: e.target.value })} />
                </label>
                <div className="flex flex-wrap items-center gap-2">
                  <Btn kind="gold" className="px-2.5! py-1!" onClick={() => setDraft({ ...draft, text: toParagraphs(draft.text) })}>¶ Join lines into a paragraph</Btn>
                  <Btn kind="ghost" className="px-2.5! py-1!" onClick={() => setDraft({ text: f.message, name: f.name })}>Reset to original</Btn>
                  <span className="ml-auto flex gap-2">
                    <Btn kind="ghost" className="px-2.5! py-1!" onClick={() => setEditing(null)}>Cancel</Btn>
                    <Btn className="px-2.5! py-1!" disabled={saving} onClick={() => saveEdit(f)}>{saving ? 'Saving…' : 'Save'}</Btn>
                  </span>
                </div>
                <p className="text-xs text-emerald-900/60">The slider shows up to 500 characters. {draft.text.trim().length > 500 ? `This is ${draft.text.trim().length}, so the end will be cut.` : ''}</p>
              </div>
            )}
            <div className="mt-3 flex flex-wrap gap-2">
              {f.status === 'new' && <Btn kind="ghost" className="px-2.5! py-1!" onClick={() => setStatus(f.id, 'read')}>Mark read</Btn>}
              {f.status !== 'resolved'
                ? <Btn className="px-2.5! py-1!" onClick={() => setStatus(f.id, 'resolved')}>Mark resolved</Btn>
                : <Btn kind="ghost" className="px-2.5! py-1!" onClick={() => setStatus(f.id, 'read')}>Reopen</Btn>}
              {f.on_slider
                ? <Btn kind="ghost" className="px-2.5! py-1!" onClick={() => setSlider(f, false)}>Remove from slider</Btn>
                : <Btn kind="gold" className="px-2.5! py-1!" title="Show this message (name + message, never phone or address) on /nusuk" onClick={() => setSlider(f, true)}>★ Show on slider</Btn>}
              {editing !== f.id && <Btn kind="ghost" className="px-2.5! py-1!" onClick={() => startEdit(f)}>✎ Edit for slider</Btn>}
              <Btn kind="ghost" className="px-2.5! py-1! text-red-700" onClick={() => remove(f.id)}>Delete</Btn>
            </div>
          </article>
        ))}
        {!rows.length && <p className="rounded-xl bg-emerald-50 p-6 text-center text-sm text-emerald-900/70">{loading ? 'Loading…' : 'No messages here.'}</p>}
      </div>
    </Card>
  );
}

/* ---------------- Feature requests ---------------- */
type FeatureRequest = {
  id: number; name: string; code: string; share_link: string;
  status: 'pending' | 'approved' | 'rejected'; created_at: string; decided_at: string | null;
  page_follow?: boolean; group_join?: boolean; fb_name?: string | null; bonus_at?: string | null;
};
type CodeInfo = { code: string; status: Status; featured_at: string | null; uses: number };
function FeatureRequestsPage({ toast, onChange, settings }: { toast: ToastFn; onChange: () => void; settings: Settings | null }) {
  const [rows, setRows] = useState<FeatureRequest[]>([]);
  const [quota, setQuota] = useState<Record<number, number>>({});
  // Copy target = normal feature quota + the page/group bonus
  const base = settings?.feature_quota ?? 10;
  // Extra copies for following the page / joining the group (Nusuk Manager → Bonus popup)
  const bonusCfg = parseBonus(settings?.content);
  const bonusOf = (r: FeatureRequest) => bonusFor(bonusCfg, r.page_follow, r.group_join);
  const target = (r: FeatureRequest) => quota[r.id] ?? base + bonusOf(r);
  const [codes, setCodes] = useState<Record<string, CodeInfo>>({});
  const [filter, setFilter] = useState<'pending' | 'approved' | 'rejected' | 'all'>('pending');
  const [loading, setLoading] = useState(false);
  const [missing, setMissing] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    let q = sb!.from('nusuk_feature_requests').select('*').order('created_at', { ascending: filter === 'pending' }).limit(300);
    if (filter !== 'all') q = q.eq('status', filter);
    const { data, error } = await q;
    if (error) {
      setLoading(false);
      if (/nusuk_feature_requests/.test(error.message)) setMissing(true);
      else toast(errText(error), false);
      return;
    }
    setMissing(false);
    const list = (data ?? []) as FeatureRequest[];
    setRows(list);
    const names = [...new Set(list.map((r) => r.code))];
    if (names.length) {
      const { data: cs } = await sb!.from('nusuk_codes').select('code,status,featured_at,uses').in('code', names);
      setCodes(Object.fromEntries(((cs ?? []) as CodeInfo[]).map((c) => [c.code, c])));
    } else setCodes({});
    setLoading(false);
  }, [filter, toast]);
  useEffect(() => { load(); }, [load]);

  async function approve(r: FeatureRequest) {
    const q = Math.max(1, Math.min(1000, Math.round(target(r)) || base));
    const { error } = await sb!.rpc('nusuk_admin_feature_approve', { p_id: r.id, p_quota: q });
    if (error) return toast(/p_quota/.test(error.message) ? 'Run src/pages/nusuk/_sql/update_16_feature_bonus.sql in Supabase first.' : errText(error), false);
    toast(`★ ${r.code} is now featured for ${q} copies`);
    load(); onChange();
  }
  async function reject(r: FeatureRequest) {
    const { error } = await sb!.from('nusuk_feature_requests').update({ status: 'rejected', decided_at: new Date().toISOString() }).eq('id', r.id);
    if (error) return toast(errText(error), false);
    toast('Rejected');
    load(); onChange();
  }
  async function remove(r: FeatureRequest) {
    if (!confirm('Delete this request? This cannot be undone.')) return;
    const { error } = await sb!.from('nusuk_feature_requests').delete().eq('id', r.id);
    if (error) return toast(errText(error), false);
    toast('Deleted');
    load(); onChange();
  }

  if (missing) {
    return <Card title="Feature requests"><p className="text-sm">Run <code className="font-mono">src/pages/nusuk/_sql/update_07_feature_requests.sql</code> in Supabase → SQL Editor, then reload this page.</p></Card>;
  }
  const stBadge: Record<FeatureRequest['status'], string> = { pending: 'bg-gold-500 text-emerald-950', approved: 'bg-emerald-100 text-emerald-900', rejected: 'bg-red-100 text-red-700' };
  return (
    <Card
      title={`Feature requests (${fmt(rows.length)})`}
      actions={
        <>
          <select value={filter} onChange={(e) => setFilter(e.target.value as typeof filter)} className="nk-input w-36 py-1.5!" aria-label="Filter requests">
            <option value="pending">Waiting</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
            <option value="all">All</option>
          </select>
          <Btn kind="ghost" onClick={load}>{loading ? 'Loading…' : 'Refresh'}</Btn>
        </>
      }
    >
      <p className="mb-3 text-xs text-emerald-900/60">Open the share link and check the post was really shared. "Approve & feature" puts the code at the top for every visitor (and approves it if it was still in Review). Set the post link visitors must share in Settings → page text → "Feature request: Facebook post link".</p>
      <div className="grid gap-3">
        {rows.map((r) => {
          const c = codes[r.code];
          return (
            <article key={r.id} className={`rounded-xl border p-4 ${r.status === 'pending' ? 'border-gold-500/60 bg-gold-100/30' : 'border-[#e7e1cf] bg-white'}`}>
              <div className="flex flex-wrap items-center gap-2">
                <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${stBadge[r.status]}`}>{r.status === 'pending' ? 'WAITING' : r.status}</span>
                <span className="ml-auto text-xs text-emerald-900/60">{when(r.created_at)}</span>
              </div>
              <div className="mt-2 font-semibold">{r.name}</div>
              <div className="mt-1 flex flex-wrap items-center gap-2">
                <span className="font-mono text-base font-bold">{r.code}</span>
                {c ? (
                  <>
                    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${badge[c.status]}`}>code: {c.status}</span>
                    {c.featured_at && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800">★ featured</span>}
                    <span className="text-xs text-emerald-900/60">{c.uses} uses</span>
                  </>
                ) : (
                  <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-700">code not in the list</span>
                )}
              </div>
              <a href={r.share_link} target="_blank" rel="noopener noreferrer" className="mt-2 block break-all text-sm font-semibold text-emerald-800 underline underline-offset-2">{r.share_link} ↗</a>
              {(r.page_follow || r.group_join) && (
                <div className="mt-2 rounded-lg border border-[#1877f2]/25 bg-[#1877f2]/5 p-2.5 text-sm">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <b className="text-[#1356b8]">Bonus:</b>
                    {r.page_follow && <span className="rounded-full bg-[#1877f2] px-2 py-0.5 text-xs font-bold text-white">📘 followed page</span>}
                    {r.group_join && <span className="rounded-full bg-[#1877f2] px-2 py-0.5 text-xs font-bold text-white">👥 joined group</span>}
                    <span className="rounded-full bg-gold-100 px-2 py-0.5 text-xs font-bold text-emerald-950">+{bonusOf(r)} copies</span>
                  </div>
                  <div className="mt-1 text-emerald-900/80">Facebook name: <b>{r.fb_name || '—'}</b> <span className="text-xs text-emerald-900/55">· check it in your page followers / group members</span></div>
                </div>
              )}
              {r.status !== 'approved' && (
                <label className="mt-2 flex flex-wrap items-center gap-2 text-sm">
                  Feature for
                  <input type="number" min={1} max={1000} className="nk-input w-20 py-1!" value={target(r)} onChange={(e) => setQuota({ ...quota, [r.id]: +e.target.value })} />
                  copies
                  <span className="text-xs text-emerald-900/55">({base} normal{bonusOf(r) ? ` + ${bonusOf(r)} bonus` : ''}. Lower it if they did not really follow or join.)</span>
                </label>
              )}
              <div className="mt-3 flex flex-wrap gap-2">
                {r.status !== 'approved' && <Btn kind="gold" className="px-2.5! py-1!" disabled={!c} onClick={() => approve(r)}>★ Approve &amp; feature</Btn>}
                {r.status === 'pending' && <Btn kind="ghost" className="px-2.5! py-1!" onClick={() => reject(r)}>Reject</Btn>}
                <Btn kind="ghost" className="px-2.5! py-1! text-red-700" onClick={() => remove(r)}>Delete</Btn>
              </div>
            </article>
          );
        })}
        {!rows.length && <p className="rounded-xl bg-emerald-50 p-6 text-center text-sm text-emerald-900/70">{loading ? 'Loading…' : 'No requests here.'}</p>}
      </div>
    </Card>
  );
}

/* ---------------- Today's winner ---------------- */
const todayStr = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
function TodayWinnerPage({ toast, settings, reload }: { toast: ToastFn; settings: Settings; reload: () => void }) {
  const blank = (): TodayWinner => ({ name: '', country: 'sa', prize: 'umrah', date: todayStr(), link: '' });
  const [w, setW] = useState<TodayWinner>(() => parseToday(settings.content) ?? blank());
  const [busy, setBusy] = useState(false);
  useEffect(() => setW(parseToday(settings.content) ?? blank()), [settings]); // eslint-disable-line react-hooks/exhaustive-deps
  const countries = useMemo(() => {
    const pinned = COUNTRY_CODES.slice(0, PINNED_COUNT).map((c) => ({ c, n: countryName(c) }));
    const rest = COUNTRY_CODES.slice(PINNED_COUNT).map((c) => ({ c, n: countryName(c) })).sort((a, b) => a.n.localeCompare(b.n));
    return { pinned, rest };
  }, []);

  async function write(value: TodayWinner | null) {
    setBusy(true);
    const { data, error: e1 } = await sb!.from('nusuk_settings').select('content').eq('id', 1).single();
    if (e1) { setBusy(false); return toast(errText(e1), false); }
    const content = { ...((data?.content as object) ?? {}), today_winner: value };
    const { error } = await sb!.from('nusuk_settings').update({ content, updated_at: new Date().toISOString() }).eq('id', 1);
    setBusy(false);
    if (error) return toast(errText(error), false);
    toast(value ? "Today's winner saved" : "Today's winner hidden");
    reload();
  }
  function save() {
    if (!w.name.trim()) return toast('Enter the winner name', false);
    if (w.link && !/^https:\/\//.test(w.link.trim())) return toast('Link must start with https://', false);
    write({ name: w.name.trim(), country: w.country, prize: w.prize, prize_text: w.prize === 'other' ? w.prize_text?.trim() || undefined : undefined, date: w.date || todayStr(), link: w.link?.trim() || undefined });
  }
  const saved = parseToday(settings.content);

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_20rem]">
      <Card title="Today's winner" actions={<>{saved && <Btn kind="ghost" disabled={busy} onClick={() => confirm("Hide today's winner card from the page?") && write(null)}>Hide card</Btn>}<Btn onClick={save} disabled={busy}>{busy ? 'Saving…' : 'Save'}</Btn></>}>
        <p className="mb-4 text-sm text-emerald-900/75">Shown on /nusuk between the code box and the Bangladeshi winners. If the date isn't today, the card says "সর্বশেষ বিজয়ী" (latest winner) instead of "আজকের বিজয়ী", so it's never wrong.</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="grid gap-1 text-sm font-semibold sm:col-span-2">Winner name<input className="nk-input" value={w.name} maxLength={120} onChange={(e) => setW({ ...w, name: e.target.value })} placeholder="As Nusuk announced it" /></label>
          <label className="grid gap-1 text-sm font-semibold">Country
            <span className="flex items-center gap-2">
              <img src={flagUrl(w.country, 40)} alt="" width={28} height={20} className="h-5 w-7 shrink-0 rounded-sm object-cover ring-1 ring-black/10" />
              <select className="nk-input" value={w.country} onChange={(e) => setW({ ...w, country: e.target.value })}>
                <optgroup label="Common">{countries.pinned.map(({ c, n }) => <option key={c} value={c}>{n}</option>)}</optgroup>
                <optgroup label="All countries">{countries.rest.map(({ c, n }) => <option key={c} value={c}>{n}</option>)}</optgroup>
              </select>
            </span>
          </label>
          <label className="grid gap-1 text-sm font-semibold">Date<input type="date" className="nk-input" value={w.date} onChange={(e) => setW({ ...w, date: e.target.value })} /></label>
          <label className="grid gap-1 text-sm font-semibold">Prize
            <select className="nk-input" value={w.prize} onChange={(e) => setW({ ...w, prize: e.target.value as Prize })}>
              <option value="umrah">{prizeLabel.umrah} (Umrah trip for two)</option>
              <option value="zamzam">{prizeLabel.zamzam} (20 cartons Zamzam)</option>
              <option value="other">Other…</option>
            </select>
          </label>
          {w.prize === 'other' && <label className="grid gap-1 text-sm font-semibold">Prize text<input className="nk-input" value={w.prize_text ?? ''} maxLength={60} onChange={(e) => setW({ ...w, prize_text: e.target.value })} /></label>}
          <label className="grid gap-1 text-sm font-semibold sm:col-span-2">Nusuk post link (optional)<input className="nk-input" value={w.link ?? ''} onChange={(e) => setW({ ...w, link: e.target.value })} placeholder="https://www.facebook.com/MyNusuk/posts/…" /></label>
        </div>
      </Card>
      <Card title="Preview">
        <div className="rounded-2xl border-2 border-gold-500/60 bg-cream p-4 text-center">
          <div className="text-xs font-bold text-gold-600">🎉 {w.date === todayStr() ? 'আজকের বিজয়ী' : 'সর্বশেষ বিজয়ী'}</div>
          <img src={flagUrl(w.country, 80)} alt="" className="mx-auto mt-3 h-10 w-[60px] rounded object-cover shadow ring-1 ring-black/10" />
          <div className="mt-2 break-words text-lg font-bold" dir="auto">{w.name || 'Winner name'}</div>
          <div className="text-sm text-emerald-900/70">{countryName(w.country, 'bn')}</div>
        </div>
      </Card>
    </div>
  );
}

/* ---------------- Video ---------------- */
function VideoPage({ toast, settings, reload }: { toast: ToastFn; settings: Settings; reload: () => void }) {
  type Form = { url: string; label: string; mode: VideoMode; channel: string };
  const fromSettings = (): Form => {
    const raw = ((settings.content as Record<string, unknown> | null)?.video ?? {}) as Partial<Form>;
    return { url: raw.url ?? '', label: raw.label ?? '', mode: raw.mode === 'youtube' ? 'youtube' : 'popup', channel: raw.channel ?? '' };
  };
  const [f, setF] = useState<Form>(fromSettings);
  const [busy, setBusy] = useState(false);
  useEffect(() => setF(fromSettings()), [settings]); // eslint-disable-line react-hooks/exhaustive-deps
  const id = f.url.trim() ? youtubeId(f.url) : null;
  const live = parseVideo(settings.content);

  async function write(value: Form | null) {
    if (value) {
      if (!youtubeId(value.url)) return toast('Paste a YouTube video link (youtube.com/watch?v=… or youtu.be/…)', false);
      if (value.channel.trim() && !subscribeUrl(value.channel)) return toast('Channel link must be a youtube.com link', false);
    }
    setBusy(true);
    const { data, error: e1 } = await sb!.from('nusuk_settings').select('content').eq('id', 1).single();
    if (e1) { setBusy(false); return toast(errText(e1), false); }
    const video = value ? { url: value.url.trim(), label: value.label.trim() || undefined, mode: value.mode, channel: value.channel.trim() || undefined } : null;
    const content = { ...((data?.content as object) ?? {}), video };
    const { error } = await sb!.from('nusuk_settings').update({ content, updated_at: new Date().toISOString() }).eq('id', 1);
    setBusy(false);
    if (error) return toast(errText(error), false);
    toast(value ? 'Video saved' : 'Video button removed');
    reload();
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_22rem]">
      <Card title="Tutorial video" actions={<>{live && <Btn kind="ghost" disabled={busy} onClick={() => confirm('Remove the video button from the page?') && write(null)}>Remove</Btn>}<Btn onClick={() => write(f)} disabled={busy}>{busy ? 'Saving…' : 'Save'}</Btn></>}>
        <p className="mb-4 text-sm text-emerald-900/75">A video button under the code box on /nusuk. Paste your YouTube link and Save. With no link, the button is hidden.</p>
        <div className="grid gap-4">
          <label className="grid gap-1 text-sm font-semibold">YouTube video link
            <input className="nk-input font-normal" value={f.url} onChange={(e) => setF({ ...f, url: e.target.value })} placeholder="https://youtu.be/… or https://www.youtube.com/watch?v=…" />
            {f.url.trim() && <span className={`text-xs font-normal ${id ? 'text-emerald-700' : 'text-red-700'}`}>{id ? `✓ Video found (${id})` : 'Not a YouTube video link'}</span>}
          </label>
          <label className="grid gap-1 text-sm font-semibold">Button text
            <input className="nk-input font-normal" maxLength={60} value={f.label} onChange={(e) => setF({ ...f, label: e.target.value })} placeholder={defaultVideoLabel} />
            <span className="text-xs font-normal text-emerald-900/60">Leave empty to use: {defaultVideoLabel}</span>
          </label>
          <fieldset className="grid gap-2">
            <legend className="mb-1 text-sm font-semibold">When a visitor clicks the button</legend>
            <label className="flex items-start gap-2 rounded-xl border border-[#e7e1cf] p-3 text-sm has-[:checked]:border-emerald-600 has-[:checked]:bg-emerald-50">
              <input type="radio" name="vmode" className="mt-1" checked={f.mode === 'popup'} onChange={() => setF({ ...f, mode: 'popup' })} />
              <span><b>Play in a popup on the page</b><span className="block text-xs text-emerald-900/70">Stays on your site. Full screen works, and the popup has "YouTube-এ দেখুন" and Subscribe buttons.</span></span>
            </label>
            <label className="flex items-start gap-2 rounded-xl border border-[#e7e1cf] p-3 text-sm has-[:checked]:border-emerald-600 has-[:checked]:bg-emerald-50">
              <input type="radio" name="vmode" className="mt-1" checked={f.mode === 'youtube'} onChange={() => setF({ ...f, mode: 'youtube' })} />
              <span><b>Open directly on YouTube</b><span className="block text-xs text-emerald-900/70">Opens the video in the YouTube app or a new tab. More views and subscribers on your channel, but the visitor leaves the page.</span></span>
            </label>
          </fieldset>
          <label className="grid gap-1 text-sm font-semibold">YouTube channel link (optional)
            <input className="nk-input font-normal" value={f.channel} onChange={(e) => setF({ ...f, channel: e.target.value })} placeholder="https://www.youtube.com/@yourchannel" />
            <span className="text-xs font-normal text-emerald-900/60">Adds a red "চ্যানেল সাবস্ক্রাইব করুন" button in the popup. YouTube asks the visitor to confirm the subscription.</span>
          </label>
        </div>
      </Card>
      <Card title={`Preview${live ? ' · live now' : ''}`}>
        <div className="nk-video-btn flex items-center gap-3 rounded-xl px-3.5 py-2.5">
          <span className="nk-video-play" aria-hidden><svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="currentColor"><path d="M8 5v14l11-7z" /></svg></span>
          <span className="min-w-0 flex-1 text-left">
            <span className="block truncate text-[15px] font-bold leading-tight">{f.label.trim() || defaultVideoLabel}</span>
            <span className="block truncate text-xs opacity-70">নুসুক কী, কোড কীভাবে ব্যবহার করবেন, ধাপে ধাপে</span>
          </span>
          <span className="shrink-0 rounded-full bg-[#ff0000] px-2 py-0.5 text-[11px] font-bold text-white">ভিডিও ›</span>
        </div>
        {id && <img src={`https://i.ytimg.com/vi/${id}/hqdefault.jpg`} alt="Video thumbnail" className="mt-3 aspect-video w-full rounded-xl object-cover" />}
      </Card>
    </div>
  );
}

/* ---------------- Top notice ---------------- */
// <input type="datetime-local"> works in this computer's local time; the database keeps an absolute ISO time.
const isoToLocalInput = (iso?: string) => {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(+d)) return '';
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
};
const localInputToIso = (v: string) => (v && !Number.isNaN(Date.parse(v)) ? new Date(v).toISOString() : undefined);
function useNow(ms = 1000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), ms); return () => clearInterval(t); }, [ms]);
  return now;
}

function TopNoticePage({ toast, settings, reload }: { toast: ToastFn; settings: Settings; reload: () => void }) {
  const fromSettings = (): TopBar => parseTopBar(settings.content) ?? { on: false, text: defaultTopBarText };
  const [t, setT] = useState<TopBar>(fromSettings);
  const [busy, setBusy] = useState(false);
  useEffect(() => setT(fromSettings()), [settings]); // eslint-disable-line react-hooks/exhaustive-deps

  async function write(next: TopBar) {
    const text = next.text.trim();
    const link = next.link?.trim() || undefined;
    const until = next.until || undefined;
    const done_text = next.done_text?.trim() || undefined;
    if (next.on && !text) return toast('Write the notice text first', false);
    if (link && !/^https:\/\//.test(link)) return toast('Link must start with https://', false);
    setBusy(true);
    // Read the latest content first so other edits are not lost.
    const { data, error: e1 } = await sb!.from('nusuk_settings').select('content').eq('id', 1).single();
    if (e1) { setBusy(false); return toast(errText(e1), false); }
    const content = { ...((data?.content as object) ?? {}), topbar: { on: next.on, text, link, until, done_text } };
    const { error } = await sb!.from('nusuk_settings').update({ content, updated_at: new Date().toISOString() }).eq('id', 1);
    setBusy(false);
    if (error) return toast(errText(error), false);
    toast(next.on ? 'Top notice is ON' : 'Top notice is OFF (text kept)');
    reload();
  }
  const saved = parseTopBar(settings.content);
  const now = useNow();
  const end = t.until ? Date.parse(t.until) : NaN;
  const left = end - now;
  const ended = !Number.isNaN(end) && left <= 0;
  const quick = (mins: number) => setT({ ...t, until: new Date(Date.now() + mins * 60000).toISOString() });

  return (
    <div className="grid gap-4">
      <Card title="Top notice" actions={<Btn onClick={() => write(t)} disabled={busy}>{busy ? 'Saving…' : 'Save'}</Btn>}>
        <p className="mb-4 text-sm text-emerald-900/75">A colored bar at the very top of /nusuk for short, temporary announcements, with an optional live countdown. Click Save after changing the text or time. Switch it off when it's no longer needed; the text is kept so you can switch it back on later. Visitors who already have the page open see the change within a minute.</p>
        <div className="grid gap-4">
          <Toggle on={t.on} onChange={(v) => { const n = { ...t, on: v }; setT(n); write(n); }} label={t.on ? 'Notice is ON' : 'Notice is OFF'} hint="Turns the bar on or off right away (saves automatically)." />
          <label className="grid gap-1 text-sm font-semibold">Notice text
            <textarea rows={2} maxLength={200} className="nk-input font-normal" value={t.text} onChange={(e) => setT({ ...t, text: e.target.value })} />
            <span className="flex justify-between text-xs font-normal text-emerald-900/60">
              <button type="button" className="underline" onClick={() => setT({ ...t, text: defaultTopBarText })}>Use the "winner announcement" text</button>
              <span>{t.text.length}/200</span>
            </span>
          </label>
          <div className="grid gap-2 rounded-xl border border-[#e7e1cf] bg-cream p-3">
            <label className="grid gap-1 text-sm font-semibold">Countdown to (optional)
              <input type="datetime-local" className="nk-input font-normal" value={isoToLocalInput(t.until)} onChange={(e) => setT({ ...t, until: localInputToIso(e.target.value) })} />
            </label>
            <div className="flex flex-wrap items-center gap-1.5 text-xs">
              <span className="font-semibold text-emerald-900/70">Quick:</span>
              {[15, 30, 60, 120].map((m) => <Btn key={m} kind="ghost" className="px-2! py-1! text-xs!" onClick={() => quick(m)}>+{m < 60 ? `${m} min` : `${m / 60} h`}</Btn>)}
              {t.until && <Btn kind="ghost" className="px-2! py-1! text-xs! text-red-700" onClick={() => setT({ ...t, until: undefined })}>No countdown</Btn>}
            </div>
            <p className="text-xs text-emerald-900/60">Time is in this computer's time zone. Visitors in any country see the correct time left.{t.until && (ended ? ' This time has already passed.' : ` Time left: ${countdownText(left)}`)}</p>
            <label className="grid gap-1 text-sm font-semibold">Text after the countdown ends (optional)
              <input className="nk-input font-normal" maxLength={200} value={t.done_text ?? ''} onChange={(e) => setT({ ...t, done_text: e.target.value })} placeholder="Leave empty to keep the same text, without the timer" />
              <button type="button" className="justify-self-start text-xs font-normal underline text-emerald-900/60" onClick={() => setT({ ...t, done_text: defaultTopBarDoneText })}>Use "announcing now" text</button>
            </label>
          </div>
          <label className="grid gap-1 text-sm font-semibold">Link (optional)<input className="nk-input font-normal" value={t.link ?? ''} onChange={(e) => setT({ ...t, link: e.target.value })} placeholder="https://… (adds a small 'দেখুন →' button)" /></label>
        </div>
      </Card>
      <Card title={`Preview${saved?.on ? ' · live now' : ''}`}>
        <div className="nk-topbar overflow-hidden rounded-xl text-white">
          <div className="flex flex-wrap items-center justify-center gap-x-2.5 gap-y-1 px-4 py-2.5 text-center text-sm font-semibold leading-snug">
            <span className="nk-topbar-dot shrink-0" aria-hidden />
            <span>{(ended && t.done_text?.trim()) || t.text || 'Notice text'}</span>
            {t.until && !ended && <span className="nk-topbar-timer shrink-0">{countdownText(left)}</span>}
            {t.link?.trim() && <span className="shrink-0 rounded-full bg-white/20 px-2.5 py-0.5 text-xs font-bold">দেখুন →</span>}
          </div>
        </div>
        {!t.on && <p className="mt-2 text-xs text-emerald-900/60">Hidden on the page while the notice is OFF.</p>}
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
type Route = 'dashboard' | 'codes' | 'review' | 'features' | 'bonus' | 'upload' | 'notice' | 'video' | 'ads' | 'today' | 'winners' | 'feedback' | 'settings';
const nav: { r: Route; label: string; icon: string }[] = [
  { r: 'dashboard', label: 'Dashboard', icon: 'M3 13h8V3H3zm10 8h8V11h-8zM3 21h8v-6H3zm10-18v6h8V3z' },
  { r: 'codes', label: 'Codes', icon: 'M4 6h16M4 12h16M4 18h10' },
  { r: 'review', label: 'Review', icon: 'M9 12l2 2 4-4M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z' },
  { r: 'features', label: 'Feature requests', icon: 'M12 2l3 6.5 7 .8-5.2 4.8 1.5 7L12 17.6 5.7 21.1l1.5-7L2 9.3l7-.8z' },
  { r: 'bonus', label: 'Bonus popup', icon: 'M20 12v9H4v-9M2 7h20v5H2zM12 21V7M12 7H7.5a2.5 2.5 0 1 1 0-5C11 2 12 7 12 7zM12 7h4.5a2.5 2.5 0 1 0 0-5C13 2 12 7 12 7z' },
  { r: 'upload', label: 'Paste codes', icon: 'M12 16V4m0 0l-4 4m4-4l4 4M4 20h16' },
  { r: 'notice', label: 'Top notice', icon: 'M3 11v2a1 1 0 0 0 1 1h2l5 4V6L6 10H4a1 1 0 0 0-1 1zM15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13' },
  { r: 'ads', label: 'Ads', icon: 'M3 11l18-5v12L3 14v-3zM11.6 16.8a3 3 0 1 1-5.8-1.6' },
  { r: 'video', label: 'Video', icon: 'M2.5 7.5a2.5 2.5 0 0 1 2.5-2.5h14a2.5 2.5 0 0 1 2.5 2.5v9a2.5 2.5 0 0 1-2.5 2.5H5a2.5 2.5 0 0 1-2.5-2.5zM10 9.5v5l4.5-2.5z' },
  { r: 'today', label: "Today's winner", icon: 'M12 2l3 6.5 7 .8-5.2 4.8 1.5 7L12 17.6 5.7 21.1l1.5-7L2 9.3l7-.8z' },
  { r: 'feedback', label: 'Feedback', icon: 'M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z' },
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

  // Unread feedback count for the sidebar badge
  const [unread, setUnread] = useState(0);
  const [featWaiting, setFeatWaiting] = useState(0);
  const [reviewWaiting, setReviewWaiting] = useState(0);
  const loadUnread = useCallback(async () => {
    const { count, error } = await sb!.from('nusuk_feedback').select('id', { count: 'exact', head: true }).eq('status', 'new');
    setUnread(error ? 0 : count ?? 0);
    const fr = await sb!.from('nusuk_feature_requests').select('id', { count: 'exact', head: true }).eq('status', 'pending');
    setFeatWaiting(fr.error ? 0 : fr.count ?? 0);
    const rv = await sb!.from('nusuk_codes').select('id', { count: 'exact', head: true }).eq('status', 'pending');
    setReviewWaiting(rv.error ? 0 : rv.count ?? 0);
  }, []);
  useEffect(() => { if (isAdmin) loadUnread(); }, [isAdmin, loadUnread, route]);
  // Keep the sidebar badges fresh (new submissions, approvals made on the Review page)
  useEffect(() => {
    if (!isAdmin) return;
    const t = setInterval(() => { if (document.visibilityState === 'visible') loadUnread(); }, 20000);
    return () => clearInterval(t);
  }, [isAdmin, loadUnread]);

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
              {n.r === 'feedback' && unread > 0 && <span className="ml-auto rounded-full bg-red-600 px-1.5 text-[11px] font-bold leading-5 text-white">{unread}</span>}
              {n.r === 'notice' && parseTopBar(settings?.content)?.on && <span className="ml-auto rounded-full bg-gold-400 px-1.5 text-[11px] font-bold leading-5 text-emerald-950">ON</span>}
              {n.r === 'review' && reviewWaiting > 0 && <span className="ml-auto rounded-full bg-red-600 px-1.5 text-[11px] font-bold leading-5 text-white">{reviewWaiting}</span>}
              {n.r === 'features' && featWaiting > 0 && <span className="ml-auto rounded-full bg-red-600 px-1.5 text-[11px] font-bold leading-5 text-white">{featWaiting}</span>}
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
        {route === 'codes' && <CodesPage key="codes" toast={toast} settings={settings} />}
        {route === 'review' && <CodesPage key="review" toast={toast} reviewMode settings={settings} />}
        {route === 'upload' && <Upload toast={toast} defaultMax={settings?.default_max_uses ?? 1} />}
        {route === 'bonus' && settings && <BonusPage toast={toast} settings={settings} reload={loadSettings} />}
        {route === 'ads' && settings && <AdsPage toast={toast} settings={settings} reload={loadSettings} />}
        {route === 'video' && settings && <VideoPage toast={toast} settings={settings} reload={loadSettings} />}
        {route === 'notice' && settings && <TopNoticePage toast={toast} settings={settings} reload={loadSettings} />}
        {route === 'today' && settings && <TodayWinnerPage toast={toast} settings={settings} reload={loadSettings} />}
        {route === 'feedback' && <FeedbackPage toast={toast} onChange={loadUnread} />}
        {route === 'features' && <FeatureRequestsPage toast={toast} onChange={loadUnread} settings={settings} />}
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
