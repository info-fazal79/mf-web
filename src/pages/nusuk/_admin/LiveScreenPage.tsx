/* Nusuk Manager → Live screen: the "studio" for the OBS broadcast page (/nusuk/live).
   Top: the preview and the controller (live view, TV program auto / by hand, scenes, pop-ups, music).
   Below: folded sections for everything that goes on screen. Saved in nusuk_settings.content.livescreen;
   the live page checks it every 5 seconds, so changes reach the stream by themselves. */
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { ArrowDown, ArrowUp, ChevronDown, Copy, ExternalLink, EyeOff, Music2, Play, Plus, Radio, Trash2, Upload } from 'lucide-react';
import { supabase as sb } from '@/lib/supabase';
import { uploadMedia } from '@/admin/media';
import {
  DEFAULT_ANNOUNCE, DEFAULT_BREAKING_LABEL, LSHAPE_MODES, SAMPLE_QUESTIONS, SCENES, THEMES, defaultLiveCfg, lshapeClashes, parseLiveCfg, themeAt, uid, videoClashes, ytId,
  type Announce, type BkItem, type BkSpeed, type Breaking, type Fx, type LiveCfg, type Notice, type Promo, type Scene, type SceneKey, type Slot, type Theme, type Track, type Video,
} from '../_lib/livecfg';

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
const sceneInfo = (k: SceneKey) => SCENES.find((x) => x.key === k)!;
/** Where each scene's settings live: a folded section below, or another page of Nusuk Manager */
const SCENE_PLACE: Record<SceneKey, string> = { home: 'sec-main', stats: 'sec-main', winners: '#/winners', lastwin: '#/today', join: 'sec-join', video: 'sec-videos' };
function jump(to: string) {
  if (to.startsWith('#/')) { location.hash = to.slice(1); return; }
  const el = document.getElementById(to) as HTMLDetailsElement | null;
  if (!el) return;
  el.open = true;
  el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  el.classList.add('ring-2', 'ring-gold-500');
  setTimeout(() => el.classList.remove('ring-2', 'ring-gold-500'), 1600);
}

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

