/**
 * Nusuk Manager → Social media: draws a post image (JPG) from blocks of content.
 * Only the blocks that have content are drawn; everything is measured first, then the
 * font size shrinks until it all fits, and the whole thing is centred. So an empty field
 * never leaves a gap, and a new field finds its own place.
 * Layouts: "stack" (one column, centred) or "split" (text on the left, picture / map on the right).
 */
import { BD_DISTRICTS, BD_H, BD_W } from './bdmap';
import { FONT, loadImage, rr } from './clubcard';

export type SizeKey = 'portrait' | 'square' | 'story';
export const SIZES: Record<SizeKey, { w: number; h: number; label: string }> = {
  portrait: { w: 1080, h: 1350, label: 'Portrait 4:5 (Facebook / Instagram)' },
  square: { w: 1080, h: 1080, label: 'Square 1:1' },
  story: { w: 1080, h: 1920, label: 'Story / Reel 9:16' },
};

export type ThemeKey = 'green' | 'cream' | 'night';
type Theme = {
  bg1: string; bg2: string; glow: string; pattern: string; frame: string;
  title: string; text: string; soft: string; accent: string; onAccent: string; card: string; cardEdge: string;
};
export const THEMES: Record<ThemeKey, Theme & { name: string }> = {
  green: { name: 'Green', bg1: '#075c45', bg2: '#021f17', glow: 'rgba(242,201,76,0.22)', pattern: 'rgba(212,175,55,0.12)', frame: 'rgba(242,201,76,0.55)',
    title: '#ffffff', text: 'rgba(255,255,255,0.88)', soft: 'rgba(255,255,255,0.62)', accent: '#f2c94c', onAccent: '#2b1f00', card: 'rgba(255,255,255,0.08)', cardEdge: 'rgba(242,201,76,0.45)' },
  cream: { name: 'Cream', bg1: '#fffaf0', bg2: '#efe0b5', glow: 'rgba(11,90,67,0.10)', pattern: 'rgba(11,90,67,0.08)', frame: 'rgba(11,90,67,0.45)',
    title: '#053d2d', text: '#24423a', soft: 'rgba(5,61,45,0.6)', accent: '#0b5a43', onAccent: '#ffffff', card: '#ffffff', cardEdge: 'rgba(183,121,31,0.45)' },
  night: { name: 'Night blue', bg1: '#1c2c55', bg2: '#060b17', glow: 'rgba(79,227,208,0.18)', pattern: 'rgba(79,227,208,0.10)', frame: 'rgba(79,227,208,0.5)',
    title: '#ffffff', text: 'rgba(255,255,255,0.88)', soft: 'rgba(255,255,255,0.6)', accent: '#4fe3d0', onAccent: '#04221f', card: 'rgba(255,255,255,0.07)', cardEdge: 'rgba(79,227,208,0.45)' },
};

export type Prize = { rank: string; name: string; img: HTMLImageElement | null };
export type Block =
  | { k: 'tag'; text: string }
  | { k: 'title'; text: string }
  | { k: 'sub'; text: string }
  | { k: 'body'; text: string }
  | { k: 'list'; items: string[]; numbered?: boolean }
  | { k: 'options'; items: string[] }
  | { k: 'stats'; items: { v: string; l: string }[] }
  | { k: 'quote'; text: string; source?: string }
  | { k: 'info'; items: { icon: string; text: string }[] }
  | { k: 'big'; text: string }
  | { k: 'prizes'; items: Prize[] }
  | { k: 'cta'; text: string };
export type Visual = { kind: 'image'; img: HTMLImageElement } | { kind: 'map'; counts: number[] } | null;
export type Design = {
  size: SizeKey;
  theme: ThemeKey;
  logo: HTMLImageElement | null;
  brand: string;
  brandSub: string;
  footer: string;
  blocks: Block[];
  visual: Visual;
  layout: 'auto' | 'stack' | 'split';
};

export const BN_RANK = ['১ম', '২য়', '৩য়', '৪র্থ', '৫ম', '৬ষ্ঠ'];
export const OPTION_MARK = ['ক', 'খ', 'গ', 'ঘ', 'ঙ', 'চ'];
export const bnNum = (n: number | string) => String(n).replace(/\d/g, (d) => '০১২৩৪৫৬৭৮৯'[Number(d)]);

