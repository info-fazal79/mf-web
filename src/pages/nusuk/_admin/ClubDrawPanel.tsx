/* Nusuk Manager → Reward Club → Raffle draw: prizes per competition, the wheel (one slice per ticket),
   draw winners one by one, and run the draw on the live screen with a countdown (update_34_club_draw.sql). */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Dices, ExternalLink, MonitorPlay, Play, RotateCcw, Square, Timer, Trophy } from 'lucide-react';
import { supabase as sb } from '@/lib/supabase';
import type { Contest } from '../_lib/club';
import { POINTER_SVG, SPIN_MS, bnPlace, buildSlots, drawSeed, landingIndex, spinTo, wheelSvg, type Slot } from '../_lib/clubdraw';

type ToastFn = (t: string, ok?: boolean) => void;
type Prize = { place: number; prize: string };
type Entry = { sl: number; name: string; code: string; tickets: number; won: boolean };
type Winner = { id: number; place: number; prize: string; tickets: number; pool: number; sl: number; name: string; phone: string; code: string; at: string };
type Pool = { total: number; people: number; entries: Entry[]; winners: Winner[] };
type State = { mode: 'normal' | 'raffle'; contest_id: number | null; scope: string; countdown_end: string | null };

const errText = (e: unknown) => (e && typeof e === 'object' && 'message' in e ? String((e as { message: string }).message) : String(e));
const dhakaToday = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Dhaka' });
const first = (n: string) => n.trim().split(/\s+/)[0] ?? n;

