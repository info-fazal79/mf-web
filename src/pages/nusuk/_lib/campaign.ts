/**
 * Share campaign on /nusuk (Nusuk Manager → Campaign).
 * Visitors enter their Nusuk code + Facebook profile and get a personal link per
 * post, new every day. When Facebook reads the link (they posted it), the share is
 * counted by the worker (worker/index.js). Hidden from everyone except a signed-in
 * admin until it is published.
 */
import { rpc } from './rpc';
import { parseBonus } from './bonus';

type Post = { id: number; title: string; image: string };
type Row = { code: string; n: number };
type State = {
  visible: boolean;
  published?: boolean;
  admin?: boolean;
  title?: string;
  rules?: string;
  starts?: string | null;
  ends?: string | null;
  open?: boolean;
  people?: number;
  posts?: Post[];
  board?: { day: Row[]; week: Row[]; final: Row[] };
};
type Link = { post: number; slug: string; done: boolean; clicks: number };
type Me = {
  ok: boolean;
  reason?: 'closed' | 'not_found' | 'bad_profile' | 'need_profile';
  code?: string;
  profile?: string;
  open?: boolean;
  follow?: boolean;
  join?: boolean;
  links?: Link[];
  today?: number;
  week?: number;
  final?: number;
};

const URL_ = import.meta.env.PUBLIC_SUPABASE_URL as string | undefined;
const KEY = import.meta.env.PUBLIC_SUPABASE_ANON_KEY as string | undefined;
const SAVE = 'nusuk:camp:v1';
const CODE_RE = /^NG-[A-Za-z0-9]{8}$/;
const FB_RE = /^https?:\/\/([a-z0-9-]+\.)*(facebook\.com|fb\.com|fb\.me)(\/|$)/i;

const bn = (n: number) => n.toLocaleString('bn-BD');
const esc = (t = '') => t.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
const bnDate = (d?: string | null) => (d ? new Date(`${d}T00:00:00`).toLocaleDateString('bn-BD', { day: 'numeric', month: 'long' }) : '');
const store = {
  get(): { code: string; profile: string } | null {
    try { const v = JSON.parse(localStorage.getItem(SAVE) ?? 'null'); return v?.code ? v : null; } catch { return null; }
  },
  set(v: { code: string; profile: string } | null) {
    try { v ? localStorage.setItem(SAVE, JSON.stringify(v)) : localStorage.removeItem(SAVE); } catch {}
  },
};

/** The admin's Supabase session (same site, saved by Nusuk Manager), refreshed if it ran out. */
async function adminToken(): Promise<string | null> {
  if (!URL_ || !KEY) return null;
  const key = `sb-${new URL(URL_).hostname.split('.')[0]}-auth-token`;
  let s: { access_token?: string; refresh_token?: string; expires_at?: number } | null = null;
  try { s = JSON.parse(localStorage.getItem(key) ?? 'null'); } catch { return null; }
  if (!s?.access_token) return null;
  if ((s.expires_at ?? 0) * 1000 > Date.now() + 60_000) return s.access_token;
  if (!s.refresh_token) return null;
  try {
    const r = await fetch(`${URL_}/auth/v1/token?grant_type=refresh_token`, {
      method: 'POST',
      headers: { apikey: KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: s.refresh_token }),
    });
    if (!r.ok) return null;
    const n = await r.json();
    if (!n.expires_at && n.expires_in) n.expires_at = Math.floor(Date.now() / 1000) + n.expires_in;
    localStorage.setItem(key, JSON.stringify({ ...s, ...n }));
    return n.access_token ?? null;
  } catch {
    return null;
  }
}

const DEFAULT_RULES =
  '১. নিচে আপনার নুসুক রেফারেল কোড আর ফেসবুক প্রোফাইলের লিংক দিন।\n২. প্রতিটি পোস্টের জন্য আপনার নিজের একটি লিংক তৈরি হবে। লিংকটি কপি করে ফেসবুকে Public পোস্ট দিন।\n৩. ফেসবুক লিংকের প্রিভিউ দেখানোর সাথে সাথে আপনার শেয়ারটি গোনা হবে। প্রতিটি পোস্ট দিনে একবার গোনা হয়।\n৪. প্রতিদিন নতুন লিংক তৈরি হয়, তাই প্রতিদিন আবার শেয়ার করতে পারবেন।\n৫. দৈনিক ও সাপ্তাহিক পুরস্কার শুধু শেয়ারের ভিত্তিতে। চূড়ান্ত পুরস্কারে পেজ ফলো ও গ্রুপে যুক্ত হওয়ার জন্য ১ পয়েন্ট করে যোগ হবে।\n৬. বিজয়ী লটারির মাধ্যমে বাছাই করা হবে। পুরস্কার দেওয়ার আগে আপনার ফেসবুক প্রোফাইলে পোস্টগুলো যাচাই করা হবে এবং নুসুক অ্যাপে আপনার কোডের স্ক্রিনশট চাওয়া হবে।';

