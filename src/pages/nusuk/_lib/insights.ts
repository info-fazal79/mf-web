/**
 * "লাইভ পরিসংখ্যান" card on /nusuk: active users per minute (last 2 hours) and
 * copies per 10 minutes (last 24 hours). Data: nusuk_insights() (update_27_live_insights.sql).
 * Shown only when switched on in Nusuk Manager → Dashboard (content.insights.on).
 */
import { rpc } from './rpc';

type Series = { start: string; step: number; values: number[] };
type Data = { now: string; active_now: number; peak_today: number; copies_today: number; copies_hour: number; active: Series; copies: Series };

const bn = (n: number) => n.toLocaleString('bn-BD');
const hm = (t: number) => new Date(t).toLocaleTimeString('bn-BD', { timeZone: 'Asia/Dhaka', hour: 'numeric', minute: '2-digit' });
const C_ACTIVE = '#0a7a59';
const C_COPIES = '#a8841f';

/** Keep only the most recent hours of a series (the copies tab shows 2 hours = 12 wide bars). */
function lastHours(s: Series, hours: number): Series {
  const keep = Math.max(1, Math.round((hours * 3600) / s.step));
  const v = s.values ?? [];
  const cut = Math.max(0, v.length - keep);
  return { start: new Date(Date.parse(s.start) + cut * s.step * 1000).toISOString(), step: s.step, values: v.slice(cut) };
}

export function insightsOn(content: unknown) {
  const v = content && typeof content === 'object' ? (content as Record<string, unknown>).insights : null;
  return !!v && typeof v === 'object' && (v as { on?: unknown }).on === true;
}