export default function ClubDrawPanel({ contests, toast }: { contests: Contest[]; toast: ToastFn }) {
  const [cid, setCid] = useState<number | null>(null);
  const c = contests.find((x) => x.id === cid) ?? null;
  const [scopeKind, setScopeKind] = useState<'today' | 'day' | 'all'>('today');
  const [day, setDay] = useState(dhakaToday());
  const scope = scopeKind === 'all' ? 'all' : scopeKind === 'today' ? dhakaToday() : day;
  const [pool, setPool] = useState<Pool | null>(null);
  const [prizes, setPrizes] = useState<Prize[]>([{ place: 1, prize: '' }]);
  const [count, setCount] = useState(1);
  const [order, setOrder] = useState<'asc' | 'desc'>('asc');
  const [rotation, setRotation] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const [slotsOverride, setSlotsOverride] = useState<Slot[] | null>(null);
  const [result, setResult] = useState<Winner | null>(null);
  const [auto, setAuto] = useState(false);
  const autoRef = useRef(false);
  const rotRef = useRef(0);
  const [state, setState] = useState<State | null>(null);
  const [cdMin, setCdMin] = useState(5);
  const [cdSec, setCdSec] = useState(0);
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 500); return () => clearInterval(t); }, []);

  // pick the first competition; default scope by type
  useEffect(() => { if (cid == null && contests.length) setCid(contests.find((x) => x.active)?.id ?? contests[0].id); }, [contests, cid]);
  useEffect(() => {
    if (!c) return;
    setScopeKind(c.kind === 'lucky' ? 'today' : 'all');
    const p = Array.isArray(c.prizes) ? c.prizes : [];
    setPrizes(p.length ? p : [{ place: 1, prize: '' }]);
    setCount(Math.max(1, p.length || 1));
    setResult(null);
  }, [c?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const load = useCallback(async () => {
    if (!cid) return;
    const { data, error } = await sb!.rpc('nusuk_admin_club_pool', { p_contest: cid, p_scope: scope });
    if (error) return toast(errText(error).includes('nusuk_admin_club_pool') ? 'Run update_34_club_draw.sql in Supabase first' : errText(error), false);
    setPool(data as Pool);
    setSlotsOverride(null);
  }, [cid, scope, toast]);
  useEffect(() => { load(); }, [load]);

  const loadState = useCallback(async () => {
    const { data } = await sb!.from('nusuk_club_draw_state').select('mode,contest_id,scope,countdown_end').eq('id', 1).maybeSingle();
    if (data) setState(data as State);
  }, []);
  useEffect(() => { loadState(); }, [loadState]);

  const left = useMemo(() => (pool?.entries ?? []).filter((e) => !e.won), [pool]);
  const slots = useMemo(() => slotsOverride ?? buildSlots(left.map((e) => ({ k: e.sl, name: first(e.name), t: e.tickets })), drawSeed(cid ?? 0, scope)), [left, slotsOverride, cid, scope]);
  const svg = useMemo(() => wheelSvg(slots, 'green'), [slots]);
  const winners = pool?.winners ?? [];
  const taken = new Set(winners.map((w) => w.place));
  const free = Array.from({ length: count }, (_, i) => i + 1).filter((n) => !taken.has(n));
  const nextPlace = free.length ? (order === 'asc' ? free[0] : free[free.length - 1]) : null;
  const isTop = c?.kind === 'top';
  // latest values for the 'draw all' loop (it keeps running across renders)
  const latest = useRef({ slots, nextPlace, isTop });
  latest.current = { slots, nextPlace, isTop };

  function setCountTo(n: number) {
    const k = Math.max(1, Math.min(200, Math.round(n) || 1));
    setCount(k);
    setPrizes((p) => Array.from({ length: k }, (_, i) => p[i] ?? { place: i + 1, prize: p[p.length - 1]?.prize ?? '' }));
  }
  async function savePrizes() {
    if (!c) return;
    const clean = prizes.slice(0, count).map((p, i) => ({ place: i + 1, prize: p.prize.trim() }));
    const { error } = await sb!.from('nusuk_club_contests').update({ prizes: clean }).eq('id', c.id);
    if (error) return toast(errText(error), false);
    c.prizes = clean;
    toast('Prizes saved');
  }

  async function spinOnce(): Promise<boolean> {
    const { slots, nextPlace, isTop } = latest.current;
    if (!c || !nextPlace) return false;
    setResult(null);
    const { data, error } = await sb!.rpc('nusuk_admin_club_spin', { p_contest: c.id, p_scope: scope, p_place: nextPlace });
    if (error) { toast(errText(error), false); return false; }
    const r = data as { ok: boolean; reason?: string; winner?: Winner };
    if (!r.ok || !r.winner) { toast(r.reason === 'empty' ? 'No one left to draw' : 'This place is already drawn', false); await load(); return false; }
    const w = r.winner;
    if (isTop) { setResult(w); await load(); return true; }
    const { slots: s2, index } = landingIndex(slots, { k: w.sl, name: first(w.name) }, w.id);
    setSlotsOverride(s2);
    const next = spinTo(rotRef.current, index, s2.length);
    rotRef.current = next;
    setSpinning(true);
    setRotation(next);
    await new Promise((res) => setTimeout(res, SPIN_MS + 250));
    setSpinning(false);
    setResult(w);
    await load();
    return true;
  }
  async function spin() { if (!spinning) await spinOnce(); }
  async function drawAll() {
    if (auto) { autoRef.current = false; setAuto(false); return; }
    autoRef.current = true; setAuto(true);
    let guard = 0;
    while (autoRef.current && guard++ < 200) {
      const ok = await spinOnce();
      if (!ok) break;
      await new Promise((res) => setTimeout(res, 3500)); // time to read the name on the live screen
    }
    autoRef.current = false; setAuto(false);
  }
  async function removeWinner(w: Winner) {
    if (!confirm(`Remove ${w.name} (#${w.place})? They go back in the draw and #${w.place} can be drawn again.`)) return;
    const { error } = await sb!.from('nusuk_club_winners').delete().eq('id', w.id);
    if (error) return toast(errText(error), false);
    load();
  }

  // ---------- live screen ----------
  async function setLive(p: Partial<State>) {
    const { error } = await sb!.from('nusuk_club_draw_state').update({ ...p, updated_at: new Date().toISOString() }).eq('id', 1);
    if (error) return toast(errText(error).includes('nusuk_club_draw_state') ? 'Run update_34_club_draw.sql in Supabase first' : errText(error), false);
    await loadState();
  }
  const onLive = state?.mode === 'raffle' && state.contest_id === cid && state.scope === scope;
  const cdLeft = state?.countdown_end ? Math.max(0, new Date(state.countdown_end).getTime() - now) : 0;
  const mmss = (ms: number) => { const s = Math.ceil(ms / 1000); return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`; };

  if (!contests.length) return null;
  return (
    <section className="nk-card grid gap-4 p-4 sm:p-5">
      <h2 className="flex items-center gap-2 text-base font-bold text-emerald-950"><Dices className="h-5 w-5" aria-hidden /> Raffle draw</h2>
      <div className="grid gap-3 sm:grid-cols-[1fr_auto_auto]">
        <select className="nk-input" value={cid ?? ''} onChange={(e) => setCid(Number(e.target.value))} aria-label="Competition">
          {contests.map((x) => <option key={x.id} value={x.id}>{x.title}{x.active ? '' : ' (off)'}</option>)}
        </select>
        <select className="nk-input w-auto" value={scopeKind} onChange={(e) => setScopeKind(e.target.value as typeof scopeKind)} aria-label="Which tickets">
          <option value="today">Today's tickets</option>
          <option value="day">Tickets of a day…</option>
          <option value="all">Whole competition</option>
        </select>
        {scopeKind === 'day' && <input type="date" className="nk-input w-auto" value={day} onChange={(e) => setDay(e.target.value)} aria-label="Day" />}
      </div>
      <p className="-mt-1 text-xs text-emerald-900/65">
        {isTop ? 'Top referrers: winners come from the leaderboard (most people brought in), no lottery.' : 'Every ticket is one chance. A person can win only once per draw.'}
        {pool && <> · <b>{pool.total}</b> {isTop ? 'referrals' : 'tickets'} from <b>{pool.people}</b> people{left.length !== pool.people ? ` · ${left.length} still in the draw` : ''}</>}
      </p>

      {/* prizes */}
      <div className="rounded-xl border border-[#e7e1cf] p-3">
        <div className="mb-2 flex flex-wrap items-center gap-2 text-sm">
          <b className="flex items-center gap-1.5"><Trophy className="h-4 w-4" aria-hidden /> Winners:</b>
          {[1, 3, 5, 10, 50, 100].map((n) => (
            <button key={n} type="button" className={`nk-btn px-2.5 py-1 text-xs ${count === n ? 'nk-gold' : 'nk-ghost'}`} onClick={() => setCountTo(n)}>{n}</button>
          ))}
          <input type="number" min={1} max={200} className="nk-input w-20 py-1" value={count} onChange={(e) => setCountTo(+e.target.value)} aria-label="Number of winners" />
          <button type="button" className="nk-btn nk-green ml-auto px-3 py-1.5 text-sm" onClick={savePrizes}>Save prizes</button>
        </div>
        <div className="grid max-h-64 gap-1.5 overflow-y-auto pr-1">
          {prizes.slice(0, count).map((p, i) => (
            <div key={i} className="grid grid-cols-[3.5rem_1fr] items-center gap-2">
              <b className="text-sm">{bnPlace(i + 1)}</b>
              <input className="nk-input py-1.5" value={p.prize} placeholder="Prize, e.g. তাসবিহ, জায়নামাজ, ৫০টি Key" onChange={(e) => setPrizes(prizes.map((x, j) => (j === i ? { ...x, prize: e.target.value } : x)))} />
            </div>
          ))}
        </div>
      </div>

      {/* live screen control */}
      <div className={`grid gap-3 rounded-xl p-3 ${onLive ? 'border-2 border-red-500/60 bg-red-50/60' : 'border border-[#e7e1cf]'}`}>
        <div className="flex flex-wrap items-center gap-2">
          <MonitorPlay className="h-5 w-5 text-emerald-800" aria-hidden />
          <b className="text-sm">Live screen:</b>
          {onLive
            ? <span className="rounded-full bg-red-600 px-2.5 py-0.5 text-xs font-bold text-white">● Showing this draw</span>
            : <span className="text-sm text-emerald-900/70">{state?.mode === 'raffle' ? 'showing another draw' : 'normal live'}</span>}
          <div className="ml-auto flex flex-wrap gap-2">
            {onLive
              ? <button type="button" className="nk-btn nk-ghost px-3 py-1.5 text-sm" onClick={() => setLive({ mode: 'normal', countdown_end: null })}>Back to normal live</button>
              : <button type="button" className="nk-btn nk-green px-3 py-1.5 text-sm" onClick={() => setLive({ mode: 'raffle', contest_id: cid, scope, countdown_end: null })}>Show this draw on the live screen</button>}
            <a href="/nusuk/live" target="_blank" rel="noopener" className="nk-btn nk-ghost flex items-center gap-1 px-3 py-1.5 text-sm"><ExternalLink className="h-4 w-4" aria-hidden /> Open</a>
          </div>
        </div>
        {onLive && (
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <Timer className="h-4 w-4" aria-hidden /><b>Countdown</b>
            <input type="number" min={0} max={180} className="nk-input w-16 py-1" value={cdMin} onChange={(e) => setCdMin(Math.max(0, +e.target.value || 0))} aria-label="Minutes" /> min
            <input type="number" min={0} max={59} className="nk-input w-16 py-1" value={cdSec} onChange={(e) => setCdSec(Math.max(0, Math.min(59, +e.target.value || 0)))} aria-label="Seconds" /> sec
            <button type="button" className="nk-btn nk-gold flex items-center gap-1 px-3 py-1.5" onClick={() => setLive({ countdown_end: new Date(Date.now() + (cdMin * 60 + cdSec) * 1000).toISOString() })}><Play className="h-4 w-4" aria-hidden /> Start</button>
            {state?.countdown_end && <button type="button" className="nk-btn nk-ghost flex items-center gap-1 px-3 py-1.5" onClick={() => setLive({ countdown_end: null })}><Square className="h-4 w-4" aria-hidden /> Clear</button>}
            {state?.countdown_end && <span className={`rounded-lg px-3 py-1 font-mono text-lg font-bold ${cdLeft ? 'bg-emerald-900 text-gold-100' : 'bg-red-600 text-white'}`}>{cdLeft ? mmss(cdLeft) : 'Time up · spin now'}</span>}
          </div>
        )}
      </div>

      {/* wheel */}
      <div className="grid gap-4 lg:grid-cols-[minmax(0,26rem)_1fr]">
        <div>
          {!isTop && (
            <div className="relative mx-auto aspect-square w-full max-w-[26rem]">
              <div className="h-full w-full drop-shadow-xl" style={{ transform: `rotate(${rotation}deg)`, transition: spinning ? `transform ${SPIN_MS / 1000}s cubic-bezier(0.08, 0.6, 0.02, 1)` : 'none' }} dangerouslySetInnerHTML={{ __html: svg }} />
              <div className="absolute top-[-6px] left-1/2 h-9 w-8 -translate-x-1/2 drop-shadow" dangerouslySetInnerHTML={{ __html: POINTER_SVG }} />
            </div>
          )}
          {!isTop && pool && pool.total > slots.length && <p className="mt-2 text-center text-xs text-emerald-900/60">The wheel shows {slots.length} slices out of {pool.total} tickets; the draw is made on all tickets.</p>}
          <div className="mt-4 flex flex-col items-center gap-2">
            <button type="button" onClick={spin} disabled={spinning || auto || !left.length || !nextPlace} className="nk-btn nk-gold px-8 py-3 text-lg disabled:opacity-50">
              {spinning ? 'ঘুরছে…' : !nextPlace ? 'All winners drawn' : !left.length ? 'No one left' : isTop ? `Reveal winner #${nextPlace}` : `Spin for winner #${nextPlace}`}
            </button>
            <div className="flex flex-wrap items-center justify-center gap-2">
              <button type="button" onClick={drawAll} disabled={(!auto && (spinning || !left.length || !nextPlace))} className="nk-btn nk-ghost flex items-center gap-1.5 px-4 py-1.5 text-sm">
                {auto ? <><Square className="h-4 w-4" aria-hidden /> Stop</> : <><RotateCcw className="h-4 w-4" aria-hidden /> Draw all remaining, one by one</>}
              </button>
              <div className="flex items-center gap-1 rounded-full bg-emerald-50 p-1 text-xs font-semibold" role="group" aria-label="Draw order">
                <button type="button" disabled={spinning || auto} onClick={() => setOrder('asc')} className={`rounded-full px-3 py-1 ${order === 'asc' ? 'bg-emerald-900 text-gold-100' : 'text-emerald-900'}`}>1 → {count}</button>
                <button type="button" disabled={spinning || auto} onClick={() => setOrder('desc')} className={`rounded-full px-3 py-1 ${order === 'desc' ? 'bg-emerald-900 text-gold-100' : 'text-emerald-900'}`}>{count} → 1</button>
              </div>
            </div>
            {result && !spinning && (
              <div className="w-full max-w-md rounded-2xl bg-emerald-900 px-5 py-4 text-center text-white shadow-lg">
                <div className="text-sm text-gold-100">🎉 {bnPlace(result.place)} বিজয়ী</div>
                <div className="mt-1 text-2xl font-bold text-gold-100">{result.name}</div>
                <div className="font-mono text-sm">SL {result.sl} · {result.code} · {result.tickets} {isTop ? 'referrals' : 'tickets'}</div>
                {result.prize && <div className="mt-1 text-sm text-emerald-100">🎁 {result.prize}</div>}
              </div>
            )}
          </div>
        </div>
        <div>
          <div className="mb-2 flex items-center justify-between"><b className="text-sm">Winners ({winners.length}/{count})</b><button type="button" className="text-xs font-semibold underline" onClick={load}>Refresh</button></div>
          <div className="grid max-h-[28rem] gap-1.5 overflow-y-auto pr-1">
            {winners.map((w) => (
              <div key={w.id} className="flex flex-wrap items-center gap-2 rounded-xl border border-gold-500/50 bg-gold-100/30 px-3 py-2 text-sm">
                <span className="rounded-full bg-emerald-900 px-2 py-0.5 text-xs font-bold text-gold-100">{bnPlace(w.place)}</span>
                <b>{w.name}</b>
                <span className="text-emerald-900/60">SL {w.sl} · {w.phone} · <span className="font-mono">{w.code}</span> · {w.tickets}/{w.pool}</span>
                {w.prize && <span>· 🎁 {w.prize}</span>}
                <button type="button" className="ml-auto text-xs font-semibold text-red-700 underline" onClick={() => removeWinner(w)}>Remove</button>
              </div>
            ))}
            {!winners.length && <p className="text-sm text-emerald-900/60">No winners yet.</p>}
          </div>
        </div>
      </div>
    </section>
  );
}
