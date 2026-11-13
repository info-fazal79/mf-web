/**
 * "Make your photo card" on /nusuk: anyone (no login) types their name, the Nusuk code is filled in
 * from this device (last code they submitted / checked / featured, or their Reward Club code),
 * and a 1080×1350 card is drawn in the browser: Ribatul Ummah logo, the code big in the middle,
 * their name, and a QR code to muhammadfazal.com/nusuk. Download as PNG or share (mobile).
 */
import { CARD_H, CARD_W, CARD_THEMES, FONT, LOOKS, MONO, drawQR, fitText, loadImage, rr, type CardTheme } from './clubcard';
import { CODE_RE } from './content';
import { rpc } from './rpc';

const SITE = 'https://muhammadfazal.com/nusuk/';
const MY_CODE = 'nusuk:mycode:v1';
const MY_NAME = 'nusuk:cardname:v1';
const MY_LOOK = 'nusuk:cardlook:v1';

/** Order matters: the index is saved with each download/share (Nusuk Manager → Photo cards). Add new ones at the end;
    to remove one, set it to '' (keeps the other numbers right). */
export const CARD_MESSAGES = [
  '', // retired
  'দোয়া করবেন, আল্লাহ যেন উমরাহর তাওফিক দেন',
  'চলুন, একসাথে উমরাহর স্বপ্ন পূরণ করি',
  'আল্লাহর ঘরের মেহমান হওয়ার স্বপ্ন দেখি',
  'কাবার পথে একসাথে, ইনশাআল্লাহ',
];

/** the same anonymous device id the rest of /nusuk uses */
function deviceId() {
  const k = 'nusuk:device:v1';
  let id = get(k);
  if (!/^[0-9a-f-]{36}$/i.test(id)) {
    id = typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : '';
    if (id) put(k, id);
  }
  return id;
}

const get = (k: string) => { try { return localStorage.getItem(k) ?? ''; } catch { return ''; } };
const put = (k: string, v: string) => { try { localStorage.setItem(k, v); } catch { /* private mode */ } };

/** Remember a Nusuk code this device used as "mine" (submit / check / feature forms, Reward Club account). */
export function rememberMyCode(code: string) {
  const c = code.replace(/\s/g, '');
  if (CODE_RE.test(c)) put(MY_CODE, c);
}
export const myCode = () => get(MY_CODE);

export type PhotoCard = { code: string; name: string; message: string; theme: CardTheme };