let defaultLogo: Promise<HTMLImageElement | null> | null = null;
export const ribatLogo = () => (defaultLogo ??= loadImage('/nusuk/ribat-logo.webp'));
export function fileToImage(f: File) {
  return new Promise<{ url: string; img: HTMLImageElement | null }>((res) => {
    const r = new FileReader();
    r.onload = async () => { const url = String(r.result); res({ url, img: await loadImage(url) }); };
    r.onerror = () => res({ url: '', img: null });
    r.readAsDataURL(f);
  });
}

/** True when a block has something to show */
export function filled(b: Block) {
  switch (b.k) {
    case 'list': case 'options': return b.items.some((t) => t.trim());
    case 'stats': return b.items.some((s) => s.v.trim());
    case 'info': return b.items.some((s) => s.text.trim());
    case 'prizes': return b.items.some((p) => p.name.trim() || p.img);
    default: return !!b.text.trim();
  }
}

// ---------------------------------------------------------------- text helpers
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
const font = (ctx: CanvasRenderingContext2D, weight: number, px: number) => { ctx.font = `${weight} ${Math.round(px)}px ${FONT}`; };

type Prepared = { h: number; draw: (x: number, y: number) => void };
type Ctx = { ctx: CanvasRenderingContext2D; T: Theme; s: number; w: number; center: boolean };

function textBlock(c: Ctx, text: string, weight: number, px: number, color: string, lh: number, maxW = c.w): Prepared {
  const { ctx } = c;
  font(ctx, weight, px * c.s);
  const lines = wrap(ctx, text.trim(), maxW);
  const step = px * c.s * lh;
  return {
    h: lines.length * step,
    draw: (x, y) => {
      font(ctx, weight, px * c.s);
      ctx.fillStyle = color;
      ctx.textBaseline = 'middle';
      ctx.textAlign = c.center ? 'center' : 'left';
      lines.forEach((l, i) => ctx.fillText(l, c.center ? x + c.w / 2 : x, y + step * i + step / 2));
    },
  };
}

function pill(c: Ctx, text: string, px: number, bg: string, fg: string, padX: number, h: number): Prepared {
  const { ctx, s } = c;
  let fs = px * s; // shrink the words until they fit the column
  font(ctx, 700, fs);
  while (ctx.measureText(text).width + padX * 2 * s > c.w && fs > 14) { fs -= 1; font(ctx, 700, fs); }
  const w = Math.min(c.w, ctx.measureText(text).width + padX * 2 * s);
  return {
    h: h * s,
    draw: (x, y) => {
      const px0 = c.center ? x + (c.w - w) / 2 : x;
      ctx.fillStyle = bg; rr(ctx, px0, y, w, h * s, (h * s) / 2); ctx.fill();
      font(ctx, 700, fs);
      ctx.fillStyle = fg; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(text, px0 + w / 2, y + (h * s) / 2 + 1);
    },
  };
}

