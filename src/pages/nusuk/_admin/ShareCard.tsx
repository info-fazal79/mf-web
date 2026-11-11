/* Nusuk Manager → Feedback → "📣 Share card": turns a visitor's message into a picture
   (name + message only, never phone or address) with a ready caption, for Facebook. */
import { useEffect, useMemo, useRef, useState } from 'react';
import { supabase as sb } from '@/lib/supabase';
import { mergeContent, parseVideo } from '../_lib/content';
import { parseBonus } from '../_lib/bonus';

type ToastFn = (t: string, ok?: boolean) => void;
type Target = { label: string; url: string };
type ShareCfg = { targets: Target[]; hashtags: string; intro: string };
type Numbers = { counter: number; ids: Record<string, number> };
export type ShareFeedback = { id: number; name: string; message: string; slider_text?: string | null; slider_name?: string | null };

const SITE = 'https://muhammadfazal.com/nusuk/';
const errText = (e: unknown) => (e && typeof e === 'object' && 'message' in e ? String((e as { message: string }).message) : String(e));

function readNumbers(content: unknown): Numbers {
  const raw = content && typeof content === 'object' ? (content as Record<string, unknown>).share_numbers : null;
  const r = (raw && typeof raw === 'object' ? raw : {}) as Partial<Numbers>;
  return { counter: Number(r.counter) || 0, ids: r.ids && typeof r.ids === 'object' ? r.ids : {} };
}

export function shareCfg(content: unknown): ShareCfg {
  const b = parseBonus(content);
  const raw = content && typeof content === 'object' ? (content as Record<string, unknown>).share : null;
  const r = (raw && typeof raw === 'object' ? raw : {}) as Partial<ShareCfg>;
  const def: Target[] = [
    { label: 'Muhammad Fazal (page)', url: 'https://www.facebook.com/info.fazal17' },
    { label: 'Ribatul Ummah (page)', url: b.page_url || 'https://www.facebook.com/ribatulummah/' },
    { label: 'Ribatul Ummah Community (group)', url: b.group_url || 'https://www.facebook.com/groups/ribatulummah' },
  ];
  return {
    targets: def.map((d, i) => ({ label: r.targets?.[i]?.label?.trim() || d.label, url: r.targets?.[i]?.url?.trim() || d.url })),
    hashtags: typeof r.hashtags === 'string' && r.hashtags.trim() ? r.hashtags : '#Nusuk #NusukUmrah #উমরাহ #নুসুক #RibatulUmmah #UmrahCompetition',
    intro: typeof r.intro === 'string' && r.intro.trim() ? r.intro : '💬 আমাদের সম্পর্কে ভিজিটরদের মতামত',
  };
}

function caption(f: ShareFeedback, cfg: ShareCfg, content: unknown) {
  const c = mergeContent(content);
  const v = parseVideo(content);
  const text = (f.slider_text || f.message).trim();
  const name = (f.slider_name || f.name).trim();
  const videos = [
    v && `🎥 কীভাবে কাজ করে: https://www.youtube.com/watch?v=${v.id}`,
    c.submit_video_url && `🎥 নুসুক অ্যাপে আপনার কোড কোথায় পাবেন: ${c.submit_video_url}`,
  ].filter(Boolean).join('\n');
  return [
    cfg.intro,
    '',
    `"${text}"`,
    `— ${name}`,
    '',
    '🕋 নুসুক উমরাহ প্রতিযোগিতার রেফারেল কোড নিতে এবং নিজের কোড শেয়ার করতে ভিজিট করুন:',
    `🔗 ${SITE}`,
    ...(videos ? ['', videos] : []),
    '',
    cfg.hashtags,
  ].join('\n');
}