export async function drawPhotoCard(canvas: HTMLCanvasElement, d: PhotoCard) {
  const L = LOOKS[d.theme] ?? LOOKS.green;
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
  const W = CARD_W, mid = W / 2;

  // background, soft rings, frame
  const g = ctx.createLinearGradient(0, 0, W, CARD_H);
  g.addColorStop(0, L.bg[0]); g.addColorStop(0.55, L.bg[1]); g.addColorStop(1, L.bg[2]);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, CARD_H);
  ctx.strokeStyle = L.ring;
  ctx.lineWidth = 2;
  for (const [cx, cy, r] of [[980, 140, 220], [980, 140, 300], [90, 1180, 260], [90, 1180, 340]] as const) {
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.stroke();
  }
  ctx.strokeStyle = L.frame;
  ctx.lineWidth = 3;
  rr(ctx, 30, 30, W - 60, CARD_H - 60, 36); ctx.stroke();

  // header: logo + name of the community, centred as one group
  {
    ctx.font = `700 42px ${FONT}`;
    const t1 = 'Ribatul Ummah';
    ctx.font = `500 27px ${FONT}`;
    const t2 = 'Nusuk Code Share - উমরাহ প্রতিযোগিতা';
    const tw = Math.max((() => { ctx.font = `700 42px ${FONT}`; return ctx.measureText(t1).width; })(), (() => { ctx.font = `500 27px ${FONT}`; return ctx.measureText(t2).width; })());
    const r = 58, gap = 26, total = r * 2 + gap + tw;
    const cx = mid - total / 2 + r, cy = 135;
    ctx.save();
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fillStyle = '#e9ef9f';
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
    const tx = cx + r + gap;
    ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    ctx.fillStyle = L.title; ctx.font = `700 42px ${FONT}`; ctx.fillText(t1, tx, cy - 20);
    ctx.fillStyle = L.soft; ctx.font = `500 27px ${FONT}`; ctx.fillText(t2, tx, cy + 24);
  }

  // headline + message
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillStyle = L.head;
  fitText(ctx, 'নুসুক উমরাহ প্রতিযোগিতা', mid, 315, 920, 76, 700);
  ctx.fillStyle = L.text;
  fitText(ctx, d.message.trim() || CARD_MESSAGES.find(Boolean)!, mid, 400, 920, 40, 600);

  // the code, big
  ctx.fillStyle = L.soft;
  ctx.font = `600 34px ${FONT}`;
  ctx.fillText('আমার নুসুক রেফারেল কোড', mid, 498);
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.3)'; ctx.shadowBlur = 40; ctx.shadowOffsetY = 14;
  ctx.fillStyle = L.box;
  rr(ctx, 100, 538, W - 200, 200, 34); ctx.fill();
  ctx.restore();
  ctx.strokeStyle = L.boxEdge; ctx.lineWidth = 6;
  rr(ctx, 100, 538, W - 200, 200, 34); ctx.stroke();
  ctx.fillStyle = L.boxText;
  fitText(ctx, d.code || 'NG-xxxxxxxx', mid, 640, W - 280, 112, 700, MONO);
  ctx.fillStyle = L.soft;
  fitText(ctx, 'নুসুক অ্যাপে কোডটি বসিয়ে দিন, আপনিও অংশ নিন', mid, 785, 900, 30, 500);

  // name
  const name = d.name.trim();
  if (name) {
    ctx.fillStyle = L.soft;
    ctx.font = `500 28px ${FONT}`;
    ctx.fillText('শেয়ার করেছেন', mid, 852);
    ctx.fillStyle = L.head;
    fitText(ctx, name, mid, 905, 880, 54, 700);
  }

  // bottom panel: QR to the site + how to join
  const py = 975, ph = 300;
  ctx.fillStyle = L.panel;
  rr(ctx, 80, py, W - 160, ph, 30); ctx.fill();
  const qs = 212, qx = 118, qy = py + 24;
  ctx.fillStyle = '#ffffff';
  rr(ctx, qx, qy, qs, qs, 18); ctx.fill();
  drawQR(ctx, SITE, qx + 14, qy + 14, qs - 28, L.qrDark);
  ctx.fillStyle = L.text;
  ctx.font = `600 23px ${FONT}`;
  ctx.fillText('স্ক্যান করুন', qx + qs / 2, qy + qs + 26);

  const tx = 370;
  ctx.textAlign = 'left';
  ctx.fillStyle = L.head;
  fitText(ctx, 'যুক্ত হতে QR কোড স্ক্যান করুন', tx, py + 62, 600, 36, 700);
  ctx.fillStyle = L.text;
  fitText(ctx, 'muhammadfazal.com/nusuk', tx, py + 122, 600, 42, 700, MONO);
  ctx.fillStyle = L.soft;
  ctx.font = `500 28px ${FONT}`;
  ctx.fillText('হাজারো নুসুক কোড, এক ক্লিকে কপি', tx, py + 186);
  ctx.fillText('নিজের কোড জমা দিন, সবাই ব্যবহার করবে', tx, py + 232);
}

