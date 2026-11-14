/* Nusuk Manager → Live screen: settings for the OBS broadcast page (/nusuk/live).
   Saved in nusuk_settings.content.livescreen; the live page checks them every 10 seconds,
   so changes show on the stream by themselves (no need to touch OBS). */
import { useEffect, useMemo, useState } from 'react';
import { supabase as sb } from '@/lib/supabase';
import { DEFAULT_BREAKING_LABEL, THEMES, defaultLiveCfg, parseLiveCfg, themeAt, type BkItem, type BkSpeed, type Breaking, type LiveCfg, type Slot, type Theme } from '../_lib/livecfg';

type ToastFn = (t: string, ok?: boolean) => void;
const errText = (e: unknown) => (e && typeof e === 'object' && 'message' in e ? String((e as { message: string }).message) : String(e));
const PANELS: { key: string; label: string }[] = [
  { key: 'feed', label: '⚡ Live activity feed' },
  { key: 'quiz', label: '🎯 Quiz (numbers + leaderboard)' },
  { key: 'featured', label: '★ Featured codes' },
  { key: 'winner', label: '🎉 Latest winner + countdown' },
  { key: 'ticker', label: '📢 Scrolling ticker at the bottom' },
];
const SWATCH: Record<Theme, [string, string]> = {
  green: ['linear-gradient(135deg,#0a4a37,#032b20)', '#f2c94c'],
  mint: ['linear-gradient(135deg,#eef8f2,#cfeadb)', '#0b5a43'],
  cream: ['linear-gradient(135deg,#fffaf0,#f1e8d2)', '#0a7a59'],
  navy: ['linear-gradient(135deg,#18264a,#060b17)', '#4fe3d0'],
};
const themeName = (t: Theme) => THEMES.find((x) => x.key === t)?.name ?? t;

function ThemeCard({ t, on, onClick, small = false }: { t: Theme; on: boolean; onClick: () => void; small?: boolean }) {
  const [bg, dot] = SWATCH[t];
  return (
    <button type="button" role="radio" aria-checked={on} onClick={onClick}
      className={`overflow-hidden rounded-xl border-2 text-left transition ${on ? 'border-emerald-600 ring-2 ring-emerald-600/20' : 'border-[#e7e1cf] hover:border-emerald-600/40'}`}>
      <span className={`flex items-end gap-1 p-2 ${small ? 'h-7' : 'h-12'}`} style={{ background: bg }}>
        <span className="h-3 w-6 rounded-sm" style={{ background: dot }} /><span className="h-4 w-3 rounded-sm" style={{ background: dot, opacity: 0.7 }} />{!small && <span className="h-7 w-3 rounded-sm" style={{ background: dot }} />}
      </span>
      <span className="block px-2 py-1 text-sm font-semibold">{themeName(t)}{on ? ' ✓' : ''}</span>
    </button>
  );
}

