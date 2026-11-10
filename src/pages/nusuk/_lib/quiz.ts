/**
 * Daily quiz on /nusuk (database: update_23_quiz.sql, admin: Nusuk Manager → Quiz).
 * The section shows the top 5 and a "কুইজ খেলুন" button; the dialog handles
 * making an ID, signing in, today's questions with countdowns, and the full leaderboard.
 */
import { rpc } from './rpc';
import { CODE_RE, countdownText } from './content';

type Row = { rank: number; prev: number | null; id: number; name: string; points: number; correct: number };
type Pub = { enabled: boolean; title?: string; per_day?: number; points?: number; now?: string; opens?: string[]; closes?: string; players?: number; board?: Row[] };
type Slot = { slot: number; opens: string; status: 'locked' | 'open' | 'answered' | 'missed'; question?: string; options?: string[]; choice?: number; correct?: number; right?: boolean; points?: number; explanation?: string };
type State = {
  ok: boolean; reason?: string; now: string; id: number; name: string; code: string; points_each: number; closes: string; tomorrow: string;
  slots: Slot[]; today_points: number; total: number; rank: number | null; prev_rank: number | null; players: number; streak: number;
};
type Me = { id: number; token: string; name: string };

const KEY = 'nusuk:quiz:v1';
const bn = (n: number | string) => String(n).replace(/\d/g, (x) => '০১২৩৪৫৬৭৮৯'[+x]);
const bnNum = (n: number) => n.toLocaleString('bn-BD');
const esc = (t = '') => t.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
const time = (iso: string) => new Date(iso).toLocaleTimeString('bn-BD', { timeZone: 'Asia/Dhaka', hour: 'numeric', minute: '2-digit' });
const LETTERS = ['ক', 'খ', 'গ', 'ঘ', 'ঙ', 'চ'];

function readMe(): Me | null {
  try { const m = JSON.parse(localStorage.getItem(KEY) ?? 'null'); return m && m.id && m.token ? m : null; } catch { return null; }
}
function saveMe(m: Me | null) {
  try { m ? localStorage.setItem(KEY, JSON.stringify(m)) : localStorage.removeItem(KEY); } catch {}
}

/** ▲2 / ▼1 / নতুন / – */
function move(rank: number, prev: number | null) {
  if (prev === null || prev === undefined) return '<span class="nk-qz-mv nk-qz-new" title="নতুন">নতুন</span>';
  const d = prev - rank;
  if (d > 0) return `<span class="nk-qz-mv nk-qz-up" title="${bn(d)} ধাপ উপরে">▲${bn(d)}</span>`;
  if (d < 0) return `<span class="nk-qz-mv nk-qz-down" title="${bn(-d)} ধাপ নিচে">▼${bn(-d)}</span>`;
  return '<span class="nk-qz-mv nk-qz-same" title="অপরিবর্তিত">–</span>';
}
const medal = (r: number) => (r === 1 ? '🥇' : r === 2 ? '🥈' : r === 3 ? '🥉' : bn(r));
function boardRows(rows: Row[], meId?: number) {
  return rows
    .map((r) => `<li class="nk-qz-row ${r.id === meId ? 'nk-qz-me' : ''}">
      <span class="nk-qz-rank">${medal(r.rank)}</span>
      <span class="min-w-0 flex-1"><b class="block truncate">${esc(r.name)}</b><span class="text-xs text-emerald-900/60">আইডি ${r.id} · ${bn(r.correct)}টি সঠিক</span></span>
      ${move(r.rank, r.prev)}
      <b class="nk-qz-pts">${bnNum(r.points)}</b>
    </li>`)
    .join('');
}

