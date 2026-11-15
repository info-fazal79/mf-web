/**
 * Nusuk Manager → Social media → Design Builder.
 * A design is a background plus a list of elements (text, picture, shape, map …) placed at x / y
 * on a canvas of a social-media size. The same drawing is used for the editor preview and the JPG,
 * so what you see is what you download.
 */
import { drawQR, FONT, loadImage, MONO, rr } from './clubcard';
import { drawMap } from './social';

export const BSIZES = {
  fb_square: { w: 1080, h: 1080, label: 'FB post · Square' },
  fb_portrait: { w: 1080, h: 1350, label: 'FB / Insta · Portrait 4:5' },
  fb_landscape: { w: 1200, h: 630, label: 'FB link · Landscape' },
  thumb: { w: 1280, h: 720, label: 'Video thumbnail 16:9' },
  story: { w: 1080, h: 1920, label: 'Story / Reel 9:16' },
  fb_cover: { w: 1640, h: 624, label: 'FB page cover' },
  fb_event: { w: 1920, h: 1005, label: 'FB event cover' },
} as const;
export type BSize = keyof typeof BSIZES;

export type Bg = {
  kind: 'solid' | 'gradient' | 'image';
  c1: string; c2: string; angle: number;
  image: string; fit: 'cover' | 'contain';
  overlay: string; overlayOp: number;
  pattern: boolean; patternColor: string; patternOp: number;
  frame: boolean; frameColor: string; frameW: number; frameInset: number; frameR: number;
};

type Base = { id: string; x: number; y: number; w: number; h: number; opacity: number; rot: number; name?: string };
export type TextEl = Base & {
  type: 'text'; text: string; size: number; weight: number; color: string; align: 'left' | 'center' | 'right';
  lh: number; font: 'bn' | 'mono'; bg: string; bgOn: boolean; pad: number; radius: number; shadow: boolean;
  borderW: number; borderC: string;
};
export type ListEl = Base & { type: 'list'; items: string; size: number; color: string; mark: string; markText: string; numbered: boolean; weight: number };
export type ImageEl = Base & { type: 'image'; src: string; fit: 'cover' | 'contain'; radius: number; circle: boolean; borderW: number; borderC: string; shadow: boolean; logo?: boolean };
export type ShapeEl = Base & { type: 'rect' | 'circle' | 'line'; fill: string; fillOn: boolean; borderW: number; borderC: string; radius: number; shadow: boolean };
export type OptionsEl = Base & { type: 'options'; items: string; size: number; color: string; card: string; edge: string; mark: string; markText: string; cols: 1 | 2 };
export type StatEl = Base & { type: 'stat'; value: string; label: string; color: string; labelColor: string; card: string; edge: string };
export type QrEl = Base & { type: 'qr'; text: string; color: string; bg: string };
export type MapEl = Base & { type: 'map'; panel: boolean; edge: string };
export type El = TextEl | ListEl | ImageEl | ShapeEl | OptionsEl | StatEl | QrEl | MapEl;
export type Doc = { size: BSize; bg: Bg; els: El[] };

export const SWATCHES = ['#ffffff', '#000000', '#053d2d', '#0b5a43', '#2bb38a', '#cdeedb', '#f2c94c', '#e0b93a', '#fffaf0', '#b91c1c', '#1877f2', '#1c2c55'];

export const uid = () => Math.random().toString(36).slice(2, 9);

export const defaultBg = (): Bg => ({
  kind: 'gradient', c1: '#075c45', c2: '#021f17', angle: 160, image: '', fit: 'cover', overlay: '#021f17', overlayOp: 0.45,
  pattern: true, patternColor: '#d4af37', patternOp: 0.14, frame: true, frameColor: '#f2c94c', frameW: 3, frameInset: 26, frameR: 34,
});

// ------------------------------------------------------------------ images
const cache = new Map<string, Promise<HTMLImageElement | null>>();
export const getImg = (src: string) => {
  if (!src) return Promise.resolve(null);
  if (!cache.has(src)) cache.set(src, loadImage(src));
  return cache.get(src)!;
};
export const LOGO = '/nusuk/ribat-logo.webp';

