/* Nusuk Manager → Raffle draw: spin a wheel of a giveaway's entries, set prizes per place, give Keys. */
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { supabase as sb } from '@/lib/supabase';

type ToastFn = (t: string, ok?: boolean) => void;
type Prize = { place: number; prize: string; keys: number | null };
type Give = { id: number; title: string; prize: string; prizes: Prize[] | null; ends_at: string | null; is_on: boolean; created_at: string };
type Entry = { id: number; code: string; fb_name: string; status: 'ok' | 'invalid' };
type Winner = { id: number; entry_id: number; code: string; fb_name: string; place: number; prize: string; keys: number | null; awarded_at: string | null; award_mode: string | null };

const errText = (e: unknown) => (e && typeof e === 'object' && 'message' in e ? String((e as { message: string }).message) : String(e));
const when = (iso: string | null) => (iso ? new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '');
const COLORS = ['#075e45', '#c9a227', '#0b7a5a', '#e0b93a', '#05503b', '#d4ab2c'];

function Card({ title, actions, children }: { title: ReactNode; actions?: ReactNode; children: ReactNode }) {
  return (
    <section className="nk-card p-4 sm:p-5">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-base font-bold text-emerald-950">{title}</h2>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
      {children}
    </section>
  );
}
function Btn({ kind = 'green', className = '', ...p }: React.ButtonHTMLAttributes<HTMLButtonElement> & { kind?: 'green' | 'gold' | 'ghost' }) {
  return <button type="button" {...p} className={`nk-btn nk-${kind} px-3.5 py-2 text-sm ${className}`} />;
}

/** The wheel: one slice per entry; the pointer is at the top. */
export function Wheel({ items, rotation, spinning }: { items: Entry[]; rotation: number; spinning: boolean }) {
  const n = Math.max(items.length, 1);
  const a = 360 / n;
  const R = 200;
  const pt = (deg: number, r = R) => { const t = ((deg - 90) * Math.PI) / 180; return [R + r * Math.cos(t), R + r * Math.sin(t)]; };
  const font = n > 120 ? 6 : n > 60 ? 8 : n > 30 ? 10 : 12;
  return (
    <div className="relative mx-auto aspect-square w-full max-w-[26rem]">
      <svg viewBox="0 0 400 400" className="h-full w-full drop-shadow-xl">
        <g style={{ transform: `rotate(${rotation}deg)`, transformOrigin: '200px 200px', transition: spinning ? 'transform 5.5s cubic-bezier(0.12, 0.65, 0.1, 1)' : 'none' }}>
          {items.length === 0 && <circle cx={200} cy={200} r={R} fill="#e7e1cf" />}
          {items.map((e, i) => {
            const [x1, y1] = pt(i * a), [x2, y2] = pt((i + 1) * a);
            const mid = i * a + a / 2;
            const [tx, ty] = pt(mid, R * 0.6);
            return (
              <g key={e.id}>
                <path d={n === 1 ? `M ${R} 0 A ${R} ${R} 0 1 1 ${R - 0.01} 0 Z` : `M ${R} ${R} L ${x1} ${y1} A ${R} ${R} 0 ${a > 180 ? 1 : 0} 1 ${x2} ${y2} Z`} fill={COLORS[i % COLORS.length]} stroke="#fff" strokeWidth={n > 80 ? 0.5 : 1.5} />
                <text x={tx} y={ty} fill="#fff" fontSize={font} fontFamily="ui-monospace, monospace" fontWeight={700} textAnchor="middle" dominantBaseline="middle" transform={`rotate(${mid - 90} ${tx} ${ty})`}>{e.code}</text>
              </g>
            );
          })}
          <circle cx={200} cy={200} r={26} fill="#063d2e" stroke="#ffe08a" strokeWidth={4} />
        </g>
        <text x={200} y={204} fill="#ffe08a" fontSize={13} fontWeight={800} textAnchor="middle">RIBAT</text>
      </svg>
      {/* pointer */}
      <div className="absolute top-[-6px] left-1/2 -translate-x-1/2 drop-shadow" aria-hidden="true">
        <svg viewBox="0 0 30 34" className="h-9 w-8"><path d="M15 34 L1 4 Q15 -4 29 4 Z" fill="#b91c1c" stroke="#fff" strokeWidth="2" /></svg>
      </div>
    </div>
  );
}