function prepBlock(c: Ctx, b: Block): Prepared {
  const { ctx, T, s } = c;
  switch (b.k) {
    case 'tag': return pill(c, b.text.trim(), 30, T.accent, T.onAccent, 28, 58);
    case 'title': return textBlock(c, b.text, 700, 76, T.title, 1.22);
    case 'sub': return textBlock(c, b.text, 600, 42, T.accent, 1.32);
    case 'body': return textBlock(c, b.text, 400, 36, T.text, 1.5);
    case 'big': return textBlock(c, b.text, 700, 92, T.accent, 1.15);
    case 'cta': return pill(c, `${b.text.trim()}  →`, 36, T.accent, T.onAccent, 46, 80);
    case 'list': {
      const items = b.items.map((t) => t.trim()).filter(Boolean);
      const icon = 40 * s, gap = 16 * s, lw = c.center ? Math.min(c.w, 860 * s) : c.w;
      font(ctx, 500, 36 * s);
      const rows = items.map((t) => wrap(ctx, t, lw - icon - 20 * s));
      const step = 36 * s * 1.42;
      const hs = rows.map((r) => Math.max(icon, r.length * step));
      return {
        h: hs.reduce((a, v) => a + v, 0) + gap * (rows.length - 1),
        draw: (x, y) => {
          const x0 = c.center ? x + (c.w - lw) / 2 : x;
          let yy = y;
          rows.forEach((r, i) => {
            const cy = yy + Math.min(hs[i], step) / 2 + (step > icon ? 0 : (icon - step) / 2);
            ctx.fillStyle = T.accent; ctx.beginPath(); ctx.arc(x0 + icon / 2, cy, icon / 2, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = T.onAccent; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
            font(ctx, 700, (b.numbered ? 24 : 26) * s);
            ctx.fillText(b.numbered ? bnNum(i + 1) : '✓', x0 + icon / 2, cy + 1);
            font(ctx, 500, 36 * s); ctx.fillStyle = T.text; ctx.textAlign = 'left';
            r.forEach((l, j) => ctx.fillText(l, x0 + icon + 20 * s, yy + step * j + step / 2));
            yy += hs[i] + gap;
          });
        },
      };
    }
    case 'options': {
      const items = b.items.map((t) => t.trim()).filter(Boolean);
      const cols = items.length === 2 || items.length === 4 ? 2 : 1;
      const gap = 20 * s, bw = (c.w - gap * (cols - 1)) / cols, badge = 52 * s, pad = 22 * s;
      font(ctx, 600, 36 * s);
      const rows = items.map((t) => wrap(ctx, t, bw - badge - pad * 3));
      const step = 36 * s * 1.35;
      const rowH: number[] = [];
      for (let i = 0; i < items.length; i += cols) rowH.push(Math.max(...rows.slice(i, i + cols).map((r) => Math.max(badge, r.length * step))) + pad * 2);
      return {
        h: rowH.reduce((a, v) => a + v, 0) + gap * (rowH.length - 1),
        draw: (x, y) => {
          let yy = y;
          rowH.forEach((h, ri) => {
            for (let ci = 0; ci < cols; ci++) {
              const i = ri * cols + ci;
              if (i >= items.length) break;
              const bx = x + ci * (bw + gap);
              ctx.fillStyle = T.card; rr(ctx, bx, yy, bw, h, 22 * s); ctx.fill();
              ctx.strokeStyle = T.cardEdge; ctx.lineWidth = 2 * s; ctx.stroke();
              ctx.fillStyle = T.accent; ctx.beginPath(); ctx.arc(bx + pad + badge / 2, yy + h / 2, badge / 2, 0, Math.PI * 2); ctx.fill();
              ctx.fillStyle = T.onAccent; font(ctx, 700, 28 * s); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
              ctx.fillText(OPTION_MARK[i], bx + pad + badge / 2, yy + h / 2 + 1);
              font(ctx, 600, 36 * s); ctx.fillStyle = T.title; ctx.textAlign = 'left';
              const r = rows[i], th = r.length * step;
              r.forEach((l, j) => ctx.fillText(l, bx + pad * 2 + badge, yy + (h - th) / 2 + step * j + step / 2));
            }
            yy += h + gap;
          });
        },
      };
    }
    case 'stats': {
      const items = b.items.filter((x) => x.v.trim()).slice(0, 4);
      const gap = 18 * s, bw = (c.w - gap * (items.length - 1)) / items.length, h = 160 * s;
      return {
        h,
        draw: (x, y) => {
          items.forEach((it, i) => {
            const bx = x + i * (bw + gap);
            ctx.fillStyle = T.card; rr(ctx, bx, y, bw, h, 24 * s); ctx.fill();
            ctx.strokeStyle = T.cardEdge; ctx.lineWidth = 2 * s; ctx.stroke();
            ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
            let px = 66 * s; font(ctx, 700, px);
            while (ctx.measureText(it.v).width > bw - 24 * s && px > 24) { px -= 2; font(ctx, 700, px); }
            ctx.fillStyle = T.accent; ctx.fillText(it.v.trim(), bx + bw / 2, y + h * 0.4);
            font(ctx, 500, 28 * s); ctx.fillStyle = T.text;
            ctx.fillText(it.l.trim(), bx + bw / 2, y + h * 0.76, bw - 16 * s);
          });
        },
      };
    }
    case 'quote': {
      const body = textBlock({ ...c, center: true }, b.text, 600, 62, T.title, 1.45, c.w - 80 * s);
      const src = b.source?.trim() ? textBlock({ ...c, center: true }, `— ${b.source.trim()}`, 600, 34, T.accent, 1.3) : null;
      const top = 90 * s;
      return {
        h: top + body.h + (src ? 24 * s + src.h : 0),
        draw: (x, y) => {
          font(ctx, 700, 170 * s); ctx.fillStyle = T.accent; ctx.globalAlpha = 0.9; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
          ctx.fillText('“', x + c.w / 2, y + top * 0.62); ctx.globalAlpha = 1;
          body.draw(x, y + top);
          src?.draw(x, y + top + body.h + 24 * s);
        },
      };
    }
    case 'info': {
      const items = b.items.filter((i) => i.text.trim());
      const rowH = 70 * s, gap = 14 * s, lw = Math.min(c.w, 820 * s);
      return {
        h: items.length * rowH + (items.length - 1) * gap,
        draw: (x, y) => {
          const x0 = c.center ? x + (c.w - lw) / 2 : x;
          items.forEach((it, i) => {
            const yy = y + i * (rowH + gap);
            ctx.fillStyle = T.card; rr(ctx, x0, yy, lw, rowH, rowH / 2); ctx.fill();
            ctx.strokeStyle = T.cardEdge; ctx.lineWidth = 2 * s; ctx.stroke();
            font(ctx, 400, 34 * s); ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = T.title;
            ctx.fillText(it.icon, x0 + 44 * s, yy + rowH / 2 + 2);
            font(ctx, 600, 34 * s); ctx.fillStyle = T.title; ctx.textAlign = 'left';
            ctx.fillText(it.text.trim(), x0 + 86 * s, yy + rowH / 2 + 1, lw - 110 * s);
          });
        },
      };
    }
    case 'prizes': {
      const items = b.items.filter((p) => p.name.trim() || p.img).slice(0, 6);
      const cols = items.length <= 3 ? items.length : 3;
      const gap = 20 * s, cw = (c.w - gap * (cols - 1)) / cols, pad = 16 * s;
      const imgS = Math.min(cw - pad * 2, (items.length > 3 ? 210 : 280) * s);
      font(ctx, 700, 32 * s);
      const names = items.map((p) => wrap(ctx, p.name.trim(), cw - pad * 2).slice(0, 2));
      const step = 32 * s * 1.3, badgeH = 50 * s;
      const cardH = pad + badgeH + 14 * s + imgS + 14 * s + 2 * step + pad;
      const rowsN = Math.ceil(items.length / cols);
      return {
        h: rowsN * cardH + (rowsN - 1) * gap,
        draw: (x, y) => {
          items.forEach((p, i) => {
            const bx = x + (i % cols) * (cw + gap), by = y + Math.floor(i / cols) * (cardH + gap);
            const first = i === 0;
            ctx.save();
            if (first) { ctx.shadowColor = T.accent; ctx.shadowBlur = 28 * s; }
            ctx.fillStyle = T.card; rr(ctx, bx, by, cw, cardH, 26 * s); ctx.fill();
            ctx.restore();
            ctx.strokeStyle = first ? T.accent : T.cardEdge; ctx.lineWidth = (first ? 4 : 2) * s; rr(ctx, bx, by, cw, cardH, 26 * s); ctx.stroke();
            // rank
            const medal = ['🥇', '🥈', '🥉'][i] ?? '🎁';
            const label = `${medal} ${p.rank.trim() || `${BN_RANK[i]} পুরস্কার`}`;
            font(ctx, 700, 26 * s);
            const lw = Math.min(cw - pad * 2, ctx.measureText(label).width + 32 * s);
            ctx.fillStyle = T.accent; rr(ctx, bx + (cw - lw) / 2, by + pad, lw, badgeH, badgeH / 2); ctx.fill();
            ctx.fillStyle = T.onAccent; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
            ctx.fillText(label, bx + cw / 2, by + pad + badgeH / 2 + 1, cw - pad * 2 - 16 * s);
            // picture
            const iy = by + pad + badgeH + 14 * s, ix = bx + (cw - imgS) / 2;
            ctx.fillStyle = '#ffffff'; rr(ctx, ix, iy, imgS, imgS, 20 * s); ctx.fill();
            if (p.img) {
              ctx.save(); rr(ctx, ix, iy, imgS, imgS, 20 * s); ctx.clip();
              const k = Math.min((imgS - 16 * s) / p.img.width, (imgS - 16 * s) / p.img.height);
              const w = p.img.width * k, h = p.img.height * k;
              ctx.drawImage(p.img, ix + (imgS - w) / 2, iy + (imgS - h) / 2, w, h);
              ctx.restore();
            } else {
              font(ctx, 400, imgS * 0.4); ctx.fillStyle = '#0b5a43'; ctx.fillText('🎁', ix + imgS / 2, iy + imgS / 2 + 4);
            }
            // name
            font(ctx, 700, 32 * s); ctx.fillStyle = T.title;
            const ny = iy + imgS + 14 * s + (2 * step - names[i].length * step) / 2;
            names[i].forEach((l, j) => ctx.fillText(l, bx + cw / 2, ny + step * j + step / 2));
          });
        },
      };
    }
  }
}

// ---------------------------------------------------------------- pictures
function drawPicture(ctx: CanvasRenderingContext2D, img: HTMLImageElement, x: number, y: number, w: number, h: number, T: Theme) {
  const k = Math.min(w / img.width, h / img.height);
  const dw = img.width * k, dh = img.height * k;
  const dx = x + (w - dw) / 2, dy = y + (h - dh) / 2;
  const r = Math.min(28, dw / 10);
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.35)'; ctx.shadowBlur = 40; ctx.shadowOffsetY = 16;
  ctx.fillStyle = '#ffffff'; rr(ctx, dx - 8, dy - 8, dw + 16, dh + 16, r + 6); ctx.fill();
  ctx.restore();
  ctx.save(); rr(ctx, dx, dy, dw, dh, r); ctx.clip(); ctx.drawImage(img, dx, dy, dw, dh); ctx.restore();
  ctx.strokeStyle = T.accent; ctx.lineWidth = 4; rr(ctx, dx - 8, dy - 8, dw + 16, dh + 16, r + 6); ctx.stroke();
}