/* ---------- the picture (1080 × 1350, Facebook portrait) ---------- */
function rounded(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
function wrap(ctx: CanvasRenderingContext2D, text: string, maxW: number) {
  const lines: string[] = [];
  for (const para of text.split(/\n+/)) {
    let line = '';
    for (const word of para.split(/\s+/).filter(Boolean)) {
      const t = line ? `${line} ${word}` : word;
      if (ctx.measureText(t).width > maxW && line) { lines.push(line); line = word; } else line = t;
    }
    if (line) lines.push(line);
  }
  return lines;
}
export async function drawCard(f: ShareFeedback, num?: number | null): Promise<HTMLCanvasElement> {
  const W = 1080, H = 1350, F = '"Hind Siliguri", sans-serif';
  await Promise.all(['400', '500', '600', '700'].map((w) => document.fonts.load(`${w} 40px "Hind Siliguri"`, 'অআক')));
  const logo = await new Promise<HTMLImageElement | null>((res) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => res(null); i.src = '/nusuk/ribat-logo.webp'; });
  const cv = document.createElement('canvas');
  cv.width = W; cv.height = H;
  const ctx = cv.getContext('2d')!;

  // Background: deep green with a soft gold glow
  const bg = ctx.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, '#0a6b4f'); bg.addColorStop(1, '#032b20');
  ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
  const glow = ctx.createRadialGradient(W, 0, 0, W, 0, 700);
  glow.addColorStop(0, 'rgba(232,196,90,0.35)'); glow.addColorStop(1, 'rgba(232,196,90,0)');
  ctx.fillStyle = glow; ctx.fillRect(0, 0, W, H);
  // faint star pattern
  ctx.strokeStyle = 'rgba(255,255,255,0.05)'; ctx.lineWidth = 2;
  for (let y = 60; y < H; y += 150) for (let x = (y / 150) % 2 ? 60 : 135; x < W; x += 150) {
    ctx.beginPath(); for (let k = 0; k < 8; k++) { const a = (k * Math.PI) / 4, r = k % 2 ? 14 : 30; ctx.lineTo(x + r * Math.cos(a), y + r * Math.sin(a)); } ctx.closePath(); ctx.stroke();
  }

  // Header: logo + name
  if (logo) { ctx.save(); rounded(ctx, 80, 70, 120, 120, 26); ctx.clip(); ctx.drawImage(logo, 80, 70, 120, 120); ctx.restore(); }
  ctx.fillStyle = '#ffffff'; ctx.font = `700 50px ${F}`; ctx.textBaseline = 'alphabetic';
  ctx.fillText('Ribatul Ummah', 225, 125);
  ctx.fillStyle = '#f5d76e'; ctx.font = `500 30px ${F}`;
  ctx.fillText('Nusuk Code Share · উমরাহ প্রতিযোগিতা', 225, 170);
  // Review number, e.g. #001
  if (num) {
    const label = `#${String(num).padStart(3, '0')}`;
    ctx.font = `700 46px ${F}`;
    const bw = ctx.measureText(label).width + 56;
    ctx.fillStyle = 'rgba(0,0,0,0.25)'; rounded(ctx, W - 80 - bw, 92, bw, 78, 39); ctx.fill();
    ctx.strokeStyle = '#f5d76e'; ctx.lineWidth = 3; rounded(ctx, W - 80 - bw, 92, bw, 78, 39); ctx.stroke();
    ctx.fillStyle = '#f5d76e'; ctx.textAlign = 'center'; ctx.fillText(label, W - 80 - bw / 2, 147); ctx.textAlign = 'left';
  }

  // Title pill
  ctx.font = `700 40px ${F}`;
  const title = 'ভিজিটরদের মতামত';
  const tw = ctx.measureText(title).width + 70;
  ctx.fillStyle = '#f5d76e'; rounded(ctx, (W - tw) / 2, 245, tw, 70, 35); ctx.fill();
  ctx.fillStyle = '#063d2e'; ctx.textAlign = 'center'; ctx.fillText(title, W / 2, 294); ctx.textAlign = 'left';

  // Message card: the font shrinks for long messages so it always fits
  const text = (f.slider_text || f.message).trim().replace(/\s+\n/g, '\n');
  const name = (f.slider_name || f.name).trim();
  // The card sits in the middle area between the title and the footer
  const top = 350, bottom = H - 210, extra = 250; // extra = quote space + stars + name
  const cx = 80, cw = W - 160, maxCardH = bottom - top, pad = 70;
  let size = 54, lines: string[] = [], lh = 0;
  for (; size >= 28; size -= 2) {
    ctx.font = `500 ${size}px ${F}`;
    lines = wrap(ctx, text, cw - pad * 2);
    lh = size * 1.6;
    if (lines.length * lh + extra <= maxCardH) break;
  }
  const maxLines = Math.floor((maxCardH - extra) / lh);
  if (lines.length > maxLines) { lines = lines.slice(0, maxLines); lines[maxLines - 1] = lines[maxLines - 1].replace(/\s*\S*$/, '') + ' …'; }
  const ch = Math.min(maxCardH, lines.length * lh + extra);
  const cy = top + Math.round((maxCardH - ch) / 2);
  ctx.shadowColor = 'rgba(0,0,0,0.35)'; ctx.shadowBlur = 40; ctx.shadowOffsetY = 14;
  ctx.fillStyle = '#fbf8f1'; rounded(ctx, cx, cy, cw, ch, 40); ctx.fill();
  ctx.shadowColor = 'transparent';
  // big quote mark
  ctx.fillStyle = 'rgba(201,162,39,0.35)'; ctx.font = `700 190px Georgia, serif`;
  ctx.fillText('“', cx + 30, cy + 150);
  ctx.fillStyle = '#063d2e'; ctx.font = `500 ${size}px ${F}`;
  lines.forEach((l, i) => ctx.fillText(l, cx + pad, cy + 120 + i * lh));
  // stars + name
  const ny = cy + 120 + lines.length * lh + 30;
  ctx.fillStyle = '#c9a227'; ctx.font = `700 34px ${F}`; ctx.fillText('★★★★★', cx + pad, ny);
  ctx.fillStyle = '#075e45'; ctx.font = `700 40px ${F}`; ctx.fillText(`— ${name}`, cx + pad, ny + 55);

  // Footer: website
  const fy = H - 140;
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffffff'; ctx.font = `600 32px ${F}`;
  ctx.fillText('নুসুক উমরাহ রেফারেল কোড পেতে ভিজিট করুন', W / 2, fy);
  ctx.fillStyle = '#f5d76e'; ctx.font = `700 46px ${F}`;
  ctx.fillText('www.muhammadfazal.com/nusuk', W / 2, fy + 62);
  ctx.textAlign = 'left';
  return cv;
}

