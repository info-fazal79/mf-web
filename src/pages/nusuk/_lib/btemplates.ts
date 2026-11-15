/**
 * Design Builder templates. Each template has a few layouts ("types") of the same content:
 * map on the right / left / big in the middle, picture left or right, and so on.
 * Positions are worked out for the chosen size, and text columns are measured and centred,
 * so every template fits square, portrait, story, thumbnail and cover sizes.
 */
import { BSIZES, defaultBg, makeWidget, measure, text, uid, type Bg, type BSize, type Doc, type El, type ImageEl, type ListEl, type OptionsEl, type TextEl } from './builder';

type Ctx = { W: number; H: number; S: number; M: number; land: boolean };
type Item = El | El[]; // an array = one row of elements side by side

let mctx: CanvasRenderingContext2D | null = null;
const hOf = (e: El) => {
  mctx ??= document.createElement('canvas').getContext('2d');
  return mctx ? measure(mctx, e) : e.h;
};

/** Place items in a column between top and bottom, centred vertically. Text fills the column width
 *  (tags and buttons keep their own width); a row is spread across the column. */
function column(items: Item[], x: number, w: number, top: number, bottom: number, gap: number, align: 'left' | 'center') {
  const fixed = (e: El) => (e.type === 'text' && e.bgOn) || e.type === 'stat' || e.type === 'image' || e.type === 'qr' || e.type === 'map' || e.type === 'rect' || e.type === 'circle';
  for (const it of items) {
    if (Array.isArray(it)) continue;
    if (!fixed(it)) it.w = w;
    if (it.type === 'text') it.align = align === 'center' ? 'center' : it.bgOn ? 'center' : 'left';
  }
  let hs = items.map((it) => (Array.isArray(it) ? Math.max(...it.map(hOf)) : hOf(it)));
  let total = hs.reduce((a, b) => a + b, 0) + gap * (items.length - 1);
  // too tall for the space (e.g. wide thumbnail sizes): shrink the words and boxes until it fits
  for (let n = 0; n < 6 && total > bottom - top; n++) {
    const f = Math.max(0.6, (bottom - top) / total);
    for (const e of items.flat()) {
      if ('size' in e) (e as { size: number }).size *= f;
      if (e.type === 'text' && e.bgOn) { e.pad *= f; e.w *= f; }
      if (e.type === 'stat' || e.type === 'map' || e.type === 'image' || e.type === 'qr') { e.w *= f; e.h *= f; }
    }
    hs = items.map((it) => (Array.isArray(it) ? Math.max(...it.map(hOf)) : hOf(it)));
    total = hs.reduce((a, b) => a + b, 0) + gap * (items.length - 1);
  }
  let y = top + Math.max(0, (bottom - top - total) / 2);
  items.forEach((it, i) => {
    if (Array.isArray(it)) {
      const g = gap * 0.6, rw = it.reduce((a, e) => a + e.w, 0) + g * (it.length - 1);
      let xx = align === 'center' ? x + (w - rw) / 2 : x;
      for (const e of it) { e.x = Math.round(xx); e.y = Math.round(y + (hs[i] - hOf(e)) / 2); xx += e.w + g; }
    } else {
      it.x = Math.round(align === 'center' || it.type === 'map' ? x + (w - it.w) / 2 : x);
      it.y = Math.round(y);
    }
    y += hs[i] + gap;
  });
}