const MAP_EMPTY = '#cdeedb';
function mapShade(n: number, max: number) {
  const t = Math.log(1 + n) / Math.log(1 + Math.max(max, 2));
  const a = [79, 174, 134], b = [6, 70, 51];
  return `rgb(${a.map((v, j) => Math.round(v + (b[j] - v) * t)).join(',')})`;
}
/** Bangladesh district map in a light panel: dark green where there are accounts, with the count */
export function drawMap(ctx: CanvasRenderingContext2D, counts: number[], x: number, y: number, w: number, h: number, T: { accent: string }, panel = true) {
  if (panel) {
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.3)'; ctx.shadowBlur = 36; ctx.shadowOffsetY = 14;
    const g = ctx.createRadialGradient(x + w / 2, y + h * 0.35, 10, x + w / 2, y + h / 2, Math.max(w, h));
    g.addColorStop(0, '#f6fcf8'); g.addColorStop(1, '#e1f2e8');
    ctx.fillStyle = g; rr(ctx, x, y, w, h, 30); ctx.fill();
    ctx.restore();
    ctx.strokeStyle = T.accent; ctx.lineWidth = 3; rr(ctx, x, y, w, h, 30); ctx.stroke();
  }
  const pad = panel ? 22 : 0;
  const k = Math.min((w - pad * 2) / BD_W, (h - pad * 2) / BD_H);
  const ox = x + (w - BD_W * k) / 2, oy = y + (h - BD_H * k) / 2;
  const max = Math.max(0, ...counts);
  ctx.save();
  ctx.translate(ox, oy); ctx.scale(k, k);
  ctx.lineJoin = 'round';
  BD_DISTRICTS.forEach(([, , path], i) => {
    const p = new Path2D(path);
    ctx.fillStyle = counts[i] ? mapShade(counts[i], max) : MAP_EMPTY;
    ctx.fill(p);
    ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1.1 / k; ctx.stroke(p);
  });
  ctx.restore();
  // counts on the districts that have accounts (biggest first, so the small ones stay on top)
  const order = BD_DISTRICTS.map((_, i) => i).filter((i) => counts[i] > 0).sort((a, b) => counts[b] - counts[a]);
  const top = new Set(order.slice(0, 3));
  const fs = Math.max(8, 11 * (k / 0.75)); // small badges, so the map itself shows
  for (const i of order.reverse()) {
    const [bn, , , lx, ly] = BD_DISTRICTS[i];
    const cx = ox + lx * k, cy = oy + ly * k;
    const t = bnNum(counts[i]);
    font(ctx, 800, fs);
    const bw = ctx.measureText(t).width + fs * 0.9, bh = fs * 1.35;
    if (top.has(i)) {
      font(ctx, 700, fs * 1.05);
      ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(3,40,30,0.7)'; ctx.fillStyle = '#ffffff'; ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
      ctx.strokeText(bn, cx, cy - bh / 2 - 2); ctx.fillText(bn, cx, cy - bh / 2 - 2);
    }
    ctx.fillStyle = '#f2c94c'; rr(ctx, cx - bw / 2, cy - bh / 2, bw, bh, bh / 2); ctx.fill();
    ctx.strokeStyle = '#8a6a12'; ctx.lineWidth = 1; ctx.stroke();
    font(ctx, 800, fs); ctx.fillStyle = '#3b2a00'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(t, cx, cy + 1);
  }
}

