/**
 * /nusuk/live — broadcast screen for OBS (1920×1080). Read-only, public-safe data:
 *   nusuk_live_screen()  numbers, activity feed, winner card   (update 29) · every 10 s
 *   nusuk_insights()     active per minute, copies per 10 min (update 27) · every 30 s
 *   nusuk_quiz_public()  quiz leaderboard (codes partly hidden)            · every 60 s
 *   nusuk_featured_list() featured codes with end times                  · every 30 s
 */
import { rpc } from './rpc';
import { countdownText, countryName, flagUrl, parseToday, prizeLong } from './content';

type Series = { start: string; step: number; values: number[] };
type Screen = {
  now: string; active_now: number; visitors_today: number; new_today: number; peak_today: number;
  copies_today: number; copies_hour: number; copies_total: number; codes_active: number;
  submitted_today: number; approved_today: number; quiz_players: number; quiz_answers_today: number; quiz_correct_today: number;
  requests_today: number; feedback_today: number; today_winner: unknown; winners_count: number; notice: string | null;
  feed: { at: string; kind: string; label: string | null }[];
};
type Ins = { active: Series; copies: Series };
type QuizRow = { rank: number; prev: number | null; name: string; code?: string; points: number };
type Feat = { running: { code: string; ends: string }[] };

const bn = (n: number) => Math.round(n).toLocaleString('bn-BD');
const esc = (t = '') => t.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
const ago = (iso: string, now: number) => {
  const s = Math.max(0, Math.round((now - Date.parse(iso)) / 1000));
  if (s < 60) return 'এইমাত্র';
  const m = Math.round(s / 60);
  return m < 60 ? `${bn(m)} মিনিট আগে` : `${bn(Math.round(m / 60))} ঘণ্টা আগে`;
};

const FEED: Record<string, (l: string | null) => [string, string]> = {
  submitted: (l) => ['📥', `নতুন কোড জমা হয়েছে <b class="font-mono">${esc(l ?? '')}</b>`],
  approved: (l) => ['✅', `কোড তালিকায় যুক্ত হলো <b class="font-mono">${esc(l ?? '')}</b>`],
  featured: (l) => ['★', `কোড ফিচার করা হলো <b class="font-mono">${esc(l ?? '')}</b>`],
  quiz_join: (l) => ['🎯', `<b>${esc(l ?? 'একজন')}</b> কুইজে যোগ দিলেন`],
  feature_request: () => ['⭐', 'একজন ফিচারের জন্য আবেদন করলেন'],
  feedback: () => ['💬', 'নতুন একটি মতামত এসেছে'],
};

