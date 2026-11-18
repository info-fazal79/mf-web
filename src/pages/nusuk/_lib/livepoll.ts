/**
 * /nusuk/live · live voting card (Nusuk Manager → Live screen → Voting, update_53).
 * While a poll is on screen: the question, every option with its share of the votes (bars move as
 * votes come in), the total, and a QR code to muhammadfazal.com/nusuk/vote.
 * The counts are one small row in the database, read every 3 seconds only while a poll is shown.
 */
import qrcode from 'qrcode-generator';
import { rpc } from './rpc';
import { VOTE_URL, type LiveCfg, type Poll } from './livecfg';

type Results = { poll: string; counts: (number | null)[]; total: number };
const MARKS = ['ক', 'খ', 'গ', 'ঘ', 'ঙ', 'চ'];
const bn = (n: number) => Math.round(n).toLocaleString('bn-BD');
const esc = (t: string) => t.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

function qrSvg(text: string) {
  const qr = qrcode(0, 'M');
  qr.addData(text);
  qr.make();
  const n = qr.getModuleCount();
  let d = '';
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (qr.isDark(r, c)) d += `M${c} ${r}h1v1h-1z`;
  return `<svg viewBox="-2 -2 ${n + 4} ${n + 4}" aria-hidden="true"><rect x="-2" y="-2" width="${n + 4}" height="${n + 4}" fill="#fff"/><path d="${d}" fill="#053d2d"/></svg>`;
}

export function initLivePoll() {
  const box = document.getElementById('ls-poll');
  if (!box) return { apply() {} };
  const $ = (id: string) => document.getElementById(id)!;
  $('ls-poll-qr').innerHTML = qrSvg(VOTE_URL);
  let shown: Poll | null = null;
  let key = '';
  let timer: ReturnType<typeof setInterval> | undefined;
  let last = { total: -1, counts: '' };

  function draw(r: Results | null) {
    if (!shown) return;
    const counts = shown.options.map((_, i) => Number(r?.counts?.[i] ?? 0));
    const total = Math.max(0, r?.total ?? 0);
    const sig = counts.join(',');
    if (sig === last.counts && total === last.total) return; // nothing new: leave the screen alone
    const grew = total > last.total && last.total >= 0;
    last = { total, counts: sig };
    const top = Math.max(...counts);
    const rows = $('ls-poll-rows');
    shown.options.forEach((o, i) => {
      let row = rows.children[i] as HTMLElement | undefined;
      if (!row) {
        row = document.createElement('div');
        row.className = 'lpl-row';
        row.innerHTML = `<div class="lpl-head"><span class="lpl-mark">${MARKS[i]}</span><span class="lpl-opt">${esc(o)}</span><b class="lpl-pct"></b></div><div class="lpl-bar"><i></i></div><div class="lpl-n"></div>`;
        rows.appendChild(row);
      }
      const pct = total ? (counts[i] / total) * 100 : 0;
      (row.querySelector('.lpl-bar i') as HTMLElement).style.width = `${pct}%`;
      row.querySelector('.lpl-pct')!.textContent = `${bn(pct)}%`;
      row.querySelector('.lpl-n')!.textContent = `${bn(counts[i])} ভোট`;
      row.classList.toggle('lpl-top', counts[i] === top && top > 0);
    });
    $('ls-poll-total').textContent = bn(total);
    if (grew) { const t = $('ls-poll-total'); t.classList.remove('lpl-bump'); void t.offsetWidth; t.classList.add('lpl-bump'); }
  }
  async function fetchResults() {
    if (!shown) return;
    try { draw(await rpc<Results>('nusuk_lv_results', { p_poll: shown.id })); } catch { /* next time */ }
  }

  return {
    apply(c: LiveCfg) {
      const p = c.polls.find((x) => x.id === c.poll_show && x.q.trim() && x.options.filter((o) => o.trim()).length >= 2) ?? null;
      const k = p ? JSON.stringify(p) : '';
      if (k === key) return;
      const was = !!key;
      key = k;
      clearInterval(timer);
      if (!p) { shown = null; box.classList.remove('lpl-in'); box.classList.add('lpl-out'); return; }
      shown = { ...p, options: p.options.filter((o) => o.trim()) };
      last = { total: -1, counts: '' };
      $('ls-poll-q').textContent = shown.q;
      box.classList.toggle('lpl-many', shown.options.length > 4);
      $('ls-poll-rows').innerHTML = '';
      draw(null);
      fetchResults();
      timer = setInterval(fetchResults, 3000);
      box.removeAttribute('data-hidden');
      if (!was) { box.classList.remove('lpl-out', 'lpl-in'); void box.offsetWidth; box.classList.add('lpl-in'); }
    },
  };
}
