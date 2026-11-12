/* Nusuk Manager → Live screen: settings for the OBS broadcast page (/nusuk/live).
   Saved in nusuk_settings.content.livescreen; the live page checks them every 10 seconds,
   so changes show on the stream by themselves (no need to touch OBS). */
import { useEffect, useMemo, useState } from 'react';
import { supabase as sb } from '@/lib/supabase';
import { THEMES, defaultLiveCfg, parseLiveCfg, themeAt, type LiveCfg, type Slot, type Theme } from '../_lib/livecfg';

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
          <div className="grid max-w-xl grid-cols-3 gap-2" role="radiogroup" aria-label="Theme">
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
                <div className="grid flex-1 grid-cols-3 gap-2" role="radiogroup" aria-label={`Theme from ${s.from}`}>
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
              <div className="grid max-w-xl grid-cols-3 gap-2">
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

      <div className="grid gap-4 lg:grid-cols-[1fr_22rem]">
        <section className="nk-card p-4 sm:p-5">
          <h2 className="mb-3 text-base font-bold text-emerald-950">Preview {dirty && <span className="text-xs font-normal text-gold-600">(save to update)</span>}</h2>
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