// ---------------------------------------------------------------- frame
function drawBackground(ctx: CanvasRenderingContext2D, W: number, H: number, T: Theme) {
  const g = ctx.createLinearGradient(0, 0, W * 0.4, H);
  g.addColorStop(0, T.bg1); g.addColorStop(1, T.bg2);
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  const glow = (gx: number, gy: number, r: number) => {
    const rg = ctx.createRadialGradient(gx, gy, 0, gx, gy, r);
    rg.addColorStop(0, T.glow); rg.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = rg; ctx.fillRect(0, 0, W, H);
  };
  glow(W, 0, W * 0.8); glow(0, H, W * 0.7);
  // eight-point star pattern (same as the site header)
  ctx.strokeStyle = T.pattern; ctx.lineWidth = 1.6;
  const c = 72;
  for (let yy = 0; yy < H + c; yy += c)
    for (let xx = 0; xx < W + c; xx += c) {
      const m = c / 2, a = c * 0.04, b = c * 0.32;
      ctx.beginPath();
      ctx.moveTo(xx + m, yy + a); ctx.lineTo(xx + m + c * 0.135, yy + b); ctx.lineTo(xx + c - a, yy + m);
      ctx.lineTo(xx + m + c * 0.135, yy + c - b); ctx.lineTo(xx + m, yy + c - a); ctx.lineTo(xx + m - c * 0.135, yy + c - b);
      ctx.lineTo(xx + a, yy + m); ctx.lineTo(xx + m - c * 0.135, yy + b); ctx.closePath(); ctx.stroke();
    }
  ctx.strokeStyle = T.frame; ctx.lineWidth = 3; rr(ctx, 26, 26, W - 52, H - 52, 34); ctx.stroke();
}