/** Wire up the section + dialog on /nusuk. */
export function initPhotoCard() {
  const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T | null;
  const dlg = $<HTMLDialogElement>('nk-pc');
  const open = $('nk-pc-open');
  if (!dlg || !open) return;
  const nameIn = $<HTMLInputElement>('nk-pc-name')!;
  const codeIn = $<HTMLInputElement>('nk-pc-code')!;
  const msgIn = $<HTMLSelectElement>('nk-pc-msg')!;
  const canvas = $<HTMLCanvasElement>('nk-pc-canvas')!;
  const err = $('nk-pc-err')!;
  const dl = $<HTMLButtonElement>('nk-pc-dl')!;
  const share = $<HTMLButtonElement>('nk-pc-share')!;
  const hint = $('nk-pc-hint')!;
  const looks = Array.from(dlg.querySelectorAll<HTMLInputElement>('input[name="nk-pc-look"]'));

  // remember the code from any code form on the page (submit, "is my code listed?", feature request)
  document.addEventListener('submit', (e) => {
    const f = e.target as HTMLFormElement | null;
    if (!f || f.id === 'nk-pc-form') return;
    const inp = f.querySelector<HTMLInputElement>('input[name="code"]');
    if (inp) rememberMyCode(inp.value);
  }, true);

  msgIn.innerHTML = CARD_MESSAGES.map((m, i) => (m ? `<option value="${i}">${m}</option>` : '')).join('');
  const theme = (): CardTheme => (looks.find((l) => l.checked)?.value as CardTheme) || 'green';
  const code = () => codeIn.value.replace(/\s/g, '');
  const valid = () => CODE_RE.test(code());

  let t = 0;
  const redraw = () => {
    clearTimeout(t);
    t = window.setTimeout(async () => {
      const ok = valid();
      err.classList.toggle('hidden', ok || !code());
      dl.disabled = !ok;
      share.disabled = !ok;
      await drawPhotoCard(canvas, { code: ok ? code() : '', name: nameIn.value.slice(0, 40), message: CARD_MESSAGES[Number(msgIn.value)] ?? '', theme: theme() });
    }, 120);
  };
  [nameIn, codeIn].forEach((el) => el.addEventListener('input', redraw));
  msgIn.addEventListener('change', redraw);
  looks.forEach((l) => l.addEventListener('change', redraw));

  if (!navigator.canShare) share.classList.add('hidden');

  open.addEventListener('click', () => {
    if (!codeIn.value) codeIn.value = myCode();
    if (!nameIn.value) nameIn.value = get(MY_NAME);
    const lk = get(MY_LOOK);
    looks.forEach((l) => { l.checked = l.value === (lk || 'green'); });
    hint.classList.toggle('hidden', !codeIn.value);
    redraw();
    dlg.showModal();
  });
  $('nk-pc-close')?.addEventListener('click', () => dlg.close());
  dlg.addEventListener('click', (e) => { if (e.target === dlg) dlg.close(); });

  const keep = () => { rememberMyCode(code()); put(MY_NAME, nameIn.value.trim().slice(0, 40)); put(MY_LOOK, theme()); };
  // count it for Nusuk Manager → Photo cards (never blocks the download)
  const track = (action: 'download' | 'share') => {
    rpc('nusuk_photocard_log', { p_action: action, p_code: code(), p_name: nameIn.value.trim().slice(0, 40), p_theme: theme(), p_msg: Number(msgIn.value) || 0, p_device: deviceId() }).catch(() => {});
  };
  const blob = () => new Promise<Blob | null>((res) => canvas.toBlob(res, 'image/png'));
  const fileName = () => `nusuk-code-${code()}.png`;
  const caption = () => `আমার নুসুক রেফারেল কোড: ${code()}\nনুসুক অ্যাপে কোডটি বসিয়ে দিন। আরও কোড পেতে: muhammadfazal.com/nusuk\n#NusukUmrah #RibatulUmmah`;

  let viaShare = false;
  dl.addEventListener('click', async () => {
    if (!valid()) return;
    keep();
    if (!viaShare) track('download');
    const b = await blob();
    if (!b) return;
    const url = URL.createObjectURL(b);
    const a = document.createElement('a');
    a.href = url; a.download = fileName();
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  });
  share.addEventListener('click', async () => {
    if (!valid()) return;
    keep();
    const b = await blob();
    if (!b) return;
    const file = new File([b], fileName(), { type: 'image/png' });
    try {
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], text: caption() });
        track('share');
      } else { track('share'); viaShare = true; dl.click(); viaShare = false; }
    } catch { /* cancelled */ }
  });
}

export { CARD_THEMES };
