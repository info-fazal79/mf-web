/**
 * Image crop editor for the media library.
 * Drag the box or its handles, pick an aspect ratio, or press Auto-trim to cut
 * away empty borders (transparent, or a solid background colour).
 * Saving uploads the result as a NEW media file; the original is kept, so
 * pages that already use the old link don't break.
 */
import { useEffect, useRef, useState, type PointerEvent as RPointerEvent } from 'react';
import { uploadMedia, type MediaItem } from './media';
import { I, Modal, useToast } from './ui';

type Rect = { x: number; y: number; w: number; h: number };
type Handle = 'move' | 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw';

const MIN = 8; // smallest crop side, in image pixels
const RATIOS: { label: string; value: number | null }[] = [
  { label: 'Free', value: null },
  { label: '1:1', value: 1 },
  { label: '4:5', value: 4 / 5 },
  { label: '4:3', value: 4 / 3 },
  { label: '16:9', value: 16 / 9 },
];
const HANDLES: Handle[] = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'];
const CURSOR: Record<Handle, string> = {
  move: 'move', n: 'ns-resize', s: 'ns-resize', e: 'ew-resize', w: 'ew-resize',
  ne: 'nesw-resize', sw: 'nesw-resize', nw: 'nwse-resize', se: 'nwse-resize',
};

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

/** Can this file be cropped in the browser? (SVG/GIF are skipped: cropping would flatten or freeze them.) */
export function isCroppable(url: string, mime?: string | null) {
  if (mime) return /^image\/(png|jpe?g|webp|avif|bmp)$/i.test(mime);
  return /\.(png|jpe?g|webp|avif|bmp)(\?|$)/i.test(url);
}

/** Bounding box of the "real" content: pixels that differ from the background (transparent or the corner colour). */
function findContent(img: HTMLImageElement): Rect | null {
  const W = img.naturalWidth;
  const H = img.naturalHeight;
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const ctx = c.getContext('2d', { willReadFrequently: true })!;
  ctx.drawImage(img, 0, 0);
  const d = ctx.getImageData(0, 0, W, H).data;
  const transparentBg = d[3] < 16;
  const [br, bg, bb] = [d[0], d[1], d[2]];
  const isContent = (i: number) =>
    transparentBg ? d[i + 3] > 16 : d[i + 3] > 16 && Math.abs(d[i] - br) + Math.abs(d[i + 1] - bg) + Math.abs(d[i + 2] - bb) > 36;

  let top = -1, bottom = -1, left = W, right = -1;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (isContent((y * W + x) * 4)) {
        if (top < 0) top = y;
        bottom = y;
        if (x < left) left = x;
        if (x > right) right = x;
      }
    }
  }
  if (top < 0) return null;
  return { x: left, y: top, w: right - left + 1, h: bottom - top + 1 };
}