function drawHeader(ctx: CanvasRenderingContext2D, d: Design, T: Theme, W: number) {
  const L = 104, x = 70, y = 62;
  ctx.save();
  ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(x + L / 2, y + L / 2, L / 2, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = T.accent; ctx.lineWidth = 4; ctx.stroke();
  if (d.logo) {
    ctx.beginPath(); ctx.arc(x + L / 2, y + L / 2, L / 2 - 6, 0, Math.PI * 2); ctx.clip();
    const k = Math.min((L - 16) / d.logo.width, (L - 16) / d.logo.height);
    ctx.drawImage(d.logo, x + (L - d.logo.width * k) / 2, y + (L - d.logo.height * k) / 2, d.logo.width * k, d.logo.height * k);
  }
  ctx.restore();
  ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
  const tx = x + L + 24, mw = W - tx - 80;
  if (d.brand.trim()) { font(ctx, 700, 42); ctx.fillStyle = T.title; ctx.fillText(d.brand.trim(), tx, y + (d.brandSub.trim() ? 36 : L / 2), mw); }
  if (d.brandSub.trim()) { font(ctx, 500, 27); ctx.fillStyle = T.soft; ctx.fillText(d.brandSub.trim(), tx, y + 78, mw); }
  return y + L;
}

function drawFooter(ctx: CanvasRenderingContext2D, d: Design, T: Theme, W: number, H: number) {
  if (!d.footer.trim()) return H - 70;
  const y = H - 104;
  ctx.strokeStyle = T.cardEdge; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(90, y - 22); ctx.lineTo(W - 90, y - 22); ctx.stroke();
  font(ctx, 600, 30); ctx.fillStyle = T.soft; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(d.footer.trim(), W / 2, y + 18, W - 160);
  return y - 40;
}

// ---------------------------------------------------------------- the whole post
export async function drawDesign(canvas: HTMLCanvasElement, d: Design) {
  const { w: W, h: H } = SIZES[d.size];
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d')!;
  try { await document.fonts.load(`700 40px ${FONT}`); await document.fonts.load(`400 40px ${FONT}`); } catch { /* fallback font */ }
  const T = THEMES[d.theme];
  drawBackground(ctx, W, H, T);
  const top = drawHeader(ctx, d, T, W) + 46;
  const bottom = drawFooter(ctx, d, T, W, H);
  const blocks = d.blocks.filter(filled);
  const v = d.visual;
  const split = !!v && d.size !== 'story' && (d.layout === 'split' || (d.layout === 'auto' && (v.kind === 'map' || v.img.height / v.img.width >= 0.95)));
  const X = 80, areaW = W - X * 2, areaH = bottom - top;

  const gapOf = (b: Block, s: number) => (b.k === 'tag' ? 26 : b.k === 'title' ? 24 : b.k === 'cta' ? 40 : 30) * s;
  /** lay out text blocks in a column, shrinking until they fit */
  const column = (w: number, h: number, center: boolean, extra?: { h: (s: number) => number; at: number }) => {
    let s = 1, prepared: Prepared[] = [], total = 0;
    for (s = 1.3; s >= 0.42; s -= 0.04) { // short posts get bigger letters, long ones shrink
      const c: Ctx = { ctx, T, s, w, center };
      prepared = blocks.map((b) => prepBlock(c, b));
      total = prepared.reduce((a, p, i) => a + p.h + (i ? gapOf(blocks[i], s) : 0), 0) + (extra ? extra.h(s) + 36 * s : 0);
      if (total <= h) break;
    }
    return { s: Math.max(s, 0.42), prepared, total };
  };

  if (split && v) {
    const colGap = 44, vw = Math.round(areaW * (v.kind === 'map' ? 0.47 : 0.44)), tw = areaW - vw - colGap;
    const { prepared, total, s } = column(tw, areaH, false);
    let y = top + Math.max(0, (areaH - total) / 2);
    prepared.forEach((p, i) => { if (i) y += gapOf(blocks[i], s); p.draw(X, y); y += p.h; });
    const vx = X + tw + colGap;
    if (v.kind === 'map') {
      const mh = Math.min(areaH, vw * (BD_H / BD_W) + 44);
      drawMap(ctx, v.counts, vx, top + (areaH - mh) / 2, vw, mh, T);
    } else drawPicture(ctx, v.img, vx + 8, top + 8, vw - 16, areaH - 16, T);
  } else {
    // one column; a picture / map goes right after the title lines
    const ratio = v ? (v.kind === 'map' ? BD_H / BD_W : v.img.height / v.img.width) : 0;
    const vH = (s: number) => (v ? Math.min(areaW * 0.9 * ratio, areaH * (blocks.length ? 0.5 : 0.9)) * Math.max(s, 0.7) : 0);
    const { prepared, total, s } = column(areaW, areaH, true, v ? { h: vH, at: 0 } : undefined);
    const after = Math.max(-1, ...blocks.map((b, i) => (['tag', 'title', 'sub', 'big'].includes(b.k) ? i : -1)));
    let y = top + Math.max(0, (areaH - total) / 2);
    const visual = () => {
      if (!v) return;
      const h = vH(s), w = Math.min(areaW, h / ratio);
      if (v.kind === 'map') drawMap(ctx, v.counts, X + (areaW - w) / 2, y, w, h, T);
      else drawPicture(ctx, v.img, X + (areaW - w) / 2 + 8, y + 8, w - 16, h - 16, T);
      y += h + 36 * s;
    };
    if (after < 0) visual();
    prepared.forEach((p, i) => {
      if (i) y += gapOf(blocks[i], s);
      p.draw(X, y); y += p.h;
      if (i === after) { y += 36 * s; visual(); y -= 36 * s; }
    });
  }
}

export function downloadJpg(canvas: HTMLCanvasElement, name: string) {
  return new Promise<boolean>((res) => {
    canvas.toBlob((b) => {
      if (!b) return res(false);
      const a = document.createElement('a');
      a.href = URL.createObjectURL(b);
      a.download = `${name.replace(/[^\wঀ-৿-]+/g, '-').slice(0, 60) || 'post'}.jpg`;
      document.body.append(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 4000);
      res(true);
    }, 'image/jpeg', 0.93);
  });
}
