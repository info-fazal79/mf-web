/* Nusuk Manager → Live screen → Live comments → "Codes & comment draw".
   1. Codes: load every comment of the live, collect the Nusuk codes people shared, add them all
      to the site in one click (nusuk_admin_add_codes; codes already there are skipped).
   2. Draw: one code wins N Keys - among the first N people who shared a code, everyone, or the
      codes shared between two times. Each code counts once (many comments = one chance) and a code
      that already won is left out. The winner can be shown on the live screen and get the Keys at
      once (nusuk_admin_award).
   3. Notice: makes the "share your code" notice with the prize and shows it on the live screen. */
import { useMemo, useState } from 'react';
import { Download, Gift, Megaphone, RefreshCw, Shuffle, Trophy, Upload } from 'lucide-react';
import { supabase as sb } from '@/lib/supabase';
import { extractCodes } from '../_lib/extract';
import { fbAllComments, type FbComment } from '../_lib/livecomments';
import type { CDraw, CDrawWinner } from '../_lib/livecfg';

type ToastFn = (t: string, ok?: boolean) => void;
type Entry = { code: string; name: string; text: string; time: number };
const errText = (e: unknown) => (e && typeof e === 'object' && 'message' in e ? String((e as { message: string }).message) : String(e));
const bn = (n: number) => n.toLocaleString('bn-BD');
const bnT = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number);
  const part = h < 4 ? 'রাত' : h < 12 ? 'সকাল' : h < 15 ? 'দুপুর' : h < 18 ? 'বিকাল' : h < 20 ? 'সন্ধ্যা' : 'রাত';
  return `${part} ${bn(h % 12 || 12)}:${String(m).padStart(2, '0').replace(/\d/g, (d) => '০১২৩৪৫৬৭৮৯'[Number(d)])}`;
};
/** minutes since midnight in Bangladesh for a time */
const dhakaMin = (t: number) => { const d = new Date(t + 6 * 3600e3); return d.getUTCHours() * 60 + d.getUTCMinutes(); };
const hm = (s: string) => { const [h, m] = s.split(':').map(Number); return h * 60 + m; };

/** each code once, at its first comment (oldest first) */
function entriesOf(list: FbComment[]): Entry[] {
  const seen = new Map<string, Entry>();
  for (const c of [...list].sort((a, b) => a.time - b.time)) {
    for (const code of extractCodes(c.text).unique) {
      const k = code.toLowerCase();
      if (!seen.has(k)) seen.set(k, { code, name: c.name, text: c.text, time: c.time });
    }
  }
  return [...seen.values()];
}

