/**
 * /nusuk — district map. A Bangladesh map that fills in as people make their account:
 * a district with no account yet stays light green, one with accounts turns dark green and
 * shows how many. A signed-in member sees an animated pin on their own district.
 * Tap a district to zoom in on it.
 * Counts come from nusuk_district_map() (update 43, cached 60 s); the outlines (bdmap.ts) load
 * only when the section comes near the screen.
 */
import { rpc } from './rpc';
import { bn, getMyDistrict, hasMemberSession, isJoinedMember, memberClient, setMyDistrict } from './club';

type MapData = { public: boolean; total: number; d: Record<string, number> };
type Dist = { bn: string; en: string; path: string; lx: number; ly: number; box: [number, number, number, number]; n: number; el?: SVGGElement };

const SVGNS = 'http://www.w3.org/2000/svg';
const ABROAD = ['দেশের বাইরে', 'বিদেশ', 'প্রবাস', 'abroad', 'outside bangladesh', 'outside'];
/** a few common ways people write some district names in Bangla */
const BN_ALT: Record<string, string> = {
  'chattagram': 'চট্টগ্রাম', 'chottogram': 'চট্টগ্রাম', 'chatgaon': 'চট্টগ্রাম', 'mymensing': 'ময়মনসিংহ', 'moymonsingh': 'ময়মনসিংহ', 'chapai': 'চাঁপাইনবাবগঞ্জ',
  'চট্রগ্রাম': 'চট্টগ্রাম', 'চট্টগ্রাম': 'চট্টগ্রাম', 'বগুরা': 'বগুড়া', 'নারায়ণগঞ্জ': 'নারায়ণগঞ্জ', 'নারায়নগঞ্জ': 'নারায়ণগঞ্জ',
  'ব্রাহ্মণবাড়ীয়া': 'ব্রাহ্মণবাড়িয়া', 'বি.বাড়িয়া': 'ব্রাহ্মণবাড়িয়া', 'চাপাইনবাবগঞ্জ': 'চাঁপাইনবাবগঞ্জ', 'চাঁপাই': 'চাঁপাইনবাবগঞ্জ',
  'রাঙামাটি': 'রাঙ্গামাটি', 'নেত্রকোণা': 'নেত্রকোনা', 'ঝালকাঠী': 'ঝালকাঠি', 'মৌলভি বাজার': 'মৌলভীবাজার', 'কক্স বাজার': 'কক্সবাজার',
  'লক্ষীপুর': 'লক্ষ্মীপুর', 'টাংগাইল': 'টাঙ্গাইল', 'মানিকগঞ্জ': 'মানিকগঞ্জ', 'নরসিংদি': 'নরসিংদী', 'যশোহর': 'যশোর', 'কুষ্টিয়া': 'কুষ্টিয়া',
};
const clean = (s: string) => s.toLowerCase().normalize('NFC').replace(/(জেলা|district|sadar|সদর|zila|zilla)/g, '').replace(/[.,;:()\-_/]+/g, ' ').replace(/\s+/g, ' ').trim();