export function initCampaign(opts: { device: () => string; content: () => unknown }) {
  const openBtn = document.getElementById('nk-cp-open') as HTMLButtonElement | null;
  const dialog = document.getElementById('nk-cp') as HTMLDialogElement | null;
  const body = document.getElementById('nk-cp-body');
  if (!openBtn || !dialog || !body || !URL_) return;

  let token: string | null = null;
  let state: State = { visible: false };
  let me: Me | null = null;
  let tab: 'day' | 'week' | 'final' = 'day';
  let poll: ReturnType<typeof setInterval> | undefined;
  let msg = '';

  async function loadState() {
    try {
      state = await rpc<State>('nusuk_camp_state', {}, token);
    } catch {
      state = { visible: false }; // not installed yet
    }
    openBtn!.style.display = state.visible ? '' : 'none';
    const badge = document.getElementById('nk-cp-badge');
    if (badge) badge.style.display = state.visible && !state.published ? '' : 'none';
  }

  async function loadMe(profile?: string) {
    const saved = store.get();
    if (!saved) { me = null; return; }
    try {
      me = await rpc<Me>('nusuk_camp_me', { p_code: saved.code, p_profile: profile ?? null, p_device: opts.device() }, token);
      if (me.ok && me.code) store.set({ code: me.code, profile: me.profile ?? saved.profile });
    } catch {
      me = { ok: false, reason: 'closed' };
    }
  }

  const reasonText: Record<string, string> = {
    closed: 'প্রতিযোগিতা এই মুহূর্তে চালু নেই।',
    not_found: 'এই কোডটি আমাদের তালিকায় নেই। আগে পেজের "কোড জমা দিন" অংশে আপনার কোডটি জমা দিন।',
    bad_profile: 'ফেসবুক প্রোফাইলের সঠিক লিংক দিন (facebook.com দিয়ে শুরু)।',
    need_profile: 'আপনার ফেসবুক প্রোফাইলের লিংক দিন।',
  };

  function boardHtml() {
    const rows = state.board?.[tab] ?? [];
    const tabs = ([['day', 'আজ'], ['week', 'এই সপ্তাহ'], ['final', 'চূড়ান্ত']] as const)
      .map(([k, l]) => `<button type="button" data-tab="${k}" class="rounded-full px-3 py-1 text-xs font-bold ${tab === k ? 'bg-emerald-900 text-gold-100' : 'bg-emerald-50 text-emerald-900'}">${l}</button>`)
      .join('');
    const list = rows.length
      ? rows.map((r, i) => `<li class="flex items-center gap-2 rounded-lg ${i < 3 ? 'bg-gold-100/60' : 'bg-emerald-50/70'} px-3 py-1.5 text-sm"><b class="w-5 text-emerald-900/60">${bn(i + 1)}</b><span class="font-mono font-bold text-emerald-950">${esc(r.code)}</span><span class="ml-auto font-bold text-emerald-900">${bn(r.n)} ${tab === 'final' ? 'পয়েন্ট' : 'শেয়ার'}</span></li>`).join('')
      : '<li class="rounded-lg bg-emerald-50 px-3 py-3 text-center text-sm text-emerald-900/60">এখনো কেউ নেই, প্রথম হোন!</li>';
    return `<section class="grid gap-2"><div class="flex items-center justify-between gap-2"><h3 class="text-sm font-bold text-emerald-900">🏅 শীর্ষ অংশগ্রহণকারী</h3><div class="flex gap-1">${tabs}</div></div><ul class="grid gap-1">${list}</ul><p class="text-xs text-emerald-900/55">একই সংখ্যক শেয়ার হলে বিজয়ী লটারির মাধ্যমে বাছাই হবে। নিরাপত্তার জন্য কোডের মাঝের অংশ লুকানো।</p></section>`;
  }

  function joinHtml() {
    const saved = store.get();
    return `<form id="nk-cp-join" class="grid gap-3 rounded-xl border border-emerald-900/10 bg-white p-3.5" novalidate>
      <p class="text-sm font-bold text-emerald-900">অংশ নিতে আপনার তথ্য দিন</p>
      <label class="grid gap-1 text-sm font-semibold">আপনার নুসুক রেফারেল কোড *
        <input name="code" class="nk-input font-mono" maxlength="20" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="যেমন: NG-y3JkB7lU" value="${esc(saved?.code ?? '')}"></label>
      <label class="grid gap-1 text-sm font-semibold">আপনার ফেসবুক প্রোফাইলের লিংক *
        <input name="profile" type="url" inputmode="url" class="nk-input" maxlength="300" placeholder="https://www.facebook.com/…" value="${esc(saved?.profile ?? '')}">
        <span class="text-xs font-normal text-emerald-900/60">বিজয়ী হলে এই প্রোফাইলে আপনার পোস্টগুলো দেখে যাচাই করা হবে।</span></label>
      ${msg ? `<p class="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">${esc(msg)}</p>` : ''}
      <button class="nk-btn nk-green py-3 text-base">অংশ নিন</button>
    </form>`;
  }

  function meHtml() {
    const m = me!;
    const posts = state.posts ?? [];
    const links = new Map((m.links ?? []).map((l) => [l.post, l]));
    const b = parseBonus(opts.content());
    const stat = (label: string, n: number, cls: string) => `<div class="rounded-xl ${cls} px-2 py-2 text-center"><div class="text-xs">${label}</div><div class="text-lg font-bold">${bn(n)}</div></div>`;
    const postRows = posts.map((p) => {
      const l = links.get(p.id);
      const url = l ? `${location.origin}/s/${l.slug}` : '';
      return `<li class="rounded-xl border ${l?.done ? 'border-emerald-600/40 bg-emerald-50/60' : 'border-emerald-900/10 bg-white'} p-3">
        <div class="flex items-center gap-3">
          ${p.image ? `<img src="${esc(p.image)}" alt="" loading="lazy" referrerpolicy="no-referrer" class="h-12 w-12 shrink-0 rounded-lg object-cover">` : '<span class="grid h-12 w-12 shrink-0 place-items-center rounded-lg bg-[#1877f2] text-xl text-white">f</span>'}
          <div class="min-w-0 flex-1">
            <div class="truncate text-sm font-bold text-emerald-950">${esc(p.title || 'পোস্ট')}</div>
            <div class="text-xs ${l?.done ? 'font-bold text-emerald-700' : 'text-emerald-900/60'}">${l?.done ? '✓ আজকের শেয়ার গোনা হয়েছে' : l ? 'আজ এখনো শেয়ার হয়নি' : 'আজ লিংক নেই'}</div>
          </div>
        </div>
        ${l ? `<div class="mt-2 flex gap-2"><input readonly value="${esc(url)}" class="nk-input min-w-0 flex-1 py-1.5! font-mono text-xs!" aria-label="আপনার লিংক"><button type="button" data-copy="${esc(url)}" class="nk-btn ${l.done ? 'nk-ghost' : 'nk-gold'} shrink-0 px-3 py-1.5 text-sm">কপি</button></div>` : ''}
      </li>`;
    }).join('');
    const bonusBtn = (kind: 'follow' | 'join', url: string, label: string, done: boolean) =>
      url ? `<a href="${esc(url)}" target="_blank" rel="noopener" data-bonus="${kind}" class="flex items-center gap-2 rounded-xl ${done ? 'bg-emerald-50 text-emerald-800' : 'bg-[#1877f2] text-white'} px-3 py-2.5 text-sm font-bold">${label}<span class="ml-auto text-xs">${done ? '✓ পেয়েছেন' : '+১ পয়েন্ট'}</span></a>` : '';
    return `
      <div class="flex items-center justify-between gap-2 rounded-xl bg-emerald-50 px-3 py-2 text-sm">
        <span>কোড: <b class="font-mono">${esc(m.code ?? '')}</b></span>
        <button type="button" id="nk-cp-change" class="text-xs font-semibold text-emerald-800 underline">পরিবর্তন</button>
      </div>
      <div class="grid grid-cols-3 gap-2">
        ${stat('আজকের শেয়ার', m.today ?? 0, 'bg-gold-100/70 text-emerald-950')}
        ${stat('এই সপ্তাহে', m.week ?? 0, 'bg-emerald-50 text-emerald-900')}
        ${stat('মোট পয়েন্ট', m.final ?? 0, 'bg-emerald-900 text-gold-100')}
      </div>
      ${m.open ? `<section class="grid gap-2">
        <h3 class="text-sm font-bold text-emerald-900">📢 আজকের পোস্ট (${bn(posts.length)}টি)</h3>
        <p class="text-xs leading-relaxed text-emerald-900/70">লিংক কপি করে ফেসবুকে <b>Public</b> পোস্ট দিন। প্রিভিউ দেখানোর পর কয়েক সেকেন্ডের মধ্যে এখানে ✓ চলে আসবে।</p>
        <ul class="grid gap-2">${postRows || '<li class="rounded-xl bg-emerald-50 p-3 text-center text-sm">আজ কোনো পোস্ট নেই।</li>'}</ul>
      </section>` : '<p class="rounded-xl bg-gold-100/60 p-3 text-center text-sm">এই মুহূর্তে শেয়ারের সময় চালু নেই।</p>'}
      ${b.page_url || b.group_url ? `<section class="grid gap-2"><h3 class="text-sm font-bold text-emerald-900">⭐ একবারের বোনাস (চূড়ান্ত পুরস্কারের জন্য)</h3>
        ${bonusBtn('follow', b.page_url, '📘 পেজ ফলো করুন', !!m.follow)}
        ${bonusBtn('join', b.group_url, '👥 গ্রুপে যুক্ত হোন', !!m.join)}</section>` : ''}`;
  }

  function render() {
    const s = state;
    const period = s.starts || s.ends ? `<p class="text-xs font-semibold text-emerald-800">📅 ${s.starts ? bnDate(s.starts) : ''}${s.ends ? ` থেকে ${bnDate(s.ends)} পর্যন্ত` : ' থেকে'}</p>` : '';
    body!.innerHTML = `
      ${s.published ? '' : '<p class="rounded-xl border border-gold-500/60 bg-gold-100/60 px-3 py-2 text-xs font-semibold text-emerald-950">👁️ শুধু আপনি (অ্যাডমিন) এটি দেখছেন। Nusuk Manager → Campaign থেকে Publish করলে সবাই দেখবে।</p>'}
      <div>
        <h2 id="nk-cp-title" class="text-lg font-bold text-emerald-900">🏆 ${esc(s.title || 'শেয়ার করুন, পুরস্কার জিতুন')}</h2>
        ${period}
      </div>
      <details class="rounded-xl bg-emerald-50 p-3 text-sm leading-relaxed text-emerald-950" ${me?.ok ? '' : 'open'}>
        <summary class="cursor-pointer font-bold">📝 নিয়মাবলি</summary>
        <p class="nk-pre mt-2">${esc(s.rules?.trim() || DEFAULT_RULES)}</p>
      </details>
      ${me?.ok ? meHtml() : joinHtml()}
      ${boardHtml()}
      <p class="text-center text-xs text-emerald-900/50">মোট অংশগ্রহণকারী: ${bn(s.people ?? 0)}</p>`;
  }

  async function refresh() {
    await Promise.all([loadState(), store.get() ? loadMe() : Promise.resolve()]);
    if (!state.visible) { dialog!.close(); return; }
    render();
  }

  body.addEventListener('click', async (e) => {
    const t = e.target as HTMLElement;
    const tb = t.closest<HTMLElement>('[data-tab]');
    if (tb) { tab = tb.dataset.tab as typeof tab; render(); return; }
    const cp = t.closest<HTMLElement>('[data-copy]');
    if (cp) {
      const text = cp.dataset.copy!;
      try { await navigator.clipboard.writeText(text); } catch {
        const input = cp.previousElementSibling as HTMLInputElement | null;
        input?.select(); try { document.execCommand('copy'); } catch {}
      }
      cp.textContent = '✓ কপি';
      setTimeout(() => (cp.textContent = 'কপি'), 1500);
      return;
    }
    const bo = t.closest<HTMLElement>('[data-bonus]');
    if (bo && me?.code) {
      // Opens the page/group in a new tab; the point is saved once
      rpc('nusuk_camp_bonus', { p_code: me.code, p_kind: bo.dataset.bonus }, token).then(() => loadMe().then(render)).catch(() => {});
      return;
    }
    if (t.id === 'nk-cp-change') { me = null; msg = ''; render(); }
  });

  body.addEventListener('submit', async (e) => {
    const f = e.target as HTMLFormElement;
    if (f.id !== 'nk-cp-join') return;
    e.preventDefault();
    const fd = new FormData(f);
    const code = String(fd.get('code') ?? '').trim();
    const profile = String(fd.get('profile') ?? '').trim();
    if (!CODE_RE.test(code)) { msg = 'কোডটি সঠিক নয়। নুসুকের কোড NG- দিয়ে শুরু হয়, পরে ৮টি অক্ষর।'; render(); return; }
    if (!FB_RE.test(profile)) { msg = reasonText.bad_profile; render(); return; }
    f.querySelector('button')!.setAttribute('disabled', '');
    store.set({ code, profile });
    await loadMe(profile);
    if (!me?.ok) { msg = reasonText[me?.reason ?? 'closed']; if (me?.reason === 'not_found') store.set(null); me = null; }
    else msg = '';
    render();
  });

  openBtn.addEventListener('click', async () => {
    render();
    dialog.showModal();
    await refresh();
    clearInterval(poll);
    poll = setInterval(() => { if (dialog.open && document.visibilityState === 'visible') refresh(); }, 10_000);
  });
  dialog.addEventListener('close', () => clearInterval(poll));
  document.getElementById('nk-cp-close')?.addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', (e) => { if (e.target === dialog) dialog.close(); });

  (async () => {
    token = await adminToken();
    await loadState();
  })();
}