export default function CommentDraw({ objectId, token, d, setD, showCard, makeNotice, toast }: {
  objectId: string | null; token: string; d: CDraw; setD: (p: Partial<CDraw>, msg?: string) => void;
  showCard: (name: string, text: string) => void; makeNotice: (tag: string, title: string, text: string) => void; toast: ToastFn;
}) {
  const [all, setAll] = useState<FbComment[] | null>(null);
  const [loading, setLoading] = useState(0);
  const [busy, setBusy] = useState(false);
  const [added, setAdded] = useState<{ added: number; skipped: number } | null>(null);
  const [pick, setPick] = useState<CDrawWinner | null>(null);
  const [spin, setSpin] = useState('');

  const entries = useMemo(() => (all ? entriesOf(all) : []), [all]);
  const won = useMemo(() => new Set(d.winners.map((w) => w.code.toLowerCase())), [d.winners]);
  const pool = useMemo(() => {
    let p = entries;
    if (d.scope === 'first') p = entries.slice(0, d.n);
    else if (d.scope === 'time') {
      const a = hm(d.from), b = hm(d.to);
      p = entries.filter((e) => { const m = dhakaMin(e.time); return a <= b ? m >= a && m <= b : m >= a || m <= b; });
    }
    return p.filter((e) => !won.has(e.code.toLowerCase()));
  }, [entries, d.scope, d.n, d.from, d.to, won]);

  const scopeText = d.scope === 'first' ? `প্রথম ${bn(d.n)} জন কোড শেয়ারকারীর মধ্য থেকে`
    : d.scope === 'time' ? `${bnT(d.from)} থেকে ${bnT(d.to)}-এর মধ্যে যারা কমেন্টে কোড দেবেন, তাদের মধ্য থেকে`
    : 'কমেন্টে কোড দেওয়া সবার মধ্য থেকে';
  const scopeShort = d.scope === 'first' ? `first ${d.n}` : d.scope === 'time' ? `${d.from}–${d.to}` : 'all';

  async function load() {
    if (!objectId) return toast('No live video found. Start the live or put the video link in Settings.', false);
    setLoading(1); setAdded(null);
    try { setAll(await fbAllComments(objectId, token, 6000, (n) => setLoading(Math.max(1, n)))); }
    catch (e) { toast(errText(e), false); }
    setLoading(0);
  }
  async function addCodes() {
    if (!entries.length) return;
    if (!confirm(`Add ${entries.length} code(s) from the comments to the website? Codes already there are skipped.`)) return;
    setBusy(true);
    let a = 0;
    const codes = entries.map((e) => e.code);
    for (let i = 0; i < codes.length; i += 500) {
      const { data, error } = await sb!.rpc('nusuk_admin_add_codes', { p_codes: codes.slice(i, i + 500), p_max_uses: 1, p_status: 'active' });
      if (error) { setBusy(false); return toast(errText(error), false); }
      a += ((data as { added?: string[] })?.added ?? []).length;
    }
    setBusy(false);
    setAdded({ added: a, skipped: codes.length - a });
    toast(`${a} new code(s) added to the website · ${codes.length - a} were already there`);
  }
  async function draw() {
    if (!pool.length) return toast('Nobody in the draw yet. Load the comments first (or change who is in it).', false);
    // a short "rolling" moment before the server-free random pick (crypto random, fair)
    const r = new Uint32Array(1);
    crypto.getRandomValues(r);
    const w = pool[r[0] % pool.length];
    setPick(null);
    for (let i = 0; i < 14; i++) {
      setSpin(pool[Math.floor(Math.random() * pool.length)].code);
      await new Promise((x) => setTimeout(x, 60 + i * 12));
    }
    setSpin('');
    const win: CDrawWinner = { code: w.code, name: w.name, text: w.text, at: Date.now(), keys: d.keys, given: false, scope: scopeShort };
    setPick(win);
    setD({ winners: [win, ...d.winners].slice(0, 200) }, `Winner: ${w.code}`);
  }
  async function give(w: CDrawWinner) {
    if (!confirm(`Give ${w.keys} Nusuk Keys to ${w.code} now?`)) return;
    const { data, error } = await sb!.rpc('nusuk_admin_award', { p_code: w.code, p_keys: w.keys, p_hours: null });
    if (error) return toast(errText(error), false);
    const r = data as { ok: boolean; reason?: string };
    if (!r.ok) return toast(r.reason === 'rejected' ? 'This code is rejected on the site' : 'Could not give the Keys', false);
    setD({ winners: d.winners.map((x) => (x.code === w.code && x.at === w.at ? { ...x, given: true } : x)) }, `${w.keys} Keys are on their way to ${w.code}`);
    if (pick && pick.code === w.code) setPick({ ...pick, given: true });
  }
  const onScreen = (w: CDrawWinner) => showCard('🎉 কমেন্ট ড্রয়ের বিজয়ী', `অভিনন্দন! ${w.code} কোডটি পাচ্ছে ${bn(w.keys)}টি Nusuk Key। ${w.name ? `(${w.name})` : ''}`.trim());
  function exportCsv() {
    const rows = [['#', 'Code', 'Name', 'First comment', 'Time'], ...entries.map((e, i) => [i + 1, e.code, e.name, e.text.replace(/\s+/g, ' '), new Date(e.time).toLocaleString('en-GB', { timeZone: 'Asia/Dhaka' })])];
    const csv = '﻿' + rows.map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    a.download = 'live-comment-codes.csv';
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 3000);
  }

  return (
    <div className="grid gap-3 rounded-xl border-2 border-gold-500/50 bg-gold-400/10 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 font-bold text-emerald-950"><Gift className="h-5 w-5 text-emerald-700" aria-hidden /> Codes &amp; comment draw</h3>
        <button type="button" disabled={!!loading || !objectId} onClick={load} className="nk-btn nk-green flex items-center gap-1.5 px-3 py-1.5 text-xs disabled:opacity-50">
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} /> {loading ? `Loading… ${loading}` : all ? 'Load again' : 'Load all comments of this live'}
        </button>
      </div>
      {!objectId && <p className="text-xs text-emerald-900/65">Works while the Page is live (or with a video link in Settings).</p>}

      {all && (
        <>
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="rounded-lg bg-white p-2"><div className="text-xl font-bold">{all.length}</div><div className="text-[11px] text-emerald-900/65">comments</div></div>
            <div className="rounded-lg bg-white p-2"><div className="text-xl font-bold">{entries.length}</div><div className="text-[11px] text-emerald-900/65">different codes</div></div>
            <div className="rounded-lg bg-white p-2"><div className="text-xl font-bold text-emerald-800">{pool.length}</div><div className="text-[11px] text-emerald-900/65">in the draw now</div></div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" disabled={busy || !entries.length} onClick={addCodes} className="nk-btn nk-green flex items-center gap-1.5 px-3 py-1.5 text-xs disabled:opacity-50"><Upload className="h-3.5 w-3.5" /> {busy ? 'Adding…' : `Add all ${entries.length} codes to the website`}</button>
            {entries.length > 0 && <button type="button" onClick={exportCsv} className="nk-btn nk-ghost flex items-center gap-1.5 px-3 py-1.5 text-xs"><Download className="h-3.5 w-3.5" /> CSV</button>}
          </div>
          {added && <p className="text-xs text-emerald-900/75">{added.added} new code(s) added · {added.skipped} were already on the site.</p>}
        </>
      )}

      {/* who is in the draw */}
      <div className="grid gap-2 rounded-lg bg-white p-2.5">
        <span className="text-xs font-bold text-emerald-900/70">Who is in the draw (each code once; past winners left out)</span>
        <div className="flex flex-wrap gap-1.5">
          {([['first', 'First N people'], ['all', 'Everyone'], ['time', 'Between two times']] as const).map(([k, l]) => (
            <button key={k} type="button" onClick={() => setD({ scope: k })} className={`nk-btn px-2.5 py-1 text-xs ${d.scope === k ? 'nk-green' : 'nk-ghost'}`}>{l}</button>
          ))}
        </div>
        {d.scope === 'first' && (
          <div className="flex flex-wrap items-center gap-1.5 text-xs">
            {[50, 100, 150, 200].map((n) => <button key={n} type="button" onClick={() => setD({ n })} className={`nk-btn px-2.5 py-1 ${d.n === n ? 'nk-green' : 'nk-ghost'}`}>{n}</button>)}
            <input type="number" min={2} className="nk-input py-1 text-xs" style={{ width: 90 }} value={d.n} onChange={(e) => setD({ n: Math.max(2, Number(e.target.value) || 2) })} aria-label="How many" />
            <span className="text-emerald-900/60">people who shared a code first</span>
          </div>
        )}
        {d.scope === 'time' && (
          <div className="flex flex-wrap items-center gap-1.5 text-xs">
            <input type="time" className="nk-input py-1 text-xs" style={{ width: 120 }} value={d.from} onChange={(e) => setD({ from: e.target.value })} />
            <span>to</span>
            <input type="time" className="nk-input py-1 text-xs" style={{ width: 120 }} value={d.to} onChange={(e) => setD({ to: e.target.value })} />
            <span className="text-emerald-900/60">Bangladesh time, today's live</span>
          </div>
        )}
        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          <span className="font-semibold">Prize:</span>
          <input type="number" min={1} max={1000} className="nk-input py-1 text-xs" style={{ width: 90 }} value={d.keys} onChange={(e) => setD({ keys: Math.max(1, Number(e.target.value) || 1) })} aria-label="Keys" />
          <span>Nusuk Keys for the winner</span>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={draw} disabled={!pool.length || !!spin} className="nk-btn flex items-center gap-1.5 bg-gradient-to-br from-[#f7d76a] to-[#e0b93a] px-4 py-2 text-sm font-bold text-emerald-950 disabled:opacity-50"><Shuffle className="h-4 w-4" /> {spin ? 'Drawing…' : `Draw a winner (${pool.length})`}</button>
          <button type="button" onClick={() => makeNotice('🎁 কমেন্ট গিফট', 'কমেন্টে আপনার নুসুক কোড দিন',
            `লাইভে কমেন্টে আপনার নুসুক রেফারেল কোড লিখুন। আপনার কোডটি আমাদের ওয়েবসাইটে যোগ করে দেওয়া হবে, আর ${scopeText} ড্রয়ের মাধ্যমে একজন পাবেন ${bn(d.keys)}টি Nusuk Key একদম ফ্রি!`)}
            className="nk-btn nk-ghost flex items-center gap-1.5 px-3 py-2 text-xs"><Megaphone className="h-3.5 w-3.5" /> Make the notice &amp; show it</button>
        </div>
        {spin && <div className="rounded-lg bg-emerald-950 py-3 text-center font-mono text-2xl font-bold tracking-widest text-gold-100">{spin}</div>}
        {pick && !spin && (
          <div className="grid gap-2 rounded-xl border-2 border-gold-500 bg-gold-400/15 p-3">
            <div className="flex items-center gap-2 font-bold"><Trophy className="h-5 w-5 text-gold-600" /> Winner: <span className="font-mono text-lg">{pick.code}</span></div>
            <p className="text-sm text-emerald-900/80">{pick.name || 'Facebook user'}: “{pick.text.slice(0, 160)}”</p>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => onScreen(pick)} className="nk-btn nk-green px-3 py-1.5 text-xs">Show on the live screen</button>
              <button type="button" disabled={pick.given} onClick={() => give(pick)} className="nk-btn nk-ghost px-3 py-1.5 text-xs disabled:opacity-60">{pick.given ? `✓ ${pick.keys} Keys given` : `Give ${pick.keys} Keys now`}</button>
            </div>
          </div>
        )}
      </div>

      {d.winners.length > 0 && (
        <details className="rounded-lg bg-white p-2.5">
          <summary className="cursor-pointer text-xs font-bold text-emerald-900/75">Past winners ({d.winners.length})</summary>
          <ul className="mt-2 grid gap-1 text-xs">
            {d.winners.map((w) => (
              <li key={w.code + w.at} className="flex flex-wrap items-center justify-between gap-2 rounded bg-emerald-50 px-2 py-1">
                <span><b className="font-mono">{w.code}</b> · {w.keys} Keys · {w.scope} · {new Date(w.at).toLocaleString('en-GB', { timeZone: 'Asia/Dhaka', dateStyle: 'short', timeStyle: 'short' })}</span>
                <span className="flex gap-1">
                  <button type="button" className="underline" onClick={() => onScreen(w)}>show</button>
                  {!w.given ? <button type="button" className="font-bold text-emerald-800 underline" onClick={() => give(w)}>give Keys</button> : <span className="text-emerald-700">✓ given</span>}
                  <button type="button" className="text-red-700 underline" onClick={() => { if (confirm('Remove from the list? (it can win again)')) setD({ winners: d.winners.filter((x) => x !== w) }); }}>remove</button>
                </span>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
