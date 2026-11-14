/**
 * /nusuk/live — "Winner" view (Nusuk Manager → Live screen → Winner live).
 * A full screen for Nusuk's official winner announcement: countdown to the next announcement,
 * the latest winner, the Bangladeshi winners list and a QR code to the page. When a new
 * "Today's winner" is saved in Nusuk Manager, it is announced here with confetti.
 * Data comes from nusuk_club_live_draw() (update_40), read every 2 s by liveraffle.ts.
 */
import qrcode from 'qrcode-generator';
import { countdownText, countryName, flagUrl, parseToday, parseWinners, prizeLong, type TodayWinner } from './content';
import { lucide } from './lucide';

export type WinnerData = { mode: 'winner'; now: string; today?: unknown; winners?: unknown[] };

const esc = (t = '') => t.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
const bn = (n: number) => Math.round(n).toLocaleString('bn-BD');
const prizeText = (w: { prize: keyof typeof prizeLong; prize_text?: string }) => (w.prize_text?.trim() || prizeLong[w.prize] || '').replace(/^[^\p{L}\p{N}]+/u, '');
const dateText = (d?: string) => {
  if (!d) return '';
  const t = Date.parse(d.length === 10 ? `${d}T12:00:00+06:00` : d);
  return Number.isNaN(t) ? d : new Date(t).toLocaleDateString('bn-BD', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Dhaka' });
};
const keyOf = (w: TodayWinner | null) => (w ? `${w.name.trim().toLowerCase()}|${w.country}|${w.date}|${w.prize}` : '');

function qrSvg(text: string) {
  const qr = qrcode(0, 'M');
  qr.addData(text);
  qr.make();
  const n = qr.getModuleCount();
  let d = '';
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (qr.isDark(r, c)) d += `M${c} ${r}h1v1h-1z`;
  return `<svg viewBox="-2 -2 ${n + 4} ${n + 4}" class="h-full w-full" aria-hidden="true"><rect x="-2" y="-2" width="${n + 4}" height="${n + 4}" fill="#fff"/><path d="${d}" fill="#053d2d"/></svg>`;
}

export function initLiveWinner() {
  const $ = (id: string) => document.getElementById(id)!;
  let skew = 0;
  let today: TodayWinner | null = null;
  let lastKey: string | null = null; // first load: no announcement
  let revealTimer: ReturnType<typeof setTimeout> | undefined;
  $('lw-qr').innerHTML = qrSvg('https://muhammadfazal.com/nusuk');
  /** only touch the page when something really changed (keeps the stream smooth, animations don't restart) */
  const setHtml = (el: HTMLElement, html: string) => { if (el.dataset.html !== html) { el.dataset.html = html; el.innerHTML = html; } };

  function renderLatest() {
    const box = $('lw-latest');
    if (!today) {
      setHtml(box, `<div class="text-3xl ls-muted">এখনো কোনো বিজয়ী যুক্ত করা হয়নি</div>`);
      return;
    }
    setHtml(box, `
      <div class="flex items-center gap-8">
        <img src="${flagUrl(today.country, 160)}" alt="" class="h-[120px] w-[180px] shrink-0 rounded-2xl object-cover shadow-lg ring-4 ring-white/40" />
        <div class="min-w-0">
          <div class="flex items-center gap-4">
            <span class="lw-today-badge">🎉 আজকের বিজয়ী</span>
            ${today.date ? `<span class="text-2xl ls-muted">${esc(dateText(today.date))}</span>` : ''}
          </div>
          <div class="mt-2 truncate text-[64px] font-bold leading-tight">${esc(today.name)}</div>
          <div class="mt-1 flex flex-wrap items-center gap-3 text-2xl">
            <span class="ls-chip rounded-full px-4 py-1">${esc(countryName(today.country, 'bn'))}</span>
            <span class="rounded-full px-4 py-1 font-bold ls-accent" style="background: color-mix(in srgb, var(--accent) 16%, transparent)">${esc(prizeText(today))}</span>
          </div>
        </div>
      </div>`);
  }

  function renderList(raw: unknown[]) {
    const list = parseWinners({ winners: raw });
    const total = bn(list.length);
    if ($('lw-total').textContent !== total) $('lw-total').textContent = total;
    setHtml($('lw-list'), list.slice(0, 5).map((w, i) => `
      <li class="flex items-center gap-3 rounded-xl px-3 py-2 ${i === 0 ? 'ls-chip' : ''}">
        <span class="text-2xl" aria-hidden="true">${w.prize === 'umrah' ? '🕋' : w.prize === 'zamzam' ? '💧' : '🎁'}</span>
        <span class="min-w-0 flex-1 truncate text-2xl font-semibold">${esc(w.name)}</span>
        <span class="shrink-0 text-lg ls-muted">${esc(dateText(w.date))}</span>
      </li>`).join('') || '<li class="text-xl ls-muted">তালিকা শীঘ্রই আসছে</li>');
  }

  function tick() {
    const box = $('lw-countbox');
    const end = today?.next_at ? Date.parse(today.next_at) : NaN;
    const nowMs = Date.now() + skew;
    const show = (mode: string, html: string) => { if (box.dataset.mode !== mode) { box.dataset.mode = mode; box.innerHTML = html; } };
    if (Number.isNaN(end) || nowMs - end > 12 * 3600e3) {
      show('none', `<div class="text-3xl ls-label-hero">পরবর্তী বিজয়ী ঘোষণার সময় শীঘ্রই জানানো হবে</div>
        <div class="mt-2 text-xl ls-muted">লাইভে থাকুন, ঘোষণার সাথে সাথে এখানে দেখা যাবে</div>`);
      return;
    }
    const left = end - nowMs;
    if (left > 0) {
      show('count', `<div class="flex items-center justify-center gap-3 text-3xl ls-label-hero">${lucide('hourglass', 'h-8 w-8')}পরবর্তী বিজয়ী ঘোষণা</div>
         <div id="lw-cd" class="ls-num mt-2 font-mono text-[120px] font-bold leading-none ls-accent"></div>
         <div class="mt-3 text-xl ls-muted">ঘোষণার সাথে সাথে এখানে দেখা যাবে · লাইভে থাকুন</div>`);
      const cd = $('lw-cd');
      const txt = countdownText(left);
      if (cd.textContent !== txt) cd.textContent = txt;
      cd.classList.toggle('ls-live', left < 60_000);
    } else {
      show('soon', `<div class="flex items-center justify-center gap-3 text-[52px] font-bold ls-accent">${lucide('partyPopper', 'h-12 w-12')}যেকোনো মুহূর্তে ঘোষণা আসছে<span class="lw-dots"></span></div>
         <div class="mt-3 text-2xl ls-muted">নুসুক কর্তৃপক্ষ ফলাফল ঘোষণা করলেই এখানে দেখাবে</div>`);
    }
  }
  setInterval(tick, 1000);

  function confetti() {
    const box = $('lw-confetti');
    box.innerHTML = '';
    const colors = ['#f2c94c', '#2bb38a', '#ffffff', '#e0b93a', '#4fe3d0', '#f59e0b', '#10b981'];
    for (let i = 0; i < 140; i++) {
      const s = document.createElement('span');
      s.className = 'lw-bit';
      s.style.left = `${Math.random() * 100}%`;
      s.style.background = colors[i % colors.length];
      s.style.animationDelay = `${Math.random() * 1.8}s`;
      s.style.animationDuration = `${3.5 + Math.random() * 3}s`;
      s.style.transform = `rotate(${Math.random() * 360}deg)`;
      s.style.width = `${8 + Math.random() * 10}px`;
      s.style.height = `${12 + Math.random() * 14}px`;
      box.append(s);
    }
  }

  function reveal(w: TodayWinner) {
    const box = $('lw-reveal');
    $('lw-reveal-body').innerHTML = `
      <div class="text-[44px] font-bold ls-accent">🎉 নতুন বিজয়ী ঘোষণা!</div>
      <img src="${flagUrl(w.country, 160)}" alt="" class="mx-auto mt-6 h-[150px] w-[225px] rounded-2xl object-cover shadow-2xl ring-4 ring-white/50" />
      <div class="mt-6 text-[96px] font-bold leading-tight">${esc(w.name)}</div>
      <div class="mt-2 text-4xl ls-muted">${esc(countryName(w.country, 'bn'))}${w.date ? ` · ${esc(dateText(w.date))}` : ''}</div>
      <div class="mt-6 inline-block rounded-full px-8 py-3 text-[44px] font-bold ls-accent" style="background: color-mix(in srgb, var(--accent) 18%, transparent)">${esc(prizeText(w))}</div>
      <div class="mt-8 text-3xl ls-muted">অভিনন্দন! আপনিও হতে পারেন পরবর্তী বিজয়ী · muhammadfazal.com/nusuk</div>`;
    box.removeAttribute('data-hidden');
    box.classList.remove('lw-in'); void box.offsetWidth; box.classList.add('lw-in');
    confetti();
    clearTimeout(revealTimer);
    revealTimer = setTimeout(() => { box.setAttribute('data-hidden', ''); $('lw-confetti').innerHTML = ''; }, 16_000);
  }

  return function update(d: WinnerData) {
    skew = Date.parse(d.now) - Date.now();
    const next = parseToday({ today_winner: d.today });
    const k = keyOf(next);
    if (lastKey !== null && k && k !== lastKey) reveal(next!);
    lastKey = k;
    today = next;
    renderLatest();
    renderList(Array.isArray(d.winners) ? d.winners : []);
    tick();
  };
}