export function initQuiz() {
  const sec = document.getElementById('nk-quiz');
  const dlg = document.getElementById('nk-qz') as HTMLDialogElement | null;
  const body = document.getElementById('nk-qz-body');
  if (!sec || !dlg || !body) return;
  const $ = (id: string) => document.getElementById(id)!;
  let pub: Pub | null = null;
  let state: State | null = null;
  let tick: ReturnType<typeof setInterval> | undefined;
  let skew = 0; // server time − this device's time

  // ---------- Section on the page ----------
  async function loadPublic() {
    try { pub = await rpc<Pub>('nusuk_quiz_public', { p_limit: 5 }); } catch { pub = null; }
    if (!pub?.enabled) { sec!.classList.add('hidden'); return; }
    if (pub.now) skew = Date.parse(pub.now) - Date.now();
    sec!.classList.remove('hidden');
    $('nk-quiz-title').textContent = pub.title ?? 'দৈনিক ইসলামিক কুইজ';
    $('nk-quiz-sub').textContent = `প্রতিদিন ${bn(pub.per_day ?? 5)}টি প্রশ্ন · প্রতিটি সঠিক উত্তরে ${bn(pub.points ?? 10)} পয়েন্ট${pub.players ? ` · ${bnNum(pub.players)} জন খেলছেন` : ''}`;
    const times = (pub.opens ?? []).map((t) => `<span class="nk-qz-chip">${time(t)}</span>`).join('');
    $('nk-quiz-times').innerHTML = times ? `<span class="text-xs text-emerald-50/80">আজকের প্রশ্ন খুলবে:</span>${times}` : '';
    const rows = pub.board ?? [];
    $('nk-quiz-top').innerHTML = rows.length
      ? boardRows(rows, readMe()?.id)
      : '<li class="rounded-xl bg-emerald-50 p-4 text-center text-sm text-emerald-900/70">এখনো কেউ পয়েন্ট পায়নি। প্রথম হোন আপনিই!</li>';
    const me = readMe();
    $('nk-quiz-me').textContent = me ? `আইডি ${me.id} (${me.name}) হিসেবে খেলছেন` : '';
    $('nk-quiz-play-label').textContent = me ? 'কুইজ চালিয়ে যান' : 'কুইজ খেলুন';
  }

  // ---------- Dialog views ----------
  function open() { if (!dlg!.open) dlg!.showModal(); }
  function show(html: string) { clearInterval(tick); body!.innerHTML = html; }
  const head = (title: string, sub = '') => `<div class="pr-9"><h2 class="text-lg font-bold text-emerald-950">${title}</h2>${sub ? `<p class="mt-0.5 text-sm text-emerald-900/70">${sub}</p>` : ''}</div>`;
  const msg = (t: string, ok = false) => `<p class="rounded-xl px-3.5 py-2.5 text-sm ${ok ? 'bg-emerald-100 text-emerald-900' : 'bg-red-50 text-red-800'}">${t}</p>`;

  function welcome() {
    show(`${head('🎯 ' + esc(pub?.title ?? 'দৈনিক ইসলামিক কুইজ'), 'খেলতে একটি কুইজ আইডি লাগবে।')}
      <div class="grid gap-2.5">
        <button type="button" data-go="register" class="nk-btn nk-green py-3.5 text-base">🆕 নতুন? আইডি তৈরি করুন</button>
        <button type="button" data-go="login" class="nk-btn nk-ghost py-3 text-base">🔑 আমার আইডি আছে</button>
      </div>
      <ul class="grid gap-1.5 rounded-xl bg-cream p-3.5 text-sm text-emerald-950/85">
        <li>• প্রতিদিন ${bn(pub?.per_day ?? 5)}টি প্রশ্ন, সকাল থেকে রাত পর্যন্ত একটি একটি করে খোলে।</li>
        <li>• প্রতিটি সঠিক উত্তরে ${bn(pub?.points ?? 10)} পয়েন্ট। লিডারবোর্ডে নিজের অবস্থান দেখুন।</li>
        <li>• একটি প্রশ্নের উত্তর একবারই দেওয়া যায়।</li>
      </ul>`);
  }

  function register(note = '') {
    show(`${head('নতুন কুইজ আইডি', 'আপনার নাম ও নুসুক রেফারেল কোড দিন।')}
      <form id="nk-qz-reg" class="grid gap-3" novalidate>
        <label class="grid gap-1 text-sm font-semibold">আপনার নাম *<input name="name" maxlength="60" autocomplete="name" class="nk-input font-normal" placeholder="লিডারবোর্ডে এই নাম দেখাবে" /></label>
        <label class="grid gap-1 text-sm font-semibold">নুসুক রেফারেল কোড *<input name="code" maxlength="40" autocomplete="off" autocapitalize="off" spellcheck="false" class="nk-input font-mono font-normal tracking-wider" placeholder="NG-xxxxxxxx" /></label>
        <p class="text-xs text-emerald-900/65">কোডটি আগে থেকেই এই সাইটে জমা থাকতে হবে। একটি কোডে একটিই আইডি।</p>
        <div id="nk-qz-msg">${note}</div>
        <button type="submit" class="nk-btn nk-green py-3 text-base">আইডি তৈরি করুন</button>
        <button type="button" data-go="welcome" class="text-sm font-semibold text-emerald-900/60 underline underline-offset-2">‹ ফিরে যান</button>
      </form>`);
    ($('nk-qz-reg') as HTMLFormElement).addEventListener('submit', async (e) => {
      e.preventDefault();
      const f = new FormData(e.target as HTMLFormElement);
      const name = String(f.get('name') ?? '').trim();
      const code = String(f.get('code') ?? '').replace(/\s/g, '');
      const say = (t: string, ok = false) => ($('nk-qz-msg').innerHTML = msg(t, ok));
      if (!name) return say('আপনার নাম লিখুন।');
      if (!CODE_RE.test(code)) return say('কোডটি সঠিক নয়। নুসুকের কোড NG- দিয়ে শুরু হয়, তারপর ৮টি অক্ষর। যেমন: NG-y3JkB7lU');
      const btn = (e.target as HTMLFormElement).querySelector<HTMLButtonElement>('button[type=submit]')!;
      btn.disabled = true;
      try {
        const r = await rpc<{ ok: boolean; reason?: string; id?: number; name?: string; token?: string; existing?: boolean }>('nusuk_quiz_register', { p_name: name, p_code: code });
        if (r.ok && r.id && r.token) {
          saveMe({ id: r.id, token: r.token, name: r.name ?? name });
          created(r.id, r.name ?? name, code, !!r.existing);
          loadPublic();
          return;
        }
        if (r.reason === 'not_found') {
          $('nk-qz-msg').innerHTML = `${msg('⚠️ এই কোডটি আমাদের তালিকায় নেই। কুইজ খেলতে আগে কোডটি এই পেজে জমা দিন, তারপর আবার আসুন।')}
            <a href="#submit" data-close class="nk-btn nk-gold mt-2 w-full py-2.5 text-sm">কোড জমা দিতে যান ›</a>`;
        } else say(r.reason === 'rejected' ? 'এই কোডটি অনুমোদন পায়নি, তাই এটি দিয়ে কুইজে অংশ নেওয়া যাবে না।' : r.reason === 'closed' ? 'কুইজ এখন বন্ধ আছে।' : 'আইডি তৈরি করা যায়নি। তথ্যগুলো দেখে আবার চেষ্টা করুন।');
      } catch (err) {
        console.error(err);
        say('তৈরি করা যায়নি। ইন্টারনেট সংযোগ দেখে আবার চেষ্টা করুন।');
      }
      btn.disabled = false;
    });
  }

  function created(id: number, name: string, code: string, existing: boolean) {
    show(`${head(existing ? 'এই কোডে আগেই আইডি আছে' : 'আলহামদুলিল্লাহ, আইডি তৈরি হয়েছে!', esc(name))}
      <div class="rounded-2xl border-2 border-dashed border-gold-500 bg-gold-100/50 p-4 text-center">
        <div class="text-xs font-semibold text-gold-600">আপনার কুইজ আইডি</div>
        <div class="mt-1 font-mono text-5xl font-bold tracking-wider text-emerald-950">${id}</div>
        <div class="mt-1 text-xs text-emerald-900/70">কোড: <span class="font-mono">${esc(code)}</span></div>
        <button type="button" id="nk-qz-copyid" class="nk-btn nk-ghost mt-3 px-4 py-2 text-sm">আইডি কপি করুন</button>
      </div>
      ${msg('📌 এই আইডিটি মনে রাখুন বা লিখে রাখুন। অন্য ফোনে খেলতে আইডি আর আপনার নুসুক কোডের শেষ ৪টি অক্ষর লাগবে। এই ফোনে আর কিছু লাগবে না।', true)}
      <button type="button" data-go="play" class="nk-btn nk-green py-3.5 text-base">কুইজ শুরু করুন ›</button>`);
    $('nk-qz-copyid').addEventListener('click', async (e) => {
      try { await navigator.clipboard.writeText(String(id)); (e.target as HTMLElement).textContent = '✓ কপি হয়েছে'; } catch {}
    });
  }

  function login(note = '') {
    show(`${head('আইডি দিয়ে প্রবেশ', 'আপনার কুইজ আইডি আর নুসুক কোডের শেষ ৪টি অক্ষর দিন।')}
      <form id="nk-qz-login" class="grid gap-3" novalidate>
        <label class="grid gap-1 text-sm font-semibold">কুইজ আইডি *<input name="id" inputmode="numeric" maxlength="7" autocomplete="off" class="nk-input font-mono text-lg font-normal tracking-widest" placeholder="যেমন: 1005" /></label>
        <label class="grid gap-1 text-sm font-semibold">নুসুক কোডের শেষ ৪টি অক্ষর *<input name="last4" maxlength="4" autocomplete="off" autocapitalize="off" spellcheck="false" class="nk-input font-mono text-lg font-normal tracking-widest" placeholder="যেমন: B7lU" /></label>
        <p class="text-xs text-emerald-900/65">লিডারবোর্ডে সবার আইডি দেখা যায়, তাই আপনার নিরাপত্তার জন্য কোডের শেষ অংশটি চাওয়া হচ্ছে।</p>
        <div id="nk-qz-msg">${note}</div>
        <button type="submit" class="nk-btn nk-green py-3 text-base">প্রবেশ করুন</button>
        <button type="button" data-go="register" class="text-sm font-semibold text-emerald-800 underline underline-offset-2">আইডি নেই? নতুন আইডি তৈরি করুন</button>
      </form>`);
    ($('nk-qz-login') as HTMLFormElement).addEventListener('submit', async (e) => {
      e.preventDefault();
      const f = new FormData(e.target as HTMLFormElement);
      const id = Number(String(f.get('id') ?? '').replace(/[০-৯]/g, (d) => String('০১২৩৪৫৬৭৮৯'.indexOf(d))).replace(/\D/g, ''));
      const last4 = String(f.get('last4') ?? '').trim();
      const say = (t: string) => ($('nk-qz-msg').innerHTML = msg(t));
      if (!id) return say('আপনার কুইজ আইডি লিখুন (যেমন 1005)।');
      if (last4.length !== 4) return say('নুসুক কোডের শেষ ৪টি অক্ষর লিখুন।');
      const btn = (e.target as HTMLFormElement).querySelector<HTMLButtonElement>('button[type=submit]')!;
      btn.disabled = true;
      try {
        const r = await rpc<{ ok: boolean; reason?: string; id?: number; name?: string; token?: string }>('nusuk_quiz_login', { p_id: id, p_last4: last4 });
        if (r.ok && r.id && r.token) { saveMe({ id: r.id, token: r.token, name: r.name ?? '' }); loadPublic(); return play(); }
        if (r.reason === 'no_id') {
          $('nk-qz-msg').innerHTML = `${msg('এই আইডিটি পাওয়া যায়নি। আপনি নতুন হলে একটি আইডি তৈরি করে নিন।')}
            <button type="button" data-go="register" class="nk-btn nk-gold mt-2 w-full py-2.5 text-sm">নতুন আইডি তৈরি করুন ›</button>`;
        } else say('কোডের শেষ ৪টি অক্ষর মেলেনি। আবার দেখে লিখুন।');
      } catch (err) {
        console.error(err);
        say('প্রবেশ করা যায়নি। ইন্টারনেট সংযোগ দেখে আবার চেষ্টা করুন।');
      }
      btn.disabled = false;
    });
  }

  async function play() {
    const me = readMe();
    if (!me) return welcome();
    show(`${head('লোড হচ্ছে…')}`);
    try { state = await rpc<State>('nusuk_quiz_state', { p_token: me.token }); } catch { show(msg('লোড করা যায়নি। ইন্টারনেট সংযোগ দেখে আবার চেষ্টা করুন।')); return; }
    if (!state.ok) {
      if (state.reason === 'signed_out') { saveMe(null); return login(msg('এই ফোনে আবার প্রবেশ করতে হবে।')); }
      return show(msg('কুইজ এখন বন্ধ আছে।'));
    }
    skew = Date.parse(state.now) - Date.now();
    renderPlay();
  }

  const serverNow = () => Date.now() + skew;

  function renderPlay(justAnswered?: number) {
    const s = state!;
    const open = s.slots.find((x) => x.status === 'open');
    const next = s.slots.find((x) => x.status === 'locked');
    const allDone = s.slots.every((x) => x.status === 'answered' || x.status === 'missed');
    const dots = s.slots.map((x) => {
      const c = x.status === 'answered' ? (x.right ? 'nk-qz-dot-ok' : 'nk-qz-dot-no') : x.status === 'open' ? 'nk-qz-dot-open' : x.status === 'missed' ? 'nk-qz-dot-miss' : '';
      const t = x.status === 'answered' ? (x.right ? 'সঠিক' : 'ভুল') : x.status === 'open' ? 'এখন খোলা' : x.status === 'missed' ? 'সময় শেষ' : `খুলবে ${time(x.opens)}`;
      return `<span class="nk-qz-dot ${c}" title="প্রশ্ন ${bn(x.slot + 1)}: ${t}">${bn(x.slot + 1)}</span>`;
    }).join('');

    let main = '';
    const answered = justAnswered !== undefined ? s.slots.find((x) => x.slot === justAnswered) : undefined;
    if (answered && answered.status === 'answered') {
      main = resultCard(answered);
    } else if (open) {
      main = questionCard(open);
    } else if (next) {
      main = `<div class="rounded-2xl bg-emerald-50 p-5 text-center">
        <div class="text-sm text-emerald-900/75">পরের প্রশ্ন (${bn(next.slot + 1)} নম্বর) খুলবে</div>
        <div id="nk-qz-cd" class="mt-1 font-mono text-3xl font-bold tabular-nums text-emerald-900">…</div>
        <div class="mt-1 text-xs text-emerald-900/60">${time(next.opens)}-এ · তখন আবার এসে উত্তর দিন</div>
      </div>`;
    } else if (allDone) {
      main = `<div class="rounded-2xl bg-gold-100/70 p-5 text-center">
        <div class="text-2xl">🌙</div>
        <div class="mt-1 font-bold text-emerald-950">আজকের সব প্রশ্ন শেষ!</div>
        <div class="mt-1 text-sm text-emerald-900/75">আজ পেয়েছেন ${bnNum(s.today_points)} পয়েন্ট। আগামীকালের প্রথম প্রশ্ন খুলবে</div>
        <div id="nk-qz-cd" class="mt-1 font-mono text-2xl font-bold tabular-nums text-emerald-900">…</div>
      </div>`;
    }
    const target = !open && next ? next.opens : !open && allDone ? s.tomorrow : '';

    show(`<div class="flex items-start justify-between gap-3 pr-9">
        <div><div class="text-xs font-semibold text-emerald-900/60">আইডি ${s.id} · ${esc(s.code)}</div><h2 class="text-lg font-bold text-emerald-950">${esc(s.name)}</h2></div>
      </div>
      <div class="grid grid-cols-3 gap-2 text-center">
        <div class="rounded-xl bg-emerald-50 px-1 py-2"><div class="text-[11px] text-emerald-800">মোট পয়েন্ট</div><div class="text-lg font-bold tabular-nums">${bnNum(s.total)}</div></div>
        <div class="rounded-xl bg-gold-100/70 px-1 py-2"><div class="text-[11px] text-gold-600">অবস্থান</div><div class="flex items-center justify-center gap-1 text-lg font-bold">${s.rank ? `${bn(s.rank)} ${move(s.rank, s.prev_rank)}` : '–'}</div></div>
        <div class="rounded-xl border border-[#e7e1cf] bg-cream px-1 py-2"><div class="text-[11px] text-emerald-900/70">টানা দিন</div><div class="text-lg font-bold">🔥 ${bn(s.streak)}</div></div>
      </div>
      <div class="flex items-center justify-between gap-2">
        <span class="text-xs font-semibold text-emerald-900/70">আজকের প্রশ্ন</span>
        <span class="flex gap-1.5">${dots}</span>
      </div>
      ${main}
      <div class="flex flex-wrap items-center justify-between gap-2 border-t border-[#e7e1cf] pt-3 text-sm">
        <button type="button" data-go="board" class="font-semibold text-emerald-800 underline underline-offset-2">🏆 পুরো লিডারবোর্ড</button>
        <button type="button" data-go="logout" class="text-xs text-emerald-900/55 underline underline-offset-2">এই ফোন থেকে বের হন</button>
      </div>`);

    if (target) {
      const t = Date.parse(target);
      const run = () => {
        const left = t - serverNow();
        const el = document.getElementById('nk-qz-cd');
        if (el) el.textContent = countdownText(Math.max(0, left));
        if (left <= 0) { clearInterval(tick); play(); }
      };
      run();
      tick = setInterval(run, 1000);
    }
    const q = body!.querySelector<HTMLElement>('[data-slot]');
    if (q) {
      q.querySelectorAll<HTMLButtonElement>('button[data-choice]').forEach((b) =>
        b.addEventListener('click', () => answer(Number(q.dataset.slot), Number(b.dataset.choice), b)),
      );
    }
  }

  function questionCard(x: Slot) {
    const opts = (x.options ?? []).map((o, i) => `<button type="button" data-choice="${i}" class="nk-qz-opt"><span class="nk-qz-letter">${LETTERS[i]}</span><span class="flex-1 text-left">${esc(o)}</span></button>`).join('');
    return `<div class="rounded-2xl border border-emerald-600/25 bg-white p-4 shadow-sm" data-slot="${x.slot}">
      <div class="text-xs font-bold text-emerald-700">প্রশ্ন ${bn(x.slot + 1)} / ${bn(state!.slots.length)}</div>
      <p class="mt-1 text-[17px] font-bold leading-snug text-emerald-950">${esc(x.question)}</p>
      <div class="mt-3 grid gap-2">${opts}</div>
      <p class="mt-2.5 text-xs text-emerald-900/55">ভেবে উত্তর দিন, একবারই উত্তর দেওয়া যাবে।</p>
    </div>`;
  }

  function resultCard(x: Slot) {
    const opts = (x.options ?? []).map((o, i) => {
      const cls = i === x.correct ? 'nk-qz-opt nk-qz-ok' : i === x.choice ? 'nk-qz-opt nk-qz-no' : 'nk-qz-opt opacity-60';
      const mark = i === x.correct ? '✓' : i === x.choice ? '✗' : LETTERS[i];
      return `<div class="${cls}"><span class="nk-qz-letter">${mark}</span><span class="flex-1 text-left">${esc(o)}</span></div>`;
    }).join('');
    return `<div class="rounded-2xl border p-4 ${x.right ? 'border-emerald-600/40 bg-emerald-50' : 'border-red-300/60 bg-red-50/60'}">
      <div class="text-lg font-bold ${x.right ? 'text-emerald-800' : 'text-red-800'}">${x.right ? `✅ সঠিক উত্তর! +${bn(x.points ?? 0)} পয়েন্ট` : '❌ উত্তরটি সঠিক হয়নি'}</div>
      <p class="mt-1 font-semibold text-emerald-950">${esc(x.question)}</p>
      <div class="mt-2.5 grid gap-1.5">${opts}</div>
      ${x.explanation ? `<p class="mt-2.5 rounded-lg bg-white/70 px-3 py-2 text-sm text-emerald-950/85">💡 ${esc(x.explanation)}</p>` : ''}
      <button type="button" data-go="play" class="nk-btn nk-green mt-3 w-full py-2.5 text-sm">এগিয়ে যান ›</button>
    </div>`;
  }

  async function answer(slot: number, choice: number, btn: HTMLButtonElement) {
    const me = readMe();
    if (!me || !state) return;
    body!.querySelectorAll<HTMLButtonElement>('button[data-choice]').forEach((b) => (b.disabled = true));
    btn.classList.add('nk-qz-picked');
    try {
      const r = await rpc<{ ok: boolean; reason?: string; right?: boolean; correct?: number; points?: number; explanation?: string }>('nusuk_quiz_answer', { p_token: me.token, p_slot: slot, p_choice: choice });
      if (!r.ok) { await play(); return; }
      const x = state.slots.find((s) => s.slot === slot)!;
      Object.assign(x, { status: 'answered', choice, right: r.right, correct: r.correct, points: r.points, explanation: r.explanation ?? undefined });
      state.total += r.points ?? 0;
      state.today_points += r.points ?? 0;
      renderPlay(slot);
      loadPublic();
    } catch (err) {
      console.error(err);
      body!.querySelectorAll<HTMLButtonElement>('button[data-choice]').forEach((b) => (b.disabled = false));
      btn.classList.remove('nk-qz-picked');
    }
  }

  async function board() {
    show(`${head('🏆 লিডারবোর্ড', 'সবচেয়ে বেশি পয়েন্ট পাওয়া খেলোয়াড়রা')}<p class="text-sm text-emerald-900/60">লোড হচ্ছে…</p>`);
    let p: Pub | null = null;
    try { p = await rpc<Pub>('nusuk_quiz_public', { p_limit: 100 }); } catch {}
    const me = readMe();
    const rows = p?.board ?? [];
    show(`${head('🏆 লিডারবোর্ড', `শীর্ষ ${bn(Math.min(rows.length, 100))} জন · ▲▼ গতকালের তুলনায়`)}
      <ol class="grid gap-1.5">${rows.length ? boardRows(rows, me?.id) : '<li class="text-sm text-emerald-900/60">এখনো কেউ পয়েন্ট পায়নি।</li>'}</ol>
      <button type="button" data-go="${me ? 'play' : 'welcome'}" class="nk-btn nk-green py-3 text-base">${me ? 'কুইজে ফিরে যান ›' : 'কুইজ খেলুন ›'}</button>`);
  }

  // ---------- Events ----------
  body.addEventListener('click', async (e) => {
    const t = (e.target as HTMLElement).closest<HTMLElement>('[data-go],[data-close]');
    if (!t) return;
    if (t.hasAttribute('data-close')) { dlg.close(); return; }
    const go = t.dataset.go;
    if (go === 'welcome') welcome();
    else if (go === 'register') register();
    else if (go === 'login') login();
    else if (go === 'play') play();
    else if (go === 'board') board();
    else if (go === 'logout') {
      if (!confirm('এই ফোন থেকে বের হবেন? আবার প্রবেশ করতে আইডি আর কোডের শেষ ৪টি অক্ষর লাগবে।')) return;
      const me = readMe();
      if (me) { try { await rpc('nusuk_quiz_logout', { p_token: me.token }); } catch {} }
      saveMe(null);
      loadPublic();
      welcome();
    }
  });
  $('nk-qz-close').addEventListener('click', () => dlg.close());
  dlg.addEventListener('click', (e) => { if (e.target === dlg) dlg.close(); });
  dlg.addEventListener('close', () => clearInterval(tick));
  $('nk-quiz-play').addEventListener('click', () => { open(); readMe() ? play() : welcome(); });
  $('nk-quiz-board').addEventListener('click', () => { open(); board(); });

  // Opened from a shared link: /nusuk#quiz
  loadPublic().then(() => { if (location.hash === '#quiz' && pub?.enabled) { open(); readMe() ? play() : welcome(); } });
  setInterval(() => { if (document.visibilityState === 'visible' && !dlg.open) loadPublic(); }, 5 * 60_000 * (0.9 + Math.random() * 0.2));
}