export function initDistrictMap() {
  const sec = document.getElementById('nk-dm');
  if (!sec) return;
  const $ = (id: string) => document.getElementById(id)!;
  let dists: Dist[] = [];
  let W = 600, H = 848;
  let svg: SVGSVGElement | null = null;
  let vb = [0, 0, 600, 848];
  let picked: Dist | null = null;
  let mine = '';
  let prev: Map<string, number> | null = null;
  let abroad = 0;
  let loading = false;
  let timer: ReturnType<typeof setInterval> | undefined;

  // -------- which district a typed name belongs to --------
  let alias: [string, number][] = [];
  const match = (raw: string) => {
    const k = clean(raw);
    if (!k) return -1;
    if (ABROAD.some((a) => k.includes(a))) return -2;
    let best = -1, bestLen = 0;
    for (const [a, i] of alias) if ((k === a || k.includes(a)) && a.length > bestLen) { best = i; bestLen = a.length; }
    return best;
  };

  async function load() {
    if (loading) return;
    loading = true;
    try {
      const [{ BD_DISTRICTS, BD_W, BD_H }, data] = await Promise.all([import('./bdmap'), rpc<MapData>('nusuk_district_map')]);
      if (!data?.public) { sec!.classList.add('hidden'); return; }
      if (!dists.length) {
        W = BD_W; H = BD_H; vb = [0, 0, W, H];
        dists = BD_DISTRICTS.map(([b, e, path, lx, ly, box]) => ({ bn: b, en: e, path, lx, ly, box, n: 0 }));
        BD_DISTRICTS.forEach(([b, e, , , , , alt], i) => {
          alias.push([clean(b), i], [clean(e), i]);
          alt.split('|').forEach((a) => alias.push([clean(a), i]));
        });
        Object.entries(BN_ALT).forEach(([a, to]) => { const i = dists.findIndex((d) => d.bn === to); if (i >= 0) alias.push([clean(a), i]); });
        alias = alias.filter(([a]) => a.length >= 3);
      }
      dists.forEach((d) => { d.n = 0; });
      abroad = 0;
      for (const [k, n] of Object.entries(data.d ?? {})) {
        const i = match(k);
        if (i >= 0) dists[i].n += Number(n) || 0; else if (i === -2) abroad += Number(n) || 0;
      }
      sec!.classList.remove('hidden');
      await findMine();
      render(data.total || 0);
    } catch {
      /* keep what is on screen */
    } finally { loading = false; }
  }

  /** the signed-in member's district: remembered by the account page; asked once if missing */
  async function findMine() {
    if (!hasMemberSession()) { mine = ''; return; }
    let m = getMyDistrict();
    if (m == null && isJoinedMember()) {
      try {
        const c = await memberClient();
        const r = c ? await c.rpc('nusuk_club_me') : null;
        m = ((r?.data as { member?: { district?: string | null } } | null)?.member?.district ?? '').trim();
        setMyDistrict(m);
      } catch { m = ''; }
    }
    const i = m ? match(m) : -1;
    mine = i >= 0 ? dists[i].bn : '';
  }

  const shade = (n: number, max: number) => {
    if (!n) return '';
    const t = Math.log(1 + n) / Math.log(1 + Math.max(max, 2)); // 0..1
    const a = [79, 174, 134], b = [6, 70, 51]; // #4fae86 → #064633
    return `rgb(${a.map((v, j) => Math.round(v + (b[j] - v) * t)).join(',')})`;
  };

  function el<K extends keyof SVGElementTagNameMap>(tag: K, attrs: Record<string, string | number>, parent?: Element) {
    const e = document.createElementNS(SVGNS, tag);
    for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, String(v));
    parent?.append(e);
    return e;
  }

  function build() {
    const box = $('nk-dm-map');
    box.innerHTML = '';
    svg = el('svg', { viewBox: vb.join(' '), class: 'nk-dm-svg', role: 'img', 'aria-label': 'বাংলাদেশের জেলাভিত্তিক মানচিত্র' }) as SVGSVGElement;
    const shapes = el('g', { class: 'nk-dm-shapes' }, svg);
    const labels = el('g', { class: 'nk-dm-labels' }, svg);
    dists.forEach((d, i) => {
      const g = el('g', { class: 'nk-dm-d', tabindex: 0, role: 'button', 'data-i': i }, shapes) as SVGGElement;
      el('path', { d: d.path }, g);
      el('title', {}, g);
      d.el = g;
      const lg = el('g', { class: 'nk-dm-lab', 'data-i': i, transform: `translate(${d.lx} ${d.ly})` }, labels);
      el('text', { class: 'nk-dm-name', y: 0 }, lg).textContent = d.bn;
      el('g', { class: 'nk-dm-badge' }, lg);
    });
    el('g', { class: 'nk-dm-pin' }, svg);
    box.append(svg);
    svg.addEventListener('click', (e) => {
      const g = (e.target as Element).closest<SVGGElement>('.nk-dm-d');
      if (!g) return zoomTo(null);
      const d = dists[Number(g.dataset.i)];
      zoomTo(picked === d ? null : d);
    });
    svg.addEventListener('keydown', (e) => {
      const g = (e.target as Element).closest<SVGGElement>('.nk-dm-d');
      if (g && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); const d = dists[Number(g.dataset.i)]; zoomTo(picked === d ? null : d); }
    });
  }

  function render(total: number) {
    if (!svg) build();
    const max = Math.max(0, ...dists.map((d) => d.n));
    const changed = new Set<string>();
    dists.forEach((d, i) => {
      const g = d.el!;
      const fill = shade(d.n, max);
      const p = g.firstElementChild as SVGPathElement;
      if (fill) p.style.fill = fill; else p.style.removeProperty('fill');
      g.classList.toggle('nk-dm-on', d.n > 0);
      g.classList.toggle('nk-dm-mine', d.bn === mine);
      g.querySelector('title')!.textContent = `${d.bn}: ${bn(d.n)} জন`;
      g.setAttribute('aria-label', `${d.bn}, ${bn(d.n)} জন`);
      if (prev && (prev.get(d.bn) ?? 0) < d.n) changed.add(d.bn);
      // label: name, and the number on a small badge
      const lg = svg!.querySelector<SVGGElement>(`.nk-dm-lab[data-i="${i}"]`)!;
      lg.classList.toggle('nk-dm-on', d.n > 0);
      const name = lg.querySelector('text')!;
      const badge = lg.querySelector<SVGGElement>('.nk-dm-badge')!;
      badge.innerHTML = '';
      if (d.n > 0) {
        const t = bn(d.n);
        const w = 7 + t.length * 5.2;
        name.setAttribute('y', '-3');
        el('rect', { x: -w / 2, y: 0.5, width: w, height: 10, rx: 5 }, badge);
        el('text', { y: 8.6 }, badge).textContent = t;
      } else name.setAttribute('y', '2.5');
    });
    // the member's own district: a bouncing pin
    const pin = svg!.querySelector<SVGGElement>('.nk-dm-pin')!;
    pin.innerHTML = '';
    const md = dists.find((d) => d.bn === mine);
    if (md) {
      const g = el('g', { transform: `translate(${md.lx} ${md.ly - 9})` }, pin);
      el('ellipse', { class: 'nk-dm-pin-ring', cx: 0, cy: 9, rx: 7, ry: 2.6 }, g);
      const b = el('g', { class: 'nk-dm-pin-b' }, g);
      // lucide map-pin, 24 → ~16 units, tip at (0, 9)
      const s = el('g', { transform: 'translate(-8 -7) scale(0.667)' }, b);
      el('path', { d: 'M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0', class: 'nk-dm-pin-body' }, s);
      el('circle', { cx: 12, cy: 10, r: 3, class: 'nk-dm-pin-dot' }, s);
    }
    changed.forEach((n) => {
      const d = dists.find((x) => x.bn === n)!;
      d.el!.classList.remove('nk-dm-new'); void d.el!.getBoundingClientRect(); d.el!.classList.add('nk-dm-new');
    });
    prev = new Map(dists.map((d) => [d.bn, d.n]));

    // numbers above the map
    const on = dists.filter((d) => d.n > 0).length;
    $('nk-dm-total').textContent = bn(total);
    $('nk-dm-dists').textContent = `${bn(on)}/৬৪`;
    const top = [...dists].filter((d) => d.n > 0).sort((a, b) => b.n - a.n).slice(0, 5);
    $('nk-dm-top').innerHTML = top.length
      ? top.map((d, i) => `<li><button type="button" data-bn="${d.bn}" class="nk-dm-chip${d.bn === mine ? ' nk-dm-chip-mine' : ''}"><b>${bn(i + 1)}</b> ${d.bn} <span>${bn(d.n)}</span></button></li>`).join('')
      : '<li class="text-sm text-emerald-900/60">এখনো কোনো জেলা যুক্ত হয়নি, প্রথম জেলাটি আপনার হোক!</li>';
    $('nk-dm-abroad').textContent = abroad ? `দেশের বাইরে থেকে ${bn(abroad)} জন` : '';
    $('nk-dm-abroad').classList.toggle('hidden', !abroad);
    const mineD = dists.find((d) => d.bn === mine);
    const cta = $('nk-dm-cta');
    const you = $('nk-dm-you');
    if (mineD) {
      const rank = [...dists].sort((a, b) => b.n - a.n).findIndex((d) => d === mineD) + 1;
      you.innerHTML = `আপনার জেলা <b>${mineD.bn}</b>: ${bn(mineD.n)} জন · অবস্থান <b>${bn(rank)}</b> নম্বরে। পরিচিতদের অ্যাকাউন্ট খুলতে বলুন, জেলাকে এগিয়ে নিন!`;
      you.classList.remove('hidden');
      cta.classList.add('hidden');
    } else {
      you.classList.add('hidden');
      cta.classList.toggle('hidden', isJoinedMember());
    }
    if (picked) info(picked);
  }

  // -------- zoom --------
  let anim = 0;
  function setVb(to: number[], ms = 520) {
    cancelAnimationFrame(anim);
    const from = [...vb];
    const t0 = performance.now();
    const step = (t: number) => {
      const k = Math.min(1, (t - t0) / ms);
      const e = k < 0.5 ? 4 * k * k * k : 1 - (-2 * k + 2) ** 3 / 2;
      vb = from.map((v, i) => v + (to[i] - v) * e);
      svg!.setAttribute('viewBox', vb.join(' '));
      if (k < 1) anim = requestAnimationFrame(step);
    };
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) { vb = to; svg!.setAttribute('viewBox', vb.join(' ')); return; }
    anim = requestAnimationFrame(step);
  }
  function zoomTo(d: Dist | null) {
    picked = d;
    svg!.classList.toggle('nk-dm-zoomed', !!d);
    dists.forEach((x) => x.el!.classList.toggle('nk-dm-picked', x === d));
    $('nk-dm-reset').classList.toggle('hidden', !d);
    if (!d) { setVb([0, 0, W, H]); $('nk-dm-info').classList.add('hidden'); return; }
    const [x0, y0, x1, y1] = d.box;
    const pad = 22;
    let w = x1 - x0 + pad * 2, h = y1 - y0 + pad * 2;
    // keep the map's shape
    if (w / h > W / H) h = (w * H) / W; else w = (h * W) / H;
    const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
    setVb([cx - w / 2, cy - h / 2, w, h]);
    info(d);
  }
  function info(d: Dist) {
    const rank = d.n ? [...dists].sort((a, b) => b.n - a.n).findIndex((x) => x === d) + 1 : 0;
    const box = $('nk-dm-info');
    box.innerHTML = `<b class="text-base">${d.bn}</b>${d.bn === mine ? ' <span class="nk-dm-you-tag">আপনার জেলা</span>' : ''}
      <span>${d.n ? `${bn(d.n)} জন অ্যাকাউন্ট খুলেছেন · ${bn(rank)} নম্বরে` : 'এখনো কেউ অ্যাকাউন্ট খোলেননি, প্রথম জন হোন!'}</span>`;
    box.classList.remove('hidden');
  }
  $('nk-dm-reset').addEventListener('click', () => zoomTo(null));
  $('nk-dm-top').addEventListener('click', (e) => {
    const b = (e.target as Element).closest<HTMLButtonElement>('[data-bn]');
    const d = b && dists.find((x) => x.bn === b.dataset.bn);
    if (d) { zoomTo(d); svg?.scrollIntoView({ behavior: 'smooth', block: 'center' }); }
  });

  // load when the section comes near; refresh every 90 s while the page is open and visible
  const io = new IntersectionObserver((es) => {
    if (!es.some((e) => e.isIntersecting)) return;
    io.disconnect();
    load();
    timer = setInterval(() => { if (document.visibilityState === 'visible') load(); }, 90_000);
  }, { rootMargin: '600px 0px' });
  io.observe(sec);
  void timer;
}