// ------------------------------------------------------------------ text
const setFont = (ctx: CanvasRenderingContext2D, w: number, px: number, f: 'bn' | 'mono' = 'bn') => { ctx.font = `${w} ${Math.max(6, Math.round(px))}px ${f === 'mono' ? MONO : FONT}`; };
function wrap(ctx: CanvasRenderingContext2D, text: string, max: number) {
  const out: string[] = [];
  for (const para of text.split('\n')) {
    const words = para.split(/\s+/).filter(Boolean);
    let line = '';
    for (const w of words) {
      const t = line ? `${line} ${w}` : w;
      if (line && ctx.measureText(t).width > max) { out.push(line); line = w; } else line = t;
    }
    out.push(line);
  }
  return out;
}
const hexA = (hex: string, a: number) => {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h.slice(0, 6), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
};
function shadowOn(ctx: CanvasRenderingContext2D, on: boolean, s = 1) {
  if (!on) return;
  ctx.shadowColor = 'rgba(0,0,0,0.35)'; ctx.shadowBlur = 30 * s; ctx.shadowOffsetY = 12 * s;
}

/** Height an element really takes (text grows with its words) */
export function measure(ctx: CanvasRenderingContext2D, e: El): number {
  if (e.type === 'text') {
    setFont(ctx, e.weight, e.size, e.font);
    const lines = wrap(ctx, e.text, Math.max(10, e.w - (e.bgOn ? e.pad * 2 : 0)));
    return Math.max(lines.length * e.size * e.lh + (e.bgOn ? e.pad * 2 : 0), 10);
  }
  if (e.type === 'list') {
    setFont(ctx, e.weight, e.size);
    const icon = e.size * 1.1, gap = e.size * 0.45;
    const rows = e.items.split('\n').filter((t) => t.trim()).map((t) => wrap(ctx, t.trim(), e.w - icon - e.size * 0.55));
    return Math.max(10, rows.reduce((a, r) => a + Math.max(icon, r.length * e.size * 1.4), 0) + gap * Math.max(0, rows.length - 1));
  }
  if (e.type === 'options') {
    const items = e.items.split('\n').filter((t) => t.trim());
    const rows = Math.ceil(items.length / e.cols) || 1;
    const gap = e.size * 0.5, bh = e.size * 2.3;
    return rows * bh + (rows - 1) * gap;
  }
  if (e.type === 'line') return Math.max(2, e.borderW);
  if (e.type === 'circle' || e.type === 'qr') return e.w;
  return e.h;
}

// ------------------------------------------------------------------ background
function stars(ctx: CanvasRenderingContext2D, W: number, H: number, color: string, op: number) {
  ctx.save();
  ctx.strokeStyle = hexA(color, op); ctx.lineWidth = 1.6;
  const c = 72;
  for (let yy = 0; yy < H + c; yy += c)
    for (let xx = 0; xx < W + c; xx += c) {
      const m = c / 2, a = c * 0.04, b = c * 0.32, d = c * 0.135;
      ctx.beginPath();
      ctx.moveTo(xx + m, yy + a); ctx.lineTo(xx + m + d, yy + b); ctx.lineTo(xx + c - a, yy + m); ctx.lineTo(xx + m + d, yy + c - b);
      ctx.lineTo(xx + m, yy + c - a); ctx.lineTo(xx + m - d, yy + c - b); ctx.lineTo(xx + a, yy + m); ctx.lineTo(xx + m - d, yy + b);
      ctx.closePath(); ctx.stroke();
    }
  ctx.restore();
}
async function drawBg(ctx: CanvasRenderingContext2D, W: number, H: number, b: Bg) {
  if (b.kind === 'solid') { ctx.fillStyle = b.c1; ctx.fillRect(0, 0, W, H); }
  else {
    const a = ((b.angle - 90) * Math.PI) / 180, r = Math.hypot(W, H) / 2;
    const g = ctx.createLinearGradient(W / 2 - Math.cos(a) * r, H / 2 - Math.sin(a) * r, W / 2 + Math.cos(a) * r, H / 2 + Math.sin(a) * r);
    g.addColorStop(0, b.c1); g.addColorStop(1, b.c2);
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  }
  if (b.kind === 'image' && b.image) {
    const i = await getImg(b.image);
    if (i) {
      const k = b.fit === 'cover' ? Math.max(W / i.width, H / i.height) : Math.min(W / i.width, H / i.height);
      ctx.drawImage(i, (W - i.width * k) / 2, (H - i.height * k) / 2, i.width * k, i.height * k);
    }
  }
  if (b.kind === 'image' && b.overlayOp > 0) { ctx.fillStyle = hexA(b.overlay, b.overlayOp); ctx.fillRect(0, 0, W, H); } // overlay over the picture
  if (b.pattern) stars(ctx, W, H, b.patternColor, b.patternOp);
}
function drawFrame(ctx: CanvasRenderingContext2D, W: number, H: number, b: Bg) {
  if (!b.frame || b.frameW <= 0) return;
  ctx.strokeStyle = b.frameColor; ctx.lineWidth = b.frameW;
  rr(ctx, b.frameInset, b.frameInset, W - b.frameInset * 2, H - b.frameInset * 2, b.frameR); ctx.stroke();
}