export function initInsights() {
  const sec = document.getElementById('nk-ins');
  const chart = document.getElementById('nk-ins-chart');
  const tip = document.getElementById('nk-ins-tip');
  if (!sec || !chart || !tip) return { setOn: (_: boolean) => {} };
  const $ = (id: string) => document.getElementById(id)!;
  let on = false;
  let tab: 'active' | 'copies' = 'active';
  let data: Data | null = null;
  let timer: ReturnType<typeof setInterval> | undefined;
  let last = 0;
  const preview = new URLSearchParams(location.search).has('insights');

  async function load() {
    if (document.visibilityState !== 'visible') return;
    last = Date.now();
    try { data = await rpc<Data>('nusuk_insights'); } catch { data = null; }
    render();
  }

  function render() {
    const show = (on || preview) && !!data;
    sec!.classList.toggle('hidden', !show);
    if (!show || !data) return;
    document.querySelectorAll<HTMLButtonElement>('#nk-ins [role=tab]').forEach((b) => {
      const sel = b.dataset.tab === tab;
      b.setAttribute('aria-selected', String(sel));
      b.className = `rounded-full px-3.5 py-1.5 text-sm font-bold transition ${sel ? 'bg-emerald-900 text-white' : 'text-emerald-900 hover:bg-emerald-50'}`;
    });
    if (tab === 'active') {
      $('nk-ins-a').textContent = bn(Math.max(1, data.active_now));
      $('nk-ins-a-l').textContent = 'এখন অ্যাক্টিভ';
      $('nk-ins-b').textContent = bn(data.peak_today);
      $('nk-ins-b-l').textContent = 'আজ সর্বোচ্চ';
      $('nk-ins-cap').textContent = 'গত ২ ঘণ্টা · প্রতি মিনিটে একসাথে কতজন ছিলেন';
      draw(data.active, 'line', C_ACTIVE, 'জন');
    } else {
      $('nk-ins-a').textContent = bn(data.copies_today);
      $('nk-ins-a-l').textContent = 'আজ কপি হয়েছে';
      $('nk-ins-b').textContent = bn(data.copies_hour);
      $('nk-ins-b-l').textContent = 'গত ১ ঘণ্টায়';
      $('nk-ins-cap').textContent = 'গত ২ ঘণ্টা · প্রতি ১০ মিনিটে কতগুলো কোড কপি হয়েছে';
      draw(lastHours(data.copies, 2), 'bars', C_COPIES, 'টি কপি');
    }
  }

  function draw(s: Series, kind: 'line' | 'bars', color: string, unit: string) {
    const v = s.values ?? [];
    const n = v.length;
    const t0 = Date.parse(s.start);
    const W = 600, H = 150, max = Math.max(1, ...v);
    const x = (i: number) => (n <= 1 ? 0 : (i / (n - 1)) * W);
    const y = (val: number) => H - (val / max) * (H - 10);
    let marks = '';
    if (kind === 'line') {
      const d = v.map((val, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(val).toFixed(1)}`).join('');
      marks = `<path d="${d}L${W},${H}L0,${H}Z" fill="${color}" fill-opacity="0.13"/><path d="${d}" fill="none" stroke="${color}" stroke-width="2" vector-effect="non-scaling-stroke" stroke-linejoin="round"/>`;
    } else {
      const bw = W / Math.max(1, n);
      marks = v.map((val, i) => (val ? `<rect x="${(i * bw + bw * 0.12).toFixed(1)}" y="${y(val).toFixed(1)}" width="${(bw * 0.76).toFixed(1)}" height="${(H - y(val)).toFixed(1)}" rx="1.5" fill="${color}"/>` : '')).join('');
    }
    const grid = [0, 0.5, 1].map((f) => `<line x1="0" x2="${W}" y1="${H - f * (H - 10)}" y2="${H - f * (H - 10)}" stroke="#053d2d" stroke-opacity="0.08" vector-effect="non-scaling-stroke"/>`).join('');
    chart!.innerHTML = `
      <div class="flex gap-2">
        <div class="flex h-24 shrink-0 flex-col justify-between text-right text-[10px] text-emerald-900/55 tabular-nums"><span>${bn(max)}</span><span>${bn(Math.round(max / 2))}</span><span>০</span></div>
        <div class="relative min-w-0 flex-1">
          <svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" class="block h-24 w-full touch-none" role="img" aria-label="${esc($('nk-ins-cap').textContent ?? '')}">${grid}${marks}<line id="nk-ins-x" x1="0" x2="0" y1="0" y2="${H}" stroke="#053d2d" stroke-opacity="0" stroke-dasharray="3 3" vector-effect="non-scaling-stroke"/></svg>
          <div class="mt-1 flex justify-between text-[10px] text-emerald-900/55"><span>${hm(t0)}</span><span>এখন</span></div>
        </div>
      </div>`;
    const svg = chart!.querySelector('svg')!;
    const cross = chart!.querySelector<SVGLineElement>('#nk-ins-x')!;
    const box = svg.parentElement!;
    const move = (e: PointerEvent) => {
      const r = svg.getBoundingClientRect();
      const i = Math.max(0, Math.min(n - 1, Math.round(((e.clientX - r.left) / r.width) * (n - 1))));
      const px = n <= 1 ? 0 : (i / (n - 1)) * 100;
      cross.setAttribute('x1', String(x(i)));
      cross.setAttribute('x2', String(x(i)));
      cross.setAttribute('stroke-opacity', '0.35');
      const from = t0 + i * s.step * 1000;
      const label = s.step >= 600 ? `${hm(from)} – ${hm(from + s.step * 1000)}` : hm(from);
      tip!.innerHTML = `<div class="font-semibold">${label}</div><div><b class="tabular-nums">${bn(v[i] ?? 0)}</b> ${unit}</div>`;
      tip!.style.left = `calc(${px}% )`;
      tip!.classList.remove('hidden');
      box.appendChild(tip!);
    };
    const leave = () => { tip!.classList.add('hidden'); cross.setAttribute('stroke-opacity', '0'); };
    svg.addEventListener('pointermove', move);
    svg.addEventListener('pointerdown', move);
    svg.addEventListener('pointerleave', leave);
  }

  document.querySelectorAll<HTMLButtonElement>('#nk-ins [role=tab]').forEach((b) =>
    b.addEventListener('click', () => { tab = b.dataset.tab === 'copies' ? 'copies' : 'active'; render(); }),
  );
  document.addEventListener('visibilitychange', () => { if ((on || preview) && document.visibilityState === 'visible' && Date.now() - last > 60_000) load(); });

  function setOn(v: boolean) {
    on = v;
    const want = on || preview;
    if (want && !timer) {
      load();
      timer = setInterval(load, 60_000); // one small call a minute, only while the tab is visible
    } else if (!want && timer) {
      clearInterval(timer);
      timer = undefined;
    }
    render();
  }
  if (preview) setOn(false);
  return { setOn };
}

const esc = (t = '') => t.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
