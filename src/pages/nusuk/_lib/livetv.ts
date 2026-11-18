/**
 * /nusuk/live — the TV program (Nusuk Manager → Live screen → Controller):
 *   • scenes that follow one another by themselves (auto) or the one picked (pin):
 *     main dashboard, live numbers + chart, Bangladeshi Umrah winners, latest Nusuk winner,
 *     join (QR + links), promo ads in an "L" around the shrunk screen, YouTube videos
 *   • short notices over the blurred screen
 *   • background music (a playlist that loops), paused while a video plays
 * The raffle / winner views (Reward Club draw, Winner live) take over the screen while they are on.
 * ?preview=1 (the preview in Nusuk Manager) keeps music and videos silent.
 */
import qrcode from 'qrcode-generator';
import { countryName, flagUrl, parseToday, parseWinners, prizeLong, winnerDayLabel } from './content';
import { lucide } from './lucide';
import { ytId, type LiveCfg, type Promo, type Scene, type SceneKey } from './livecfg';

type Series = { start: string; step: number; values: number[] };
export type TvData = {
  screen: { active_now: number; visitors_today: number; new_today: number; peak_today: number; copies_today: number; copies_hour: number; copies_total: number; codes_active: number } | null;
  ins: { active: Series; copies: Series } | null;
};
type Raw = { _winners?: unknown; _today?: unknown };
type YTPlayer = { loadVideoById: (id: string) => void; playVideo: () => void; mute: () => void; destroy: () => void };
type YTNs = { Player: new (el: string | HTMLElement, o: unknown) => YTPlayer };

const bn = (n: number) => Math.round(n).toLocaleString('bn-BD');
const esc = (t = '') => t.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
const SITE = 'https://muhammadfazal.com/nusuk';
const BD_FLAG = '<svg viewBox="0 0 20 12" class="h-full w-full" aria-hidden="true"><rect width="20" height="12" fill="#006a4e"/><circle cx="9" cy="6" r="3.8" fill="#f42a41"/></svg>';