// ---------------------------------------------------------------- pieces
const T = (c: Ctx, t: string, size: number, p: Partial<TextEl> = {}) => text({ text: t, size: size * c.S, weight: 600, lh: 1.25, ...p });
const H1 = (c: Ctx, t: string, k = 1) => T(c, t, 78 * k, { weight: 700, lh: 1.18, name: 'Heading' });
const SUB = (c: Ctx, t: string) => T(c, t, 40, { color: '#f2c94c', name: 'Sub heading' });
const P = (c: Ctx, t: string) => T(c, t, 32, { weight: 400, color: '#e8f5ee', lh: 1.5, name: 'Paragraph' });
function pill(c: Ctx, t: string, size: number, kind: 'tag' | 'button', p: Partial<TextEl> = {}) {
  const e = makeWidget(kind, c.W, 0, 0) as TextEl;
  e.text = t; e.size = size * c.S;
  mctx ??= document.createElement('canvas').getContext('2d');
  if (mctx) { mctx.font = `${e.weight} ${e.size}px "Hind Siliguri", sans-serif`; e.w = Math.round(mctx.measureText(t).width + e.pad * 2 + 24 * c.S); }
  return Object.assign(e, p);
}
const TAG = (c: Ctx, t: string) => pill(c, t, 30, 'tag');
const BTN = (c: Ctx, t: string) => pill(c, t, 36, 'button');
const LIST = (c: Ctx, items: string[], numbered = false) => { const e = makeWidget(numbered ? 'steps' : 'list', c.W, 0, 0) as ListEl; e.items = items.join('\n'); e.size = 34 * c.S; return e; };
const PIC = (c: Ctx, w: number, h: number, p: Partial<ImageEl> = {}) => Object.assign(makeWidget('image', c.W, 0, 0) as ImageEl, { w: Math.round(w), h: Math.round(h), ...p });
const MAP = (c: Ctx, w: number, h: number) => { const e = makeWidget('map', c.W, 0, 0); const k = Math.min(w / 600, (h - 44) / 848); e.w = Math.round(600 * k); e.h = Math.round(848 * k + 44); return e; };
function STAT(c: Ctx, v: string, l: string, w = 260) { const e = makeWidget('stat', c.W, 0, 0); e.w = Math.round(w * c.S); e.h = Math.round(160 * c.S); Object.assign(e, { value: v, label: l }); return e; }
function header(c: Ctx): El[] {
  const L = 110 * c.S;
  const logo = makeWidget('logo', c.W, 0, 0); Object.assign(logo, { w: L, h: L, x: c.M, y: c.M * 0.8 });
  const brand = text({ text: 'Ribatul Ummah', size: 40 * c.S, weight: 700, align: 'left', w: 620 * c.S, x: c.M + L + 22 * c.S, y: c.M * 0.8 + L / 2 - 28 * c.S, name: 'Brand' });
  return [logo, brand];
}
function web(c: Ctx) { const e = pill(c, '🌐 muhammadfazal.com/nusuk', 28, 'tag', { bg: 'rgba(0,0,0,0.28)', color: '#ffffff', name: 'Website bar' }); e.x = Math.round(c.W / 2 - e.w / 2); e.y = Math.round(c.H - 46 * c.S - hOf(e)); return e; }
const areaTop = (c: Ctx) => c.M * 0.8 + 140 * c.S;
const areaBottom = (c: Ctx) => c.H - 120 * c.S;

function ctxOf(size: BSize): Ctx {
  const { w: W, h: H } = BSIZES[size];
  const S = Math.min(W, H * 1.25) / 1080;
  return { W, H, S, M: 64 * S, land: W / H > 1.2 };
}
const doc = (size: BSize, els: El[], bg: Partial<Bg> = {}): Doc => ({ size, bg: { ...defaultBg(), ...bg }, els: els.map((e) => ({ ...e, id: uid() })) });

/** text column + a visual on one side (or under the heading on tall sizes) */
function sideBySide(c: Ctx, size: BSize, items: Item[], visual: El, side: 'left' | 'right', bg: Partial<Bg> = {}) {
  const top = areaTop(c), bottom = areaBottom(c);
  const vw = c.W * 0.42, tw = c.W - c.M * 2 - vw - 40 * c.S;
  const vx = side === 'right' ? c.W - c.M - vw : c.M, tx = side === 'right' ? c.M : c.M + vw + 40 * c.S;
  if (!c.land && c.H / c.W > 1.6) {
    // story: everything in one column, the visual in the middle
    const [first, ...rest] = items;
    const k = Math.min(1, (c.W - c.M * 2) / visual.w);
    visual.w *= k; visual.h *= k;
    column([first, visual, ...rest], c.M, c.W - c.M * 2, top, bottom, 34 * c.S, 'center');
  } else {
    const k = Math.min((bottom - top) / visual.h, vw / visual.w);
    visual.w = Math.round(visual.w * k); visual.h = Math.round(visual.h * k);
    visual.x = Math.round(vx + (vw - visual.w) / 2); visual.y = Math.round(top + (bottom - top - visual.h) / 2);
    column(items, tx, tw, top, bottom, 26 * c.S, 'left');
  }
  return doc(size, [...header(c), ...items.flat(), visual, web(c)], bg);
}
function centred(c: Ctx, size: BSize, items: Item[], bg: Partial<Bg> = {}, gap = 30) {
  column(items, c.M, c.W - c.M * 2, areaTop(c), areaBottom(c), gap * c.S, 'center');
  return doc(size, [...header(c), ...items.flat(), web(c)], bg);
}