/** A folded section (closed until opened) */
function Sec({ id, title, badge, hint, children }: { id?: string; title: ReactNode; badge?: ReactNode; hint?: string; children: ReactNode }) {
  return (
    <details id={id} className="nk-card group scroll-mt-4 overflow-hidden p-0">
      <summary className="flex cursor-pointer list-none items-center gap-3 px-4 py-3.5 sm:px-5 [&::-webkit-details-marker]:hidden">
        <span className="text-base font-bold text-emerald-950">{title}</span>
        {badge}
        {hint && <span className="hidden text-xs text-emerald-900/55 md:inline">{hint}</span>}
        <ChevronDown className="ml-auto h-5 w-5 shrink-0 text-emerald-900/50 transition group-open:rotate-180" aria-hidden />
      </summary>
      <div className="grid gap-3 border-t border-[#eee7d3] px-4 py-4 sm:px-5">{children}</div>
    </details>
  );
}
const OnAir = () => <span className="rounded-full bg-red-600 px-2 py-0.5 text-[11px] font-bold text-white">● ON SCREEN</span>;
function Switch({ on, set, label }: { on: boolean; set: (v: boolean) => void; label: ReactNode }) {
  return (
    <button type="button" role="switch" aria-checked={on} onClick={() => set(!on)} className="flex items-center gap-2.5 text-sm font-semibold">
      <span className={`relative h-6 w-11 rounded-full transition ${on ? 'bg-emerald-600' : 'bg-emerald-900/20'}`}><span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${on ? 'left-[22px]' : 'left-0.5'}`} /></span>
      {label}
    </button>
  );
}
const field = 'grid gap-1 text-sm font-semibold';
const input = 'nk-input font-normal';

export default function LiveScreenPage({ toast }: { toast: ToastFn }) {
  const [c, setC] = useState<LiveCfg>(defaultLiveCfg());
  const [loaded, setLoaded] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(Date.now());
  const [previewKey, setPreviewKey] = useState(0);
  const [upBusy, setUpBusy] = useState('');
  // Normal live, Reward Club raffle draw or Winner live (nusuk_club_draw_state, update 34 / 40)
  const [draw, setDraw] = useState<{ mode: 'normal' | 'raffle' | 'winner'; contest_id: number | null; scope: string; title?: string } | null>(null);
  const loadDraw = async () => {
    const { data, error } = await sb!.from('nusuk_club_draw_state').select('mode,contest_id,scope').eq('id', 1).maybeSingle();
    if (error || !data) return setDraw(null);
    let title = '';
    if (data.contest_id) { const { data: x } = await sb!.from('nusuk_club_contests').select('title').eq('id', data.contest_id).maybeSingle(); title = x?.title ?? ''; }
    setDraw({ ...(data as { mode: 'normal' | 'raffle' | 'winner'; contest_id: number | null; scope: string }), title });
  };
  useEffect(() => { loadDraw(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  async function setDrawMode(mode: 'normal' | 'raffle' | 'winner') {
    if (mode === 'raffle' && !draw?.contest_id) return toast('First pick the draw in Reward Club → Raffle draw → "Show this draw on the live screen"', false);
    const { error } = await sb!.from('nusuk_club_draw_state').update({ mode, updated_at: new Date().toISOString() }).eq('id', 1);
    if (error) return toast(errText(error).includes('check') ? 'Run update_40_live_winner.sql in Supabase first' : errText(error), false);
    await loadDraw();
    toast(mode === 'raffle' ? 'Live screen: raffle draw' : mode === 'winner' ? 'Live screen: winner announcement' : 'Live screen: normal');
  }
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 15000); return () => clearInterval(t); }, []);
  useEffect(() => {
    sb!.from('nusuk_settings').select('content').eq('id', 1).single().then(({ data }) => {
      setC(parseLiveCfg((data?.content as Record<string, unknown> | null)?.livescreen));
      setLoaded(true);
    });
  }, []);
  // a running save; edits made meanwhile are saved by the next one
  const saving = useRef(false);
  const set = (p: Partial<LiveCfg>) => { setC((x) => ({ ...x, ...p })); setDirty(true); };
  const url = `${typeof location !== 'undefined' ? location.origin : ''}/nusuk/live`;
  const current = useMemo(() => themeAt(c, now), [c, now]);

  async function save(next: LiveCfg = c, quiet = false) {
    const clash = [...lshapeClashes(next.promos), ...videoClashes(next.videos)];
    if (clash.length) return toast(`Promo times clash: ${clash[0].msg}. Change one of the times first.`, false);
    if (saving.current) await new Promise((r) => setTimeout(r, 300));
    saving.current = true;
    setBusy(true);
    const { data, error: e1 } = await sb!.from('nusuk_settings').select('content').eq('id', 1).single();
    if (e1) { saving.current = false; setBusy(false); return toast(errText(e1), false); }
    const content = { ...((data?.content as object) ?? {}), livescreen: next };
    const { error } = await sb!.from('nusuk_settings').update({ content, updated_at: new Date().toISOString() }).eq('id', 1);
    saving.current = false;
    setBusy(false);
    if (error) return toast(errText(error), false);
    setDirty(false);
    if (!quiet) toast('Saved · the live screen changes within 5 seconds');
  }
  /** Controller buttons: change and save at once (with any other edits) */
  function now_(p: Partial<LiveCfg>, msg?: string) {
    const next = { ...c, ...p };
    setC(next);
    save(next, true).then(() => msg && toast(msg));
  }

  // ---------- small list helpers ----------
  const move = <T,>(a: T[], i: number, d: -1 | 1) => { const b = [...a]; const j = i + d; if (j < 0 || j >= b.length) return b; [b[i], b[j]] = [b[j], b[i]]; return b; };
  const setScene = (k: SceneKey, p: Partial<Scene>) => set({ tv: { ...c.tv, scenes: c.tv.scenes.map((s) => (s.key === k ? { ...s, ...p } : s)) } });
  const setSlot = (i: number, p: Partial<Slot>) => set({ schedule: c.schedule.map((s, j) => (j === i ? { ...s, ...p } : s)) });
  const setBk = (p: Partial<Breaking>) => set({ breaking: { ...c.breaking, ...p } });
  const setBkItem = (i: number, p: Partial<BkItem>) => setBk({ items: c.breaking.items.map((x, j) => (j === i ? { ...x, ...p } : x)) });
  const blankBk = (): BkItem => ({ text: '', on: true });
  const setQ = (p: Partial<LiveCfg['questions']>) => set({ questions: { ...c.questions, ...p } });
  const setAn = (i: number, p: Partial<Announce>) => set({ announces: c.announces.map((a, j) => (j === i ? { ...a, ...p } : a)) });
  const setNt = (id: string, p: Partial<Notice>) => set({ notices: c.notices.map((n) => (n.id === id ? { ...n, ...p } : n)) });
  const setPr = (id: string, p: Partial<Promo>) => set({ promos: c.promos.map((x) => (x.id === id ? { ...x, ...p } : x)) });
  const setVd = (id: string, p: Partial<Video>) => set({ videos: c.videos.map((x) => (x.id === id ? { ...x, ...p } : x)) });
  const setTr = (id: string, p: Partial<Track>) => set({ music: { ...c.music, tracks: c.music.tracks.map((x) => (x.id === id ? { ...x, ...p } : x)) } });
  const togglePanel = (k: string) => set({ hide: c.hide.includes(k) ? c.hide.filter((x) => x !== k) : [...c.hide, k] });
  const toggleRotate = (t: Theme) => {
    const has = c.rotate_themes.includes(t);
    if (has && c.rotate_themes.length === 1) return;
    set({ rotate_themes: has ? c.rotate_themes.filter((x) => x !== t) : THEMES.map((x) => x.key).filter((k) => k === t || c.rotate_themes.includes(k)) });
  };
  async function upload(file: File, folder: string, done: (u: string) => void) {
    setUpBusy(folder);
    try { const m = await uploadMedia(file, folder); done(m.url); toast('Uploaded'); } catch (e) { toast(`Upload failed: ${errText(e)}`, false); }
    setUpBusy('');
  }

  // what is on screen now
  const anOn = c.announce_show != null ? c.announces[c.announce_show] : null;
  const ntOn = c.notices.find((n) => n.id === c.notice_show) ?? null;
  const qOn = c.questions.show != null ? c.questions.items[c.questions.show] : null;
  const ready = (k: SceneKey) => (k === 'video' ? c.videos.some((v) => v.on && ytId(v.url)) : true);
  const clashes = lshapeClashes(c.promos);
  const promoList = c.promos.filter((p) => p.on && (p.title.trim() || p.text.trim()));
  const vClashes = videoClashes(c.videos);
  const vidList = c.videos.filter((v) => v.on && ytId(v.url));
  /** a time picker row used by promos and videos */
  const timesRow = (times: string[], setTimes: (t: string[]) => void, bad: (t: string) => boolean) => (
    <div className="flex flex-wrap items-center gap-1.5 text-sm">
      {times.map((t, k) => (
        <span key={k} className={`flex items-center gap-0.5 rounded-lg border px-1 ${bad(t) ? 'border-red-500 bg-red-50' : 'border-[#d9d2bd] bg-white'}`}>
          <input type="time" className="bg-transparent py-0.5 text-sm" value={t} onChange={(e) => e.target.value && setTimes(times.map((x, j) => (j === k ? e.target.value : x)).sort())} />
          <button type="button" className="px-1 text-red-700" onClick={() => setTimes(times.filter((_, j) => j !== k))} aria-label="Remove time">✕</button>
        </span>
      ))}
      {times.length < 24 && <button type="button" className="nk-btn nk-ghost px-2 py-1 text-xs" onClick={() => {
        const h = new Date(Date.now() + 6 * 3600e3).getUTCHours() + 1;
        for (let k = 0; k < 24; k++) { const t = `${String((h + k) % 24).padStart(2, '0')}:00`; if (!times.includes(t)) { setTimes([...times, t].sort()); break; } }
      }}>+ time</button>}
      <span className="text-[11px] text-emerald-900/55">(Bangladesh time)</span>
    </div>
  );
  const onAirScene: SceneKey | null = draw?.mode === 'raffle' ? null : c.tv.auto ? null : c.tv.pin;

  if (!loaded) return <section className="nk-card p-5 text-sm text-emerald-900/60">Loading…</section>;
  return (
    <div className="grid gap-4 pb-16">
      {/* ============================================================ studio */}
      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,27rem)]">
        <section className="nk-card grid gap-3 p-3 sm:p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="flex items-center gap-2 text-base font-bold text-emerald-950"><Radio className="h-5 w-5 text-red-600" aria-hidden /> Live screen · preview</h2>
            <div className="flex flex-wrap gap-2">
              <button type="button" className="nk-btn nk-ghost flex items-center gap-1.5 px-3 py-1.5 text-sm" onClick={async () => { try { await navigator.clipboard.writeText(url); toast('Link copied (paste it in OBS → Browser source)'); } catch { toast(url, false); } }}><Copy className="h-4 w-4" aria-hidden /> Copy OBS link</button>
              <a href={url} target="_blank" rel="noopener" className="nk-btn nk-ghost flex items-center gap-1.5 px-3 py-1.5 text-sm"><ExternalLink className="h-4 w-4" aria-hidden /> Open</a>
              <button type="button" className="nk-btn nk-ghost px-3 py-1.5 text-sm" onClick={() => setPreviewKey((k) => k + 1)}>Reload preview</button>
            </div>
          </div>
          <div className="relative w-full overflow-hidden rounded-xl border border-[#e7e1cf] bg-black" style={{ aspectRatio: '16 / 9' }}>
            <iframe key={previewKey} src={`${url}?preview=1`} title="Live screen preview" className="absolute inset-0 h-full w-full border-0" />
          </div>
          <p className="text-xs text-emerald-900/60">The preview is silent (music and videos play only on the real stream). Changes show here within 5 seconds.</p>
        </section>

        {/* ---------- controller ---------- */}
        <section className="nk-card grid min-w-0 grid-cols-[minmax(0,1fr)] gap-4 overflow-hidden p-4">
          <div>
            <div className="mb-1.5 text-xs font-bold tracking-wide text-emerald-900/60 uppercase">Live view</div>
            <div className="grid grid-cols-3 gap-1 rounded-xl border border-[#e7e1cf] bg-white p-1" role="tablist" aria-label="What the live screen shows">
              {([['normal', 'Normal'], ['raffle', 'Raffle draw'], ['winner', 'Winner']] as const).map(([k, t]) => (
                <button key={k} type="button" role="tab" aria-selected={draw?.mode === k} disabled={!draw} onClick={() => draw && draw.mode !== k && setDrawMode(k)}
                  className={`rounded-lg px-2 py-1.5 text-sm font-semibold ${draw?.mode === k ? (k === 'raffle' ? 'bg-red-600 text-white' : k === 'winner' ? 'bg-gold-500 text-emerald-950' : 'bg-emerald-900 text-white') : 'text-emerald-900 hover:bg-emerald-50'}`}>{t}</button>
              ))}
            </div>
            {draw?.mode === 'raffle' && <p className="mt-1 rounded-lg bg-red-50 px-2 py-1.5 text-xs font-semibold text-red-800">Raffle draw "{draw.title || '—'}" has the whole screen. The TV program below waits until you go back to Normal or Winner.</p>}
            {draw?.mode === 'winner' && <p className="mt-1 text-xs text-emerald-900/65">Winner view is the <b>Main screen</b>; the TV program below runs over it.</p>}
          </div>

          <div className="grid gap-2">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-bold tracking-wide text-emerald-900/60 uppercase">TV program</span>
              <select className="rounded-lg border border-[#d9d2bd] bg-white px-2 py-1 text-xs font-semibold text-emerald-950" value={c.tv.fx} onChange={(e) => now_({ tv: { ...c.tv, fx: e.target.value as Fx } })} aria-label="Change effect">
                <option value="fade">Effect: fade</option><option value="slide">Effect: slide</option><option value="zoom">Effect: zoom</option>
              </select>
            </div>
            <div className="grid grid-cols-2 gap-1 rounded-xl border border-[#e7e1cf] bg-white p-1">
              <button type="button" onClick={() => now_({ tv: { ...c.tv, auto: true } }, 'Auto: the scenes follow one another')} className={`rounded-lg px-2 py-2 text-sm font-bold ${c.tv.auto ? 'bg-emerald-900 text-white' : 'text-emerald-900 hover:bg-emerald-50'}`}>⟳ Auto</button>
              <button type="button" onClick={() => now_({ tv: { ...c.tv, auto: false } }, 'By hand: press ▶ on a scene')} className={`rounded-lg px-2 py-2 text-sm font-bold ${!c.tv.auto ? 'bg-emerald-900 text-white' : 'text-emerald-900 hover:bg-emerald-50'}`}>✋ By hand</button>
            </div>
            <p className="text-xs text-emerald-900/60">{c.tv.auto ? <>Ticked scenes play from top to bottom, then start again. The number next to each scene = <b>how many seconds that scene stays on screen</b> (for the winners: seconds for <b>each</b> winner). Press <b>Save</b> after changing them. ▶ = show that scene now (switches to By hand).</> : 'The scene with ● stays on screen until you press ▶ on another one.'}</p>
            <ol className="grid gap-1">
              {c.tv.scenes.map((s, i) => {
                const info = sceneInfo(s.key);
                const air = onAirScene === s.key;
                return (
                  <li key={s.key} className={`flex items-center gap-1.5 rounded-xl border px-2 py-1.5 ${air ? 'border-red-500 bg-red-50' : 'border-[#eee7d3]'} ${c.tv.auto && !s.on ? 'opacity-55' : ''}`}>
                    {c.tv.auto && <input type="checkbox" className="h-4 w-4 accent-emerald-700" checked={s.on} onChange={(e) => setScene(s.key, { on: e.target.checked })} aria-label={`Use ${info.name}`} />}
                    <button type="button" className="min-w-0 flex-1 text-left" title={`${info.hint} · click to open its settings`} onClick={() => jump(SCENE_PLACE[s.key])}>
                      <div className="truncate text-sm font-semibold hover:underline">{air && <span className="text-red-600">● </span>}{info.name}</div>
                      {!ready(s.key) && <div className="text-[11px] text-gold-600">Add a video below</div>}
                    </button>
                    {c.tv.auto && (s.key !== 'video'
                      ? <label className="flex shrink-0 items-center gap-1 text-[11px] text-emerald-900/60" title="How long this scene stays on screen"><input type="number" min={5} max={3600} className="rounded-md border border-[#d9d2bd] bg-white px-1 py-0.5 text-right text-xs font-semibold text-emerald-950" style={{ width: 52 }} value={s.secs} onChange={(e) => setScene(s.key, { secs: Math.max(5, Math.round(+e.target.value) || 5) })} aria-label={`Seconds for ${info.name}`} />{s.key === 'winners' ? 's each' : 's'}</label>
                      : <span className="shrink-0 text-[11px] text-emerald-900/50">till end</span>)}
                    {c.tv.auto && <>
                      <button type="button" className="nk-btn nk-ghost px-1 py-1" disabled={i === 0} onClick={() => set({ tv: { ...c.tv, scenes: move(c.tv.scenes, i, -1) } })} aria-label="Move up"><ArrowUp className="h-3.5 w-3.5" /></button>
                      <button type="button" className="nk-btn nk-ghost px-1 py-1" disabled={i === c.tv.scenes.length - 1} onClick={() => set({ tv: { ...c.tv, scenes: move(c.tv.scenes, i, 1) } })} aria-label="Move down"><ArrowDown className="h-3.5 w-3.5" /></button>
                    </>}
                    <button type="button" disabled={!ready(s.key)} onClick={() => now_({ tv: { ...c.tv, auto: false, pin: s.key } }, `On screen: ${info.name}`)}
                      className={`nk-btn px-2 py-1 ${air ? 'bg-red-600 text-white' : 'nk-green'}`} aria-label={`Show ${info.name} now`}><Play className="h-3.5 w-3.5" fill="currentColor" /></button>
                  </li>
                );
              })}
            </ol>
          </div>

          <div className={`grid gap-2 rounded-xl border p-2.5 ${c.lshape.mode !== 'off' ? 'border-gold-500 bg-gold-400/10' : 'border-[#e7e1cf]'}`}>
            <div className="flex items-center justify-between gap-2">
              <button type="button" className="text-xs font-bold tracking-wide text-emerald-900/60 uppercase hover:underline" onClick={() => jump('sec-promos')}>L-shape ads ↓</button>
              <span className="text-[11px] text-emerald-900/55">{promoList.length} promo{promoList.length === 1 ? '' : 's'} ready</span>
            </div>
            <div className="grid grid-cols-4 gap-1 rounded-xl border border-[#e7e1cf] bg-white p-1">
              {LSHAPE_MODES.map((m) => (
                <button key={m.key} type="button" title={m.hint} onClick={() => {
                  if (m.key === 'schedule' && clashes.length) return toast(`Fix the clashing promo times first: ${clashes[0].msg}`, false);
                  now_({ lshape: { ...c.lshape, mode: m.key, show: m.key === 'manual' ? c.lshape.show : null } }, `L-shape: ${m.name}`);
                }} className={`rounded-lg px-1 py-1.5 text-xs font-bold ${c.lshape.mode === m.key ? (m.key === 'off' ? 'bg-emerald-900 text-white' : 'bg-gold-500 text-emerald-950') : 'text-emerald-900 hover:bg-emerald-50'}`}>{m.name}</button>
              ))}
            </div>
            <p className="text-[11px] text-emerald-900/60">{LSHAPE_MODES.find((m) => m.key === c.lshape.mode)?.hint}. Works over every scene; the screen shrinks to the top right while an ad is on.</p>
            {c.lshape.mode === 'manual' && (promoList.length ? (
              <ul className="grid gap-1">
                {promoList.map((p) => {
                  const on = c.lshape.show === p.id;
                  return (
                    <li key={p.id} className={`flex items-center gap-2 rounded-lg px-2 py-1 ${on ? 'bg-red-50 ring-1 ring-red-400' : ''}`}>
                      <span className="min-w-0 flex-1 truncate text-sm">{on && <span className="text-red-600">● </span>}{p.title || p.text}</span>
                      <button type="button" onClick={() => now_({ lshape: { ...c.lshape, show: on ? null : p.id } }, on ? 'L-shape hidden' : 'L-shape on screen')} className={`nk-btn px-2.5 py-1 text-xs ${on ? 'bg-red-600 text-white' : 'nk-green'}`}>{on ? 'Hide' : 'Show'}</button>
                    </li>
                  );
                })}
              </ul>
            ) : <p className="text-xs text-gold-600">Add a promo below first.</p>)}
            {c.lshape.mode === 'rotate' && (
              <label className="flex items-center gap-2 text-xs font-semibold">Full screen between two promos
                <input type="number" min={0} max={86400} className="rounded-md border border-[#d9d2bd] bg-white px-1 py-0.5 text-right text-xs" style={{ width: 64 }} value={c.lshape.gap} onChange={(e) => set({ lshape: { ...c.lshape, gap: Math.max(0, Math.round(+e.target.value) || 0) } })} />s
                <span className="font-normal text-emerald-900/55">(each promo stays for its own seconds)</span>
              </label>
            )}
            {c.lshape.mode === 'schedule' && <p className="text-xs text-emerald-900/70">Times are set on each promo below (Bangladesh time). {clashes.length ? <b className="text-red-700">{clashes.length} clash{clashes.length === 1 ? '' : 'es'} to fix.</b> : 'No clashes.'}</p>}
          </div>

          <div className={`grid gap-2 rounded-xl border p-2.5 ${c.vplay.mode !== 'off' ? 'border-sky-400 bg-sky-50/60' : 'border-[#e7e1cf]'}`}>
            <div className="flex items-center justify-between gap-2">
              <button type="button" className="text-xs font-bold tracking-wide text-emerald-900/60 uppercase hover:underline" onClick={() => jump('sec-videos')}>Videos ↓</button>
              <span className="text-[11px] text-emerald-900/55">{vidList.length} video{vidList.length === 1 ? '' : 's'} ready</span>
            </div>
            <div className="grid grid-cols-3 gap-1 rounded-xl border border-[#e7e1cf] bg-white p-1">
              {([['off', 'Off', 'Videos never cut in'], ['manual', 'By hand', 'Press Play on a video: it cuts in over the screen and plays to the end'], ['schedule', 'At set times', 'Each video starts at its own times and plays to the end']] as const).map(([k, t, h]) => (
                <button key={k} type="button" title={h} onClick={() => {
                  if (k === 'schedule' && vClashes.length) return toast(`Fix the video times first: ${vClashes[0].msg}`, false);
                  now_({ vplay: { ...c.vplay, mode: k } }, `Videos: ${t}`);
                }} className={`rounded-lg px-1 py-1.5 text-xs font-bold ${c.vplay.mode === k ? (k === 'off' ? 'bg-emerald-900 text-white' : 'bg-sky-600 text-white') : 'text-emerald-900 hover:bg-emerald-50'}`}>{t}</button>
              ))}
            </div>
            <p className="text-[11px] text-emerald-900/60">A video cuts in over whatever is on screen, plays to the end, then the scenes go on where they were. Music pauses meanwhile.</p>
            {c.vplay.mode === 'manual' && (vidList.length ? (
              <ul className="grid gap-1">
                {vidList.map((v) => (
                  <li key={v.id} className="flex items-center gap-2 rounded-lg px-1 py-0.5">
                    <span className="min-w-0 flex-1 truncate text-sm">{v.title || v.url}</span>
                    {c.vplay.show === v.id && Date.now() - c.vplay.at < 10 * 60e3 && <span className="text-[11px] text-sky-700">started {new Date(c.vplay.at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</span>}
                    <button type="button" onClick={() => now_({ vplay: { mode: 'manual', show: v.id, at: Date.now() } }, 'Video starts within 5 seconds')} className="nk-btn flex items-center gap-1 bg-sky-600 px-2.5 py-1 text-xs text-white"><Play className="h-3 w-3" fill="currentColor" /> Play</button>
                  </li>
                ))}
              </ul>
            ) : <p className="text-xs text-gold-600">Add a video below first.</p>)}
            {c.vplay.mode === 'schedule' && <p className="text-xs text-emerald-900/70">Times are set on each video below. {vClashes.length ? <b className="text-red-700">{vClashes.length} clash{vClashes.length === 1 ? '' : 'es'} to fix.</b> : 'No clashes.'}</p>}
          </div>

          <div className="grid gap-1.5 rounded-xl border border-[#e7e1cf] bg-cream/50 p-2.5 text-sm">
            <div className="text-xs font-bold tracking-wide text-emerald-900/60 uppercase">Pop-ups on screen</div>
            <div className="flex items-center justify-between gap-2"><span className="min-w-0 truncate">📣 {anOn ? <b>{anOn.title || 'Announcement'}</b> : <span className="text-emerald-900/50">no announcement</span>}</span>{anOn && <button type="button" className="text-xs font-bold text-red-700 underline" onClick={() => now_({ announce_show: null })}>Hide</button>}</div>
            <div className="flex items-center justify-between gap-2"><span className="min-w-0 truncate">🔔 {ntOn ? <b>{ntOn.title || 'Notice'}</b> : <span className="text-emerald-900/50">no notice</span>}</span>{ntOn && <button type="button" className="text-xs font-bold text-red-700 underline" onClick={() => now_({ notice_show: null })}>Hide</button>}</div>
            <div className="flex items-center justify-between gap-2"><span className="min-w-0 truncate">💬 {qOn ? <b>{qOn}</b> : <span className="text-emerald-900/50">no question</span>}</span>{qOn && <button type="button" className="text-xs font-bold text-red-700 underline" onClick={() => now_({ questions: { ...c.questions, show: null } })}>Hide</button>}</div>
            {(anOn || ntOn || qOn) && <button type="button" className="nk-btn mt-1 flex items-center justify-center gap-1.5 border border-red-300 bg-white py-1.5 text-xs text-red-700" onClick={() => now_({ announce_show: null, notice_show: null, questions: { ...c.questions, show: null } }, 'All pop-ups hidden')}><EyeOff className="h-3.5 w-3.5" /> Hide all pop-ups</button>}
          </div>

          <div className="grid gap-2 rounded-xl border border-[#e7e1cf] p-2.5">
            <div className="flex items-center justify-between gap-2">
              <Switch on={c.music.on} set={(v) => now_({ music: { ...c.music, on: v } }, v ? 'Music on' : 'Music off')} label={<span className="flex items-center gap-1.5"><Music2 className="h-4 w-4" aria-hidden /> Background music</span>} />
              <span className="text-xs text-emerald-900/60">{c.music.tracks.filter((t) => t.on && t.url).length} tracks</span>
            </div>
            <label className="flex items-center gap-2 text-xs font-semibold">Volume
              <input type="range" min={0} max={100} value={c.music.volume} className="flex-1 accent-emerald-700" onChange={(e) => setC((x) => ({ ...x, music: { ...x.music, volume: +e.target.value } }))} onMouseUp={() => now_({})} onTouchEnd={() => now_({})} />
              <b className="w-8 text-right tabular-nums">{c.music.volume}</b>
            </label>
          </div>
        </section>
      </div>

      {/* ============================================================ folded sections */}
      <Sec title="🎨 Theme" badge={<span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-bold text-emerald-900">now: {themeName(current)}</span>}>
        <div className="grid gap-2 sm:grid-cols-3" role="radiogroup" aria-label="Theme mode">
          {([['fixed', 'One theme', 'Always the theme you pick.'], ['schedule', 'By time of day', 'Each theme from a start time (Bangladesh time).'], ['rotate', 'Change every…', 'Goes through the themes you tick.']] as const).map(([k, t, h]) => (
            <button key={k} type="button" role="radio" aria-checked={c.mode === k} onClick={() => set({ mode: k })}
              className={`rounded-xl border p-3 text-left transition ${c.mode === k ? 'border-emerald-600 bg-emerald-50 ring-2 ring-emerald-600/20' : 'border-[#e7e1cf] bg-white hover:border-emerald-600/40'}`}>
              <div className="font-bold">{t}{c.mode === k ? ' ✓' : ''}</div><div className="mt-0.5 text-xs text-emerald-900/65">{h}</div>
            </button>
          ))}
        </div>
        {c.mode === 'fixed' && <div className="grid max-w-2xl grid-cols-2 gap-2 sm:grid-cols-4" role="radiogroup" aria-label="Theme">{THEMES.map((t) => <ThemeCard key={t.key} t={t.key} on={c.theme === t.key} onClick={() => set({ theme: t.key })} />)}</div>}
        {c.mode === 'schedule' && (
          <div className="grid gap-2">
            {c.schedule.map((s, i) => (
              <div key={i} className="flex flex-wrap items-center gap-3 rounded-xl border border-[#e7e1cf] bg-cream p-2.5">
                <label className="flex items-center gap-2 text-sm font-semibold">From<input type="time" className="nk-input w-32 py-1.5! font-normal" value={s.from} onChange={(e) => e.target.value && setSlot(i, { from: e.target.value })} /></label>
                <div className="grid flex-1 grid-cols-2 gap-2 sm:grid-cols-4">{THEMES.map((t) => <ThemeCard key={t.key} small t={t.key} on={s.theme === t.key} onClick={() => setSlot(i, { theme: t.key })} />)}</div>
                {c.schedule.length > 1 && <button type="button" className="nk-btn nk-ghost px-2.5 py-1 text-xs text-red-700" onClick={() => set({ schedule: c.schedule.filter((_, j) => j !== i) })}>Remove</button>}
              </div>
            ))}
            <div className="flex flex-wrap gap-2">
              {c.schedule.length < 8 && <button type="button" className="nk-btn nk-ghost px-3 py-1.5 text-xs" onClick={() => set({ schedule: [...c.schedule, { from: '12:00', theme: 'green' }] })}>+ Add a time</button>}
              <button type="button" className="nk-btn nk-ghost px-3 py-1.5 text-xs" onClick={() => set({ schedule: defaultLiveCfg().schedule })}>8 hours each</button>
            </div>
          </div>
        )}
        {c.mode === 'rotate' && (
          <div className="grid gap-3">
            <label className="flex flex-wrap items-center gap-2 text-sm font-semibold">Change every
              <input type="number" min={1} max={1440} className="nk-input w-24 py-1.5! font-normal" value={c.rotate_min} onChange={(e) => set({ rotate_min: Math.min(1440, Math.max(1, Math.round(+e.target.value) || 1)) })} /> minutes</label>
            <div className="grid max-w-2xl grid-cols-2 gap-2 sm:grid-cols-4">{THEMES.map((t) => <ThemeCard key={t.key} t={t.key} on={c.rotate_themes.includes(t.key)} onClick={() => toggleRotate(t.key)} />)}</div>
          </div>
        )}
      </Sec>

      <Sec id="sec-main" title="🧩 Main screen & live numbers" hint="panels of the main dashboard, headline">
        <div className="grid gap-2 sm:grid-cols-2">
          {PANELS.map((p) => <label key={p.key} className="flex items-center gap-2.5 text-sm"><input type="checkbox" className="h-4 w-4 accent-emerald-700" checked={!c.hide.includes(p.key)} onChange={() => togglePanel(p.key)} />{p.label}</label>)}
        </div>
        <label className={`${field} max-w-xl`}>Headline (optional)<input className={input} maxLength={80} value={c.title} onChange={(e) => set({ title: e.target.value })} placeholder="নুসুক উমরাহ কোড শেয়ার · লাইভ" /></label>
      </Sec>

      <Sec title="🔴 Breaking news" badge={c.breaking.on ? <OnAir /> : undefined} hint="bar above the yellow ticker">
        <Switch on={c.breaking.on} set={(v) => set({ breaking: { ...c.breaking, on: v } })} label="Show the breaking news bar" />
        <div className="grid gap-2">
          {c.breaking.items.map((t, i) => (
            <div key={i} className={`flex items-center gap-2 ${t.on ? '' : 'opacity-60'}`}>
              <span className="w-6 shrink-0 text-right text-sm font-bold text-red-700">{i + 1}.</span>
              <input className={`nk-input flex-1 ${t.on ? '' : 'line-through'}`} maxLength={200} value={t.text} placeholder="খবর লিখুন" onChange={(e) => setBkItem(i, { text: e.target.value })}
                onKeyDown={(e) => { if (e.key === 'Enter' && c.breaking.items.length < 20) { e.preventDefault(); setBk({ items: [...c.breaking.items.slice(0, i + 1), blankBk(), ...c.breaking.items.slice(i + 1)] }); } }} />
              <button type="button" onClick={() => setBkItem(i, { on: !t.on })} className={`nk-btn shrink-0 px-2.5 py-1.5 text-xs ${t.on ? 'nk-ghost' : 'border border-gold-500 bg-gold-400/25'}`}>{t.on ? 'Hide' : 'Hidden · show'}</button>
              <button type="button" className="nk-btn nk-ghost px-2 py-1.5 text-xs" disabled={i === 0} onClick={() => setBk({ items: move(c.breaking.items, i, -1) })} aria-label="Move up">↑</button>
              <button type="button" className="nk-btn nk-ghost px-2 py-1.5 text-xs text-red-700" onClick={() => setBk({ items: c.breaking.items.length > 1 ? c.breaking.items.filter((_, j) => j !== i) : [blankBk()] })} aria-label="Remove">✕</button>
            </div>
          ))}
          {c.breaking.items.length < 20 && <button type="button" className="nk-btn nk-ghost w-fit px-3 py-1.5 text-sm" onClick={() => setBk({ items: [...c.breaking.items, blankBk()] })}>+ Add new</button>}
        </div>
        <div className="flex flex-wrap items-end gap-4">
          <label className={field}>Label<input className={`${input} w-56`} maxLength={30} value={c.breaking.label} placeholder={DEFAULT_BREAKING_LABEL} onChange={(e) => setBk({ label: e.target.value })} /></label>
          <div className={field}>Speed
            <div className="flex gap-1 rounded-xl border border-[#e7e1cf] bg-white p-1">
              {([['slow', 'Slow'], ['normal', 'Normal'], ['fast', 'Fast']] as [BkSpeed, string][]).map(([k, t]) => <button key={k} type="button" onClick={() => setBk({ speed: k })} className={`rounded-lg px-3 py-1.5 text-sm ${c.breaking.speed === k ? 'bg-red-600 font-bold text-white' : 'font-semibold text-emerald-900 hover:bg-emerald-50'}`}>{t}</button>)}
            </div>
          </div>
        </div>
      </Sec>

      <Sec title="📣 Announcements" badge={anOn ? <OnAir /> : <span className="text-xs text-emerald-900/55">{c.announces.length} draft{c.announces.length === 1 ? '' : 's'}</span>} hint="full screen; keep drafts, show one">
        {c.announces.map((a, i) => {
          const on = c.announce_show === i;
          return (
            <details key={i} className={`rounded-xl border ${on ? 'border-red-500 ring-2 ring-red-500/20' : 'border-[#e7e1cf]'} bg-white`} open={i === 0 && c.announces.length === 1}>
              <summary className="flex cursor-pointer list-none items-center gap-2 px-3 py-2.5 [&::-webkit-details-marker]:hidden">
                <b className="min-w-0 flex-1 truncate text-sm">{i + 1}. {a.title || 'Untitled'}</b>
                {on && <OnAir />}
                <button type="button" onClick={(e) => { e.preventDefault(); if (!on && !a.title.trim()) return toast('Write the heading first', false); now_({ announce_show: on ? null : i }, on ? 'Announcement hidden' : 'Announcement on screen'); }}
                  className={`nk-btn px-3 py-1 text-xs ${on ? 'bg-red-600 text-white' : 'nk-green'}`}>{on ? 'Hide' : 'Show'}</button>
              </summary>
              <div className="grid gap-3 border-t border-[#eee7d3] p-3">
                <div className="grid gap-3 lg:grid-cols-2">
                  <label className={field}>Tag<input className={input} maxLength={60} value={a.tag} onChange={(e) => setAn(i, { tag: e.target.value })} /></label>
                  <label className={field}>Bottom line<input className={input} maxLength={80} value={a.footer} onChange={(e) => setAn(i, { footer: e.target.value })} /></label>
                </div>
                <label className={field}>Heading<textarea className={input} rows={2} maxLength={160} value={a.title} onChange={(e) => setAn(i, { title: e.target.value })} /></label>
                <label className={field}>Text<textarea className={input} rows={3} maxLength={600} value={a.body} onChange={(e) => setAn(i, { body: e.target.value })} /></label>
                <label className={field}>Highlights <span className="text-xs font-normal text-emerald-900/60">one per line</span><textarea className={input} rows={3} value={a.points.join('\n')} onChange={(e) => setAn(i, { points: e.target.value.split('\n').slice(0, 6) })} /></label>
                <label className={field}>Ask for opinion<input className={input} maxLength={200} value={a.ask} onChange={(e) => setAn(i, { ask: e.target.value })} /></label>
                <label className={field}>Choices (answer with a number) <span className="text-xs font-normal text-emerald-900/60">one per line; empty = none</span><textarea className={input} rows={3} value={a.choices.join('\n')} onChange={(e) => setAn(i, { choices: e.target.value.split('\n').slice(0, 6) })} /></label>
                <div className="flex flex-wrap gap-2">
                  <button type="button" className="nk-btn nk-ghost px-3 py-1.5 text-xs" onClick={() => set({ announces: [...c.announces.slice(0, i + 1), { ...a, title: `${a.title} (copy)` }, ...c.announces.slice(i + 1)].slice(0, 20) })}>Duplicate</button>
                  <button type="button" className="nk-btn nk-ghost px-3 py-1.5 text-xs text-red-700" onClick={() => {
                    if (!confirm('Delete this announcement draft?')) return;
                    const list = c.announces.filter((_, j) => j !== i);
                    set({ announces: list.length ? list : [{ ...DEFAULT_ANNOUNCE, points: [], choices: [] }], announce_show: c.announce_show == null || c.announce_show === i ? null : c.announce_show > i ? c.announce_show - 1 : c.announce_show });
                  }}><Trash2 className="inline h-3.5 w-3.5" /> Delete</button>
                </div>
              </div>
            </details>
          );
        })}
        {c.announces.length < 20 && <button type="button" className="nk-btn nk-ghost flex w-fit items-center gap-1.5 px-3 py-1.5 text-sm" onClick={() => set({ announces: [...c.announces, { ...DEFAULT_ANNOUNCE, title: '', body: '', points: [], ask: '', choices: [], on: false }] })}><Plus className="h-4 w-4" /> New announcement</button>}
      </Sec>

      <Sec title="🔔 Notices" badge={ntOn ? <OnAir /> : undefined} hint="a card in the middle over the blurred screen">
        {c.notices.map((n) => {
          const on = c.notice_show === n.id;
          return (
            <div key={n.id} className={`grid gap-2 rounded-xl border p-3 ${on ? 'border-red-500 ring-2 ring-red-500/20' : 'border-[#e7e1cf]'}`}>
              <div className="grid gap-2 sm:grid-cols-[12rem_1fr]">
                <input className={input} maxLength={60} value={n.tag} placeholder="Tag, e.g. 📢 নোটিশ" onChange={(e) => setNt(n.id, { tag: e.target.value })} />
                <input className={`${input} font-semibold`} maxLength={140} value={n.title} placeholder="Heading" onChange={(e) => setNt(n.id, { title: e.target.value })} />
              </div>
              <textarea className={input} rows={2} maxLength={500} value={n.text} placeholder="Text (optional)" onChange={(e) => setNt(n.id, { text: e.target.value })} />
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={() => { if (!on && !n.title.trim()) return toast('Write the heading first', false); now_({ notice_show: on ? null : n.id }, on ? 'Notice hidden' : 'Notice on screen'); }} className={`nk-btn px-3 py-1.5 text-xs ${on ? 'bg-red-600 text-white' : 'nk-green'}`}>{on ? '● On screen · Hide' : 'Show'}</button>
                <button type="button" className="nk-btn nk-ghost px-3 py-1.5 text-xs text-red-700" onClick={() => set({ notices: c.notices.filter((x) => x.id !== n.id), notice_show: on ? null : c.notice_show })}><Trash2 className="inline h-3.5 w-3.5" /> Delete</button>
              </div>
            </div>
          );
        })}
        {c.notices.length < 20 && <button type="button" className="nk-btn nk-ghost flex w-fit items-center gap-1.5 px-3 py-1.5 text-sm" onClick={() => set({ notices: [...c.notices, { id: uid(), tag: '📢 নোটিশ', title: '', text: '' }] })}><Plus className="h-4 w-4" /> New notice</button>}
      </Sec>

      <Sec title="💬 Questions for the audience" badge={qOn ? <OnAir /> : undefined} hint="pops up at the top">
        {c.questions.items.map((q, i) => {
          const on = c.questions.show === i;
          return (
            <div key={i} className={`flex items-center gap-2 rounded-xl p-1.5 ${on ? 'bg-gold-400/20 ring-2 ring-gold-500' : ''}`}>
              <span className="w-6 shrink-0 text-right text-sm font-bold text-emerald-800">{i + 1}.</span>
              <input className="nk-input flex-1" maxLength={200} value={q} onChange={(e) => setQ({ items: c.questions.items.map((x, j) => (j === i ? e.target.value : x)) })} placeholder="আপনার প্রশ্ন লিখুন" />
              <button type="button" onClick={() => { if (!on && !q.trim()) return toast('Write the question first', false); now_({ questions: { ...c.questions, show: on ? null : i } }); }} className={`nk-btn shrink-0 px-3 py-1.5 text-xs ${on ? 'bg-red-600 text-white' : 'nk-green'}`}>{on ? '● Hide' : 'Show'}</button>
              <button type="button" className="nk-btn nk-ghost px-2 py-1.5 text-xs text-red-700" onClick={() => setQ({ items: c.questions.items.length > 1 ? c.questions.items.filter((_, j) => j !== i) : [''], show: c.questions.show == null || c.questions.show === i ? null : c.questions.show > i ? c.questions.show - 1 : c.questions.show })} aria-label="Remove">✕</button>
            </div>
          );
        })}
        <div className="flex flex-wrap gap-2">
          {c.questions.items.length < 30 && <button type="button" className="nk-btn nk-ghost w-fit px-3 py-1.5 text-sm" onClick={() => setQ({ items: [...c.questions.items, ''] })}>+ Add question</button>}
          <button type="button" className="nk-btn nk-ghost w-fit px-3 py-1.5 text-sm" onClick={() => setQ({ items: [...c.questions.items, ...SAMPLE_QUESTIONS.filter((s) => !c.questions.items.includes(s))].slice(0, 30) })}>+ Sample questions</button>
        </div>
      </Sec>

      <Sec id="sec-promos" title="📢 Promo ads (L-shape)" badge={c.lshape.mode !== 'off' ? <span className="rounded-full bg-gold-500 px-2 py-0.5 text-[11px] font-bold text-emerald-950">{LSHAPE_MODES.find((m) => m.key === c.lshape.mode)?.name}</span> : undefined} hint="over any scene: the screen shrinks, the ad fills the left and bottom">
        <p className="text-xs text-emerald-900/60">When the L-shape comes is set in the controller (<b>By hand</b>, <b>Take turns</b> or <b>At set times</b>). Each promo: how long it stays, and its own opening times for "At set times". Left: tag, heading, picture, text. Bottom: the points and the site link.</p>
        {clashes.length > 0 && <div className="rounded-xl border border-red-300 bg-red-50 p-3 text-sm text-red-800"><b>These times clash</b> (one promo would open while another is still on screen). Saving is blocked until they are fixed:<ul className="mt-1 list-disc pl-5">{clashes.map((x, k) => <li key={k}>{x.msg}</li>)}</ul></div>}
        {c.promos.map((p, i) => (
          <div key={p.id} className={`grid gap-2 rounded-xl border border-[#e7e1cf] p-3 ${p.on ? '' : 'opacity-60'}`}>
            <div className="flex flex-wrap items-center gap-2">
              <Switch on={p.on} set={(v) => setPr(p.id, { on: v })} label={<b>Promo {i + 1}</b>} />
              <button type="button" className="nk-btn nk-ghost ml-auto px-2 py-1 text-xs" disabled={i === 0} onClick={() => set({ promos: move(c.promos, i, -1) })}>↑</button>
              <button type="button" className="nk-btn nk-ghost px-2 py-1 text-xs text-red-700" onClick={() => set({ promos: c.promos.filter((x) => x.id !== p.id) })}><Trash2 className="h-3.5 w-3.5" /></button>
            </div>
            <div className="grid gap-2 sm:grid-cols-[12rem_1fr]">
              <input className={input} maxLength={60} value={p.tag} placeholder="Tag, e.g. 🎁 আসছে" onChange={(e) => setPr(p.id, { tag: e.target.value })} />
              <input className={`${input} font-semibold`} maxLength={140} value={p.title} placeholder="Heading" onChange={(e) => setPr(p.id, { title: e.target.value })} />
            </div>
            <textarea className={input} rows={2} maxLength={500} value={p.text} placeholder="Text" onChange={(e) => setPr(p.id, { text: e.target.value })} />
            <textarea className={input} rows={2} value={p.points.join('\n')} placeholder={'Points for the bottom bar, one per line\nযেমন: আকর্ষণীয় পুরস্কার'} onChange={(e) => setPr(p.id, { points: e.target.value.split('\n').slice(0, 6) })} />
            <label className={field}>QR code link <span className="text-xs font-normal text-emerald-900/60">optional · e.g. your Facebook group; a QR code appears on the ad</span>
              <input className={`${input} font-mono text-xs`} maxLength={500} value={p.qr} placeholder="https://www.facebook.com/groups/…" onChange={(e) => setPr(p.id, { qr: e.target.value })} /></label>
            <div className="grid gap-2 rounded-lg bg-cream/60 p-2.5 sm:grid-cols-[auto_1fr] sm:items-start">
              <label className="flex items-center gap-2 text-sm font-semibold">Stays on screen
                <input type="number" min={5} max={3600} className="rounded-md border border-[#d9d2bd] bg-white px-1.5 py-1 text-right text-sm" style={{ width: 70 }} value={p.secs} onChange={(e) => setPr(p.id, { secs: Math.max(5, Math.round(+e.target.value) || 5) })} />s</label>
              <div className="flex flex-wrap items-center gap-1.5 text-sm">
                <span className="font-semibold">Opens at</span>
                {p.times.map((t, k) => {
                  const bad = clashes.some((x) => x.id === p.id && x.t === t);
                  return (
                    <span key={k} className={`flex items-center gap-0.5 rounded-lg border px-1 ${bad ? 'border-red-500 bg-red-50' : 'border-[#d9d2bd] bg-white'}`}>
                      <input type="time" className="bg-transparent py-0.5 text-sm" value={t} onChange={(e) => e.target.value && setPr(p.id, { times: p.times.map((x, j) => (j === k ? e.target.value : x)).sort() })} />
                      <button type="button" className="px-1 text-red-700" onClick={() => setPr(p.id, { times: p.times.filter((_, j) => j !== k) })} aria-label="Remove time">✕</button>
                    </span>
                  );
                })}
                {p.times.length < 24 && <button type="button" className="nk-btn nk-ghost px-2 py-1 text-xs" onClick={() => {
                  // next free hour that does not clash
                  const used = new Set(p.times);
                  let h = new Date(Date.now() + 6 * 3600e3).getUTCHours() + 1;
                  let t = '';
                  for (let k = 0; k < 24; k++) { const c2 = `${String((h + k) % 24).padStart(2, '0')}:00`; if (!used.has(c2)) { t = c2; break; } }
                  if (t) setPr(p.id, { times: [...p.times, t].sort() });
                }}>+ time</button>}
                <span className="text-[11px] text-emerald-900/55">(for "At set times", Bangladesh time)</span>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {p.image && <img src={p.image} alt="" className="h-12 w-12 rounded-lg border border-[#e7e1cf] object-contain" />}
              <label className="nk-btn nk-ghost flex cursor-pointer items-center gap-1.5 px-3 py-1.5 text-xs"><Upload className="h-3.5 w-3.5" />{upBusy === 'nusuk-promo' ? 'Uploading…' : p.image ? 'Change picture' : 'Picture'}
                <input type="file" accept="image/*" hidden onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) upload(f, 'nusuk-promo', (u) => setPr(p.id, { image: u })); }} /></label>
              {p.image && <button type="button" className="text-xs text-red-700 underline" onClick={() => setPr(p.id, { image: '' })}>Remove picture</button>}
            </div>
          </div>
        ))}
        {c.promos.length < 20 && <button type="button" className="nk-btn nk-ghost flex w-fit items-center gap-1.5 px-3 py-1.5 text-sm" onClick={() => set({ promos: [...c.promos, { id: uid(), on: true, tag: '🎁 আসছে', title: '', text: '', points: [], image: '', secs: 30, times: [], qr: '' }] })}><Plus className="h-4 w-4" /> New promo</button>}
      </Sec>

      <Sec id="sec-videos" title="▶️ Videos" hint="YouTube tutorials, played one after another">
        <p className="text-xs text-emerald-900/60">Paste YouTube links (watch, youtu.be or shorts). When a video plays is set in the controller: <b>By hand</b> (Play) or <b>At set times</b> (the times on each video below). A video always plays to the end, then the scenes go on.</p>
        {vClashes.length > 0 && <div className="rounded-xl border border-red-300 bg-red-50 p-3 text-sm text-red-800"><b>Two videos have the same time.</b> Saving is blocked until it is fixed:<ul className="mt-1 list-disc pl-5">{vClashes.map((x, k) => <li key={k}>{x.msg}</li>)}</ul></div>}
        {c.videos.map((v, i) => {
          const id = ytId(v.url);
          return (
            <div key={v.id} className={`flex flex-wrap items-center gap-2 rounded-xl border border-[#e7e1cf] p-2 ${v.on ? '' : 'opacity-60'}`}>
              {id ? <img src={`https://i.ytimg.com/vi/${id}/mqdefault.jpg`} alt="" className="h-12 w-20 rounded-md object-cover" /> : <span className="grid h-12 w-20 place-items-center rounded-md bg-emerald-50 text-xs text-emerald-900/50">no video</span>}
              <div className="grid min-w-0 flex-1 gap-1.5">
                <input className={`${input} py-1.5`} maxLength={120} value={v.title} placeholder="Title (shown on screen)" onChange={(e) => setVd(v.id, { title: e.target.value })} />
                <input className={`${input} py-1.5 font-mono text-xs`} maxLength={300} value={v.url} placeholder="https://www.youtube.com/watch?v=…" onChange={(e) => setVd(v.id, { url: e.target.value })} />
              </div>
              <Switch on={v.on} set={(x) => setVd(v.id, { on: x })} label="" />
              <button type="button" className="nk-btn nk-ghost px-2 py-1 text-xs" disabled={i === 0} onClick={() => set({ videos: move(c.videos, i, -1) })}>↑</button>
              <button type="button" className="nk-btn nk-ghost px-2 py-1 text-xs text-red-700" onClick={() => set({ videos: c.videos.filter((x) => x.id !== v.id) })}><Trash2 className="h-3.5 w-3.5" /></button>
              <div className="flex w-full flex-wrap items-center gap-2 rounded-lg bg-cream/60 px-2 py-1.5"><span className="text-sm font-semibold">Plays at</span>{timesRow(v.times, (t) => setVd(v.id, { times: t }), (t) => vClashes.some((x) => x.id === v.id && x.t === t))}</div>
            </div>
          );
        })}
        {c.videos.length < 30 && <button type="button" className="nk-btn nk-ghost flex w-fit items-center gap-1.5 px-3 py-1.5 text-sm" onClick={() => set({ videos: [...c.videos, { id: uid(), on: true, title: '', url: '', times: [] }] })}><Plus className="h-4 w-4" /> Add video</button>}
      </Sec>

      <Sec title="🎵 Background music" badge={c.music.on ? <OnAir /> : undefined} hint="instead of OBS; tracks play one after another and loop">
        <p className="text-xs text-emerald-900/60">Upload MP3 files or paste a direct link to an audio file. In OBS tick <b>Control audio via OBS</b> on the Browser source to set its level there too. Use only music you have the right to play.</p>
        {c.music.tracks.map((t, i) => (
          <div key={t.id} className={`flex flex-wrap items-center gap-2 rounded-xl border border-[#e7e1cf] p-2 ${t.on ? '' : 'opacity-60'}`}>
            <span className="w-6 text-right text-sm font-bold text-emerald-800">{i + 1}.</span>
            <div className="grid min-w-0 flex-1 gap-1.5">
              <input className={`${input} py-1.5`} maxLength={120} value={t.title} placeholder="Name" onChange={(e) => setTr(t.id, { title: e.target.value })} />
              <input className={`${input} py-1.5 font-mono text-xs`} maxLength={500} value={t.url} placeholder="https://…/music.mp3" onChange={(e) => setTr(t.id, { url: e.target.value })} />
            </div>
            {t.url && <audio src={t.url} controls preload="none" className="h-8 w-48" />}
            <Switch on={t.on} set={(x) => setTr(t.id, { on: x })} label="" />
            <button type="button" className="nk-btn nk-ghost px-2 py-1 text-xs" disabled={i === 0} onClick={() => set({ music: { ...c.music, tracks: move(c.music.tracks, i, -1) } })}>↑</button>
            <button type="button" className="nk-btn nk-ghost px-2 py-1 text-xs text-red-700" onClick={() => set({ music: { ...c.music, tracks: c.music.tracks.filter((x) => x.id !== t.id) } })}><Trash2 className="h-3.5 w-3.5" /></button>
          </div>
        ))}
        <div className="flex flex-wrap gap-2">
          <label className="nk-btn nk-ghost flex cursor-pointer items-center gap-1.5 px-3 py-1.5 text-sm"><Upload className="h-4 w-4" />{upBusy === 'nusuk-music' ? 'Uploading…' : 'Upload MP3'}
            <input type="file" accept="audio/*" hidden onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) upload(f, 'nusuk-music', (u) => set({ music: { ...c.music, tracks: [...c.music.tracks, { id: uid(), on: true, title: f.name.replace(/\.[^.]+$/, ''), url: u }] } })); }} /></label>
          <button type="button" className="nk-btn nk-ghost flex items-center gap-1.5 px-3 py-1.5 text-sm" onClick={() => set({ music: { ...c.music, tracks: [...c.music.tracks, { id: uid(), on: true, title: '', url: '' }] } })}><Plus className="h-4 w-4" /> Add by link</button>
        </div>
      </Sec>

      <Sec id="sec-join" title="📱 Join scene: QR code + links" hint="your own QR link, heading, text and links">
        <label className={field}>Heading<input className={input} maxLength={100} value={c.join.title} onChange={(e) => set({ join: { ...c.join, title: e.target.value } })} /></label>
        <label className={field}>Text<textarea className={input} rows={2} maxLength={300} value={c.join.text} onChange={(e) => set({ join: { ...c.join, text: e.target.value } })} /></label>
        <label className={field}>QR code link <span className="text-xs font-normal text-emerald-900/60">the QR on screen opens this (empty = muhammadfazal.com/nusuk), e.g. your group</span>
          <input className={`${input} font-mono text-xs`} maxLength={500} value={c.join.qr} placeholder="https://muhammadfazal.com/nusuk" onChange={(e) => set({ join: { ...c.join, qr: e.target.value } })} /></label>
        <div className="grid gap-1.5">
          <span className="text-sm font-semibold">Links on screen</span>
          {c.join.links.map((l, i) => (
            <div key={i} className="flex items-center gap-2">
              <input className={`${input} w-40`} maxLength={40} value={l.label} placeholder="Facebook গ্রুপ" onChange={(e) => set({ join: { ...c.join, links: c.join.links.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)) } })} />
              <input className={`${input} flex-1 font-mono text-xs`} maxLength={200} value={l.url} placeholder="fb.com/groups/…" onChange={(e) => set({ join: { ...c.join, links: c.join.links.map((x, j) => (j === i ? { ...x, url: e.target.value } : x)) } })} />
              <button type="button" className="nk-btn nk-ghost px-2 py-1.5 text-xs text-red-700" onClick={() => set({ join: { ...c.join, links: c.join.links.filter((_, j) => j !== i) } })}>✕</button>
            </div>
          ))}
          {c.join.links.length < 6 && <button type="button" className="nk-btn nk-ghost w-fit px-3 py-1.5 text-xs" onClick={() => set({ join: { ...c.join, links: [...c.join.links, { label: '', url: '' }] } })}>+ Add link</button>}
        </div>
      </Sec>

      <Sec title="🛠 Set up in OBS (once)">
        <ol className="grid list-decimal gap-1.5 pl-5 text-sm text-emerald-950/85">
          <li>OBS → <b>Sources</b> → <b>+</b> → <b>Browser</b>; URL: <span className="font-mono">{url}</span></li>
          <li><b>Width 1920</b>, <b>Height 1080</b>; tick <b>Control audio via OBS</b> (for the music and videos).</li>
          <li>Settings → Video: <b>1920×1080</b>; Settings → Advanced: <b>Browser Source Hardware Acceleration</b> on.</li>
          <li>Settings → Stream: <b>Facebook Live</b> or <b>YouTube</b>, paste the stream key, then Start Streaming.</li>
        </ol>
      </Sec>

      {/* floating save */}
      {dirty && (
        <div className="fixed right-5 bottom-5 z-40 flex items-center gap-3 rounded-2xl border border-gold-500/60 bg-white px-4 py-3 shadow-2xl">
          <span className="text-sm font-semibold text-emerald-950">Unsaved changes</span>
          <button type="button" className="nk-btn nk-green px-5 py-2 text-sm" disabled={busy} onClick={() => save()}>{busy ? 'Saving…' : 'Save'}</button>
        </div>
      )}
    </div>
  );
}
