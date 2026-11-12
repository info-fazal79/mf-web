/**
 * Reward Club photo card (1080×1350, Facebook portrait), drawn on a canvas in the browser:
 * Ribatul Ummah logo top-left, member SL top-right, the referral (Nusuk) code in the middle,
 * a QR code to the Nusuk page at the bottom. Three looks (themes), one per competition.
 */
import qrcode from 'qrcode-generator';
import { DEFAULT_CARD_LINE, bn, refLink } from './club';

export const CARD_W = 1080;
export const CARD_H = 1350;
const FONT = '"Hind Siliguri", system-ui, sans-serif';
const MONO = '"JetBrains Mono", ui-monospace, monospace';

export type CardTheme = 'green' | 'gold' | 'night';
export const CARD_THEMES: { key: CardTheme; name: string }[] = [
  { key: 'green', name: 'Green (Nusuk)' },
  { key: 'gold', name: 'Cream & gold' },
  { key: 'night', name: 'Night blue' },
];
type Look = {
  bg: [string, string, string]; ring: string; frame: string;
  title: string; head: string; text: string; soft: string;
  box: string; boxText: string; boxEdge: string;
  pill: string; pillText: string; panel: string; qrDark: string;
};
const LOOKS: Record<CardTheme, Look> = {
  green: {
    bg: ['#0b5a43', '#064532', '#022a1f'], ring: 'rgba(242,201,76,0.10)', frame: 'rgba(242,201,76,0.55)',
    title: '#ffffff', head: '#f2c94c', text: '#ffffff', soft: 'rgba(255,255,255,0.75)',
    box: '#ffffff', boxText: '#053d2d', boxEdge: '#f2c94c', pill: '#f2c94c', pillText: '#053d2d', panel: 'rgba(0,0,0,0.22)', qrDark: '#053d2d',
  },
  gold: {
    bg: ['#fffaf0', '#f6ecd0', '#ead9a8'], ring: 'rgba(11,90,67,0.08)', frame: 'rgba(160,120,30,0.55)',
    title: '#053d2d', head: '#0b5a43', text: '#10241b', soft: 'rgba(16,36,27,0.7)',
    box: '#0b5a43', boxText: '#ffe08a', boxEdge: '#c9a227', pill: '#0b5a43', pillText: '#ffe08a', panel: 'rgba(11,90,67,0.10)', qrDark: '#053d2d',
  },
  night: {
    bg: ['#1c2c55', '#111c3a', '#060b17'], ring: 'rgba(79,227,208,0.10)', frame: 'rgba(79,227,208,0.5)',
    title: '#ffffff', head: '#4fe3d0', text: '#ffffff', soft: 'rgba(255,255,255,0.72)',
    box: '#ffffff', boxText: '#111c3a', boxEdge: '#4fe3d0', pill: '#4fe3d0', pillText: '#06231f', panel: 'rgba(0,0,0,0.28)', qrDark: '#111c3a',
  },
};

function loadImage(src: string) {
  return new Promise<HTMLImageElement | null>((res) => {
    const i = new Image();
    i.onload = () => res(i);
    i.onerror = () => res(null);
    i.src = src;
  });
}

function rr(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

/** Text that shrinks until it fits `max` width */
function fitText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, max: number, size: number, weight: number, family = FONT) {
  let s = size;
  do {
    ctx.font = `${weight} ${s}px ${family}`;
    if (ctx.measureText(text).width <= max) break;
    s -= 2;
  } while (s > 12);
  ctx.fillText(text, x, y);
}

function drawQR(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, size: number, dark: string) {
  const qr = qrcode(0, 'M');
  qr.addData(text);
  qr.make();
  const n = qr.getModuleCount();
  const cell = size / n;
  ctx.fillStyle = dark;
  for (let r = 0; r < n; r++)
    for (let c = 0; c < n; c++)
      if (qr.isDark(r, c)) ctx.fillRect(Math.floor(x + c * cell), Math.floor(y + r * cell), Math.ceil(cell), Math.ceil(cell));
}

export type CardData = {
  code: string; sl: number; name: string;
  theme?: CardTheme; headline?: string; sub?: string; line?: string;
  /** e.g. "শেষ: ২০ নভেম্বর" for competitions with an end date */
  badge?: string;
};