// ---------------------------------------------------------------- the templates
export type Variant = { key: string; label: string; make: (size: BSize) => Doc };
export type TemplateCat = { key: string; label: string; emoji: string; variants: Variant[] };

const MAP_TEXT = { tag: '🆕 নতুন ফিচার', h: 'আপনার জেলা কতটা এগিয়ে?', sub: 'জেলাভিত্তিক মানচিত্র এখন নুসুক পেজে', list: ['কোন জেলা থেকে কতজন, ম্যাপে দেখুন', 'অ্যাকাউন্ট খুললেই জেলা গাঢ় সবুজ', 'এগিয়ে থাকা জেলার র‍্যাংকিং'], btn: 'আজই অ্যাকাউন্ট খুলুন →' };

export const TEMPLATES: TemplateCat[] = [
  {
    key: 'map', label: 'District map', emoji: '📍', variants: [
      { key: 'right', label: 'Map right', make: (s) => { const c = ctxOf(s); return sideBySide(c, s, [TAG(c, MAP_TEXT.tag), H1(c, MAP_TEXT.h), SUB(c, MAP_TEXT.sub), [STAT(c, '১৬৩', 'মোট অ্যাকাউন্ট', 205), STAT(c, '৪১/৬৪', 'যুক্ত জেলা', 205)], LIST(c, MAP_TEXT.list), BTN(c, MAP_TEXT.btn)], MAP(c, 600, 892), 'right'); } },
      { key: 'left', label: 'Map left', make: (s) => { const c = ctxOf(s); return sideBySide(c, s, [TAG(c, MAP_TEXT.tag), H1(c, MAP_TEXT.h), SUB(c, MAP_TEXT.sub), LIST(c, MAP_TEXT.list), BTN(c, MAP_TEXT.btn)], MAP(c, 600, 892), 'left'); } },
      { key: 'centre', label: 'Big map in the middle', make: (s) => {
        const c = ctxOf(s);
        if (c.land) return sideBySide(c, s, [TAG(c, MAP_TEXT.tag), H1(c, MAP_TEXT.h), BTN(c, MAP_TEXT.btn)], MAP(c, 600, 892), 'right');
        const top = areaTop(c), bottom = areaBottom(c), w = c.W - c.M * 2, g = 24 * c.S;
        const tag = TAG(c, MAP_TEXT.tag), head = H1(c, MAP_TEXT.h, 0.9), btn = BTN(c, MAP_TEXT.btn);
        head.w = w;
        const map = MAP(c, w, bottom - top - hOf(tag) - hOf(head) - hOf(btn) - g * 3);
        column([tag, head, map, btn], c.M, w, top, bottom, g, 'center');
        return doc(s, [...header(c), tag, head, map, btn, web(c)]);
      } },
      { key: 'stats', label: 'Map with number boxes', make: (s) => {
        const c = ctxOf(s);
        return sideBySide(c, s, [H1(c, 'কোন জেলা কত এগিয়ে', 0.9), STAT(c, '১৬৩', 'মোট অ্যাকাউন্ট', 340), STAT(c, '৪১/৬৪', 'যুক্ত জেলা', 340), STAT(c, 'ঢাকা', 'শীর্ষ জেলা', 340), BTN(c, 'আপনার জেলাকে এগিয়ে নিন')], MAP(c, 600, 892), 'right');
      } },
    ],
  },
  {
    key: 'announce', label: 'Announcement', emoji: '📢', variants: [
      { key: 'centre', label: 'Centred', make: (s) => { const c = ctxOf(s); return centred(c, s, [TAG(c, '📢 জরুরি ঘোষণা'), H1(c, 'গুরুত্বপূর্ণ ঘোষণা'), SUB(c, 'সবাই মনোযোগ দিয়ে পড়ুন'), P(c, 'এখানে ঘোষণার বিস্তারিত লিখুন। লেখা বেশি হলে বক্স নিজে থেকেই লম্বা হবে।'), BTN(c, 'বিস্তারিত দেখুন →')]); } },
      { key: 'card', label: 'On a card', make: (s) => {
        const c = ctxOf(s);
        const items: Item[] = [TAG(c, '📢 নোটিশ'), H1(c, 'গুরুত্বপূর্ণ ঘোষণা', 0.9), P(c, 'এখানে ঘোষণার বিস্তারিত লিখুন। কার্ডের ভেতরে লেখা সুন্দরভাবে বসে যাবে।'), BTN(c, 'বিস্তারিত দেখুন →')];
        const top = areaTop(c), bottom = areaBottom(c);
        const card = makeWidget('card', c.W, 0, 0); Object.assign(card, { x: c.M, y: top, w: c.W - c.M * 2, h: bottom - top, opacity: 0.1 });
        column(items, c.M + 50 * c.S, c.W - c.M * 2 - 100 * c.S, top, bottom, 30 * c.S, 'center');
        return doc(s, [...header(c), card, ...items.flat(), web(c)]);
      } },
      { key: 'picture', label: 'With picture', make: (s) => { const c = ctxOf(s); return sideBySide(c, s, [TAG(c, '📢 ঘোষণা'), H1(c, 'গুরুত্বপূর্ণ ঘোষণা', 0.9), P(c, 'এখানে ঘোষণার বিস্তারিত লিখুন।'), BTN(c, 'বিস্তারিত দেখুন →')], PIC(c, 600, 760), 'right'); } },
    ],
  },
  {
    key: 'feature', label: 'Feature + screenshot', emoji: '✨', variants: [
      { key: 'right', label: 'Screenshot right', make: (s) => { const c = ctxOf(s); return sideBySide(c, s, [TAG(c, '🆕 নতুন ফিচার'), H1(c, 'ফিচারের নাম', 0.9), SUB(c, 'এক লাইনে ফিচারটি কী করে'), LIST(c, ['প্রথম সুবিধা', 'দ্বিতীয় সুবিধা', 'তৃতীয় সুবিধা']), BTN(c, 'এখনই দেখুন →')], PIC(c, 480, 900, { fit: 'contain', borderC: '#f2c94c' }), 'right'); } },
      { key: 'left', label: 'Screenshot left', make: (s) => { const c = ctxOf(s); return sideBySide(c, s, [TAG(c, '🆕 নতুন ফিচার'), H1(c, 'ফিচারের নাম', 0.9), SUB(c, 'এক লাইনে ফিচারটি কী করে'), LIST(c, ['প্রথম সুবিধা', 'দ্বিতীয় সুবিধা']), BTN(c, 'এখনই দেখুন →')], PIC(c, 480, 900, { fit: 'contain', borderC: '#f2c94c' }), 'left'); } },
      { key: 'below', label: 'Screenshot under heading', make: (s) => { const c = ctxOf(s); const room = areaBottom(c) - areaTop(c); return centred(c, s, [TAG(c, '🆕 নতুন ফিচার'), H1(c, 'ফিচারের নাম', 0.85), PIC(c, Math.min(c.W * 0.8, room * 0.9), room * 0.5, { fit: 'contain' }), BTN(c, 'এখনই দেখুন →')], {}, 26); } },
    ],
  },
  {
    key: 'quiz', label: 'Quiz / poll', emoji: '❓', variants: [
      { key: 'grid', label: '4 options (2×2)', make: (s) => { const c = ctxOf(s); return centred(c, s, [TAG(c, '❓ আজকের প্রশ্ন'), H1(c, 'আজ কোন দেশ থেকে বিজয়ী হওয়ার সম্ভাবনা বেশি?', 0.85), makeWidget('options', c.W, 0, 0), BTN(c, 'কমেন্টে উত্তর দিন 👇')]); } },
      { key: 'list', label: 'Options in a list', make: (s) => { const c = ctxOf(s); const o = makeWidget('options', c.W, 0, 0) as OptionsEl; o.cols = 1; return centred(c, s, [TAG(c, '❓ আজকের প্রশ্ন'), H1(c, 'আজ কোন দেশ থেকে বিজয়ী হওয়ার সম্ভাবনা বেশি?', 0.8), o, BTN(c, 'কমেন্টে উত্তর দিন 👇')], {}, 26); } },
      { key: 'picture', label: 'With picture', make: (s) => { const c = ctxOf(s); const o = makeWidget('options', c.W, 0, 0) as OptionsEl; o.cols = 1; o.size = 32 * c.S; return sideBySide(c, s, [TAG(c, '❓ প্রশ্ন'), H1(c, 'ছবিটি কোন জায়গার?', 0.85), o, BTN(c, 'কমেন্টে উত্তর দিন 👇')], PIC(c, 600, 760), 'right'); } },
    ],
  },
  {
    key: 'give', label: 'Giveaway', emoji: '🎁', variants: [
      { key: 'three', label: '3 prizes', make: (s) => giveaway(s, 3) },
      { key: 'one', label: 'One big prize', make: (s) => giveaway(s, 1) },
      { key: 'steps', label: 'Prizes + how to join', make: (s) => giveaway(s, 3, true) },
    ],
  },
  {
    key: 'winner', label: 'Winner', emoji: '🏆', variants: [
      { key: 'circle', label: 'Photo in a circle', make: (s) => { const c = ctxOf(s); const room = areaBottom(c) - areaTop(c); const d = Math.min(380 * c.S, room * 0.36); return centred(c, s, [TAG(c, '🎉 অভিনন্দন'), PIC(c, d, d, { circle: true, borderW: 8 * c.S, borderC: '#f2c94c' }), H1(c, 'বিজয়ীর নাম', 1), SUB(c, 'দেশ · দুইজনের উমরাহ সফর'), P(c, 'আল্লাহ তাঁর উমরাহ কবুল করুন।')], {}, 24); } },
      { key: 'side', label: 'Photo on the side', make: (s) => { const c = ctxOf(s); return sideBySide(c, s, [TAG(c, '🏆 আজকের বিজয়ী'), H1(c, 'বিজয়ীর নাম'), SUB(c, 'দেশ · দুইজনের উমরাহ সফর'), BTN(c, 'আপনিও অংশ নিন →')], PIC(c, 560, 700), 'left'); } },
    ],
  },
  {
    key: 'event', label: 'Event / live', emoji: '📅', variants: [
      { key: 'centre', label: 'Centred', make: (s) => { const c = ctxOf(s); return centred(c, s, [TAG(c, '🔴 লাইভ'), H1(c, 'আজ রাতে লাইভ ড্র'), SUB(c, 'সরাসরি বিজয়ী ঘোষণা'), [STAT(c, 'আজ', 'তারিখ', 240), STAT(c, '৯টা', 'রাত', 240), STAT(c, 'FB', 'পেজে লাইভ', 240)], BTN(c, 'লাইভে থাকুন 🔔')]); } },
      { key: 'date', label: 'Big date on the side', make: (s) => {
        const c = ctxOf(s);
        const box = makeWidget('rect', c.W, 0, 0); Object.assign(box, { w: 360 * c.S, h: 420 * c.S, fill: '#f2c94c', radius: 36 * c.S, shadow: true });
        const day = T(c, '২০', 170, { weight: 700, color: '#2b1f00', lh: 1 }), mon = T(c, 'নভেম্বর', 44, { weight: 700, color: '#2b1f00' });
        const d = sideBySide(c, s, [TAG(c, '📅 ইভেন্ট'), H1(c, 'লাইভ ড্র ও বিজয়ী ঘোষণা', 0.85), P(c, 'রাত ৯টা · ফেসবুক পেজে লাইভ'), BTN(c, 'রিমাইন্ডার দিন 🔔')], box, 'right');
        const b = d.els.find((e) => e.type === 'rect')!;
        day.w = mon.w = b.w; day.x = mon.x = b.x; day.y = b.y + b.h * 0.18; mon.y = b.y + b.h * 0.66;
        d.els.push({ ...day, id: uid() }, { ...mon, id: uid() });
        return d;
      } },
    ],
  },
  {
    key: 'quote', label: 'Quote / Hadith', emoji: '💬', variants: [
      { key: 'centre', label: 'Centred', make: (s) => { const c = ctxOf(s); return centred(c, s, [T(c, '❝', 150, { color: '#f2c94c', lh: 1 }), T(c, 'নিশ্চয়ই কষ্টের সাথেই রয়েছে স্বস্তি।', 62, { weight: 700, lh: 1.4 }), SUB(c, '— সূরা আশ-শারহ, ৯৪:৬')], { c1: '#1c2c55', c2: '#060b17', patternColor: '#4fe3d0', frameColor: '#4fe3d0' }, 20); } },
      { key: 'card', label: 'On a card', make: (s) => {
        const c = ctxOf(s);
        const items: Item[] = [T(c, '❝', 130, { color: '#0b5a43', lh: 1 }), T(c, 'নিশ্চয়ই কষ্টের সাথেই রয়েছে স্বস্তি।', 58, { weight: 700, lh: 1.4, color: '#053d2d' }), T(c, '— সূরা আশ-শারহ, ৯৪:৬', 38, { color: '#b7791f' })];
        const top = areaTop(c), bottom = areaBottom(c);
        const card = makeWidget('rect', c.W, 0, 0); Object.assign(card, { x: c.M, y: top, w: c.W - c.M * 2, h: bottom - top, fill: '#fffaf0', radius: 40 * c.S, shadow: true });
        column(items, c.M + 60 * c.S, c.W - c.M * 2 - 120 * c.S, top, bottom, 20 * c.S, 'center');
        return doc(s, [...header(c), card, ...items.flat(), web(c)]);
      } },
    ],
  },
  {
    key: 'stats', label: 'Numbers', emoji: '📊', variants: [
      { key: 'row', label: '3 in a row', make: (s) => { const c = ctxOf(s); return centred(c, s, [TAG(c, '📊 এক নজরে'), H1(c, 'আমাদের অগ্রগতি'), [STAT(c, '১৬৩', 'অ্যাকাউন্ট', 280), STAT(c, '৪১', 'জেলা', 280), STAT(c, '১১', 'বিজয়ী', 280)], P(c, 'আপনার সহযোগিতায় এগিয়ে চলেছি, আলহামদুলিল্লাহ।')]); } },
      { key: 'grid', label: '2 × 2', make: (s) => { const c = ctxOf(s); return centred(c, s, [TAG(c, '📊 এক নজরে'), H1(c, 'আমাদের অগ্রগতি', 0.9), [STAT(c, '১৬৩', 'অ্যাকাউন্ট', 400), STAT(c, '৪১', 'জেলা', 400)], [STAT(c, '১১', 'বিজয়ী', 400), STAT(c, '৫০০+', 'কোড', 400)], BTN(c, 'আপনিও যুক্ত হোন →')], {}, 24); } },
    ],
  },
  {
    key: 'code', label: 'Share my code', emoji: '🔑', variants: [
      { key: 'centre', label: 'Code + QR', make: (s) => { const c = ctxOf(s); const code = makeWidget('code', c.W, 0, 0); const qr = makeWidget('qr', c.W, 0, 0); qr.w = qr.h = 200 * c.S; return centred(c, s, [H1(c, 'নুসুক উমরাহ প্রতিযোগিতা', 0.85), SUB(c, 'আমার নুসুক রেফারেল কোড'), code, P(c, 'কোডটি ব্যবহার করে আমাকে সাহায্য করুন'), qr], {}, 26); } },
      { key: 'side', label: 'Code + picture', make: (s) => { const c = ctxOf(s); const code = makeWidget('code', c.W, 0, 0); code.w = 520 * c.S; (code as TextEl).size = 60 * c.S; return sideBySide(c, s, [H1(c, 'আমার নুসুক কোড', 0.9), code, P(c, 'কোডটি ব্যবহার করে আমাকে সাহায্য করুন'), BTN(c, 'muhammadfazal.com/nusuk')], PIC(c, 520, 700), 'right'); } },
    ],
  },
  {
    key: 'thumb', label: 'Thumbnail / cover', emoji: '🎬', variants: [
      { key: 'left', label: 'Words left, picture right', make: (s) => thumb(s, 'right') },
      { key: 'right', label: 'Picture left, words right', make: (s) => thumb(s, 'left') },
      { key: 'centre', label: 'Big words in the middle', make: (s) => {
        const c = ctxOf(s);
        const a = [T(c, 'আজকের বিজয়ী কে?', 130, { weight: 700, lh: 1.1, shadow: true }), pill(c, 'লাইভ ড্র · আজ রাত ৯টা', 50, 'tag')];
        column(a, c.M, c.W - c.M * 2, c.M, c.H - c.M, 30 * c.S, 'center');
        return doc(s, a, { frame: false });
      } },
    ],
  },
];