export default function RafflePage({ toast }: { toast: ToastFn }) {
  const [gives, setGives] = useState<Give[]>([]);
  const [sel, setSel] = useState<number | null>(null);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [winners, setWinners] = useState<Winner[]>([]);
  const [prizes, setPrizes] = useState<Prize[]>([]);
  const [count, setCount] = useState(1);
  const [missing, setMissing] = useState(false);
  const [rotation, setRotation] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const [result, setResult] = useState<Winner | null>(null);
  const [award, setAward] = useState<Record<number, { keys: number; hours: number }>>({});
  const rotRef = useRef(0);

  const loadGives = useCallback(async () => {
    const { data, error } = await sb!.from('nusuk_giveaways').select('id,title,prize,prizes,ends_at,is_on,created_at').order('id', { ascending: false }).limit(50);
    if (error) { setMissing(/prizes|nusuk_giveaways/.test(error.message)); return; }
    const l = (data ?? []) as Give[];
    setGives(l);
    setSel((cur) => cur ?? l[0]?.id ?? null);
  }, []);
  useEffect(() => { loadGives(); }, [loadGives]);
  const g = gives.find((x) => x.id === sel) ?? null;

  const loadData = useCallback(async () => {
    if (!sel) return;
    const [e, w] = await Promise.all([
      sb!.from('nusuk_giveaway_entries').select('id,code,fb_name,status').eq('giveaway_id', sel).order('id').limit(3000),
      sb!.from('nusuk_raffle_winners').select('*').eq('giveaway_id', sel).order('place'),
    ]);
    if (w.error) { setMissing(true); return; }
    setEntries((e.data ?? []) as Entry[]);
    setWinners((w.data ?? []) as Winner[]);
  }, [sel]);
  useEffect(() => { loadData(); }, [loadData]);
  useEffect(() => {
    const p = (g?.prizes ?? []) as Prize[];
    setPrizes(p.length ? p : [{ place: 1, prize: g?.prize ?? '', keys: null }]);
    setCount(Math.max(1, p.length || 1));
  }, [g?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Wheel = valid entries that haven't won yet
  const won = useMemo(() => new Set(winners.map((w) => w.entry_id)), [winners]);
  const wheel = useMemo(() => entries.filter((e) => e.status === 'ok' && !won.has(e.id)), [entries, won]);

  function setCountTo(n: number) {
    const c = Math.max(1, Math.min(100, Math.round(n) || 1));
    setCount(c);
    setPrizes((p) => Array.from({ length: c }, (_, i) => p[i] ?? { place: i + 1, prize: p[p.length - 1]?.prize ?? g?.prize ?? '', keys: p[p.length - 1]?.keys ?? null }));
  }
  async function savePrizes() {
    if (!g) return;
    const clean = prizes.slice(0, count).map((p, i) => ({ place: i + 1, prize: p.prize.trim(), keys: p.keys && p.keys > 0 ? Math.round(p.keys) : null }));
    const { error } = await sb!.from('nusuk_giveaways').update({ prizes: clean }).eq('id', g.id);
    if (error) return toast(errText(error), false);
    toast('Prizes saved');
    loadGives();
  }

  async function spin() {
    if (!g || spinning) return;
    if (winners.length >= count) return toast(`All ${count} winner(s) are drawn. Increase "Winners" to draw more.`, false);
    if (!wheel.length) return toast('No entries left on the wheel', false);
    setResult(null);
    const { data, error } = await sb!.rpc('nusuk_raffle_spin', { p_giveaway: g.id });
    if (error) return toast(errText(error), false);
    const r = data as { ok: boolean; winner?: Winner };
    if (!r.ok || !r.winner) return toast('No entries left on the wheel', false);
    const i = Math.max(0, wheel.findIndex((e) => e.id === r.winner!.entry_id));
    const a = 360 / wheel.length;
    // Land the winner's slice under the pointer (top), after 6 full turns, a little off-centre
    const jitter = (Math.random() - 0.5) * a * 0.6;
    const target = -(i * a + a / 2 + jitter);
    const base = rotRef.current - (rotRef.current % 360);
    const next = base + 360 * 6 + ((target % 360) + 360) % 360;
    rotRef.current = next;
    setSpinning(true);
    setRotation(next);
    setTimeout(() => {
      setSpinning(false);
      setResult(r.winner!);
      loadData();
    }, 5700);
  }
  async function removeWinner(w: Winner) {
    if (!confirm(`Remove ${w.code} from the winners? They go back on the wheel.`)) return;
    const { error } = await sb!.from('nusuk_raffle_winners').delete().eq('id', w.id);
    if (error) return toast(errText(error), false);
    // Renumber the rest
    const rest = winners.filter((x) => x.id !== w.id);
    for (let k = 0; k < rest.length; k++) if (rest[k].place !== k + 1) await sb!.from('nusuk_raffle_winners').update({ place: k + 1 }).eq('id', rest[k].id);
    loadData();
  }
  async function giveKeys(w: Winner) {
    if (/^NG-TEST\d{4}$/.test(w.code)) return toast('🧪 This is a test code: no Keys are given (so it never enters the real code list).', false);
    const a = award[w.id] ?? { keys: w.keys ?? 50, hours: 0 };
    if (!a.keys || a.keys < 1) return toast('How many Keys?', false);
    if (!confirm(`Give ${w.code} ${a.keys} Keys ${a.hours ? `spread over ${a.hours} hour(s)` : 'instantly (top of the page until done)'}?`)) return;
    const { error } = await sb!.rpc('nusuk_admin_award', { p_code: w.code, p_keys: a.keys, p_hours: a.hours || null, p_winner: w.id });
    if (error) return toast(errText(error), false);
    toast(`🎁 ${w.code} gets ${a.keys} Keys`);
    loadData();
  }

  if (missing) {
    return <Card title="🎡 Raffle draw"><p className="text-sm">Run <code className="font-mono">src/pages/nusuk/_sql/update_22_raffle.sql</code> in Supabase → SQL Editor, then reload this page.</p></Card>;
  }
  return (
    <div className="grid gap-4">
      <Card title="🎡 Raffle draw">
        <p className="mb-3 text-sm text-emerald-900/70">Pick a giveaway. Everyone who entered with a valid entry goes on the wheel. Spin to draw winners one by one; the server picks at random and the wheel stops on that code. Winners show in the top bar.</p>
        {gives.length ? (
          <select className="nk-input font-normal" value={sel ?? ''} onChange={(e) => { setSel(+e.target.value); setResult(null); }}>
            {gives.map((x) => <option key={x.id} value={x.id}>{x.title} · {x.prize || '—'} · {when(x.created_at)}{x.is_on ? ' · ON' : ''}</option>)}
          </select>
        ) : <p className="text-sm text-emerald-900/60">No giveaways yet. Create one in Top notice → Giveaway.</p>}
      </Card>

      {g && (
        <>
          <Card title="🏅 Winners and prizes" actions={<Btn onClick={savePrizes}>Save prizes</Btn>}>
            <div className="mb-3 flex flex-wrap items-center gap-2 text-sm">
              <b>Winners:</b>
              {[1, 2, 3, 5, 10].map((n) => <Btn key={n} kind={count === n ? 'gold' : 'ghost'} className="px-2.5! py-1! text-xs!" onClick={() => setCountTo(n)}>{n}</Btn>)}
              <input type="number" min={1} max={100} className="nk-input w-20 py-1! font-normal" value={count} onChange={(e) => setCountTo(+e.target.value)} aria-label="Custom number of winners" />
            </div>
            <div className="grid gap-2">
              {prizes.slice(0, count).map((p, i) => (
                <div key={i} className="grid items-center gap-2 sm:grid-cols-[4rem_1fr_9rem]">
                  <b className="text-sm">#{i + 1}</b>
                  <input className="nk-input py-1.5! font-normal" value={p.prize} onChange={(e) => setPrizes(prizes.map((x, j) => (j === i ? { ...x, prize: e.target.value } : x)))} placeholder="Prize, e.g. ৫০টি Key or a book" />
                  <input type="number" min={0} className="nk-input py-1.5! font-normal" value={p.keys ?? ''} onChange={(e) => setPrizes(prizes.map((x, j) => (j === i ? { ...x, keys: e.target.value ? +e.target.value : null } : x)))} placeholder="Keys (optional)" />
                </div>
              ))}
            </div>
          </Card>

          <Card title={`🎡 Wheel (${wheel.length} on the wheel · ${winners.length}/${count} drawn)`}>
            <Wheel items={wheel} rotation={rotation} spinning={spinning} />
            <div className="mt-4 flex flex-col items-center gap-2">
              <button type="button" onClick={spin} disabled={spinning || !wheel.length || winners.length >= count}
                className="nk-btn nk-gold px-8 py-3 text-lg disabled:opacity-50">{spinning ? 'ঘুরছে…' : winners.length >= count ? 'All winners drawn' : `🎲 Spin for winner #${winners.length + 1}`}</button>
              {result && !spinning && (
                <div className="w-full max-w-md rounded-2xl bg-emerald-900 px-5 py-4 text-center text-white shadow-lg">
                  <div className="text-sm text-gold-100">🎉 Winner #{result.place}</div>
                  <div className="mt-1 font-mono text-2xl font-bold text-gold-100">{result.code}</div>
                  <div className="text-base font-semibold">{result.fb_name}</div>
                  {result.prize && <div className="mt-1 text-sm text-emerald-100">🎁 {result.prize}</div>}
                </div>
              )}
            </div>
          </Card>

          <Card title={`🏆 Drawn winners (${winners.length})`} actions={<Btn kind="ghost" onClick={loadData}>Refresh</Btn>}>
            <div className="grid gap-2">
              {winners.map((w) => {
                const a = award[w.id] ?? { keys: w.keys ?? 50, hours: 0 };
                return (
                  <article key={w.id} className="grid gap-2 rounded-xl border border-gold-500/50 bg-gold-100/30 p-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-emerald-900 px-2.5 py-0.5 text-xs font-bold text-gold-100">#{w.place}</span>
                      <b className="font-mono">{w.code}</b>
                      <span>{w.fb_name}</span>
                      {w.prize && <span className="text-sm text-emerald-900/70">· 🎁 {w.prize}</span>}
                      <button type="button" className="ml-auto text-xs font-semibold text-red-700 underline" onClick={() => removeWinner(w)}>Remove</button>
                    </div>
                    {w.awarded_at ? (
                      <div className="text-sm font-semibold text-emerald-800">✓ {w.keys} Keys given ({w.award_mode === 'instant' ? 'instant' : `over ${w.award_mode}`}) · {when(w.awarded_at)}</div>
                    ) : (
                      <div className="flex flex-wrap items-center gap-2 text-sm">
                        <span>Give</span>
                        <input type="number" min={1} max={1000} className="nk-input w-20 py-1! font-normal" value={a.keys} onChange={(e) => setAward({ ...award, [w.id]: { ...a, keys: +e.target.value } })} />
                        <span>Keys</span>
                        <select className="nk-input w-auto py-1! font-normal" value={a.hours} onChange={(e) => setAward({ ...award, [w.id]: { ...a, hours: +e.target.value } })}>
                          <option value={0}>instantly (top of the page)</option>
                          {[1, 2, 3, 6, 12, 24].map((h) => <option key={h} value={h}>within {h} hour{h > 1 ? 's' : ''}</option>)}
                        </select>
                        <Btn kind="gold" className="px-3! py-1!" onClick={() => giveKeys(w)}>🎁 Give Keys</Btn>
                      </div>
                    )}
                  </article>
                );
              })}
              {!winners.length && <p className="text-sm text-emerald-900/60">No winners drawn yet. Spin the wheel.</p>}
            </div>
            <p className="mt-3 text-xs text-emerald-900/60">"Instantly" puts the code at the very top until it gets the Keys (usually within minutes). "Within N hours" spreads the copies evenly over that time. Before giving a prize, check the winner's Facebook name and share link in Top notice → Giveaway → Entries.</p>
          </Card>
        </>
      )}
    </div>
  );
}