function qrSvg(text: string) {
  const qr = qrcode(0, 'M');
  qr.addData(text);
  qr.make();
  const n = qr.getModuleCount();
  let d = '';
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (qr.isDark(r, c)) d += `M${c} ${r}h1v1h-1z`;
  return `<svg viewBox="-2 -2 ${n + 4} ${n + 4}" class="h-full w-full" aria-hidden="true"><rect x="-2" y="-2" width="${n + 4}" height="${n + 4}" fill="#fff"/><path d="${d}" fill="#053d2d"/></svg>`;
}
function lineSvg(v: number[], color: string) {
  const n = v.length;
  if (!n) return '';
  const W = 1000, H = 300, max = Math.max(1, ...v);
  const x = (i: number) => (n <= 1 ? 0 : (i / (n - 1)) * W);
  const y = (val: number) => H - (val / max) * (H - 16);
  const d = v.map((val, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(val).toFixed(1)}`).join('');
  return `<div class="flex h-full gap-3"><div class="flex shrink-0 flex-col justify-between text-right text-lg ls-muted ls-num"><span>${bn(max)}</span><span>${bn(max / 2)}</span><span>০</span></div>
    <svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" class="h-full w-full"><path d="${d}L${W},${H}L0,${H}Z" fill="${color}" fill-opacity="0.2"/><path d="${d}" fill="none" stroke="${color}" stroke-width="4" vector-effect="non-scaling-stroke" stroke-linejoin="round"/><circle cx="${x(n - 1)}" cy="${y(v[n - 1])}" r="8" fill="${color}"/></svg></div>`;
}
const dateBn = (d?: string) => (d ? new Date(`${d}T00:00:00`).toLocaleDateString('bn-BD', { day: 'numeric', month: 'long', year: 'numeric' }) : '');

export function initLiveTv(opts: { muted: boolean; data: () => TvData }) {
  const $ = (id: string) => document.getElementById(id)!;
  let cfg: LiveCfg | null = null;
  let raw: Raw = {};
  let mode: 'normal' | 'raffle' | 'winner' = 'normal';
  let cur: SceneKey | '' = '';
  let timer: ReturnType<typeof setTimeout> | undefined; // next scene
  let inner: ReturnType<typeof setInterval> | undefined; // rotation inside a scene
  let order: Scene[] = [];
  let idx = 0;
  let plan = '';

  // the draw state is checked every 2 s; only a real change of view restarts the program
  document.addEventListener('ls-mode', (e) => { const m = (e as CustomEvent).detail; if (m === mode) return; mode = m; plan = ''; schedule(); });

  const umrah = () => parseWinners({ winners: raw._winners }).filter((w) => w.prize === 'umrah').sort((a, b) => (b.date ?? '').localeCompare(a.date ?? ''));
  const today = () => parseToday({ today_winner: raw._today });
  const promos = () => (cfg?.promos ?? []).filter((p) => p.on && (p.title.trim() || p.text.trim()));
  const vids = () => (cfg?.videos ?? []).filter((v) => v.on && ytId(v.url));
  const ok = (k: SceneKey) => (k === 'video' ? vids().length > 0 : k === 'promo' ? promos().length > 0 : k === 'winners' ? umrah().length > 0 : k === 'lastwin' ? !!today() : true);
  const scenes = () => { const s = (cfg?.tv.scenes ?? []).filter((x) => x.on && ok(x.key)); return s.length ? s : [{ key: 'home' as SceneKey, on: true, secs: 60 }]; };

  // ------------------------------------------------------------ program
  function schedule() {
    if (!cfg) return;
    if (mode !== 'normal') { clearTimeout(timer); plan = 'off'; show('home'); return; } // a draw / winner view is on screen
    const key = JSON.stringify([cfg.tv, promos().length, vids().length, umrah().length, !!today()]);
    if (key === plan) return;
    plan = key;
    clearTimeout(timer);
    if (!cfg.tv.auto) { show(ok(cfg.tv.pin) ? cfg.tv.pin : 'home'); return; }
    order = scenes();
    const at = order.findIndex((s) => s.key === cur);
    run(at >= 0 ? at : 0, at >= 0);
  }
  function run(i: number, keep = false) {
    if (!order.length) return;
    idx = ((i % order.length) + order.length) % order.length;
    const s = order[idx];
    if (!keep || s.key !== cur) show(s.key);
    if (s.key === 'video') return; // the video scene moves on when the videos end
    timer = setTimeout(next, Math.max(5, s.secs || 20) * 1000);
  }
  function next() {
    clearTimeout(timer);
    if (!cfg?.tv.auto || mode !== 'normal') return;
    order = scenes();
    run(idx + 1);
  }

  // ------------------------------------------------------------ scenes
  function show(k: SceneKey) {
    if (k === cur) return;
    cur = k;
    clearInterval(inner);
    stopVideo();
    const host = $('ls-scene');
    host.querySelectorAll('.tv-scene').forEach((el) => { el.classList.add('tv-out'); setTimeout(() => el.remove(), 750); });
    // promo: the screen shrinks to the top right, the ads fill the "L"
    document.body.classList.toggle('ls-squeeze', k === 'promo');
    if (k === 'promo') startPromos(); else stopPromos();
    if (k === 'home' || k === 'promo') return;
    const el = document.createElement('div');
    el.className = `tv-scene tv-in-${cfg?.tv.fx ?? 'fade'}`;
    host.append(el);
    if (k === 'stats') { stats(el); inner = setInterval(() => stats(el), 10_000); }
    if (k === 'winners') winners(el);
    if (k === 'lastwin') lastWin(el);
    if (k === 'join') join(el);
    if (k === 'video') video(el);
  }

  function stats(el: HTMLElement) {
    const { screen: d, ins } = opts.data();
    const css = getComputedStyle($('ls-stage'));
    const tile = (icon: Parameters<typeof lucide>[0], label: string, v: number, sub: string, hero = false) =>
      `<div class="tv-tile ${hero ? 'tv-tile-hero' : ''}"><div class="tv-tile-l">${lucide(icon, 'h-7 w-7')}${label}</div><div class="tv-tile-v ls-num">${bn(v)}</div><div class="tv-tile-s">${sub}</div></div>`;
    el.innerHTML = `<div class="tv-head"><span class="tv-head-ico">${lucide('activity', 'h-8 w-8', 2.2)}</span>লাইভ পরিসংখ্যান<span class="tv-head-r"><span class="ls-live tv-dot"></span>এই মুহূর্তে</span></div>
      <div class="tv-tiles">
        ${tile('activity', 'এখন অ্যাক্টিভ', Math.max(1, d?.active_now ?? 0), `আজ সর্বোচ্চ একসাথে ${bn(d?.peak_today ?? 0)} জন`, true)}
        ${tile('users', 'আজ ভিজিটর', d?.visitors_today ?? 0, `নতুন ${bn(d?.new_today ?? 0)} জন`)}
        ${tile('copy', 'আজ কোড কপি', d?.copies_today ?? 0, `গত ১ ঘণ্টায় ${bn(d?.copies_hour ?? 0)}`)}
        ${tile('inbox', 'তালিকায় কোড', d?.codes_active ?? 0, `মোট কপি ${bn(d?.copies_total ?? 0)}`)}
      </div>
      <div class="tv-chart"><div class="tv-chart-h">অ্যাক্টিভ ইউজার · গত ২ ঘণ্টা · প্রতি মিনিটে</div><div class="tv-chart-b">${lineSvg(ins?.active.values ?? [], css.getPropertyValue('--line').trim() || '#7ee2b8')}</div></div>`;
  }

  function winners(el: HTMLElement) {
    const list = umrah();
    let i = 0;
    el.innerHTML = `<div class="tv-head"><span class="tv-head-ico">${lucide('trophy', 'h-8 w-8', 2.2)}</span>বাংলাদেশি উমরাহ বিজয়ী<span class="tv-head-r">মোট <b class="ls-accent">${bn(list.length)}</b> জন</span></div>
      <div class="tv-win" id="tv-win"></div><div class="tv-dots" id="tv-wdots"></div>`;
    const one = () => {
      const w = list[i % list.length];
      $('tv-win').innerHTML = `<div class="tv-win-card tv-pop">
          <div class="tv-win-flag">${BD_FLAG}</div>
          <div class="tv-win-badge">🕋 দুইজনের উমরাহ সফর</div>
          <div class="tv-win-name" dir="auto">${esc(w.name)}</div>
          <div class="tv-win-date">${esc(dateBn(w.date))}</div>
        </div>`;
      $('tv-wdots').innerHTML = list.map((_, j) => `<i class="${j === i % list.length ? 'on' : ''}"></i>`).join('');
      i++;
    };
    one();
    const per = Math.max(4, Math.min(8, Math.floor((scene('winners')?.secs || 30) / Math.max(1, list.length))));
    if (list.length > 1) inner = setInterval(one, per * 1000);
  }

  function lastWin(el: HTMLElement) {
    const w = today();
    if (!w) return;
    el.innerHTML = `<div class="tv-head"><span class="tv-head-ico">${lucide('partyPopper', 'h-8 w-8', 2.2)}</span>নুসুক উমরাহ প্রতিযোগিতা<span class="tv-head-r">${esc(dateBn(w.date))}</span></div>
      <div class="tv-last tv-pop">
        <img src="${flagUrl(w.country, 160)}" alt="" class="tv-last-flag" />
        <div class="min-w-0">
          <span class="lw-today-badge">🎉 ${esc(winnerDayLabel(w.date))}</span>
          <div class="tv-last-name" dir="auto">${esc(w.name)}</div>
          <div class="tv-last-meta"><span class="ls-chip">${esc(countryName(w.country, 'bn'))}</span><span class="tv-last-prize">${esc(prizeLong[w.prize] ?? '')}</span></div>
        </div>
      </div>`;
  }

  function join(el: HTMLElement) {
    const j = cfg!.join;
    const links = j.links.filter((l) => l.url.trim() || l.label.trim());
    el.innerHTML = `<div class="tv-join tv-pop">
        <div class="tv-join-qr">${qrSvg(SITE)}</div>
        <div class="min-w-0">
          <div class="tv-join-scan">${lucide('smartphone', 'h-8 w-8', 2.2)} ক্যামেরায় স্ক্যান করুন</div>
          <div class="tv-join-title">${esc(j.title)}</div>
          ${j.text.trim() ? `<p class="tv-join-text">${esc(j.text)}</p>` : ''}
          <ul class="tv-join-links">${links.map((l) => `<li><b>${esc(l.label)}</b><span>${esc(l.url)}</span></li>`).join('')}</ul>
        </div>
      </div>`;
  }

  // ------------------------------------------------------------ promo "L"
  let promoI = 0;
  function startPromos() {
    const list = promos();
    if (!list.length) return;
    promoI = 0;
    const one = () => { promo(list[promoI % list.length]); promoI++; };
    one();
    const per = Math.max(8, Math.floor((scene('promo')?.secs || 30) / list.length));
    if (list.length > 1) inner = setInterval(one, per * 1000);
  }
  function stopPromos() { $('tv-pl').innerHTML = ''; $('tv-pb').innerHTML = ''; }
  function promo(p: Promo) {
    $('tv-pl').innerHTML = `<div class="tv-pl-in tv-pop">
        ${p.tag.trim() ? `<span class="tv-pl-tag">${esc(p.tag)}</span>` : ''}
        <div class="tv-pl-title">${esc(p.title)}</div>
        ${p.image ? `<img class="tv-pl-img" src="${esc(p.image)}" alt="" />` : ''}
        ${p.text.trim() ? `<p class="tv-pl-text">${esc(p.text)}</p>` : ''}
      </div>`;
    const pts = p.points.map((x) => x.trim()).filter(Boolean);
    $('tv-pb').innerHTML = `<div class="tv-pb-in tv-pop">
        <div class="tv-pb-pts">${pts.map((x) => `<span>${lucide('circleCheck', 'h-6 w-6', 2.4)}${esc(x)}</span>`).join('')}</div>
        <div class="tv-pb-site">${lucide('smartphone', 'h-7 w-7', 2.2)}muhammadfazal.com/nusuk</div>
      </div>`;
  }

  // ------------------------------------------------------------ videos (YouTube IFrame API)
  let yt: YTPlayer | null = null;
  let ytReady: Promise<YTNs> | null = null;
  const w = window as unknown as { YT?: YTNs; onYouTubeIframeAPIReady?: () => void };
  function loadYT() {
    if (!ytReady) ytReady = new Promise((res) => {
      if (w.YT?.Player) return res(w.YT);
      w.onYouTubeIframeAPIReady = () => res(w.YT!);
      const s = document.createElement('script');
      s.src = 'https://www.youtube.com/iframe_api';
      document.head.append(s);
    });
    return ytReady;
  }
  async function video(el: HTMLElement) {
    const list = vids();
    el.innerHTML = `<div class="tv-head"><span class="tv-head-ico">${lucide('play', 'h-8 w-8', 2.2)}</span><span id="tv-vt" class="min-w-0 truncate"></span><span id="tv-vn" class="tv-head-r"></span></div><div class="tv-video"><div id="tv-yt"></div></div>`;
    const YT = await loadYT();
    if (cur !== 'video') return;
    duck(true);
    let i = 0;
    const done = () => { if (cfg?.tv.auto) next(); else { i = 0; play(); } }; // picked by hand: play the list again
    const play = () => {
      const v = list[i];
      $('tv-vt').textContent = v.title || 'ভিডিও';
      $('tv-vn').textContent = list.length > 1 ? `${bn(i + 1)}/${bn(list.length)}` : '';
      if (yt) { yt.loadVideoById(ytId(v.url)); return; }
      yt = new YT.Player('tv-yt', {
        videoId: ytId(v.url), width: '100%', height: '100%',
        playerVars: { autoplay: 1, controls: 0, rel: 0, modestbranding: 1, playsinline: 1, iv_load_policy: 3, mute: opts.muted ? 1 : 0 },
        events: {
          onReady: (e: { target: YTPlayer }) => { if (opts.muted) e.target.mute(); e.target.playVideo(); },
          onStateChange: (e: { data: number }) => { if (e.data === 0) { i++; if (i < list.length) play(); else done(); } },
          onError: () => { i++; if (i < list.length) play(); else done(); },
        },
      });
    };
    play();
  }
  function stopVideo() {
    if (yt) { try { yt.destroy(); } catch { /* gone */ } yt = null; }
    duck(false);
  }

  // ------------------------------------------------------------ background music
  const audio = new Audio();
  audio.muted = opts.muted;
  audio.preload = 'auto';
  let tracks: string[] = [];
  let tracksKey = '';
  let ti = 0;
  let ducked = false;
  audio.addEventListener('ended', () => { ti = (ti + 1) % Math.max(1, tracks.length); playTrack(); });
  audio.addEventListener('error', () => { if (tracks.length > 1) { ti = (ti + 1) % tracks.length; setTimeout(playTrack, 1500); } });
  function playTrack() {
    if (!tracks.length) return;
    audio.src = tracks[ti % tracks.length];
    if (!ducked) audio.play().catch(() => { /* autoplay blocked outside OBS: starts after a click */ });
  }
  function music(c: LiveCfg) {
    const list = c.music.tracks.filter((t) => t.on && /^https?:\/\//.test(t.url.trim())).map((t) => t.url.trim());
    audio.volume = c.music.volume / 100;
    if (!c.music.on || !list.length) { audio.pause(); tracksKey = ''; tracks = []; return; }
    const k = list.join('|');
    if (k !== tracksKey) { tracksKey = k; tracks = list; ti = 0; playTrack(); }
    else if (audio.paused && !ducked) audio.play().catch(() => {});
  }
  function duck(on: boolean) {
    ducked = on;
    if (on) audio.pause();
    else if (tracks.length && cfg?.music.on) audio.play().catch(() => {});
  }
  // a click anywhere starts the music when the browser blocked autoplay (normal browsers; OBS plays by itself)
  addEventListener('pointerdown', () => { if (tracks.length && audio.paused && !ducked) audio.play().catch(() => {}); });

  // ------------------------------------------------------------ notice over the blurred screen
  let ntShown = '';
  function notice(c: LiveCfg) {
    const n = c.notices.find((x) => x.id === c.notice_show);
    const key = n ? JSON.stringify(n) : '';
    if (key === ntShown) return;
    const was = !!ntShown;
    ntShown = key;
    const box = $('ls-nt');
    if (!n) { box.classList.remove('tvn-in'); box.classList.add('tvn-out'); return; }
    $('ls-nt-tag').textContent = n.tag;
    $('ls-nt-tag').toggleAttribute('data-hidden', !n.tag.trim());
    $('ls-nt-title').textContent = n.title;
    $('ls-nt-text').textContent = n.text;
    $('ls-nt-text').toggleAttribute('data-hidden', !n.text.trim());
    box.removeAttribute('data-hidden');
    if (!was) { box.classList.remove('tvn-out', 'tvn-in'); void box.offsetWidth; box.classList.add('tvn-in'); }
  }

  const scene = (k: SceneKey) => cfg?.tv.scenes.find((s) => s.key === k);

  return {
    apply(c: LiveCfg, r: unknown) {
      cfg = c;
      raw = (r && typeof r === 'object' ? r : {}) as Raw;
      schedule();
      music(c);
      notice(c);
    },
  };
}