// ------------------------------------------------------------------ elements
async function drawEl(ctx: CanvasRenderingContext2D, e: El, h: number, counts: number[] | null) {
  ctx.save();
  ctx.globalAlpha = e.opacity;
  if (e.rot) { ctx.translate(e.x + e.w / 2, e.y + h / 2); ctx.rotate((e.rot * Math.PI) / 180); ctx.translate(-(e.x + e.w / 2), -(e.y + h / 2)); }
  switch (e.type) {
    case 'text': {
      if (e.bgOn || e.borderW > 0) {
        ctx.save(); shadowOn(ctx, e.shadow);
        rr(ctx, e.x, e.y, e.w, h, e.radius);
        if (e.bgOn) { ctx.fillStyle = e.bg; ctx.fill(); }
        ctx.restore();
        if (e.borderW > 0) { ctx.strokeStyle = e.borderC; ctx.lineWidth = e.borderW; rr(ctx, e.x, e.y, e.w, h, e.radius); ctx.stroke(); }
      }
      setFont(ctx, e.weight, e.size, e.font);
      const pad = e.bgOn ? e.pad : 0;
      const lines = wrap(ctx, e.text, Math.max(10, e.w - pad * 2));
      const step = e.size * e.lh;
      const top = e.y + (h - lines.length * step) / 2;
      ctx.fillStyle = e.color; ctx.textBaseline = 'middle'; ctx.textAlign = e.align;
      const tx = e.align === 'left' ? e.x + pad : e.align === 'right' ? e.x + e.w - pad : e.x + e.w / 2;
      if (e.shadow && !e.bgOn) shadowOn(ctx, true, 0.5);
      lines.forEach((l, i) => ctx.fillText(l, tx, top + step * i + step / 2));
      break;
    }
    case 'list': {
      setFont(ctx, e.weight, e.size);
      const icon = e.size * 1.1, gap = e.size * 0.45, step = e.size * 1.4;
      const rows = e.items.split('\n').filter((t) => t.trim()).map((t) => wrap(ctx, t.trim(), e.w - icon - e.size * 0.55));
      let y = e.y;
      rows.forEach((r, i) => {
        const rh = Math.max(icon, r.length * step);
        const cy = y + Math.min(rh, Math.max(step, icon)) / 2;
        ctx.fillStyle = e.mark; ctx.beginPath(); ctx.arc(e.x + icon / 2, cy, icon / 2, 0, Math.PI * 2); ctx.fill();
        setFont(ctx, 700, e.size * 0.62); ctx.fillStyle = e.markText; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(e.numbered ? String(i + 1).replace(/\d/g, (d) => '০১২৩৪৫৬৭৮৯'[Number(d)]) : '✓', e.x + icon / 2, cy + 1);
        setFont(ctx, e.weight, e.size); ctx.fillStyle = e.color; ctx.textAlign = 'left';
        r.forEach((l, j) => ctx.fillText(l, e.x + icon + e.size * 0.55, y + step * j + step / 2 + (icon > step ? (icon - step) / 2 : 0)));
        y += rh + gap;
      });
      break;
    }
    case 'image': {
      const i = await getImg(e.src || (e.logo ? LOGO : ''));
      const r = e.circle ? Math.min(e.w, h) / 2 : e.radius;
      ctx.save(); shadowOn(ctx, e.shadow);
      if (e.circle) { ctx.beginPath(); ctx.ellipse(e.x + e.w / 2, e.y + h / 2, e.w / 2, h / 2, 0, 0, Math.PI * 2); } else rr(ctx, e.x, e.y, e.w, h, r);
      ctx.fillStyle = i ? 'rgba(0,0,0,0)' : 'rgba(255,255,255,0.18)';
      if (!i || e.shadow) { ctx.fillStyle = i ? '#ffffff' : 'rgba(255,255,255,0.18)'; ctx.fill(); }
      ctx.restore();
      ctx.save();
      if (e.circle) { ctx.beginPath(); ctx.ellipse(e.x + e.w / 2, e.y + h / 2, e.w / 2, h / 2, 0, 0, Math.PI * 2); } else rr(ctx, e.x, e.y, e.w, h, r);
      ctx.clip();
      if (i) {
        const k = e.fit === 'cover' ? Math.max(e.w / i.width, h / i.height) : Math.min(e.w / i.width, h / i.height);
        ctx.drawImage(i, e.x + (e.w - i.width * k) / 2, e.y + (h - i.height * k) / 2, i.width * k, i.height * k);
      } else {
        setFont(ctx, 600, Math.min(e.w, h) * 0.12); ctx.fillStyle = 'rgba(255,255,255,0.7)'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText('ছবি দিন', e.x + e.w / 2, e.y + h / 2);
      }
      ctx.restore();
      if (e.borderW > 0) {
        ctx.strokeStyle = e.borderC; ctx.lineWidth = e.borderW;
        if (e.circle) { ctx.beginPath(); ctx.ellipse(e.x + e.w / 2, e.y + h / 2, e.w / 2, h / 2, 0, 0, Math.PI * 2); } else rr(ctx, e.x, e.y, e.w, h, r);
        ctx.stroke();
      }
      break;
    }
    case 'rect': case 'circle': {
      ctx.save(); shadowOn(ctx, e.shadow);
      if (e.type === 'circle') { ctx.beginPath(); ctx.ellipse(e.x + e.w / 2, e.y + h / 2, e.w / 2, h / 2, 0, 0, Math.PI * 2); } else rr(ctx, e.x, e.y, e.w, h, e.radius);
      if (e.fillOn) { ctx.fillStyle = e.fill; ctx.fill(); }
      ctx.restore();
      if (e.borderW > 0) {
        ctx.strokeStyle = e.borderC; ctx.lineWidth = e.borderW;
        if (e.type === 'circle') { ctx.beginPath(); ctx.ellipse(e.x + e.w / 2, e.y + h / 2, e.w / 2, h / 2, 0, 0, Math.PI * 2); } else rr(ctx, e.x, e.y, e.w, h, e.radius);
        ctx.stroke();
      }
      break;
    }
    case 'line': {
      ctx.strokeStyle = e.borderC; ctx.lineWidth = Math.max(1, e.borderW); ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(e.x, e.y + h / 2); ctx.lineTo(e.x + e.w, e.y + h / 2); ctx.stroke();
      break;
    }
    case 'options': {
      const items = e.items.split('\n').filter((t) => t.trim());
      const gap = e.size * 0.5, bh = e.size * 2.3, bw = (e.w - gap * (e.cols - 1)) / e.cols, badge = e.size * 1.35;
      const marks = ['ক', 'খ', 'গ', 'ঘ', 'ঙ', 'চ'];
      items.forEach((t, i) => {
        const bx = e.x + (i % e.cols) * (bw + gap), by = e.y + Math.floor(i / e.cols) * (bh + gap);
        ctx.fillStyle = e.card; rr(ctx, bx, by, bw, bh, bh * 0.3); ctx.fill();
        ctx.strokeStyle = e.edge; ctx.lineWidth = 2; ctx.stroke();
        ctx.fillStyle = e.mark; ctx.beginPath(); ctx.arc(bx + bh / 2, by + bh / 2, badge / 2, 0, Math.PI * 2); ctx.fill();
        setFont(ctx, 700, e.size * 0.75); ctx.fillStyle = e.markText; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(marks[i] ?? '•', bx + bh / 2, by + bh / 2 + 1);
        setFont(ctx, 600, e.size); ctx.fillStyle = e.color; ctx.textAlign = 'left';
        ctx.fillText(t.trim(), bx + bh, by + bh / 2 + 1, bw - bh - e.size * 0.5);
      });
      break;
    }
    case 'stat': {
      ctx.fillStyle = e.card; rr(ctx, e.x, e.y, e.w, h, 24); ctx.fill();
      ctx.strokeStyle = e.edge; ctx.lineWidth = 2; ctx.stroke();
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      let px = h * 0.42; setFont(ctx, 700, px);
      while (ctx.measureText(e.value).width > e.w - 20 && px > 10) { px -= 2; setFont(ctx, 700, px); }
      ctx.fillStyle = e.color; ctx.fillText(e.value, e.x + e.w / 2, e.y + h * 0.4);
      setFont(ctx, 500, h * 0.17); ctx.fillStyle = e.labelColor; ctx.fillText(e.label, e.x + e.w / 2, e.y + h * 0.76, e.w - 16);
      break;
    }
    case 'qr': {
      ctx.fillStyle = e.bg; rr(ctx, e.x, e.y, e.w, h, e.w * 0.06); ctx.fill();
      const p = e.w * 0.07;
      drawQR(ctx, e.text || 'https://muhammadfazal.com/nusuk', e.x + p, e.y + p, e.w - p * 2, e.color);
      break;
    }
    case 'map': {
      drawMap(ctx, counts ?? [], e.x, e.y, e.w, h, { accent: e.edge }, e.panel);
      break;
    }
  }
  ctx.restore();
}

