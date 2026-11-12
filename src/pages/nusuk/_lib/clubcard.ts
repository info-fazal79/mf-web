/**
 * Reward Club photo card (1080×1350, Facebook portrait), drawn on a canvas in the browser:
 * Ribatul Ummah logo top-left, member SL top-right, the referral (Nusuk) code in the middle,
 * a QR code to the Nusuk page at the bottom.
 */
import qrcode from 'qrcode-generator';
import { DEFAULT_CARD_LINE, bn, refLink } from './club';

export const CARD_W = 1080;
export const CARD_H = 1350;
const FONT = '"Hind Siliguri", system-ui, sans-serif';
const MONO = '"JetBrains Mono", ui-monospace, monospace';

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

function drawQR(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, size: number) {
  const qr = qrcode(0, 'M');
  qr.addData(text);
  qr.make();
  const n = qr.getModuleCount();
  const cell = size / n;
  ctx.fillStyle = '#053d2d';
  for (let r = 0; r < n; r++)
    for (let c = 0; c < n; c++)
      if (qr.isDark(r, c)) ctx.fillRect(Math.floor(x + c * cell), Math.floor(y + r * cell), Math.ceil(cell), Math.ceil(cell));
}

export type CardData = { code: string; sl: number; name: string; line?: string; title?: string };

export async function drawCard(canvas: HTMLCanvasElement, d: CardData) {
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
  g.addColorStop(0, '#0b5a43');
  g.addColorStop(0.55, '#064532');
  g.addColorStop(1, '#022a1f');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, CARD_W, CARD_H);
  // soft rings
  ctx.strokeStyle = 'rgba(242,201,76,0.10)';
  ctx.lineWidth = 2;
  for (const [cx, cy, r] of [[980, 140, 220], [980, 140, 300], [90, 1180, 260], [90, 1180, 340]] as const) {
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.stroke();
  }
  // gold frame
  ctx.strokeStyle = 'rgba(242,201,76,0.55)';
  ctx.lineWidth = 3;
  rr(ctx, 30, 30, CARD_W - 60, CARD_H - 60, 36); ctx.stroke();

  // top: logo + name (left), SL (right)
  if (logo) {
    ctx.save();
    ctx.beginPath(); ctx.arc(130, 130, 62, 0, Math.PI * 2); ctx.fillStyle = '#ffffff'; ctx.fill();
    ctx.clip();
    ctx.drawImage(logo, 74, 74, 112, 112);
    ctx.restore();
  }
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#ffffff';
  ctx.font = `700 40px ${FONT}`;
  ctx.fillText('Ribatul Ummah', 214, 112);
  ctx.fillStyle = 'rgba(255,255,255,0.7)';
  ctx.font = `500 28px ${FONT}`;
  ctx.fillText('রিবাতুল উম্মাহ কমিউনিটি', 214, 156);

  const sl = `SL ${bn(d.sl)}`;
  ctx.font = `700 34px ${FONT}`;
  const slw = ctx.measureText(sl).width + 52;
  ctx.fillStyle = '#f2c94c';
  rr(ctx, CARD_W - 74 - slw, 96, slw, 68, 34); ctx.fill();
  ctx.fillStyle = '#053d2d';
  ctx.textAlign = 'center';
  ctx.fillText(sl, CARD_W - 74 - slw / 2, 132);

  // headline
  ctx.fillStyle = '#f2c94c';
  fitText(ctx, d.title || 'নুসুক উমরাহ প্রতিযোগিতা', CARD_W / 2, 320, 900, 74, 700);
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  fitText(ctx, 'রিবাত উপহার লাকি ড্র', CARD_W / 2, 405, 900, 44, 600);

  // code box
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  ctx.font = `600 34px ${FONT}`;
  ctx.fillText('আমার রেফারেল কোড', CARD_W / 2, 520);
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.35)'; ctx.shadowBlur = 40; ctx.shadowOffsetY = 14;
  ctx.fillStyle = '#ffffff';
  rr(ctx, 110, 565, CARD_W - 220, 190, 32); ctx.fill();
  ctx.restore();
  ctx.strokeStyle = '#f2c94c'; ctx.lineWidth = 6;
  rr(ctx, 110, 565, CARD_W - 220, 190, 32); ctx.stroke();
  ctx.fillStyle = '#053d2d';
  fitText(ctx, d.code, CARD_W / 2, 662, CARD_W - 300, 104, 700, MONO);

  // line under the code
  ctx.fillStyle = '#ffffff';
  fitText(ctx, d.line || DEFAULT_CARD_LINE, CARD_W / 2, 820, 900, 40, 600);
  ctx.fillStyle = 'rgba(255,255,255,0.7)';
  fitText(ctx, `শেয়ার করেছেন: ${d.name}`, CARD_W / 2, 880, 900, 32, 500);

  // bottom panel: QR + how to
  const py = 960;
  ctx.fillStyle = 'rgba(0,0,0,0.22)';
  rr(ctx, 80, py, CARD_W - 160, 300, 30); ctx.fill();
  ctx.fillStyle = '#ffffff';
  rr(ctx, 115, py + 30, 240, 240, 20); ctx.fill();
  drawQR(ctx, refLink(d.code), 133, py + 48, 204);

  ctx.textAlign = 'left';
  ctx.fillStyle = '#f2c94c';
  ctx.font = `700 38px ${FONT}`;
  ctx.fillText('স্ক্যান করুন অথবা ভিজিট করুন', 395, py + 75);
  ctx.fillStyle = '#ffffff';
  fitText(ctx, 'muhammadfazal.com/nusuk', 395, py + 135, 590, 46, 700, MONO);
  ctx.fillStyle = 'rgba(255,255,255,0.8)';
  ctx.font = `500 29px ${FONT}`;
  ctx.fillText('হাজারো নুসুক কোড, একদম ফ্রি', 395, py + 195);
  ctx.fillText('প্রতিদিন রিবাতের পুরস্কার জেতার সুযোগ', 395, py + 240);
}

export function cardBlob(canvas: HTMLCanvasElement) {
  return new Promise<Blob | null>((res) => canvas.toBlob(res, 'image/png'));
}