export function CropEditor({
  src,
  name,
  folder = 'general',
  open,
  onClose,
  onSaved,
}: {
  src: string;
  name: string;
  folder?: string;
  open: boolean;
  onClose: () => void;
  onSaved: (m: MediaItem) => void;
}) {
  const toast = useToast();
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  const [objUrl, setObjUrl] = useState('');
  const [err, setErr] = useState('');
  const [rect, setRect] = useState<Rect>({ x: 0, y: 0, w: 0, h: 0 });
  const [ratio, setRatio] = useState<number | null>(null);
  const [pad, setPad] = useState(0);
  const [scale, setScale] = useState(1);
  const [saving, setSaving] = useState(false);
  const view = useRef<HTMLImageElement>(null);
  const drag = useRef<{ h: Handle; px: number; py: number; r: Rect } | null>(null);

  // Load the image as a same-origin blob so the canvas can read its pixels.
  useEffect(() => {
    if (!open) return;
    let url = '';
    let live = true;
    setImg(null);
    setErr('');
    setRatio(null);
    setPad(0);
    fetch(src, { cache: 'no-store' })
      .then((r) => {
        if (!r.ok) throw new Error(`Could not load image (${r.status})`);
        return r.blob();
      })
      .then(async (b) => {
        url = URL.createObjectURL(b);
        const im = new Image();
        im.src = url;
        await im.decode();
        if (!live) return;
        setObjUrl(url);
        setImg(im);
        setRect({ x: 0, y: 0, w: im.naturalWidth, h: im.naturalHeight });
      })
      .catch((e) => live && setErr((e as Error).message));
    return () => {
      live = false;
      if (url) URL.revokeObjectURL(url);
    };
  }, [open, src]);

  // Track how big the image is drawn on screen (natural px → screen px).
  useEffect(() => {
    if (!img || !view.current) return;
    const el = view.current;
    const measure = () => setScale(el.clientWidth / img.naturalWidth || 1);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [img]);

  const W = img?.naturalWidth ?? 1;
  const H = img?.naturalHeight ?? 1;

  function fitRatio(r: Rect, rt: number, h: Handle): Rect {
    let { x, y, w } = r;
    let hh = w / rt;
    if (h === 'n' || h === 's') {
      hh = r.h;
      w = hh * rt;
    }
    // Keep inside the image.
    const maxW = h.includes('w') ? r.x + r.w : W - x;
    const maxH = h.includes('n') ? r.y + r.h : H - y;
    if (w > maxW) { w = maxW; hh = w / rt; }
    if (hh > maxH) { hh = maxH; w = hh * rt; }
    if (h.includes('w')) x = r.x + r.w - w;
    if (h.includes('n')) y = r.y + r.h - hh;
    if (h === 'n' || h === 's') x = clamp(r.x + (r.w - w) / 2, 0, W - w);
    if (h === 'e' || h === 'w') y = clamp(r.y + (r.h - hh) / 2, 0, H - hh);
    return { x, y, w, h: hh };
  }

  function onDown(h: Handle, e: RPointerEvent) {
    e.preventDefault();
    e.stopPropagation();
    (e.target as Element).setPointerCapture?.(e.pointerId);
    drag.current = { h, px: e.clientX, py: e.clientY, r: rect };
  }
  function onMove(e: RPointerEvent) {
    const g = drag.current;
    if (!g) return;
    const dx = (e.clientX - g.px) / scale;
    const dy = (e.clientY - g.py) / scale;
    const r0 = g.r;
    if (g.h === 'move') {
      setRect({ ...r0, x: clamp(r0.x + dx, 0, W - r0.w), y: clamp(r0.y + dy, 0, H - r0.h) });
      return;
    }
    let { x, y, w, h } = r0;
    if (g.h.includes('w')) { x = clamp(r0.x + dx, 0, r0.x + r0.w - MIN); w = r0.x + r0.w - x; }
    if (g.h.includes('e')) w = clamp(r0.w + dx, MIN, W - r0.x);
    if (g.h.includes('n')) { y = clamp(r0.y + dy, 0, r0.y + r0.h - MIN); h = r0.y + r0.h - y; }
    if (g.h.includes('s')) h = clamp(r0.h + dy, MIN, H - r0.y);
    let next = { x, y, w, h };
    if (ratio) next = fitRatio(next, ratio, g.h);
    setRect(next);
  }
  function onUp() {
    drag.current = null;
  }

  function applyRatio(rt: number | null) {
    setRatio(rt);
    if (!rt) return;
    // Largest box of that ratio, centred on the current selection.
    let w = Math.min(rect.w, rect.h * rt);
    let h = w / rt;
    if (w > W) { w = W; h = w / rt; }
    if (h > H) { h = H; w = h * rt; }
    const cx = rect.x + rect.w / 2;
    const cy = rect.y + rect.h / 2;
    setRect({ x: clamp(cx - w / 2, 0, W - w), y: clamp(cy - h / 2, 0, H - h), w, h });
  }

  function autoTrim() {
    if (!img) return;
    try {
      const box = findContent(img);
      if (!box) return toast('Nothing to trim: the image looks empty.', false);
      const p = pad;
      const x = Math.max(0, box.x - p);
      const y = Math.max(0, box.y - p);
      const next = { x, y, w: Math.min(W, box.x + box.w + p) - x, h: Math.min(H, box.y + box.h + p) - y };
      setRatio(null);
      setRect(next);
      if (next.w === W && next.h === H) toast('No empty border found around this image.');
    } catch (e) {
      toast((e as Error).message, false);
    }
  }

  async function save() {
    if (!img) return;
    const r = { x: Math.round(rect.x), y: Math.round(rect.y), w: Math.round(rect.w), h: Math.round(rect.h) };
    if (r.x === 0 && r.y === 0 && r.w === W && r.h === H) return toast('Nothing changed: move the crop box first.', false);
    setSaving(true);
    try {
      const c = document.createElement('canvas');
      c.width = r.w;
      c.height = r.h;
      c.getContext('2d')!.drawImage(img, r.x, r.y, r.w, r.h, 0, 0, r.w, r.h);
      const blob = await new Promise<Blob | null>((res) => c.toBlob(res, 'image/png'));
      if (!blob) throw new Error('Could not create the cropped image');
      const base = name.replace(/\.[^.]+$/, '').replace(/-cropped(-\d+)?$/, '');
      const m = await uploadMedia(new File([blob], `${base}-cropped.png`, { type: 'image/png' }), folder);
      toast('Cropped copy saved');
      onSaved(m);
      onClose();
    } catch (e) {
      toast((e as Error).message, false);
    } finally {
      setSaving(false);
    }
  }

  const s = scale;
  const box = { left: rect.x * s, top: rect.y * s, width: rect.w * s, height: rect.h * s };

  return (
    <Modal open={open} onClose={onClose} title="Crop image" wide>
      {err ? (
        <p className="py-10 text-center text-sm text-red-500">{err}</p>
      ) : !img ? (
        <p className="py-10 text-center text-sm text-muted">Loading image…</p>
      ) : (
        <div className="grid gap-4">
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" className="btn-primary px-3 py-1.5 text-xs" onClick={autoTrim} title="Cut away transparent or plain-colour borders">
              <I n="layers" s={14} /> Auto-trim empty edges
            </button>
            <label className="flex items-center gap-1.5 text-xs text-muted">
              keep
              <input type="number" min={0} max={200} value={pad} onChange={(e) => setPad(Math.max(0, e.target.valueAsNumber || 0))} className="input w-16 px-2 py-1 text-xs" />
              px space
            </label>
            <span className="mx-1 h-5 w-px bg-line" />
            {RATIOS.map((r) => (
              <button
                key={r.label}
                type="button"
                onClick={() => applyRatio(r.value)}
                className={`rounded-lg border px-2.5 py-1 text-xs font-semibold ${ratio === r.value ? 'border-accent bg-accent-soft text-accent' : 'border-line text-muted hover:text-fg'}`}
              >
                {r.label}
              </button>
            ))}
            <button type="button" className="ml-auto text-xs text-muted hover:text-fg" onClick={() => { setRatio(null); setRect({ x: 0, y: 0, w: W, h: H }); }}>
              <I n="refresh" s={13} className="mr-1 inline" />Reset
            </button>
          </div>

          <div
            className="grid place-items-center rounded-xl border border-line p-3"
            style={{ background: 'repeating-conic-gradient(var(--surface-2) 0% 25%, var(--bg) 0% 50%) 50% / 18px 18px' }}
          >
            <div className="relative select-none touch-none" onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}>
              <img ref={view} src={objUrl} alt="" draggable={false} className="block max-h-[55vh] w-auto max-w-full" />
              {/* Dim everything outside the crop box */}
              <div
                className="absolute"
                style={{ ...box, boxShadow: '0 0 0 9999px rgba(0,0,0,0.55)', outline: '1.5px solid #fff', cursor: CURSOR.move }}
                onPointerDown={(e) => onDown('move', e)}
              >
                <div className="pointer-events-none absolute inset-0 grid grid-cols-3 grid-rows-3">
                  {Array.from({ length: 9 }).map((_, i) => (
                    <span key={i} className="border border-white/20" />
                  ))}
                </div>
                {HANDLES.map((h) => (
                  <span
                    key={h}
                    onPointerDown={(e) => onDown(h, e)}
                    className="absolute h-3.5 w-3.5 rounded-sm border border-black/40 bg-white"
                    style={{
                      cursor: CURSOR[h],
                      top: h.includes('n') ? -7 : h.includes('s') ? 'calc(100% - 7px)' : 'calc(50% - 7px)',
                      left: h.includes('w') ? -7 : h.includes('e') ? 'calc(100% - 7px)' : 'calc(50% - 7px)',
                    }}
                  />
                ))}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <p className="font-mono text-xs text-muted">
              {W}×{H} → <span className="text-fg">{Math.round(rect.w)}×{Math.round(rect.h)}</span> px
            </p>
            <p className="text-xs text-muted">Saved as a new file; the original stays in the library.</p>
            <div className="ml-auto flex gap-2">
              <button type="button" className="btn-ghost" onClick={onClose}>Cancel</button>
              <button type="button" className="btn-primary" disabled={saving} onClick={save}>
                <I n="check" s={15} /> {saving ? 'Saving…' : 'Save cropped copy'}
              </button>
            </div>
          </div>
        </div>
      )}
    </Modal>
  );
}