export async function drawCard(canvas: HTMLCanvasElement, d: CardData) {
  const L = LOOKS[d.theme ?? 'green'] ?? LOOKS.green;
  canvas.width = CARD_W;
  canvas.height = CARD_H;
  const ctx = canvas.getContext('2d')!;
  try {
    await Promise.all([
      document.fonts.load(`700 60px "Hind Siliguri"`),
      document.fonts.load(`500 40px "Hind Siliguri"`),
      document.fonts.load(`700 60px "JetBrains Mono"`),
    ]);
  } catch { /* system fonts */ }
  const logo = await loadImage('/nusuk/ribat-logo.webp');

  // background
  const g = ctx.createLinearGradient(0, 0, CARD_W, CARD_H);
  g.addColorStop(0, L.bg[0]);
  g.addColorStop(0.55, L.bg[1]);
  g.addColorStop(1, L.bg[2]);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, CARD_W, CARD_H);
  ctx.strokeStyle = L.ring;
  ctx.lineWidth = 2;
  for (const [cx, cy, r] of [[980, 140, 220], [980, 140, 300], [90, 1180, 260], [90, 1180, 340]] as const) {
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.stroke();
  }
  ctx.strokeStyle = L.frame;
  ctx.lineWidth = 3;
  rr(ctx, 30, 30, CARD_W - 60, CARD_H - 60, 36); ctx.stroke();

  // top-left: logo filling a ringed circle, centred
  {
    const cx = 130, cy = 130, r = 62;
    ctx.save();
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fillStyle = '#e9ef9f'; // the logo's own background, so no white edge shows
    ctx.fill();
    if (logo) {
      ctx.clip();
      const s = Math.max((r * 2) / logo.naturalWidth, (r * 2) / logo.naturalHeight);
      const w = logo.naturalWidth * s, h = logo.naturalHeight * s;
      ctx.drawImage(logo, cx - w / 2, cy - h / 2, w, h);
    }
    ctx.restore();
    ctx.strokeStyle = L.boxEdge; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.stroke();
  }
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = L.title;
  ctx.font = `700 40px ${FONT}`;
  ctx.fillText('Ribatul Ummah', 214, 112);
  ctx.fillStyle = L.soft;
  ctx.font = `500 28px ${FONT}`;
  ctx.fillText('রিবাতুল উম্মাহ কমিউনিটি', 214, 156);

  // top-right: SL
  const sl = `SL ${bn(d.sl)}`;
  ctx.font = `700 34px ${FONT}`;
  const slw = ctx.measureText(sl).width + 52;
  ctx.fillStyle = L.pill;
  rr(ctx, CARD_W - 74 - slw, 96, slw, 68, 34); ctx.fill();
  ctx.fillStyle = L.pillText;
  ctx.textAlign = 'center';
  ctx.fillText(sl, CARD_W - 74 - slw / 2, 132);

  // headline
  ctx.fillStyle = L.head;
  fitText(ctx, d.headline?.trim() || 'নুসুক উমরাহ প্রতিযোগিতা', CARD_W / 2, 310, 900, 74, 700);
  ctx.fillStyle = L.text;
  fitText(ctx, d.sub?.trim() || 'রিবাত উপহার লাকি ড্র', CARD_W / 2, 395, 900, 44, 600);
  if (d.badge) {
    ctx.font = `700 28px ${FONT}`;
    const bw = ctx.measureText(d.badge).width + 44;
    ctx.fillStyle = L.panel;
    rr(ctx, CARD_W / 2 - bw / 2, 432, bw, 50, 25); ctx.fill();
    ctx.fillStyle = L.head;
    ctx.fillText(d.badge, CARD_W / 2, 458);
  }

  // code box
  ctx.fillStyle = L.soft;
  ctx.font = `600 34px ${FONT}`;
  ctx.fillText('আমার রেফারেল কোড', CARD_W / 2, 535);
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.3)'; ctx.shadowBlur = 40; ctx.shadowOffsetY = 14;
  ctx.fillStyle = L.box;
  rr(ctx, 110, 575, CARD_W - 220, 190, 32); ctx.fill();
  ctx.restore();
  ctx.strokeStyle = L.boxEdge; ctx.lineWidth = 6;
  rr(ctx, 110, 575, CARD_W - 220, 190, 32); ctx.stroke();
  ctx.fillStyle = L.boxText;
  fitText(ctx, d.code, CARD_W / 2, 672, CARD_W - 300, 104, 700, MONO);

  ctx.fillStyle = L.text;
  fitText(ctx, d.line?.trim() || DEFAULT_CARD_LINE, CARD_W / 2, 830, 900, 40, 600);
  ctx.fillStyle = L.soft;
  fitText(ctx, `শেয়ার করেছেন: ${d.name}`, CARD_W / 2, 890, 900, 32, 500);

  // bottom panel: QR + how to
  const py = 960;
  ctx.fillStyle = L.panel;
  rr(ctx, 80, py, CARD_W - 160, 300, 30); ctx.fill();
  ctx.fillStyle = '#ffffff';
  rr(ctx, 115, py + 30, 240, 240, 20); ctx.fill();
  drawQR(ctx, refLink(d.code), 133, py + 48, 204, L.qrDark);

  ctx.textAlign = 'left';
  ctx.fillStyle = L.head;
  ctx.font = `700 38px ${FONT}`;
  ctx.fillText('স্ক্যান করুন অথবা ভিজিট করুন', 395, py + 75);
  ctx.fillStyle = L.text;
  fitText(ctx, 'muhammadfazal.com/nusuk', 395, py + 135, 590, 46, 700, MONO);
  ctx.fillStyle = L.soft;
  ctx.font = `500 29px ${FONT}`;
  ctx.fillText('হাজারো নুসুক কোড, একদম ফ্রি', 395, py + 195);
  ctx.fillText('রিবাতের পুরস্কার জেতার সুযোগ', 395, py + 240);
}

export function cardBlob(canvas: HTMLCanvasElement) {
  return new Promise<Blob | null>((res) => canvas.toBlob(res, 'image/png'));
}
