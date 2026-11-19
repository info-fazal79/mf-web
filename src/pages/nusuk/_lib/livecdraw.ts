/**
 * /nusuk/live · the comment draw on the live screen (Nusuk Manager → Live screen → Live comments →
 * "Draw on the live screen").
 *   'count' → title, prize, who is in it, how many, and a big countdown (counted from when this
 *             screen got it, so the clocks of the two computers never matter)
 *   'win'   → the codes roll for a few seconds and stop on the winner, with confetti
 *   'off'   → hidden
 * Nusuk Manager picks the winner (from every comment, at the end of the countdown); this screen only shows it.
 */
import type { CDrawLive, LiveCfg } from './livecfg';

const bn = (n: number) => Math.max(0, Math.round(n)).toLocaleString('bn-BD');
const bnDigits = (s: string) => s.replace(/\d/g, (d) => '০১২৩৪৫৬৭৮৯'[Number(d)]);
const ROLL_MS = 4500;

export function initLiveCDraw() {
  const el0 = document.getElementById('ls-cd');
  if (!el0) return { apply() {} };
  const box: HTMLElement = el0;
  const $ = (id: string) => document.getElementById(id)!;
  let id = '';
  let phase: CDrawLive['phase'] = 'off';
  let endAt = 0;
  let tick: ReturnType<typeof setInterval> | undefined;
  let roll: ReturnType<typeof setTimeout> | undefined;
  let rolling = false;
  let pool: string[] = [];
  let pending: CDrawLive | null = null;
  let pendingAt = 0;

  const clock = (ms: number) => {
    const s = Math.max(0, Math.ceil(ms / 1000));
    return s >= 60 ? bnDigits(`${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`) : bn(s);
  };
  const randCode = () => (pool.length ? pool[Math.floor(Math.random() * pool.length)] : '••••••');

  function stopAll() { clearInterval(tick); clearTimeout(roll); rolling = false; tick = undefined; }
  function setMode(m: 'count' | 'roll' | 'win') { box.dataset.mode = m; }

  function show(l: CDrawLive) {
    $('ls-cd-title').textContent = l.title || '🎁 কমেন্ট ড্র';
    $('ls-cd-prize').textContent = l.prize;
    $('ls-cd-rule').textContent = l.rule;
    $('ls-cd-count').textContent = bn(l.count);
    pool = l.pool.length ? l.pool : pool;
    if (box.hasAttribute('data-hidden')) {
      box.removeAttribute('data-hidden');
      box.classList.remove('lcd-out', 'lcd-in'); void box.offsetWidth; box.classList.add('lcd-in');
    }
  }
  /** codes flying past; once the winner is known they slow down for ROLL_MS and stop on it */
  function startRoll() {
    if (rolling) return;
    rolling = true;
    setMode('roll');
    const step = () => {
      const el = $('ls-cd-code');
      el.textContent = randCode();
      el.classList.remove('lcd-flick'); void el.offsetWidth; el.classList.add('lcd-flick');
      const since = pending ? Date.now() - pendingAt : 0;
      if (pending && since >= ROLL_MS) { rolling = false; return reveal(pending); }
      const slow = since / ROLL_MS;
      roll = setTimeout(step, 55 + slow * slow * 380);
    };
    step();
  }
  function reveal(l: CDrawLive) {
    pending = null;
    if (!l.winner) return;
    setMode('win');
    $('ls-cd-code').textContent = l.winner.code;
    $('ls-cd-name').textContent = l.winner.name && l.winner.name !== 'Facebook user' ? l.winner.name : '';
    confetti();
  }
  function confetti() {
    const c = $('ls-cd-conf');
    c.innerHTML = '';
    const colors = ['#f2c94c', '#2bb38a', '#ffffff', '#e0b93a', '#4fe3d0', '#f59e0b', '#10b981'];
    for (let i = 0; i < 150; i++) {
      const s = document.createElement('span');
      s.className = 'lcd-bit';
      s.style.left = `${Math.random() * 100}%`;
      s.style.background = colors[i % colors.length];
      s.style.animationDelay = `${Math.random() * 1.6}s`;
      s.style.animationDuration = `${3.5 + Math.random() * 3}s`;
      s.style.width = `${8 + Math.random() * 10}px`;
      s.style.height = `${12 + Math.random() * 14}px`;
      c.append(s);
    }
  }

  return {
    apply(c: LiveCfg) {
      const l = c.cdraw.live;
      if (l.phase === 'off' || !l.id) {
        if (phase === 'off') return;
        phase = 'off'; id = ''; pending = null;
        stopAll();
        box.classList.remove('lcd-in'); box.classList.add('lcd-out');
        setTimeout(() => { if (phase === 'off') { box.setAttribute('data-hidden', ''); $('ls-cd-conf').innerHTML = ''; } }, 600);
        return;
      }
      if (l.id === id && l.phase === phase) { // same draw: only the text may have changed
        $('ls-cd-count').textContent = bn(l.count);
        return;
      }
      const fresh = l.id !== id;
      id = l.id;
      phase = l.phase;
      show(l);
      if (l.phase === 'count') {
        stopAll();
        pending = null;
        $('ls-cd-name').textContent = '';
        setMode('count');
        endAt = Date.now() + l.secs * 1000;
        const t = () => {
          const left = endAt - Date.now();
          $('ls-cd-clock').textContent = clock(left);
          if (left <= 0) { clearInterval(tick); startRoll(); } // waiting for Nusuk Manager's pick
        };
        t();
        tick = setInterval(t, 250);
      } else {
        // the winner is known
        clearInterval(tick);
        pending = l;
        pendingAt = Date.now() - (fresh ? 1500 : 0); // a screen opened just now: a shorter roll
        startRoll();
      }
    },
  };
}