/** Draw the whole design; returns each element's box (for the editor's handles) */
export async function renderDoc(canvas: HTMLCanvasElement, d: Doc, counts: number[] | null) {
  const { w: W, h: H } = BSIZES[d.size];
  if (canvas.width !== W) canvas.width = W;
  if (canvas.height !== H) canvas.height = H;
  const ctx = canvas.getContext('2d')!;
  try { await Promise.all([document.fonts.load(`700 40px ${FONT}`), document.fonts.load(`400 40px ${FONT}`)]); } catch { /* fallback */ }
  // load pictures first, so the drawing below is one quick pass
  await Promise.all([d.bg.image, ...d.els.map((e) => (e.type === 'image' ? e.src || (e.logo ? LOGO : '') : ''))].filter(Boolean).map(getImg));
  ctx.clearRect(0, 0, W, H);
  await drawBg(ctx, W, H, d.bg);
  const boxes: Record<string, { x: number; y: number; w: number; h: number }> = {};
  for (const e of d.els) {
    const h = measure(ctx, e);
    boxes[e.id] = { x: e.x, y: e.y, w: e.w, h };
    await drawEl(ctx, e, h, counts);
  }
  drawFrame(ctx, W, H, d.bg);
  return boxes;
}

// ------------------------------------------------------------------ widgets
export type WidgetKey = 'heading' | 'sub' | 'para' | 'tag' | 'button' | 'list' | 'steps' | 'options' | 'stat' | 'code' | 'web' | 'image' | 'logo' | 'rect' | 'card' | 'circle' | 'line' | 'qr' | 'map';
export const WIDGETS: { key: WidgetKey; label: string; group: 'Text' | 'Pictures' | 'Shapes' | 'Nusuk' }[] = [
  { key: 'heading', label: 'Heading', group: 'Text' },
  { key: 'sub', label: 'Sub heading', group: 'Text' },
  { key: 'para', label: 'Paragraph', group: 'Text' },
  { key: 'tag', label: 'Tag / badge', group: 'Text' },
  { key: 'button', label: 'Button', group: 'Text' },
  { key: 'list', label: 'Points ✓', group: 'Text' },
  { key: 'steps', label: 'Steps 1-2-3', group: 'Text' },
  { key: 'image', label: 'Picture', group: 'Pictures' },
  { key: 'logo', label: 'Logo', group: 'Pictures' },
  { key: 'rect', label: 'Box', group: 'Shapes' },
  { key: 'card', label: 'Glass card', group: 'Shapes' },
  { key: 'circle', label: 'Circle', group: 'Shapes' },
  { key: 'line', label: 'Line', group: 'Shapes' },
  { key: 'options', label: 'Quiz options', group: 'Nusuk' },
  { key: 'stat', label: 'Number box', group: 'Nusuk' },
  { key: 'code', label: 'Nusuk code', group: 'Nusuk' },
  { key: 'web', label: 'Website bar', group: 'Nusuk' },
  { key: 'qr', label: 'QR code', group: 'Nusuk' },
  { key: 'map', label: 'District map', group: 'Nusuk' },
];