export default function ShareCardDialog({ f, content, toast, onClose, onSaved }: { f: ShareFeedback; content: unknown; toast: ToastFn; onClose: () => void; onSaved: () => void }) {
  const [cfg, setCfg] = useState<ShareCfg>(() => shareCfg(content));
  const [text, setText] = useState(() => caption(f, shareCfg(content), content));
  const [url, setUrl] = useState('');
  const [blob, setBlob] = useState<Blob | null>(null);
  const [num, setNum] = useState<number | null>(() => readNumbers(content).ids[String(f.id)] ?? null);
  const [numOn, setNumOn] = useState(() => !!readNumbers(content).ids[String(f.id)]);
  const [numBusy, setNumBusy] = useState(false);
  const [editTargets, setEditTargets] = useState(false);
  const dlg = useRef<HTMLDialogElement>(null);

  useEffect(() => { dlg.current?.showModal(); }, []);
  useEffect(() => {
    let alive = true;
    setBlob(null);
    drawCard(f, numOn ? num : null).then((cv) => cv.toBlob((b) => { if (!alive || !b) return; setBlob(b); setUrl(URL.createObjectURL(b)); }, 'image/png'));
    return () => { alive = false; };
  }, [f, num, numOn]);

  /** Tick "Add number": the first time a message is numbered it gets the next number (#001, #002…), saved for good. */
  async function toggleNumber(on: boolean) {
    if (!on) { setNumOn(false); return; }
    if (num) { setNumOn(true); return; }
    setNumBusy(true);
    const { data, error: e1 } = await sb!.from('nusuk_settings').select('content').eq('id', 1).single();
    if (e1) { setNumBusy(false); return toast(errText(e1), false); }
    const cur = readNumbers(data?.content);
    const n = cur.ids[String(f.id)] ?? cur.counter + 1;
    const next = { ...((data?.content as object) ?? {}), share_numbers: { counter: Math.max(cur.counter, n), ids: { ...cur.ids, [String(f.id)]: n } } };
    const { error } = await sb!.from('nusuk_settings').update({ content: next, updated_at: new Date().toISOString() }).eq('id', 1);
    setNumBusy(false);
    if (error) return toast(errText(error), false);
    setNum(n);
    setNumOn(true);
    toast(`This card is review #${String(n).padStart(3, '0')}`);
    onSaved();
  }
  useEffect(() => () => { if (url) URL.revokeObjectURL(url); }, [url]);
  const fileName = useMemo(() => `feedback-${f.id}.png`, [f.id]);

  const download = () => { if (!url) return; const a = document.createElement('a'); a.href = url; a.download = fileName; a.click(); };
  async function copyImage() {
    if (!blob) return;
    try { await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]); toast('Picture copied: paste it (Ctrl+V) in the Facebook post box'); }
    catch { download(); toast('Could not copy the picture, so it was downloaded instead'); }
  }
  async function copyText() {
    try { await navigator.clipboard.writeText(text); toast('Caption copied'); } catch { toast('Could not copy the caption', false); }
  }
  /** One click: copy the caption, download the picture, open the page/group. */
  async function postTo(t: Target) {
    if (!blob) return toast('The picture is still being made', false);
    try { await navigator.clipboard.writeText(text); } catch { /* still open it */ }
    download();
    window.open(t.url, '_blank', 'noopener');
    toast(`Caption copied and picture downloaded. On Facebook: Create post → Ctrl+V the caption → add the picture.`);
  }
  async function saveDefaults() {
    const { data, error: e1 } = await sb!.from('nusuk_settings').select('content').eq('id', 1).single();
    if (e1) return toast(errText(e1), false);
    const next = { ...((data?.content as object) ?? {}), share: cfg };
    const { error } = await sb!.from('nusuk_settings').update({ content: next, updated_at: new Date().toISOString() }).eq('id', 1);
    if (error) return toast(errText(error), false);
    toast('Saved as default');
    setText(caption(f, cfg, content));
    onSaved();
  }

  return (
    <dialog ref={dlg} onClose={onClose} onClick={(e) => { if (e.target === dlg.current) dlg.current?.close(); }}
      className="m-auto max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-4xl overflow-y-auto rounded-[1.25rem] p-0 shadow-2xl backdrop:bg-emerald-950/60">
      <div className="grid gap-4 p-5 lg:grid-cols-[minmax(0,22rem)_1fr]">
        <div>
          <div className="mb-2 flex items-center justify-between"><b>📣 Share card</b><button type="button" className="text-xl text-emerald-900/60 lg:hidden" onClick={() => dlg.current?.close()}>×</button></div>
          {url ? <img src={url} alt="Share card" className="w-full rounded-xl shadow-lg" /> : <div className="grid aspect-[4/5] place-items-center rounded-xl bg-emerald-50 text-sm text-emerald-900/60">Making the picture…</div>}
          <div className="mt-2 flex flex-wrap gap-2">
            <button type="button" className="nk-btn nk-ghost px-3 py-1.5 text-sm" onClick={copyImage} disabled={!blob}>🖼️ Copy picture</button>
            <button type="button" className="nk-btn nk-ghost px-3 py-1.5 text-sm" onClick={download} disabled={!blob}>⬇️ Download</button>
          </div>
          <label className="mt-2 flex items-center gap-2 rounded-xl bg-gold-100/50 px-3 py-2 text-sm font-semibold">
            <input type="checkbox" className="h-4 w-4 accent-emerald-700" checked={numOn} disabled={numBusy} onChange={(e) => toggleNumber(e.target.checked)} />
            Add review number {num ? <span className="font-mono text-emerald-800">#{String(num).padStart(3, '0')}</span> : <span className="text-xs font-normal text-emerald-900/60">(gets the next number)</span>}
          </label>
          <p className="mt-2 text-xs text-emerald-900/60">Only the name and message are used. The phone number and address are never shown.</p>
        </div>
        <div className="grid content-start gap-3">
          <div className="flex items-start justify-between gap-2">
            <h2 className="text-lg font-bold text-emerald-900">Post on Facebook in one click</h2>
            <button type="button" className="hidden h-9 w-9 shrink-0 place-items-center rounded-full text-xl text-emerald-900/60 hover:bg-emerald-50 lg:grid" onClick={() => dlg.current?.close()} aria-label="Close">×</button>
          </div>
          <div className="grid gap-2">
            {cfg.targets.map((t) => (
              <button key={t.url} type="button" onClick={() => postTo(t)} disabled={!blob}
                className="flex items-center gap-3 rounded-xl bg-[#1877f2] px-4 py-3 text-left text-white shadow-sm hover:bg-[#166fe5] disabled:opacity-50">
                <span className="text-xl">{/groups\//.test(t.url) ? '👥' : '📘'}</span>
                <span className="min-w-0 flex-1"><span className="block font-bold">Post on {t.label}</span><span className="block truncate text-xs text-white/75">{t.url}</span></span>
                <span className="text-sm font-bold">→</span>
              </button>
            ))}
          </div>
          <p className="rounded-xl bg-emerald-50 px-3 py-2 text-xs leading-relaxed text-emerald-950">
            Each button copies the caption, downloads the picture and opens the page or group. There: <b>Create post</b> → <b>Ctrl+V</b> (caption) → <b>Photo/video</b> and pick <b>{fileName}</b> from Downloads → Post.
            Facebook doesn't let websites post to groups for you, so this is the fastest safe way.
          </p>
          <label className="grid gap-1 text-sm font-semibold">Caption (you can edit it)
            <textarea rows={11} className="nk-input font-normal" value={text} onChange={(e) => setText(e.target.value)} />
          </label>
          <div className="flex flex-wrap gap-2">
            <button type="button" className="nk-btn nk-gold px-3 py-1.5 text-sm" onClick={copyText}>📋 Copy caption</button>
            <button type="button" className="nk-btn nk-ghost px-3 py-1.5 text-sm" onClick={() => setText(caption(f, cfg, content))}>Reset caption</button>
            <button type="button" className="nk-btn nk-ghost px-3 py-1.5 text-sm" onClick={() => setEditTargets(!editTargets)}>⚙️ Pages, hashtags</button>
          </div>
          {editTargets && (
            <div className="grid gap-2 rounded-xl border border-[#e7e1cf] bg-cream p-3">
              {cfg.targets.map((t, i) => (
                <div key={i} className="grid gap-1.5 sm:grid-cols-[12rem_1fr]">
                  <input className="nk-input py-1.5! text-sm font-normal" value={t.label} onChange={(e) => setCfg({ ...cfg, targets: cfg.targets.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)) })} />
                  <input className="nk-input py-1.5! text-sm font-normal" value={t.url} onChange={(e) => setCfg({ ...cfg, targets: cfg.targets.map((x, j) => (j === i ? { ...x, url: e.target.value } : x)) })} />
                </div>
              ))}
              <label className="grid gap-1 text-xs font-semibold">First line of the caption<input className="nk-input py-1.5! text-sm font-normal" value={cfg.intro} onChange={(e) => setCfg({ ...cfg, intro: e.target.value })} /></label>
              <label className="grid gap-1 text-xs font-semibold">Hashtags<input className="nk-input py-1.5! text-sm font-normal" value={cfg.hashtags} onChange={(e) => setCfg({ ...cfg, hashtags: e.target.value })} /></label>
              <div><button type="button" className="nk-btn nk-green px-3 py-1.5 text-sm" onClick={saveDefaults}>Save as default</button></div>
            </div>
          )}
        </div>
      </div>
    </dialog>
  );
}