function giveaway(s: BSize, n: 1 | 3, steps = false): Doc {
  const c = ctxOf(s);
  const top = areaTop(c), bottom = areaBottom(c);
  const head: Item[] = [TAG(c, '🎁 গিভঅ্যাওয়ে'), H1(c, 'মেগা গিভঅ্যাওয়ে', 0.9)];
  const ranks = ['🥇 ১ম পুরস্কার', '🥈 ২য় পুরস্কার', '🥉 ৩য় পুরস্কার'];
  const names = ['স্মার্টফোন', 'জায়নামাজ ও তসবিহ', 'জমজমের পানি'];
  const gap = 24 * c.S;
  const cw = n === 1 ? Math.min(560 * c.S, c.W * 0.6) : (c.W - c.M * 2 - gap * 2) / 3;
  const pic = n === 1 ? cw * 0.8 : cw - 40 * c.S;
  const ch = 70 * c.S + pic + 110 * c.S;
  const tail: Item[] = steps ? [LIST(c, ['পেজে অ্যাকাউন্ট খুলুন', 'নুসুক কোড জমা দিন', 'পোস্টটি শেয়ার করুন'], true), BTN(c, 'অংশ নিতে ভিজিট করুন →')] : [P(c, 'শেষ সময়: ৩০ নভেম্বর · ড্র ফেসবুক লাইভে'), BTN(c, 'অংশ নিতে ভিজিট করুন →')];
  // a stand-in box the size of the prize row, so the column leaves room for it
  const slot = makeWidget('rect', c.W, 0, 0); Object.assign(slot, { w: n === 1 ? cw : c.W - c.M * 2, h: ch, fillOn: false });
  column([...head, slot, ...tail], c.M, c.W - c.M * 2, top, bottom, 26 * c.S, 'center');
  const prizes: El[] = [];
  for (let i = 0; i < n; i++) {
    const x = slot.x + i * (cw + gap), y = slot.y;
    const card = makeWidget('card', c.W, 0, 0); Object.assign(card, { x, y, w: cw, h: ch, radius: 28 * c.S, opacity: 0.12, borderW: 0 });
    const edge = makeWidget('rect', c.W, 0, 0); Object.assign(edge, { x, y, w: cw, h: ch, radius: 28 * c.S, fillOn: false, borderW: (i === 0 ? 4 : 2) * c.S, borderC: '#f2c94c', name: 'Card edge' });
    const r = pill(c, ranks[i], 24, 'tag'); r.x = Math.round(x + (cw - r.w) / 2); r.y = Math.round(y + 16 * c.S);
    const p = PIC(c, pic, pic, { fit: 'contain', borderW: 0, shadow: false, radius: 20 * c.S }); p.x = Math.round(x + (cw - pic) / 2); p.y = Math.round(y + 70 * c.S);
    const nm = T(c, names[i], 32, { weight: 700, w: cw - 20 * c.S, x: x + 10 * c.S, y: y + 80 * c.S + pic, name: 'Prize name' });
    prizes.push(card, edge, r, p, nm);
  }
  return doc(s, [...header(c), ...head.flat(), ...prizes, ...tail.flat(), web(c)]);
}

function thumb(s: BSize, picSide: 'left' | 'right'): Doc {
  const c = ctxOf(s);
  const pw = c.W * 0.4, ph = c.H - c.M * 1.6;
  const pic = PIC(c, pw, ph, { borderW: 8 * c.S, borderC: '#f2c94c' });
  pic.x = Math.round(picSide === 'right' ? c.W - pw - c.M * 0.8 : c.M * 0.8); pic.y = Math.round(c.M * 0.8);
  const tw = c.W - pw - c.M * 2.6, tx = picSide === 'right' ? c.M : pic.x + pw + c.M;
  const items = [T(c, 'আজকের বিজয়ী কে?', 120, { weight: 700, lh: 1.1, shadow: true }), pill(c, 'লাইভ ড্র · আজ রাত ৯টা', 46, 'tag')];
  column(items, tx, tw, c.M, c.H - c.M, 30 * c.S, 'left');
  return doc(s, [pic, ...items], { frame: false });
}

export const firstTemplate = (size: BSize) => TEMPLATES[1].variants[0].make(size);
export const blankDoc = (size: BSize): Doc => ({ size, bg: defaultBg(), els: [] });