const T0 = { opacity: 1, rot: 0 };
export const text = (p: Partial<TextEl>): TextEl => ({
  id: uid(), type: 'text', x: 0, y: 0, w: 800, h: 100, ...T0, text: 'লেখা', size: 40, weight: 600, color: '#ffffff', align: 'center', lh: 1.3, font: 'bn',
  bg: '#f2c94c', bgOn: false, pad: 24, radius: 20, shadow: false, borderW: 0, borderC: '#f2c94c', ...p,
});
/** A new element for a widget, centred on (cx, cy) */
export function makeWidget(k: WidgetKey, W: number, cx: number, cy: number): El {
  const S = W / 1080;
  let e: El;
  switch (k) {
    case 'heading': e = text({ text: 'আপনার শিরোনাম', size: 76 * S, weight: 700, w: 900 * S, lh: 1.2, name: 'Heading' }); break;
    case 'sub': e = text({ text: 'ছোট একটি উপ-শিরোনাম', size: 42 * S, weight: 600, color: '#f2c94c', w: 860 * S, name: 'Sub heading' }); break;
    case 'para': e = text({ text: 'এখানে বিস্তারিত লিখুন। লেখা বেশি হলে বক্স নিজে থেকেই লম্বা হবে।', size: 34 * S, weight: 400, color: '#e8f5ee', w: 820 * S, lh: 1.5, name: 'Paragraph' }); break;
    case 'tag': e = text({ text: '🆕 নতুন', size: 30 * S, weight: 700, color: '#2b1f00', w: 260 * S, bgOn: true, bg: '#f2c94c', pad: 16 * S, radius: 40 * S, name: 'Tag' }); break;
    case 'button': e = text({ text: 'এখনই ভিজিট করুন →', size: 36 * S, weight: 700, color: '#2b1f00', w: 560 * S, bgOn: true, bg: '#f2c94c', pad: 22 * S, radius: 60 * S, shadow: true, name: 'Button' }); break;
    case 'list': e = { id: uid(), type: 'list', x: 0, y: 0, w: 780 * S, h: 200, ...T0, items: 'প্রথম পয়েন্ট\nদ্বিতীয় পয়েন্ট\nতৃতীয় পয়েন্ট', size: 36 * S, color: '#ffffff', mark: '#f2c94c', markText: '#2b1f00', numbered: false, weight: 500, name: 'Points' }; break;
    case 'steps': e = { id: uid(), type: 'list', x: 0, y: 0, w: 780 * S, h: 200, ...T0, items: 'Copy Code চাপুন\nNusuk অ্যাপ খুলুন\nকোড পেস্ট করুন', size: 36 * S, color: '#ffffff', mark: '#f2c94c', markText: '#2b1f00', numbered: true, weight: 500, name: 'Steps' }; break;
    case 'image': e = { id: uid(), type: 'image', x: 0, y: 0, w: 600 * S, h: 420 * S, ...T0, src: '', fit: 'cover', radius: 28 * S, circle: false, borderW: 6 * S, borderC: '#ffffff', shadow: true, name: 'Picture' }; break;
    case 'logo': e = { id: uid(), type: 'image', x: 0, y: 0, w: 160 * S, h: 160 * S, ...T0, src: '', logo: true, fit: 'contain', radius: 0, circle: false, borderW: 0, borderC: '#f2c94c', shadow: false, name: 'Logo' }; break;
    case 'rect': e = { id: uid(), type: 'rect', x: 0, y: 0, w: 600 * S, h: 300 * S, ...T0, fill: '#0b5a43', fillOn: true, borderW: 0, borderC: '#f2c94c', radius: 28 * S, shadow: false, name: 'Box' }; break;
    case 'card': e = { id: uid(), type: 'rect', x: 0, y: 0, w: 860 * S, h: 380 * S, ...T0, fill: '#ffffff', fillOn: true, opacity: 0.1, borderW: 0, borderC: '#f2c94c', radius: 32 * S, shadow: false, name: 'Glass card' }; break;
    case 'circle': e = { id: uid(), type: 'circle', x: 0, y: 0, w: 260 * S, h: 260 * S, ...T0, fill: '#f2c94c', fillOn: true, borderW: 0, borderC: '#ffffff', radius: 0, shadow: false, name: 'Circle' }; break;
    case 'line': e = { id: uid(), type: 'line', x: 0, y: 0, w: 700 * S, h: 4, ...T0, fill: '#f2c94c', fillOn: false, borderW: 4 * S, borderC: '#f2c94c', radius: 0, shadow: false, name: 'Line' }; break;
    case 'options': e = { id: uid(), type: 'options', x: 0, y: 0, w: 900 * S, h: 260, ...T0, items: 'বাংলাদেশ\nপাকিস্তান\nইন্দোনেশিয়া\nমিশর', size: 36 * S, color: '#ffffff', card: 'rgba(255,255,255,0.08)', edge: '#f2c94c', mark: '#f2c94c', markText: '#2b1f00', cols: 2, name: 'Quiz options' }; break;
    case 'stat': e = { id: uid(), type: 'stat', x: 0, y: 0, w: 280 * S, h: 170 * S, ...T0, value: '১৬৩', label: 'মোট অ্যাকাউন্ট', color: '#f2c94c', labelColor: '#e8f5ee', card: 'rgba(255,255,255,0.08)', edge: '#f2c94c', name: 'Number box' }; break;
    case 'code': e = text({ text: 'NG-XXXXXXXX', font: 'mono', size: 80 * S, weight: 700, color: '#053d2d', w: 760 * S, bgOn: true, bg: '#ffffff', pad: 30 * S, radius: 30 * S, borderW: 6 * S, borderC: '#f2c94c', shadow: true, name: 'Nusuk code' }); break;
    case 'web': e = text({ text: '🌐 muhammadfazal.com/nusuk', size: 30 * S, weight: 600, color: '#ffffff', w: 620 * S, bgOn: true, bg: 'rgba(0,0,0,0.25)', pad: 16 * S, radius: 40 * S, name: 'Website bar' }); break;
    case 'qr': e = { id: uid(), type: 'qr', x: 0, y: 0, w: 220 * S, h: 220 * S, ...T0, text: 'https://muhammadfazal.com/nusuk', color: '#053d2d', bg: '#ffffff', name: 'QR code' }; break;
    case 'map': e = { id: uid(), type: 'map', x: 0, y: 0, w: 480 * S, h: 680 * S, ...T0, panel: true, edge: '#f2c94c', name: 'District map' }; break;
  }
  e.x = Math.round(cx - e.w / 2);
  e.y = Math.round(cy - (e.type === 'text' || e.type === 'list' || e.type === 'options' ? 60 * S : e.h / 2));
  return e;
}

