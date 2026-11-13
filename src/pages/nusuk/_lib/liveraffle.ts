/**
 * /nusuk/live — Reward Club raffle view (Nusuk Manager → Reward Club → Raffle draw → "Show this draw").
 * Reads nusuk_club_live_draw() every 2 s (update_34_club_draw.sql). In raffle mode the middle of
 * the screen becomes: wheel + countdown + prizes + winners. A newly drawn winner spins the wheel
 * here too and is announced, one at a time.
 */
import { rpc } from './rpc';
import { POINTER_SVG, SPIN_MS, bnPlace, buildSlots, drawSeed, landingIndex, spinTo, wheelSvg, type Slot, type WheelPerson } from './clubdraw';

type Win = { id: number; place: number; prize: string; tickets: number; k: number; name: string; code: string };
type Draw = {
  mode: 'normal' | 'raffle';
  now: string;
  countdown_end?: string | null;
  scope?: string;
  contest?: { id: number; title: string; kind: 'lucky' | 'window' | 'top'; prizes: { place: number; prize: string }[] };
  total?: number;
  people?: number;
  wheel?: WheelPerson[];
  winners?: Win[];
};

const bn = (n: number) => Math.round(n).toLocaleString('bn-BD');
const bnd = (n: number) => String(n).replace(/\d/g, (d) => '০১২৩৪৫৬৭৮৯'[Number(d)]); // SL numbers, no comma
const esc = (t = '') => t.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
const first = (n: string) => n.trim().split(/\s+/)[0] ?? n;
const scopeText = (s?: string) => (!s || s === 'all' ? 'পুরো প্রতিযোগিতার টিকিট' : `${new Date(`${s}T00:00:00+06:00`).toLocaleDateString('bn-BD', { day: 'numeric', month: 'long', timeZone: 'Asia/Dhaka' })}-এর টিকিট`);