export default function LiveScreenPage({ toast }: { toast: ToastFn }) {
  const [c, setC] = useState<LiveCfg>(defaultLiveCfg());
  const [loaded, setLoaded] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(Date.now());
  const [previewKey, setPreviewKey] = useState(0);
  // Normal live or the Reward Club raffle draw (nusuk_club_draw_state, update 34)
  const [draw, setDraw] = useState<{ mode: 'normal' | 'raffle' | 'winner'; contest_id: number | null; scope: string; title?: string } | null>(null);
  const loadDraw = async () => {
    const { data, error } = await sb!.from('nusuk_club_draw_state').select('mode,contest_id,scope').eq('id', 1).maybeSingle();
    if (error || !data) return setDraw(null);
    let title = '';
    if (data.contest_id) { const { data: c } = await sb!.from('nusuk_club_contests').select('title').eq('id', data.contest_id).maybeSingle(); title = c?.title ?? ''; }
    setDraw({ ...(data as { mode: 'normal' | 'raffle' | 'winner'; contest_id: number | null; scope: string }), title });
  };
  useEffect(() => { loadDraw(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  async function setDrawMode(mode: 'normal' | 'raffle' | 'winner') {
    if (mode === 'raffle' && !draw?.contest_id) return toast('First pick the draw in Reward Club → Raffle draw → "Show this draw on the live screen"', false);
    const { error } = await sb!.from('nusuk_club_draw_state').update({ mode, updated_at: new Date().toISOString() }).eq('id', 1);
    if (error) return toast(errText(error).includes('check') ? 'Run update_40_live_winner.sql in Supabase first' : errText(error), false);
    await loadDraw();
    toast(mode === 'raffle' ? 'Live screen: raffle draw (changes within 2 seconds)' : mode === 'winner' ? 'Live screen: winner announcement (changes within 2 seconds)' : 'Live screen: normal');
  }
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 15000); return () => clearInterval(t); }, []);
  useEffect(() => {
    sb!.from('nusuk_settings').select('content').eq('id', 1).single().then(({ data }) => {
      setC(parseLiveCfg((data?.content as Record<string, unknown> | null)?.livescreen));
      setLoaded(true);
    });
  }, []);
  const set = (p: Partial<LiveCfg>) => { setC((x) => ({ ...x, ...p })); setDirty(true); };
  const url = `${typeof location !== 'undefined' ? location.origin : ''}/nusuk/live`;
  const current = useMemo(() => themeAt(c, now), [c, now]);

  async function save() {
    setBusy(true);
    const { data, error: e1 } = await sb!.from('nusuk_settings').select('content').eq('id', 1).single();
    if (e1) { setBusy(false); return toast(errText(e1), false); }
    const content = { ...((data?.content as object) ?? {}), livescreen: c };
    const { error } = await sb!.from('nusuk_settings').update({ content, updated_at: new Date().toISOString() }).eq('id', 1);
    setBusy(false);
    if (error) return toast(errText(error), false);
    setDirty(false);
    setPreviewKey((k) => k + 1);
    toast('Saved · the live screen changes within 10 seconds');
  }
  const setSlot = (i: number, p: Partial<Slot>) => set({ schedule: c.schedule.map((s, j) => (j === i ? { ...s, ...p } : s)) });
  const setBk = (p: Partial<Breaking>) => set({ breaking: { ...c.breaking, ...p } });
  const setBkItem = (i: number, p: Partial<BkItem>) => setBk({ items: c.breaking.items.map((x, j) => (j === i ? { ...x, ...p } : x)) });
  const blank = (): BkItem => ({ text: '', on: true });
  const moveBk = (i: number, d: -1 | 1) => {
    const a = [...c.breaking.items];
    const j = i + d;
    if (j < 0 || j >= a.length) return;
    [a[i], a[j]] = [a[j], a[i]];
    setBk({ items: a });
  };
  const bkCount = c.breaking.items.filter((x) => x.on && x.text.trim()).length;
  const bkHidden = c.breaking.items.filter((x) => !x.on && x.text.trim()).length;
  const togglePanel = (k: string) => set({ hide: c.hide.includes(k) ? c.hide.filter((x) => x !== k) : [...c.hide, k] });
  const toggleRotate = (t: Theme) => {
    const has = c.rotate_themes.includes(t);
    if (has && c.rotate_themes.length === 1) return;
    set({ rotate_themes: has ? c.rotate_themes.filter((x) => x !== t) : THEMES.map((x) => x.key).filter((k) => k === t || c.rotate_themes.includes(k)) });
  };

  if (!loaded) return <section className="nk-card p-5 text-sm text-emerald-900/60">Loading…</section>;
  return (
    <div className="grid gap-4">
      <section className="nk-card p-4 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-emerald-950">📺 Live screen for Facebook &amp; YouTube live</h2>
            <p className="mt-1 max-w-3xl text-sm text-emerald-900/75">
              A full-screen broadcast page (1920×1080) that updates by itself. Settings below are saved here and the live screen checks them every 10 seconds,
              so you can change the theme or panels during a live and it changes on the stream. OBS keeps the same link.
            </p>
          </div>
          <button type="button" className="nk-btn nk-green px-4 py-2 text-sm" disabled={busy || !dirty} onClick={save}>{busy ? 'Saving…' : dirty ? 'Save' : 'Saved'}</button>
        </div>
        <div className="mt-4 grid gap-3 lg:grid-cols-[1fr_auto]">
          <input readOnly className="nk-input font-mono text-sm" value={url} onFocus={(e) => e.target.select()} aria-label="Live screen link" />
          <div className="flex gap-2">
            <button type="button" className="nk-btn nk-ghost px-4 py-2 text-sm" onClick={async () => { try { await navigator.clipboard.writeText(url); toast('Link copied'); } catch { toast('Copy failed, select the link and copy it', false); } }}>Copy link</button>
            <a href={url} target="_blank" rel="noopener" className="nk-btn nk-ghost px-4 py-2 text-sm">Open ↗</a>
          </div>
        </div>
        <p className="mt-2 text-xs text-emerald-900/60">Use this plain link in OBS. (Older links with ?theme= in them keep their own theme and ignore these settings.)</p>
      </section>

      <section className="nk-card p-4 sm:p-5">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-base font-bold text-emerald-950">🎨 Theme</h2>
          <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-900">On screen now: {themeName(current)}</span>
        </div>
        <div className="mb-4 grid gap-2 sm:grid-cols-3" role="radiogroup" aria-label="Theme mode">
          {([
            ['fixed', 'One theme', 'Always the theme you pick.'],
            ['schedule', 'By time of day', 'Each theme from a start time you set (Bangladesh time).'],
            ['rotate', 'Change every…', 'Goes through the themes you tick, every N minutes.'],
          ] as const).map(([k, t, h]) => (
            <button key={k} type="button" role="radio" aria-checked={c.mode === k} onClick={() => set({ mode: k })}
              className={`rounded-xl border p-3 text-left transition ${c.mode === k ? 'border-emerald-600 bg-emerald-50 ring-2 ring-emerald-600/20' : 'border-[#e7e1cf] bg-white hover:border-emerald-600/40'}`}>
              <div className="font-bold">{t}{c.mode === k ? ' ✓' : ''}</div>
              <div className="mt-0.5 text-xs text-emerald-900/65">{h}</div>
            </button>
          ))}
        </div>

        {c.mode === 'fixed' && (
          <div className="grid max-w-2xl grid-cols-2 gap-2 sm:grid-cols-4" role="radiogroup" aria-label="Theme">
            {THEMES.map((t) => <ThemeCard key={t.key} t={t.key} on={c.theme === t.key} onClick={() => set({ theme: t.key })} />)}
          </div>
        )}

        {c.mode === 'schedule' && (
          <div className="grid gap-2">
            {c.schedule.map((s, i) => (
              <div key={i} className="flex flex-wrap items-center gap-3 rounded-xl border border-[#e7e1cf] bg-cream p-2.5">
                <label className="flex items-center gap-2 text-sm font-semibold">From
                  <input type="time" className="nk-input w-32 py-1.5! font-normal" value={s.from} onChange={(e) => e.target.value && setSlot(i, { from: e.target.value })} />
                </label>
                <div className="grid flex-1 grid-cols-2 gap-2 sm:grid-cols-4" role="radiogroup" aria-label={`Theme from ${s.from}`}>
                  {THEMES.map((t) => <ThemeCard key={t.key} small t={t.key} on={s.theme === t.key} onClick={() => setSlot(i, { theme: t.key })} />)}
                </div>
                {c.schedule.length > 1 && <button type="button" className="nk-btn nk-ghost px-2.5 py-1 text-xs text-red-700" onClick={() => set({ schedule: c.schedule.filter((_, j) => j !== i) })}>Remove</button>}
              </div>
            ))}
            <div className="flex flex-wrap gap-2">
              {c.schedule.length < 8 && <button type="button" className="nk-btn nk-ghost px-3 py-1.5 text-xs" onClick={() => set({ schedule: [...c.schedule, { from: '12:00', theme: 'green' }] })}>+ Add a time</button>}
              <button type="button" className="nk-btn nk-ghost px-3 py-1.5 text-xs" onClick={() => set({ schedule: defaultLiveCfg().schedule })}>8 hours each (6 AM · 2 PM · 10 PM)</button>
            </div>
            <p className="text-xs text-emerald-900/60">Each theme stays until the next start time; after the last one it continues through the night until the first one the next day.</p>
          </div>
        )}

        {c.mode === 'rotate' && (
          <div className="grid gap-3">
            <label className="flex flex-wrap items-center gap-2 text-sm font-semibold">Change every
              <input type="number" min={1} max={1440} className="nk-input w-24 py-1.5! font-normal" value={c.rotate_min} onChange={(e) => set({ rotate_min: Math.min(1440, Math.max(1, Math.round(+e.target.value) || 1)) })} />
              minutes
              <span className="flex gap-1.5">{[5, 15, 30, 60, 480].map((m) => <button key={m} type="button" className="nk-btn nk-ghost px-2 py-1 text-xs" onClick={() => set({ rotate_min: m })}>{m >= 60 ? `${m / 60} h` : `${m} min`}</button>)}</span>
            </label>
            <div>
              <div className="mb-1.5 text-sm font-semibold">Themes to use</div>
              <div className="grid max-w-2xl grid-cols-2 gap-2 sm:grid-cols-4">
                {THEMES.map((t) => <ThemeCard key={t.key} t={t.key} on={c.rotate_themes.includes(t.key)} onClick={() => toggleRotate(t.key)} />)}
              </div>
            </div>
          </div>
        )}
      </section>

      <section className="nk-card p-4 sm:p-5">
        <h2 className="mb-3 text-base font-bold text-emerald-950">What to show</h2>
        <div className="grid gap-2 sm:grid-cols-2">
          {PANELS.map((p) => (
            <label key={p.key} className="flex items-center gap-2.5 text-sm">
              <input type="checkbox" className="h-4 w-4 accent-emerald-700" checked={!c.hide.includes(p.key)} onChange={() => togglePanel(p.key)} />
              {p.label}
            </label>
          ))}
        </div>
        <label className="mt-4 grid max-w-xl gap-1 text-sm font-semibold">Headline (optional)
          <input className="nk-input font-normal" maxLength={80} value={c.title} onChange={(e) => set({ title: e.target.value })} placeholder="নুসুক উমরাহ কোড শেয়ার · লাইভ" />
        </label>
      </section>

      <section className="nk-card grid gap-3 p-4 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-emerald-950">🔴 Breaking news</h2>
            <p className="mt-0.5 text-sm text-emerald-900/70">A news-channel style bar above the yellow ticker. The headlines run right to left through the bar, one after another, and start again after the last one. Shows on every view (normal, raffle, winner).</p>
          </div>
          <div className="flex items-center gap-2">
            <label className="flex items-center gap-2 text-sm font-semibold">
              <input type="checkbox" className="h-4 w-4 accent-red-600" checked={c.breaking.on} onChange={(e) => setBk({ on: e.target.checked })} /> Show on the live screen
            </label>
            <button type="button" className="nk-btn nk-green px-4 py-2 text-sm" disabled={busy || !dirty} onClick={save}>{busy ? 'Saving…' : dirty ? 'Save' : 'Saved'}</button>
          </div>
        </div>
        <div className="grid gap-2">
          {c.breaking.items.map((t, i) => (
            <div key={i} className={`flex items-center gap-2 ${t.on ? '' : 'opacity-60'}`}>
              <span className="w-6 shrink-0 text-right text-sm font-bold text-red-700">{i + 1}.</span>
              <input className={`nk-input flex-1 ${t.on ? '' : 'line-through'}`} maxLength={200} value={t.text} placeholder={i === 0 ? 'যেমন: আজ রাত ৯টায় নতুন বিজয়ী ঘোষণা, লাইভে থাকুন!' : 'আরেকটি খবর লিখুন'}
                onChange={(e) => setBkItem(i, { text: e.target.value })}
                onKeyDown={(e) => { if (e.key === 'Enter' && c.breaking.items.length < 20) { e.preventDefault(); setBk({ items: [...c.breaking.items.slice(0, i + 1), blank(), ...c.breaking.items.slice(i + 1)] }); } }} />
              <button type="button" onClick={() => setBkItem(i, { on: !t.on })} aria-pressed={!t.on}
                className={`nk-btn shrink-0 px-2.5 py-1.5 text-xs ${t.on ? 'nk-ghost' : 'border border-gold-500 bg-gold-400/25 text-emerald-950'}`}>{t.on ? 'Hide' : 'Hidden · show'}</button>
              <button type="button" className="nk-btn nk-ghost px-2 py-1.5 text-xs" disabled={i === 0} onClick={() => moveBk(i, -1)} aria-label="Move up">↑</button>
              <button type="button" className="nk-btn nk-ghost px-2 py-1.5 text-xs" disabled={i === c.breaking.items.length - 1} onClick={() => moveBk(i, 1)} aria-label="Move down">↓</button>
              <button type="button" className="nk-btn nk-ghost px-2 py-1.5 text-xs text-red-700" onClick={() => setBk({ items: c.breaking.items.length > 1 ? c.breaking.items.filter((_, j) => j !== i) : [blank()] })} aria-label="Remove">✕</button>
            </div>
          ))}
          {c.breaking.items.length < 20 && (
            <button type="button" className="nk-btn nk-ghost w-fit px-3 py-1.5 text-sm" onClick={() => setBk({ items: [...c.breaking.items, blank()] })}>+ Add new</button>
          )}
        </div>
        <div className="flex flex-wrap items-end gap-4">
          <label className="grid gap-1 text-sm font-semibold">Label
            <input className="nk-input w-56 font-normal" maxLength={30} value={c.breaking.label} placeholder={DEFAULT_BREAKING_LABEL} onChange={(e) => setBk({ label: e.target.value })} />
          </label>
          <div className="grid gap-1 text-sm font-semibold">Speed
            <div className="flex gap-1 rounded-xl border border-[#e7e1cf] bg-white p-1" role="radiogroup" aria-label="Speed">
              {([['slow', 'Slow'], ['normal', 'Normal'], ['fast', 'Fast']] as [BkSpeed, string][]).map(([k, t]) => (
                <button key={k} type="button" role="radio" aria-checked={c.breaking.speed === k} onClick={() => setBk({ speed: k })}
                  className={`rounded-lg px-3 py-1.5 text-sm ${c.breaking.speed === k ? 'bg-red-600 font-bold text-white' : 'font-semibold text-emerald-900 hover:bg-emerald-50'}`}>{t}</button>
              ))}
            </div>
          </div>
          <p className="text-xs text-emerald-900/60">{bkCount} on the stream{bkHidden ? ` · ${bkHidden} hidden` : ''} · Enter in a box adds a new line · press Save, the stream changes within 10 seconds.</p>
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-[1fr_22rem]">
        <section className="nk-card p-4 sm:p-5">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-base font-bold text-emerald-950">Preview {dirty && <span className="text-xs font-normal text-gold-600">(save to update)</span>}</h2>
            {draw && (
              <div className="flex gap-1 rounded-xl border border-[#e7e1cf] bg-white p-1" role="tablist" aria-label="What the live screen shows">
                {([['normal', 'Normal live'], ['raffle', 'Raffle draw live'], ['winner', 'Winner live']] as const).map(([k, t]) => (
                  <button key={k} type="button" role="tab" aria-selected={draw.mode === k} onClick={() => draw.mode !== k && setDrawMode(k)}
                    className={`rounded-lg px-3.5 py-1.5 text-sm font-semibold ${draw.mode === k ? (k === 'raffle' ? 'bg-red-600 text-white' : k === 'winner' ? 'bg-gold-500 text-emerald-950' : 'bg-emerald-900 text-white') : 'text-emerald-900 hover:bg-emerald-50'}`}>{t}</button>
                ))}
              </div>
            )}
          </div>
          {draw && (
            <p className="mb-3 text-xs text-emerald-900/65">
              <b>Winner live:</b> Nusuk's official winner, full screen, with the countdown to the next announcement. Save a new winner in <a href="#/today" className="font-semibold underline">Winners → Today's winner</a> and the live screen announces it (with confetti) within a few seconds.{' '}
              <b>Raffle draw live:</b> {draw.contest_id ? <><b>{draw.title}</b> · {draw.scope === 'all' ? 'whole competition' : draw.scope}; </> : 'no draw chosen yet; '}
              set it up in <a href="#/club" className="font-semibold underline">Reward Club → Raffle draw</a>.
            </p>
          )}
          <div className="relative w-full overflow-hidden rounded-xl border border-[#e7e1cf] bg-black" style={{ aspectRatio: '16 / 9' }}>
            <iframe key={previewKey} src={url} title="Live screen preview" className="absolute inset-0 h-full w-full border-0" />
          </div>
        </section>
        <section className="nk-card p-4 sm:p-5">
          <h2 className="mb-3 text-base font-bold text-emerald-950">Set up in OBS (once)</h2>
          <ol className="grid list-decimal gap-1.5 pl-5 text-sm text-emerald-950/85">
            <li>OBS → <b>Sources</b> → <b>+</b> → <b>Browser</b>.</li>
            <li>Paste the link above in <b>URL</b>.</li>
            <li><b>Width 1920</b>, <b>Height 1080</b>.</li>
            <li>Settings → Video: <b>1920×1080</b>.</li>
            <li>Settings → Stream: <b>Facebook Live</b> or <b>YouTube</b>, paste the stream key.</li>
            <li>Start Streaming.</li>
          </ol>
        </section>
      </div>
    </div>
  );
}