export function initLiveScreen() {
  const $ = (id: string) => document.getElementById(id)!;
  const params = new URLSearchParams(location.search);
  const hide = new Set((params.get('hide') ?? '').split(',').map((s) => s.trim()).filter(Boolean));
  document.querySelectorAll<HTMLElement>('[data-panel]').forEach((el) => { if (hide.has(el.dataset.panel!)) el.setAttribute('data-hidden', ''); });
  const title = params.get('title');
  if (title) $('ls-title').textContent = title.slice(0, 80);

  // Fit the 1920×1080 stage into any window (OBS uses exactly 1920×1080)
  const stage = $('ls-stage');
  const fit = () => {
    const k = Math.min(innerWidth / 1920, innerHeight / 1080);
    stage.style.transform = `translate(${(innerWidth - 1920 * k) / 2}px, ${(innerHeight - 1080 * k) / 2}px) scale(${k})`;
  };
  addEventListener('resize', fit);
  fit();

  let skew = 0;
  const now = () => Date.now() + skew;
  const clock = () => {
    const d = new Date(now());
    $('ls-clock').textContent = d.toLocaleTimeString('en-GB', { timeZone: 'Asia/Dhaka', hour: '2-digit', minute: '2-digit', second: '2-digit' });
    $('ls-date').textContent = d.toLocaleDateString('bn-BD', { timeZone: 'Asia/Dhaka', weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  };
  setInterval(clock, 1000);
  clock();

  // Numbers count up smoothly and flash when they change
  const shown = new Map<string, number>();
  function setNum(id: string, val: number) {
    const el = $(id);
    const from = shown.get(id) ?? 0;
    shown.set(id, val);
    if (from === val) { el.textContent = bn(val); return; }
    const t0 = performance.now();
    const step = (t: number) => {
      const p = Math.min(1, (t - t0) / 900);
      el.textContent = bn(from + (val - from) * (1 - Math.pow(1 - p, 3)));
      if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
    if (from) { el.classList.remove('ls-bump'); void el.offsetWidth; el.classList.add('ls-bump'); }
  }

  // ---------- Charts ----------
  function chart(el: HTMLElement, s: Series | undefined, kind: 'line' | 'bars', color: string) {
    const v = s?.values ?? [];
    const n = v.length;
    if (!n) { el.innerHTML = ''; return; }
    const W = 1000, H = 300, max = Math.max(1, ...v);
    const x = (i: number) => (n <= 1 ? 0 : (i / (n - 1)) * W);
    const y = (val: number) => H - (val / max) * (H - 16);
    let marks = '';
    if (kind === 'line') {
      const d = v.map((val, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(val).toFixed(1)}`).join('');
      marks = `<path d="${d}L${W},${H}L0,${H}Z" fill="${color}" fill-opacity="0.18"/><path d="${d}" fill="none" stroke="${color}" stroke-width="3" vector-effect="non-scaling-stroke" stroke-linejoin="round"/>`;
      const lx = x(n - 1), ly = y(v[n - 1]);
      marks += `<circle cx="${lx}" cy="${ly}" r="7" fill="${color}"/>`;
    } else {
      const bw = W / n;
      marks = v.map((val, i) => (val ? `<rect x="${(i * bw + bw * 0.14).toFixed(1)}" y="${y(val).toFixed(1)}" width="${(bw * 0.72).toFixed(1)}" height="${(H - y(val)).toFixed(1)}" rx="4" fill="${color}"/>` : '')).join('');
    }
    const grid = [0, 0.5, 1].map((f) => `<line x1="0" x2="${W}" y1="${H - f * (H - 16)}" y2="${H - f * (H - 16)}" stroke="#fff" stroke-opacity="0.1" vector-effect="non-scaling-stroke"/>`).join('');
    el.innerHTML = `<div class="flex h-full gap-3">
      <div class="flex shrink-0 flex-col justify-between text-right text-base text-emerald-100/60 ls-num"><span>${bn(max)}</span><span>${bn(max / 2)}</span><span>০</span></div>
      <svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" class="h-full w-full">${grid}${marks}</svg>
    </div>`;
  }
  const last = (s: Series | undefined, keep: number): Series | undefined =>
    s && { start: s.start, step: s.step, values: s.values.slice(-keep) };

  // ---------- Feed ----------
  let feedKey = '';
  function renderFeed(items: Screen['feed'], t: number) {
    const key = items.map((f) => f.at + f.kind).join('|');
    const fresh = key !== feedKey;
    feedKey = key;
    $('ls-feed').innerHTML = items.length
      ? items.slice(0, 11).map((f, i) => {
          const [icon, text] = (FEED[f.kind] ?? (() => ['•', '']))(f.label);
          return `<li class="${fresh && i === 0 ? 'ls-feed-item ' : ''}flex items-center gap-3 rounded-2xl bg-white/[0.06] px-4 py-2.5 text-xl">
            <span class="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white/10 text-2xl">${icon}</span>
            <span class="min-w-0 flex-1 truncate">${text}</span>
            <span class="shrink-0 text-base text-emerald-100/60">${ago(f.at, t)}</span></li>`;
        }).join('')
      : '<li class="text-xl text-emerald-100/60">নতুন কিছু ঘটলেই এখানে দেখা যাবে…</li>';
  }

  // ---------- Winner ----------
  let winTimer: ReturnType<typeof setInterval> | undefined;
  function renderWinner(raw: unknown, count: number) {
    clearInterval(winTimer);
    const w = parseToday({ today_winner: raw });
    if (!w) { $('ls-win').innerHTML = `<div class="text-xl text-emerald-100/70">বাংলাদেশি বিজয়ী এ পর্যন্ত: <b class="text-gold-400">${bn(count)}</b> জন</div>`; return; }
    $('ls-win').innerHTML = `
      <div class="flex items-center gap-4">
        <img src="${flagUrl(w.country, 160)}" alt="" class="h-16 w-24 rounded-lg object-cover ring-2 ring-white/20" />
        <div class="min-w-0"><div class="truncate text-3xl font-bold">${esc(w.name)}</div><div class="text-lg text-emerald-100/80">${esc(countryName(w.country, 'bn'))} · ${esc(prizeLong[w.prize] ?? '')}</div></div>
      </div>
      <div id="ls-next" class="mt-3 text-xl"></div>
      <div class="mt-1 text-base text-emerald-100/70">বাংলাদেশি বিজয়ী এ পর্যন্ত: <b class="text-gold-400">${bn(count)}</b> জন</div>`;
    const end = w.next_at ? Date.parse(w.next_at) : NaN;
    const tick = () => {
      const el = document.getElementById('ls-next');
      if (!el) return;
      if (Number.isNaN(end) || now() - end > 6 * 3600e3) { el.textContent = ''; return; }
      const left = end - now();
      el.innerHTML = left > 0 ? `⏳ পরবর্তী বিজয়ী ঘোষণা: <b class="ls-num font-mono text-gold-400">${countdownText(left)}</b>` : '🎉 নতুন বিজয়ী এখনই ঘোষণা হচ্ছে!';
    };
    tick();
    winTimer = setInterval(tick, 1000);
  }

  // ---------- Loaders ----------
  async function loadScreen() {
    let d: Screen;
    try { d = await rpc<Screen>('nusuk_live_screen'); } catch { return; }
    skew = Date.parse(d.now) - Date.now();
    setNum('k-active', Math.max(1, d.active_now));
    $('k-active-s').textContent = `আজ সর্বোচ্চ একসাথে ${bn(d.peak_today)} জন`;
    setNum('k-visitors', d.visitors_today);
    $('k-visitors-s').textContent = `নতুন ${bn(d.new_today)} জন`;
    setNum('k-copies', d.copies_today);
    $('k-copies-s').textContent = `গত ১ ঘণ্টায় ${bn(d.copies_hour)} · মোট ${bn(d.copies_total)}`;
    setNum('k-sub', d.submitted_today);
    $('k-sub-s').textContent = `অনুমোদিত ${bn(d.approved_today)} · তালিকায় ${bn(d.codes_active)}`;
    setNum('k-quiz', d.quiz_answers_today);
    $('k-quiz-s').textContent = `${d.quiz_answers_today ? `${bn(Math.round((d.quiz_correct_today / d.quiz_answers_today) * 100))}% সঠিক · ` : ''}${bn(d.quiz_players)} জন খেলোয়াড়`;
    renderFeed(d.feed ?? [], now());
    renderWinner(d.today_winner, d.winners_count ?? 0);
    const parts = [
      '📲 কোড নিন এক ক্লিকে: muhammadfazal.com/nusuk',
      d.notice ? `📢 ${d.notice}` : '',
      '🎯 প্রতিদিন কুইজ খেলুন, লিডারবোর্ডে নাম তুলুন',
      '⭐ নিজের কোড জমা দিন, অন্যরা ব্যবহার করবে',
      '🤝 Ribatul Ummah কমিউনিটিতে যুক্ত থাকুন',
    ].filter(Boolean).join('   •   ');
    if ($('ls-ticker').dataset.text !== parts) { $('ls-ticker').dataset.text = parts; $('ls-ticker').textContent = `${parts}   •   ${parts}   •   `; }
  }

  async function loadCharts() {
    let d: Ins;
    try { d = await rpc<Ins>('nusuk_insights'); } catch { return; }
    chart($('c-active'), d.active, 'line', '#7ee2b8');
    chart($('c-copies'), last(d.copies, 24), 'bars', '#dcbc52');
  }

  async function loadQuiz() {
    if (hide.has('quiz')) return;
    let d: { enabled: boolean; board?: QuizRow[] };
    try { d = await rpc('nusuk_quiz_public', { p_limit: 5 }); } catch { return; }
    const rows = d.enabled ? d.board ?? [] : [];
    const medal = (r: number) => (r === 1 ? '🥇' : r === 2 ? '🥈' : r === 3 ? '🥉' : bn(r));
    $('ls-quiz').innerHTML = rows.length
      ? rows.map((r) => `<li class="flex items-center gap-3 text-lg leading-snug"><span class="w-8 text-center text-xl">${medal(r.rank)}</span><b class="min-w-0 flex-1 truncate">${esc(r.name)}</b><span class="font-mono text-base text-emerald-100/60">${esc(r.code ?? '')}</span><b class="ls-num w-16 text-right text-gold-400">${bn(r.points)}</b></li>`).join('')
      : '<li class="text-xl text-emerald-100/60">আজকের কুইজের ফল এখানে দেখা যাবে</li>';
  }

  let feat: Feat['running'] = [];
  async function loadFeatured() {
    if (hide.has('featured')) return;
    try { feat = (await rpc<Feat>('nusuk_featured_list')).running ?? []; } catch { feat = []; }
    renderFeat();
  }
  function renderFeat() {
    $('ls-feat').innerHTML = feat.length
      ? feat.slice(0, 5).map((f) => `<li class="flex items-center gap-3 text-lg leading-snug"><span class="text-gold-400">★</span><b class="font-mono flex-1">${esc(f.code)}</b><span class="ls-num font-mono text-lg text-emerald-100/80">⏳ ${countdownText(Math.max(0, Date.parse(f.ends) - now()))}</span></li>`).join('')
      : '<li class="text-xl text-emerald-100/60">এখন কোনো কোড ফিচার করা নেই</li>';
  }

  loadScreen(); loadCharts(); loadQuiz(); loadFeatured();
  setInterval(loadScreen, 10_000);
  setInterval(loadCharts, 30_000);
  setInterval(loadQuiz, 60_000);
  setInterval(loadFeatured, 30_000);
  setInterval(renderFeat, 1000);
}