export function initLiveRaffle(opts: { onMode: (mode: 'normal' | 'raffle' | 'winner') => void; onWinner: (d: unknown) => void; theme: () => string }) {
  const $ = (id: string) => document.getElementById(id)!;
  let draw: Draw | null = null;
  let drawKey = '';
  let skew = 0;
  let shownIds = new Set<number>();
  let revealed: Win[] = [];
  const queue: Win[] = [];
  let busy = false;
  let rotation = 0;
  let slots: Slot[] = [];
  let lastWheelKey = '';

  const wheelBox = $('lr-wheel');
  $('lr-pointer').innerHTML = POINTER_SVG;

  function renderWheel(force = false) {
    if (!draw?.contest || busy) return;
    const out = new Set(revealed.map((w) => w.k));
    const people = (draw.wheel ?? []).filter((p) => !out.has(p.k)).map((p) => ({ ...p, name: first(p.name) }));
    const key = `${drawKey}|${people.length}|${people.reduce((a, p) => a + p.t, 0)}|${opts.theme()}`;
    if (!force && key === lastWheelKey) return;
    lastWheelKey = key;
    slots = buildSlots(people, drawSeed(draw.contest.id, draw.scope ?? 'all'));
    wheelBox.style.transition = 'none';
    wheelBox.innerHTML = wheelSvg(slots, opts.theme());
    wheelBox.style.transform = `rotate(${rotation}deg)`;
  }

  function renderSide() {
    if (!draw?.contest) return;
    const c = draw.contest;
    $('lr-title').textContent = c.title;
    $('lr-scope').textContent = `${scopeText(draw.scope)} · ${bn(draw.total ?? 0)} ${c.kind === 'top' ? 'রেফারেল' : 'টিকিট'} · ${bn(draw.people ?? 0)} জন`;
    $('lr-wheelbox').toggleAttribute('data-hidden', c.kind === 'top');
    $('lr-topnote').toggleAttribute('data-hidden', c.kind !== 'top');
    const won = new Map(revealed.map((w) => [w.place, w]));
    const prizes = c.prizes?.length ? c.prizes : [{ place: 1, prize: '' }];
    $('lr-prizes').innerHTML = prizes.map((p) => {
      const w = won.get(p.place);
      return `<li class="flex items-center gap-3 rounded-xl px-3 py-2 ${w ? 'ls-chip' : ''}">
        <span class="ls-rank ${p.place <= 3 ? `ls-rank-${p.place}` : ''}">${bnPlace(p.place)}</span>
        <span class="min-w-0 flex-1 truncate text-xl">${w ? `<b>${esc(w.name)}</b> <span class="ls-muted text-base">SL ${bnd(w.k)} · <span class="font-mono">${esc(w.code)}</span></span>` : `<span class="ls-muted">${esc(p.prize || 'পুরস্কার')}</span>`}</span>
        ${w ? `<span class="shrink-0 text-base ls-accent">${esc(p.prize)}</span>` : ''}
      </li>`;
    }).join('');
  }

  function renderCountdown() {
    const el = $('lr-count');
    const end = draw?.countdown_end ? Date.parse(draw.countdown_end) : 0;
    if (!end) { $('lr-countbox').setAttribute('data-hidden', ''); return; }
    $('lr-countbox').removeAttribute('data-hidden');
    const ms = Math.max(0, end - (Date.now() + skew));
    const s = Math.ceil(ms / 1000);
    el.textContent = ms > 0 ? `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}` : '০০:০০';
    $('lr-countlabel').textContent = ms > 0 ? 'ড্র শুরু হতে বাকি' : 'এখনই ড্র হচ্ছে…';
    el.classList.toggle('ls-live', ms > 0 && ms < 10_000);
  }
  setInterval(renderCountdown, 250);

  function announce(w: Win) {
    const box = $('lr-announce');
    box.innerHTML = `<div class="text-3xl ls-accent font-bold">🎉 ${bnPlace(w.place)} বিজয়ী</div>
      <div class="mt-2 text-[64px] font-bold leading-tight">${esc(w.name)}</div>
      <div class="mt-1 text-2xl ls-muted">SL ${bnd(w.k)} · <span class="font-mono">${esc(w.code)}</span></div>
      ${w.prize ? `<div class="mt-3 text-3xl font-bold ls-accent">🎁 ${esc(w.prize)}</div>` : ''}`;
    box.removeAttribute('data-hidden');
    box.classList.remove('lr-pop'); void box.offsetWidth; box.classList.add('lr-pop');
    setTimeout(() => box.setAttribute('data-hidden', ''), 7000);
  }

  async function play() {
    if (busy) return;
    const w = queue.shift();
    if (!w || !draw?.contest) return;
    busy = true;
    if (draw.contest.kind !== 'top' && slots.length) {
      const land = landingIndex(slots, { k: w.k, name: first(w.name) }, w.id);
      if (land.slots !== slots) { slots = land.slots; wheelBox.innerHTML = wheelSvg(slots, opts.theme()); }
      rotation = spinTo(rotation, land.index, slots.length);
      wheelBox.style.transition = `transform ${SPIN_MS / 1000}s cubic-bezier(0.08, 0.6, 0.02, 1)`;
      wheelBox.style.transform = `rotate(${rotation}deg)`;
      await new Promise((r) => setTimeout(r, SPIN_MS + 300));
    }
    revealed = [...revealed, w];
    announce(w);
    renderSide();
    await new Promise((r) => setTimeout(r, 2500));
    busy = false;
    renderWheel(true);
    if (queue.length) play();
  }

  async function poll() {
    let d: Draw;
    try { d = await rpc<Draw>('nusuk_club_live_draw'); } catch { return; } // update 34 not run: stay normal
    skew = Date.parse(d.now) - Date.now();
    if ((d.mode as string) === 'winner') { opts.onMode('winner'); opts.onWinner(d); draw = null; drawKey = ''; return; }
    const raffle = d.mode === 'raffle' && !!d.contest;
    opts.onMode(raffle ? 'raffle' : 'normal');
    if (!raffle) { draw = null; drawKey = ''; return; }
    const key = `${d.contest!.id}|${d.scope}`;
    if (key !== drawKey) {
      // a different draw: everyone already drawn shows at once, no animation
      drawKey = key;
      draw = d;
      revealed = (d.winners ?? []).slice();
      shownIds = new Set(revealed.map((w) => w.id));
      queue.length = 0;
      lastWheelKey = '';
    } else {
      draw = d;
      const ids = new Set((d.winners ?? []).map((w) => w.id));
      // winners removed in Nusuk Manager disappear here too
      if (revealed.some((w) => !ids.has(w.id))) { revealed = revealed.filter((w) => ids.has(w.id)); shownIds = new Set(revealed.map((w) => w.id)); lastWheelKey = ''; }
      for (const w of d.winners ?? []) if (!shownIds.has(w.id)) { shownIds.add(w.id); queue.push(w); }
    }
    renderSide();
    renderWheel();
    renderCountdown();
    if (queue.length) play();
  }
  poll();
  setInterval(poll, 2000);
}
