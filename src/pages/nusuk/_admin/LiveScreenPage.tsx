/* Nusuk Manager → Live screen: link + setup for the OBS broadcast page (/nusuk/live). */
import { useMemo, useState } from 'react';

type ToastFn = (t: string, ok?: boolean) => void;
const PANELS: { key: string; label: string }[] = [
  { key: 'feed', label: '⚡ Live activity feed' },
  { key: 'quiz', label: '🎯 Quiz (numbers + leaderboard)' },
  { key: 'featured', label: '★ Featured codes' },
  { key: 'winner', label: '🎉 Latest winner + countdown' },
  { key: 'ticker', label: '📢 Scrolling ticker at the bottom' },
];

export default function LiveScreenPage({ toast }: { toast: ToastFn }) {
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const [title, setTitle] = useState('');
  const url = useMemo(() => {
    const q = new URLSearchParams();
    if (hidden.size) q.set('hide', [...hidden].join(','));
    if (title.trim()) q.set('title', title.trim());
    const s = q.toString();
    return `${location.origin}/nusuk/live${s ? `?${s}` : ''}`;
  }, [hidden, title]);
  const toggle = (k: string) => setHidden((h) => { const n = new Set(h); n.has(k) ? n.delete(k) : n.add(k); return n; });

  return (
    <div className="grid gap-4">
      <section className="nk-card p-4 sm:p-5">
        <h2 className="text-base font-bold text-emerald-950">📺 Live screen for Facebook &amp; YouTube live</h2>
        <p className="mt-1 max-w-3xl text-sm text-emerald-900/75">
          A full-screen broadcast page (1920×1080) that updates by itself: active users, visitors, codes copied, new codes, quiz answers, a live activity feed,
          graphs, the quiz leaderboard, featured codes and the next-winner countdown. Only public-safe data is shown (codes are partly hidden, quiz players by first name).
          Add it to OBS and stream it.
        </p>
        <div className="mt-4 grid gap-3 lg:grid-cols-[1fr_auto]">
          <input readOnly className="nk-input font-mono text-sm" value={url} onFocus={(e) => e.target.select()} aria-label="Live screen link" />
          <div className="flex gap-2">
            <button type="button" className="nk-btn nk-green px-4 py-2 text-sm" onClick={async () => { try { await navigator.clipboard.writeText(url); toast('Link copied'); } catch { toast('Copy failed, select the link and copy it', false); } }}>Copy link</button>
            <a href={url} target="_blank" rel="noopener" className="nk-btn nk-ghost px-4 py-2 text-sm">Open ↗</a>
          </div>
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="nk-card p-4 sm:p-5">
          <h2 className="mb-3 text-base font-bold text-emerald-950">What to show</h2>
          <div className="grid gap-2">
            {PANELS.map((p) => (
              <label key={p.key} className="flex items-center gap-2.5 text-sm">
                <input type="checkbox" className="h-4 w-4 accent-emerald-700" checked={!hidden.has(p.key)} onChange={() => toggle(p.key)} />
                {p.label}
              </label>
            ))}
          </div>
          <label className="mt-4 grid gap-1 text-sm font-semibold">Headline (optional)
            <input className="nk-input font-normal" maxLength={80} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="নুসুক উমরাহ কোড শেয়ার · লাইভ" />
          </label>
          <p className="mt-2 text-xs text-emerald-900/60">These choices are part of the link. Copy the link again after changing them.</p>
        </section>

        <section className="nk-card p-4 sm:p-5">
          <h2 className="mb-3 text-base font-bold text-emerald-950">Set up in OBS (once)</h2>
          <ol className="grid list-decimal gap-1.5 pl-5 text-sm text-emerald-950/85">
            <li>OBS → <b>Sources</b> → <b>+</b> → <b>Browser</b>.</li>
            <li>Paste the link above in <b>URL</b>.</li>
            <li><b>Width 1920</b>, <b>Height 1080</b>. Tick <b>Refresh browser when scene becomes active</b>.</li>
            <li>OBS → Settings → Video: Base and Output resolution <b>1920×1080</b>.</li>
            <li>Settings → Stream: choose <b>Facebook Live</b> or <b>YouTube</b> and paste the stream key from Facebook / YouTube Studio.</li>
            <li>Start Streaming. The screen updates every few seconds by itself.</li>
          </ol>
          <p className="mt-3 text-xs text-emerald-900/60">Tip: add your camera or voice in OBS on top of this screen. The page uses very little data (one small update every 10 seconds).</p>
        </section>
      </div>

      <section className="nk-card p-4 sm:p-5">
        <h2 className="mb-3 text-base font-bold text-emerald-950">Preview</h2>
        <div className="relative w-full overflow-hidden rounded-xl border border-[#e7e1cf] bg-black" style={{ aspectRatio: '16 / 9' }}>
          <iframe key={url} src={url} title="Live screen preview" className="absolute inset-0 h-full w-full border-0" />
        </div>
      </section>
    </div>
  );
}
