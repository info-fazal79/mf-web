/**
 * Vote and giveaway strips under the top notice bar (Nusuk Manager → Top notice).
 * Vote: 👍 / 👎 with live counts; 👎 asks for a reason.
 * Giveaway: prize + countdown; "অংশ নিন" opens a form (tasks, code, Facebook name, share link).
 */
import { rpc } from './rpc';
import { countdownText } from './content';

type Poll = { id: number; question: string; ends_at: string | null; open: boolean; yes: number; no: number; mine: 1 | -1 | null };
type Give = {
  id: number; title: string; prize: string; prize_image: string; details: string; ends_at: string | null; open: boolean;
  need_page: boolean; need_group: boolean; need_share: boolean; page_url: string; group_url: string; post_url: string;
  entries: number; mine: boolean; winner: { name: string; code: string } | null;
};
type Live = { now?: string; poll: Poll | null; giveaway: Give | null };

const bn = (n: number) => n.toLocaleString('bn-BD');
const esc = (t = '') => t.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
const FB = /^https?:\/\/([a-z0-9-]+\.)*(facebook\.com|fb\.com|fb\.me|fb\.watch)(\/|$)/i;

export function initLive(opts: { device: string }) {
  const box = document.getElementById('nk-live');
  if (!box) return;
  let data: Live = { poll: null, giveaway: null };
  let skew = 0;
  let tick: ReturnType<typeof setInterval> | undefined;

  // ---- dialogs (built once) ----
  const dlg = (id: string, inner: string) => {
    const d = document.createElement('dialog');
    d.id = id;
    d.className = 'm-auto max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-md overflow-y-auto rounded-[1.25rem] p-0 shadow-2xl backdrop:bg-emerald-950/60';
    d.innerHTML = inner;
    d.addEventListener('click', (e) => { if (e.target === d) d.close(); });
    document.body.append(d);
    return d;
  };
  const noDlg = dlg('nk-vote-no', `<form class="grid gap-3 p-5" novalidate>
      <div class="flex items-start justify-between gap-3"><h2 class="text-lg font-bold text-emerald-900">👎 কেন একমত নন?</h2>
      <button type="button" data-x class="grid h-9 w-9 shrink-0 place-items-center rounded-full text-xl text-emerald-900/60 hover:bg-emerald-50" aria-label="বন্ধ করুন">×</button></div>
      <p data-q class="rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-950"></p>
      <label class="grid gap-1 text-sm font-semibold">আপনার কারণ লিখুন *
        <textarea name="reason" rows="4" maxlength="1000" class="nk-input font-normal" placeholder="আপনার মতামত আমাদের সিদ্ধান্ত নিতে সাহায্য করবে"></textarea></label>
      <p data-msg class="hidden rounded-xl px-3 py-2 text-sm"></p>
      <button class="nk-btn nk-green py-3 text-base">ভোট দিন</button>
    </form>`);
  const gwDlg = dlg('nk-gw', '<div data-body class="grid gap-3.5 p-5"></div>');

  const say = (el: HTMLElement | null, t: string, ok: boolean) => {
    if (!el) return;
    el.textContent = t;
    el.className = `rounded-xl px-3 py-2 text-sm ${ok ? 'bg-emerald-100 text-emerald-900' : 'bg-red-50 text-red-800'}`;
  };
  const left = (iso: string | null) => (iso ? Date.parse(iso) - (Date.now() + skew) : Infinity);

  async function load() {
    try {
      data = await rpc<Live>('nusuk_live', { p_device: opts.device });
      if (data.now) skew = Date.parse(data.now) - Date.now();
    } catch {
      data = { poll: null, giveaway: null }; // not installed yet
    }
    render();
  }

  function render() {
    const p = data.poll, g = data.giveaway;
    let html = '';
    if (p) {
      const yesOn = p.mine === 1, noOn = p.mine === -1;
      html += `<div class="nk-live-poll text-white"><div class="mx-auto flex max-w-xl flex-wrap items-center justify-center gap-x-3 gap-y-1.5 px-4 py-2.5 text-center text-sm">
        <span class="font-semibold leading-snug">🗳️ ${esc(p.question)}</span>
        <span class="flex items-center gap-1.5">
          <button type="button" data-vote="1" ${p.open ? '' : 'disabled'} class="nk-vote ${yesOn ? 'nk-vote-on' : ''}" aria-pressed="${yesOn}">👍 হ্যাঁ <b>${bn(p.yes)}</b></button>
          <button type="button" data-vote="-1" ${p.open ? '' : 'disabled'} class="nk-vote ${noOn ? 'nk-vote-on nk-vote-no' : ''}" aria-pressed="${noOn}">👎 না <b>${bn(p.no)}</b></button>
        </span>
        ${p.open && p.ends_at ? `<span class="text-xs text-white/75">⏳ <span data-cd="${esc(p.ends_at)}"></span></span>` : ''}
        ${!p.open ? '<span class="text-xs text-white/75">ভোট শেষ</span>' : p.mine ? '<span class="text-xs text-gold-100">✓ আপনার ভোট দেওয়া হয়েছে</span>' : ''}
      </div></div>`;
    }
    if (g) {
      const status = g.winner
        ? `<span class="font-bold">🏆 বিজয়ী: ${esc(g.winner.name)} <span class="font-mono text-xs opacity-80">(${esc(g.winner.code)})</span></span>`
        : g.open
          ? `${g.ends_at ? `<span class="nk-live-cd">⏳ <span data-cd="${esc(g.ends_at)}"></span></span>` : ''}
             <button type="button" data-gw class="rounded-full bg-emerald-900 px-3 py-1 text-xs font-bold text-gold-100 hover:bg-emerald-800">${g.mine ? '✓ অংশ নিয়েছেন' : 'অংশ নিন →'}</button>`
          : '<span class="text-xs font-semibold">⏳ সময় শেষ, শীঘ্রই বিজয়ী ঘোষণা</span>';
      html += `<div class="nk-live-gw text-emerald-950"><div class="mx-auto flex max-w-xl flex-wrap items-center justify-center gap-x-3 gap-y-1.5 px-4 py-2.5 text-center text-sm">
        <span class="font-bold leading-snug">🎁 ${esc(g.title)}${g.prize ? `: <span class="font-semibold">${esc(g.prize)}</span>` : ''}</span>
        ${status}
        <button type="button" data-gw class="text-xs font-semibold underline underline-offset-2">${bn(g.entries)} জন অংশ নিয়েছেন</button>
      </div></div>`;
    }
    box!.innerHTML = html;
    box!.classList.toggle('hidden', !html);
    clearInterval(tick);
    if (box!.querySelector('[data-cd]')) {
      const upd = () => {
        let ended = false;
        box!.querySelectorAll<HTMLElement>('[data-cd]').forEach((el) => {
          const ms = left(el.dataset.cd!);
          el.textContent = countdownText(ms);
          if (ms <= 0) ended = true;
        });
        if (ended) { clearInterval(tick); load(); }
      };
      upd();
      tick = setInterval(upd, 1000);
    }
  }

  // ---- vote ----
  async function vote(v: 1 | -1, reason?: string) {
    const p = data.poll;
    if (!p) return { ok: false };
    const r = await rpc<{ ok: boolean; reason?: string }>('nusuk_poll_vote', { p_poll: p.id, p_device: opts.device, p_vote: v, p_reason: reason ?? null });
    if (r.ok) await load();
    return r;
  }
  box.addEventListener('click', async (e) => {
    const t = e.target as HTMLElement;
    const vb = t.closest<HTMLButtonElement>('[data-vote]');
    if (vb && !vb.disabled) {
      const v = Number(vb.dataset.vote) as 1 | -1;
      if (v === 1) { vb.disabled = true; await vote(1).catch(() => {}); return; }
      noDlg.querySelector<HTMLElement>('[data-q]')!.textContent = data.poll?.question ?? '';
      noDlg.querySelector('[data-msg]')!.className = 'hidden';
      noDlg.querySelector('textarea')!.value = '';
      noDlg.showModal();
      return;
    }
    if (t.closest('[data-gw]')) openGiveaway();
  });
  noDlg.querySelector('[data-x]')!.addEventListener('click', () => noDlg.close());
  noDlg.querySelector('form')!.addEventListener('submit', async (e) => {
    e.preventDefault();
    const msg = noDlg.querySelector<HTMLElement>('[data-msg]');
    const reason = noDlg.querySelector('textarea')!.value.trim();
    if (reason.length < 3) return say(msg, 'অনুগ্রহ করে কারণটা একটু লিখুন।', false);
    try {
      const r = await vote(-1, reason);
      if (r.ok) { say(msg, 'ধন্যবাদ! আপনার মতামত পৌঁছেছে।', true); setTimeout(() => noDlg.close(), 1200); }
      else say(msg, 'ভোট নেওয়া যায়নি, ভোটের সময় হয়তো শেষ।', false);
    } catch { say(msg, 'পাঠানো যায়নি। আবার চেষ্টা করুন।', false); }
  });

  // ---- giveaway ----
  const reasons: Record<string, string> = {
    closed: 'এই গিভঅ্যাওয়ের সময় শেষ।',
    bad_code: 'নুসুক কোডটি সঠিক নয় (NG- দিয়ে শুরু, পরে ৮টি অক্ষর)।',
    need_name: 'আপনার ফেসবুক প্রোফাইলের নাম লিখুন।',
    need_page: 'পেজ ফলো করে টিক দিন।',
    need_group: 'গ্রুপে যুক্ত হয়ে টিক দিন।',
    need_share: 'পোস্ট শেয়ার করে শেয়ারের লিংক দিন (facebook.com দিয়ে শুরু)।',
    exists: 'এই কোড দিয়ে আগেই অংশ নেওয়া হয়েছে।',
    too_many: 'এই ফোন থেকে আর অংশ নেওয়া যাবে না।',
  };
  function openGiveaway() {
    const g = data.giveaway;
    if (!g) return;
    const body = gwDlg.querySelector<HTMLElement>('[data-body]')!;
    const task = (on: boolean, url: string, label: string, check: string, name: string) =>
      on ? `<div class="rounded-xl border border-emerald-900/10 bg-white p-3">
        <div class="flex items-center justify-between gap-2"><b class="text-sm">${label}</b>${url ? `<a href="${esc(url)}" target="_blank" rel="noopener" class="shrink-0 rounded-lg bg-[#1877f2] px-3 py-1.5 text-xs font-bold text-white">খুলুন ↗</a>` : ''}</div>
        ${name ? `<label class="mt-2 flex items-center gap-2 text-sm"><input type="checkbox" name="${name}" class="h-4 w-4 accent-emerald-700"> ${check}</label>` : ''}
      </div>` : '';
    body.innerHTML = `
      <div class="flex items-start justify-between gap-3">
        <h2 class="text-lg font-bold text-emerald-900">🎁 ${esc(g.title)}</h2>
        <button type="button" data-x class="grid h-9 w-9 shrink-0 place-items-center rounded-full text-xl text-emerald-900/60 hover:bg-emerald-50" aria-label="বন্ধ করুন">×</button>
      </div>
      ${g.prize_image ? `<img src="${esc(g.prize_image)}" alt="" class="max-h-56 w-full rounded-xl bg-emerald-50 object-contain">` : ''}
      ${g.prize ? `<div class="rounded-xl bg-gold-100/70 px-3.5 py-2.5 text-center"><div class="text-xs text-emerald-900/70">পুরস্কার</div><div class="text-lg font-bold text-emerald-950">${esc(g.prize)}</div></div>` : ''}
      ${g.winner ? `<div class="rounded-xl bg-emerald-900 px-3.5 py-3 text-center text-gold-100"><div class="text-xs">🏆 বিজয়ী</div><div class="text-lg font-bold">${esc(g.winner.name)}</div><div class="font-mono text-xs opacity-80">${esc(g.winner.code)}</div></div>` : ''}
      ${g.open && g.ends_at ? `<p class="text-center text-sm font-semibold text-emerald-900">⏳ শেষ হতে বাকি <span data-cd2="${esc(g.ends_at)}" class="font-mono"></span></p>` : ''}
      ${g.details ? `<p class="nk-pre text-sm leading-relaxed text-emerald-950/85">${esc(g.details)}</p>` : ''}
      <p class="text-center text-xs text-emerald-900/60">এখন পর্যন্ত ${bn(g.entries)} জন অংশ নিয়েছেন। সময় শেষে লটারির মাধ্যমে বিজয়ী বাছাই হবে।</p>
      ${g.open && !g.winner ? `<form class="grid gap-3" novalidate>
        <h3 class="text-sm font-bold text-emerald-900">✅ অংশ নিতে যা করতে হবে</h3>
        ${task(g.need_page, g.page_url, '📘 আমাদের ফেসবুক পেজ ফলো করুন', 'আমি পেজ ফলো করেছি', 'page')}
        ${task(g.need_group, g.group_url, '👥 কমিউনিটি গ্রুপে যুক্ত হোন', 'আমি গ্রুপে যুক্ত হয়েছি', 'group')}
        ${task(g.need_share, g.post_url, '📢 এই পোস্টটি Public করে শেয়ার করুন', '', '')}
        ${g.need_share ? `<label class="grid gap-1 text-sm font-semibold">শেয়ার করা পোস্টের লিংক *
          <input name="share" type="url" inputmode="url" maxlength="600" class="nk-input font-normal" placeholder="https://www.facebook.com/share/p/...">
          <span class="text-xs font-normal text-emerald-900/60">শেয়ার করার পর আপনার পোস্টে ••• চেপে "Copy link" করে এখানে দিন।</span></label>` : ''}
        <label class="grid gap-1 text-sm font-semibold">আপনার ফেসবুক প্রোফাইলের নাম *
          <input name="fbname" maxlength="120" class="nk-input font-normal" placeholder="যাচাইয়ের জন্য">
        </label>
        <label class="grid gap-1 text-sm font-semibold">আপনার নুসুক রেফারেল কোড *
          <input name="code" maxlength="20" autocomplete="off" autocapitalize="off" spellcheck="false" class="nk-input font-mono" placeholder="NG-y3JkB7lU">
          <span class="text-xs font-normal text-emerald-900/60">এই কোডটিই ড্র-তে যাবে। বিজয়ী হলে পুরস্কার এই কোডের মালিকই পাবেন।</span>
        </label>
        <p data-msg class="hidden rounded-xl px-3 py-2 text-sm"></p>
        <button class="nk-btn nk-gold py-3 text-base">🎁 অংশ নিন</button>
      </form>` : ''}`;
    body.querySelector('[data-x]')!.addEventListener('click', () => gwDlg.close());
    const cd = body.querySelector<HTMLElement>('[data-cd2]');
    if (cd) {
      const u = () => { cd.textContent = countdownText(left(cd.dataset.cd2!)); };
      u();
      const t = setInterval(() => { if (!gwDlg.open) return clearInterval(t); u(); }, 1000);
    }
    const form = body.querySelector('form');
    form?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const fd = new FormData(form);
      const msg = form.querySelector<HTMLElement>('[data-msg]');
      const code = String(fd.get('code') ?? '').trim();
      const name = String(fd.get('fbname') ?? '').trim();
      const share = String(fd.get('share') ?? '').trim();
      if (g.need_page && fd.get('page') !== 'on') return say(msg, reasons.need_page, false);
      if (g.need_group && fd.get('group') !== 'on') return say(msg, reasons.need_group, false);
      if (g.need_share && !FB.test(share)) return say(msg, reasons.need_share, false);
      if (!name) return say(msg, reasons.need_name, false);
      if (!/^NG-[A-Za-z0-9]{8}$/.test(code)) return say(msg, reasons.bad_code, false);
      const btn = form.querySelector('button')!;
      btn.disabled = true;
      try {
        const r = await rpc<{ ok: boolean; reason?: string }>('nusuk_giveaway_enter', {
          p_id: g.id, p_device: opts.device, p_code: code, p_name: name, p_share: share || null,
          p_page: fd.get('page') === 'on', p_group: fd.get('group') === 'on',
        });
        if (r.ok) {
          say(msg, '🎉 আপনি ড্র-তে যুক্ত হয়েছেন! সময় শেষে বিজয়ী ঘোষণা করা হবে, ইনশাআল্লাহ।', true);
          form.querySelectorAll('input').forEach((i) => (i.disabled = true));
          load();
          return;
        }
        say(msg, reasons[r.reason ?? ''] ?? 'অংশ নেওয়া যায়নি।', false);
      } catch { say(msg, 'পাঠানো যায়নি। ইন্টারনেট সংযোগ দেখে আবার চেষ্টা করুন।', false); }
      btn.disabled = false;
    });
    gwDlg.showModal();
    gwDlg.scrollTop = 0;
  }

  load();
  setInterval(() => { if (document.visibilityState === 'visible' && !gwDlg.open && !noDlg.open) load(); }, 30_000);
}
