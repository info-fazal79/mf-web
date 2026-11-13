/* /nusuk/account · member account: Google sign-in, profile, competitions, tickets, photo card + caption. */
import { useCallback, useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { ArrowLeft, Check, Clock, UserRound, Copy, Download, Gift, History, LogOut, PenLine, Share2, Sparkles, Ticket, Trophy, UserPlus, Users } from 'lucide-react';
import {
  CODE_RE, KIND_LABEL, markJoined, showOf, SAVE_ERR, bn, bnDate, bnTime, contestRules, fillCaption, memberClient, rememberRef, savedRef,
  type ClubMe, type Contest, type Member, type SaveResult,
} from '../_lib/club';
import { drawCard, cardBlob } from '../_lib/clubcard';
import { bnPlace } from '../_lib/clubdraw';

const DISTRICTS = 'ঢাকা,গাজীপুর,নারায়ণগঞ্জ,নরসিংদী,মুন্সিগঞ্জ,মানিকগঞ্জ,টাঙ্গাইল,কিশোরগঞ্জ,ফরিদপুর,গোপালগঞ্জ,মাদারীপুর,শরীয়তপুর,রাজবাড়ী,চট্টগ্রাম,কক্সবাজার,কুমিল্লা,ফেনী,নোয়াখালী,লক্ষ্মীপুর,চাঁদপুর,ব্রাহ্মণবাড়িয়া,খাগড়াছড়ি,রাঙ্গামাটি,বান্দরবান,রাজশাহী,নাটোর,নওগাঁ,চাঁপাইনবাবগঞ্জ,পাবনা,সিরাজগঞ্জ,বগুড়া,জয়পুরহাট,খুলনা,যশোর,সাতক্ষীরা,বাগেরহাট,ঝিনাইদহ,মাগুরা,নড়াইল,কুষ্টিয়া,চুয়াডাঙ্গা,মেহেরপুর,বরিশাল,পটুয়াখালী,ভোলা,পিরোজপুর,ঝালকাঠি,বরগুনা,সিলেট,মৌলভীবাজার,হবিগঞ্জ,সুনামগঞ্জ,রংপুর,দিনাজপুর,ঠাকুরগাঁও,পঞ্চগড়,নীলফামারী,লালমনিরহাট,কুড়িগ্রাম,গাইবান্ধা,ময়মনসিংহ,জামালপুর,শেরপুর,নেত্রকোনা,দেশের বাইরে'.split(',');

const DEV = 'nusuk:device:v1';
function deviceId() {
  try {
    let id = localStorage.getItem(DEV) ?? '';
    if (!/^[0-9a-f-]{36}$/i.test(id)) { id = crypto.randomUUID(); localStorage.setItem(DEV, id); }
    return id;
  } catch { return null; }
}
const errText = (e: unknown) => (e && typeof e === 'object' && 'message' in e ? String((e as { message: string }).message) : String(e));

function Shell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-[#f7f4ea] text-emerald-950">
      <header className="sticky top-0 z-40 bg-gradient-to-br from-emerald-900 to-[#032b20] text-white shadow-[0_6px_18px_-8px_rgba(2,30,22,0.55)]">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-4 py-4">
          <a href="/nusuk" className="flex items-center gap-2.5">
            <img src="/nusuk/ribat-logo-96.webp" alt="" width={40} height={40} className="h-10 w-10 rounded-full bg-[#e9ef9f] object-cover ring-2 ring-gold-400/60" />
            <div className="leading-tight">
              <div className="font-bold">Ribatul Ummah</div>
              <div className="text-xs text-emerald-100/80">নুসুক কোড শেয়ার</div>
            </div>
          </a>
          <a href="/nusuk" className="flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 text-sm font-semibold hover:bg-white/20">
            <ArrowLeft className="h-4 w-4" aria-hidden /> কোড পেজ
          </a>
        </div>
      </header>
      <main className="mx-auto grid max-w-3xl gap-4 px-4 py-5">{children}</main>
    </div>
  );
}

export default function ClubApp() {
  const [sb, setSb] = useState<SupabaseClient | null>(null);
  const [me, setMe] = useState<ClubMe | null>(null);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState(false);

  const load = useCallback(async (c: SupabaseClient) => {
    const { data, error: e } = await c.rpc('nusuk_club_me');
    if (e) { setError(errText(e)); return; }
    setError('');
    setMe(data as ClubMe);
    markJoined(Boolean((data as ClubMe).member)); // the /nusuk top bar (50 Keys offer) is hidden for members
  }, []);

  useEffect(() => {
    rememberRef();
    let off = () => {};
    memberClient().then(async (c) => {
      if (!c) { setError('Supabase is not configured'); return; }
      setSb(c);
      await c.auth.getSession(); // finishes the Google redirect (?code=…) if there is one
      if (location.search.includes('code=')) history.replaceState(null, '', location.pathname + location.hash);
      await load(c);
      const { data } = c.auth.onAuthStateChange((ev) => { if (ev === 'SIGNED_IN' || ev === 'SIGNED_OUT') load(c); });
      off = () => data.subscription.unsubscribe();
    });
    return () => off();
  }, [load]);

  if (error) return <Shell><section className="nk-card p-5 text-sm text-red-800">লোড করা যায়নি: {error}</section></Shell>;
  if (!sb || !me) return <Shell><section className="nk-card p-5 text-sm text-emerald-900/60">লোড হচ্ছে…</section></Shell>;

  const reload = () => load(sb);

  return (
    <Shell>
      <h1 className="flex items-center gap-2 text-2xl font-bold"><UserRound className="h-6 w-6 text-emerald-700" aria-hidden /> {me.member ? 'আমার অ্যাকাউন্ট' : me.signed_in ? 'অ্যাকাউন্ট সম্পূর্ণ করুন' : 'লগইন / রেজিস্টার'}</h1>

      {me.cfg.test && me.cfg.on && (
        <p className="rounded-xl border border-gold-500/60 bg-gold-400/15 px-3.5 py-2.5 text-sm font-semibold">
          টেস্ট মোড: শুধু তালিকায় থাকা ইমেইলগুলো এখন ব্যবহার করতে পারছে। সবার জন্য এখনো খোলা হয়নি।
        </p>
      )}
      {!me.signed_in && <SignIn sb={sb} cfg={me.cfg} />}
      {me.signed_in && !me.member && (me.cfg.on
        ? <ProfileForm sb={sb} email={me.email} onDone={reload} tickets={showOf(me.cfg).tickets} />
        : <section className="nk-card p-5 text-[15px]">নতুন অ্যাকাউন্ট খোলা শীঘ্রই চালু হবে, ইনশাআল্লাহ। একটু পরে আবার দেখুন।{me.email && <span className="mt-1 block text-xs text-emerald-900/60">লগইন: {me.email}</span>}</section>)}
      {me.member && !editing && <Dashboard me={me} onEdit={() => setEditing(true)} refBox={showOf(me.cfg).invite && !me.member.referred_by ? <RefLater sb={sb} myCode={me.member.nusuk_code} onDone={reload} /> : null} />}
      {me.member && editing && <ProfileForm sb={sb} member={me.member} email={me.member.email ?? undefined} onDone={async () => { setEditing(false); await reload(); }} onCancel={() => setEditing(false)} />}

      <p className="text-center text-xs text-emerald-900/60">লগইন করে আপনি আমাদের <a href="/nusuk/privacy" className="font-semibold underline">গোপনীয়তা নীতি</a> মেনে নিচ্ছেন।</p>
      {me.signed_in && (
        <button type="button" onClick={() => sb.auth.signOut()} className="mx-auto flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold text-emerald-900/70 hover:bg-emerald-900/5">
          <LogOut className="h-4 w-4" aria-hidden /> লগআউট
        </button>
      )}
    </Shell>
  );
}

function GoogleMark() {
  return (
    <svg viewBox="0 0 48 48" className="h-5 w-5" aria-hidden>
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
      <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2c-2 1.5-4.5 2.4-7.2 2.4-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
    </svg>
  );
}

function SignIn({ sb, cfg }: { sb: SupabaseClient; cfg: ClubMe['cfg'] }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [inviter, setInviter] = useState<{ name: string; sl: number } | null>(null);
  useEffect(() => {
    const r = savedRef();
    if (r) sb.rpc('nusuk_club_ref', { p_code: r }).then(({ data }) => { if (data?.ok) setInviter({ name: data.name, sl: data.sl }); });
  }, [sb]);
  async function go() {
    setBusy(true); setErr('');
    const { error } = await sb.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: `${location.origin}/nusuk/club` } });
    if (error) { setErr(errText(error)); setBusy(false); }
  }
  return (
    <section className="nk-card p-5 text-center">
      {inviter && showOf(cfg).invite && (
        <p className="mx-auto mb-4 flex max-w-md items-center justify-center gap-2 rounded-xl bg-gold-400/20 px-3 py-2 text-[15px] font-semibold">
          <UserPlus className="h-4 w-4 shrink-0" aria-hidden /> {inviter.name} (SL {bn(inviter.sl)}) আপনাকে আমন্ত্রণ জানিয়েছেন। যুক্ত হলেই পাবেন ২টি টিকিট!
        </p>
      )}
      <h2 className="text-lg font-bold">Google দিয়ে লগইন বা নতুন অ্যাকাউন্ট</h2>
      <p className="mt-1 text-sm text-emerald-900/70">এক ক্লিকেই হয়ে যাবে। কোনো পাসওয়ার্ড লাগবে না।</p>
      {!cfg.on && <p className="mt-2 text-sm text-emerald-900/70">নতুন অ্যাকাউন্ট খোলা শীঘ্রই চালু হবে, ইনশাআল্লাহ।</p>}
      <button type="button" onClick={go} disabled={busy}
        className="mx-auto mt-4 flex items-center gap-3 rounded-full border border-[#dadce0] bg-white px-6 py-3 font-semibold text-[#3c4043] shadow-sm transition hover:shadow-md disabled:opacity-60">
        <GoogleMark /> {busy ? 'অপেক্ষা করুন…' : 'Google দিয়ে লগইন'}
      </button>
      {err && <p className="mt-3 text-sm text-red-700">লগইন শুরু করা যায়নি: {err}</p>}
    </section>
  );
}

function ProfileForm({ sb, member, email, onDone, onCancel, tickets = true }: { sb: SupabaseClient; member?: Member; email?: string; onDone: () => void; onCancel?: () => void; tickets?: boolean }) {
  const isNew = !member;
  const [f, setF] = useState({
    name: member?.name ?? '',
    phone: member?.phone ?? '',
    code: member?.nusuk_code ?? '',
    district: member?.district ?? '',
    umrah: member?.umrah_done ?? '',
    consent: member?.consent ?? true,
    ref: isNew ? savedRef() : '',
  });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ t: string; ok: boolean } | null>(null);
  const set = (p: Partial<typeof f>) => setF((x) => ({ ...x, ...p }));

  async function submit(e: FormEvent) {
    e.preventDefault();
    const code = f.code.replace(/\s/g, '');
    const ref = f.ref.replace(/\s/g, '');
    if (!f.district.trim()) return setMsg({ t: 'আপনার জেলা লিখুন বা তালিকা থেকে বেছে নিন।', ok: false });
    if (isNew && !CODE_RE.test(code)) return setMsg({ t: SAVE_ERR.code, ok: false });
    setBusy(true); setMsg(null);
    const save = (withRef: boolean) => sb.rpc('nusuk_club_save', {
      p_name: f.name, p_phone: f.phone, p_code: code, p_district: f.district, p_umrah: f.umrah || null,
      p_consent: f.consent, p_ref: isNew && withRef && CODE_RE.test(ref) ? ref : null, p_device: deviceId(),
    });
    let { data, error } = await save(true);
    // the code from a shared link did not work (wrong / own code): make the account without it
    if (!error && (data as SaveResult)?.reason && ['bad_ref', 'self_ref'].includes((data as SaveResult).reason!)) ({ data, error } = await save(false));
    setBusy(false);
    if (error) return setMsg({ t: errText(error), ok: false });
    const r = data as SaveResult;
    if (!r.ok) return setMsg({ t: SAVE_ERR[r.reason ?? 'busy'], ok: false });
    if (r.created) try { localStorage.removeItem('nusuk:ref'); } catch {}
    onDone();
  }

  const label = 'mb-1 block text-sm font-semibold';
  return (
    <form onSubmit={submit} className="nk-card grid gap-4 p-4 sm:p-5">
      <div>
        <h2 className="text-lg font-bold">{isNew ? 'প্রোফাইল পূরণ করুন' : 'প্রোফাইল এডিট'}</h2>
        {isNew && <p className="mt-1 text-sm text-emerald-900/70">{tickets ? 'সেভ করলেই আপনার প্রথম টিকিট জমা হবে। আপনার নুসুক কোডটিই হবে আপনার রেফারেল কোড।' : 'তথ্যগুলো সেভ করলেই আপনার অ্যাকাউন্ট তৈরি হয়ে যাবে।'}</p>}
        {email && <p className="mt-1 text-xs text-emerald-900/60">লগইন: {email}</p>}
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <label><span className={label}>আপনার নাম *</span>
          <input className="nk-input" required maxLength={60} value={f.name} onChange={(e) => set({ name: e.target.value })} autoComplete="name" /></label>
        <label><span className={label}>মোবাইল নম্বর *</span>
          <input className="nk-input" required inputMode="tel" placeholder="01XXXXXXXXX" value={f.phone} onChange={(e) => set({ phone: e.target.value })} autoComplete="tel" />
          <span className="mt-1 block text-xs text-emerald-900/60">বিজয়ী হলে এই নম্বরে যোগাযোগ করা হবে।</span></label>
        <label className="sm:col-span-2"><span className={label}>আপনার নুসুক রেফারেল কোড *</span>
          <input className="nk-input font-mono" required={isNew} disabled={!isNew} placeholder="NG-xxxxxxxx" value={f.code} onChange={(e) => set({ code: e.target.value })} spellCheck={false} autoCapitalize="off" />
          <span className="mt-1 block text-xs text-emerald-900/60">{isNew ? 'নুসুক অ্যাপ থেকে হুবহু কপি করে দিন। পরে বদলানো যাবে না।' : 'রেফারেল কোড বদলানো যায় না (আপনার শেয়ার করা কার্ড যাতে কাজ করে)।'}</span></label>
        <label><span className={label}>জেলা *</span>
          <input className="nk-input" required list="nk-districts" value={f.district} onChange={(e) => set({ district: e.target.value })} placeholder="যেমন: ঢাকা" />
          <datalist id="nk-districts">{DISTRICTS.map((d) => <option key={d} value={d} />)}</datalist></label>
        <label><span className={label}>আগে উমরাহ করেছেন?</span>
          <select className="nk-input" value={f.umrah} onChange={(e) => set({ umrah: e.target.value as typeof f.umrah })}>
            <option value="">বেছে নিন</option>
            <option value="yes">হ্যাঁ, করেছি</option>
            <option value="planning">না, শীঘ্রই যাওয়ার ইচ্ছা আছে</option>
            <option value="no">না</option>
          </select></label>
        <label className="flex items-start gap-2.5 text-sm sm:col-span-2">
          <input type="checkbox" className="mt-1 h-4 w-4 accent-emerald-700" checked={f.consent} onChange={(e) => set({ consent: e.target.checked })} />
          রিবাতুল উম্মাহর নতুন প্রতিযোগিতা, কুইজ ও গুরুত্বপূর্ণ ঘোষণা SMS/ফোনে জানতে চাই।
        </label>
      </div>
      {msg && <p className={`rounded-xl px-3.5 py-2.5 text-sm ${msg.ok ? 'bg-emerald-100 text-emerald-900' : 'bg-red-50 text-red-800'}`}>{msg.t}</p>}
      <div className="flex flex-wrap gap-2">
        <button type="submit" disabled={busy} className="nk-btn nk-green px-5 py-2.5">{busy ? 'সেভ হচ্ছে…' : isNew ? (tickets ? 'সেভ করে টিকিট নিন' : 'সেভ করে যুক্ত হোন') : 'সেভ করুন'}</button>
        {onCancel && <button type="button" onClick={onCancel} className="nk-btn nk-ghost px-5 py-2.5">বাতিল</button>}
      </div>
    </form>
  );
}

function Stat({ icon, label, value, hint }: { icon: ReactNode; label: string; value: number; hint?: string }) {
  return (
    <div className="rounded-xl bg-emerald-50 p-3">
      <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-900/70">{icon}{label}</div>
      <div className="mt-0.5 text-2xl font-bold text-emerald-950">{bn(value)}</div>
      {hint && <div className="text-xs text-emerald-900/60">{hint}</div>}
    </div>
  );
}

/** Time left until `iso`, in Bengali */
function timeLeft(iso: string, now: number) {
  const ms = new Date(iso).getTime() - now;
  if (ms <= 0) return 'শেষ হয়েছে';
  const d = Math.floor(ms / 86400000), h = Math.floor((ms % 86400000) / 3600000), m = Math.floor((ms % 3600000) / 60000);
  return d > 0 ? `${bn(d)} দিন ${bn(h)} ঘণ্টা বাকি` : h > 0 ? `${bn(h)} ঘণ্টা ${bn(m)} মিনিট বাকি` : `${bn(Math.max(1, m))} মিনিট বাকি`;
}

function ContestRules({ c }: { c: Contest }) {
  return (
    <ul className="grid gap-1.5 text-[15px] leading-relaxed">
      {contestRules(c).map((l, i) => (
        <li key={i} className="flex gap-2.5"><Check className="mt-1 h-4 w-4 shrink-0 text-emerald-600" aria-hidden />{l}</li>
      ))}
    </ul>
  );
}

/** Before sign-up: what competitions are running */
function ContestsPreview({ contests }: { contests: Contest[] }) {
  if (!contests.length) return null;
  return (
    <>
      {contests.map((c) => (
        <section key={c.id} className="nk-card p-4 sm:p-5">
          <h2 className="flex items-center gap-2 text-lg font-bold"><Trophy className="h-5 w-5 text-emerald-700" aria-hidden /> {c.title}</h2>
          {c.info.trim() && <p className="mt-1 text-[15px] text-emerald-900/80">{c.info}</p>}
          <div className="mt-3"><ContestRules c={c} /></div>
        </section>
      ))}
    </>
  );
}

const REF_ERR: Record<string, string> = {
  bad_ref: 'এই রেফারেল কোডের কোনো সদস্য পাওয়া যায়নি। কোডটি আবার দেখুন।',
  self_ref: 'নিজের কোড দেওয়া যাবে না।',
  ref_newer: 'যিনি আপনার পরে যুক্ত হয়েছেন বা যাকে আপনি এনেছেন, তার কোড দেওয়া যাবে না।',
  has_ref: 'আপনার রেফারেল কোড আগেই যোগ করা আছে।',
  closed: 'এখন রেফারেল কোড যোগ করা বন্ধ আছে।',
  signin: 'আবার লগইন করুন।',
};

/** Add the code of the person who invited you (once) */
function RefLater({ sb, myCode, onDone }: { sb: SupabaseClient; myCode: string; onDone: () => void }) {
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  async function add(e: FormEvent) {
    e.preventDefault();
    const c = code.replace(/\s/g, '');
    if (!CODE_RE.test(c)) return setMsg('রেফারেল কোড সঠিক নয়। যেমন: NG-y3JkB7lU');
    if (c.toLowerCase() === myCode.toLowerCase()) return setMsg(REF_ERR.self_ref);
    setBusy(true); setMsg('');
    const { data, error } = await sb.rpc('nusuk_club_set_ref', { p_ref: c, p_device: deviceId() });
    setBusy(false);
    if (error) return setMsg(errText(error).includes('nusuk_club_set_ref') ? 'একটু পরে আবার চেষ্টা করুন।' : errText(error));
    const r = data as { ok: boolean; reason?: string };
    if (!r.ok) return setMsg(REF_ERR[r.reason ?? ''] ?? 'একটু পরে আবার চেষ্টা করুন।');
    onDone();
  }
  return (
    <form onSubmit={add} className="nk-card grid gap-2 p-4 sm:p-5">
      <h2 className="flex items-center gap-2 text-lg font-bold"><UserPlus className="h-5 w-5 text-emerald-700" aria-hidden /> কারো আমন্ত্রণে এসেছেন?</h2>
      <p className="text-sm text-emerald-900/70">যিনি আপনাকে পাঠিয়েছেন, তার রেফারেল কোড দিন। একবারই যোগ করা যাবে।</p>
      <div className="flex flex-wrap gap-2">
        <input className="nk-input min-w-0 flex-1 font-mono" placeholder="NG-xxxxxxxx" value={code} onChange={(e) => setCode(e.target.value)} spellCheck={false} autoCapitalize="off" aria-label="রেফারেল কোড" />
        <button type="submit" disabled={busy} className="nk-btn nk-green px-5 py-2.5">{busy ? 'যোগ হচ্ছে…' : 'যোগ করুন'}</button>
      </div>
      {msg && <p className="rounded-xl bg-red-50 px-3.5 py-2.5 text-sm text-red-800">{msg}</p>}
    </form>
  );
}

/** Progress of the Nusuk Keys sent to the member's code */
function KeysCard({ k }: { k: NonNullable<ClubMe['keys']> }) {
  const done = k.delivered >= k.keys;
  const pct = Math.min(100, Math.round((k.delivered / Math.max(1, k.keys)) * 100));
  return (
    <section className={`nk-card grid gap-2 p-4 sm:p-5 ${done ? '' : 'border-gold-500/60'}`}>
      <h2 className="flex items-center gap-2 text-lg font-bold"><Gift className="h-5 w-5 text-emerald-700" aria-hidden />
        {done ? `আপনার কোডে ${bn(k.keys)}টি Nusuk Key দেওয়া সম্পন্ন হয়েছে` : `আপনার কোডে ${bn(k.keys)}টি Nusuk Key যাচ্ছে`}
      </h2>
      <div className="h-3 overflow-hidden rounded-full bg-emerald-100" role="progressbar" aria-valuemin={0} aria-valuemax={k.keys} aria-valuenow={k.delivered}>
        <div className={`h-full rounded-full ${done ? 'bg-emerald-600' : 'bg-gold-500'} transition-all`} style={{ width: `${pct}%` }} />
      </div>
      <p className="text-sm text-emerald-900/75">
        {bn(k.keys)}টির মধ্যে <b>{bn(k.delivered)}টি</b> পৌঁছেছে
        {!done && (k.ends ? ` · ${bnDate(k.ends)}-এর মধ্যে সম্পন্ন হবে` : ' · কিছুক্ষণের মধ্যেই সম্পন্ন হবে')}
      </p>
      {!done && <p className="text-xs text-emerald-900/60">মানুষ আপনার কোড কপি করে নুসুক অ্যাপে ব্যবহার করলে Key জমা হয়। পেজ রিফ্রেশ করলে সর্বশেষ সংখ্যা দেখাবে।</p>}
    </section>
  );
}

function Dashboard({ me, onEdit, refBox }: { me: ClubMe; onEdit: () => void; refBox?: ReactNode }) {
  const m = me.member!;
  const [sel, setSel] = useState(0);
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 30000); return () => clearInterval(t); }, []);
  const show = showOf(me.cfg);
  const contests = show.contests ? me.contests : [];
  const c = contests[Math.min(sel, contests.length - 1)];
  return (
    <>
      <section className="nk-card flex flex-wrap items-center justify-between gap-3 p-4 sm:p-5">
        <div>
          <div className="text-sm text-emerald-900/70">আসসালামু আলাইকুম,</div>
          <div className="text-xl font-bold">{m.name}</div>
          <div className="mt-1 flex flex-wrap gap-2 text-sm">
            <span className="rounded-full bg-gold-400/25 px-2.5 py-0.5 font-bold">SL {bn(m.sl)}</span>
            <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 font-mono font-semibold">{m.nusuk_code}</span>
            {show.invite && m.referred_by && <span className="rounded-full bg-emerald-50 px-2.5 py-0.5">আমন্ত্রণ: {m.referred_by}</span>}
          </div>
        </div>
        <button type="button" onClick={onEdit} className="nk-btn nk-ghost flex items-center gap-2 px-4 py-2 text-sm"><PenLine className="h-4 w-4" aria-hidden /> প্রোফাইল এডিট</button>
      </section>

      {me.keys && <KeysCard k={me.keys} />}

      {refBox}

      {show.contests && !c && <section className="nk-card p-5 text-[15px]">এই মুহূর্তে কোনো প্রতিযোগিতা চলছে না। নতুন প্রতিযোগিতা শুরু হলে এখানে দেখাবে, ইনশাআল্লাহ।</section>}

      {contests.length > 1 && (
        <div className="flex gap-1 overflow-x-auto rounded-xl border border-[#e7e1cf] bg-white p-1" role="tablist" aria-label="প্রতিযোগিতা">
          {contests.map((x, i) => (
            <button key={x.id} type="button" role="tab" aria-selected={x === c} onClick={() => setSel(i)}
              className={`shrink-0 rounded-lg px-3.5 py-2 text-sm font-bold transition ${x === c ? 'bg-emerald-900 text-white' : 'text-emerald-900 hover:bg-emerald-50'}`}>
              {x.title}
            </button>
          ))}
        </div>
      )}

      {c && (
        <section className="nk-card grid gap-4 p-4 sm:p-5">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <h2 className="flex items-center gap-2 text-lg font-bold"><Trophy className="h-5 w-5 text-emerald-700" aria-hidden /> {c.title}</h2>
              {c.info.trim() && <p className="mt-0.5 text-[15px] text-emerald-900/80">{c.info}</p>}
            </div>
            {c.ends_at && <span className="flex items-center gap-1.5 rounded-full bg-gold-400/25 px-3 py-1 text-sm font-bold"><Clock className="h-4 w-4" aria-hidden />{timeLeft(c.ends_at, now)}</span>}
          </div>
          {c.kind === 'top' ? (
            <div className="grid grid-cols-2 gap-2">
              <Stat icon={<Users className="h-4 w-4" aria-hidden />} label="আপনার কোডে যুক্ত" value={c.my?.referrals ?? 0} />
              <Stat icon={<Trophy className="h-4 w-4" aria-hidden />} label="আপনার অবস্থান" value={c.my?.rank ?? 0} hint={c.my?.rank ? undefined : 'এখনো কেউ যুক্ত হননি'} />
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-2">
              <Stat icon={<Sparkles className="h-4 w-4" aria-hidden />} label="আজকের ড্রয়ের টিকিট" value={c.my?.today ?? 0} />
              <Stat icon={<Ticket className="h-4 w-4" aria-hidden />} label="মোট টিকিট" value={c.my?.total ?? 0} hint="পুরো প্রতিযোগিতায়" />
              <Stat icon={<Users className="h-4 w-4" aria-hidden />} label="আপনার কোডে যুক্ত" value={c.my?.referrals ?? 0} />
            </div>
          )}
          {c.t_copy > 0 && (
            <div className={`flex items-start gap-3 rounded-xl p-3 text-[15px] ${c.my?.copied_today ? 'bg-emerald-50' : 'bg-gold-400/15'}`}>
              <Clock className="mt-0.5 h-5 w-5 shrink-0 text-emerald-700" aria-hidden />
              <div>
                {c.my?.copied_today
                  ? <><b>আজকের কোড কপির টিকিট জমা হয়েছে।</b> কাল আবার {bnTime(c.copy_from)} – {bnTime(c.copy_to)}-এর মধ্যে কপি করুন।</>
                  : <><b>আজকের কোড কপির টিকিট এখনো নেননি।</b> {bnTime(c.copy_from)} – {bnTime(c.copy_to)}-এর মধ্যে <a href="/nusuk" className="font-bold text-emerald-700 underline">কোড পেজে</a> একটি কোড কপি করুন।{!c.in_window && ' (এখন সময়ের বাইরে)'}</>}
              </div>
            </div>
          )}
          {c.kind === 'top' && c.top && c.top.length > 0 && (
            <div>
              <h3 className="mb-2 font-bold">লিডারবোর্ড</h3>
              <ol className="grid gap-1 text-sm">
                {c.top.map((t, i) => (
                  <li key={t.sl} className={`flex items-center justify-between rounded-lg px-3 py-1.5 ${t.sl === m.sl ? 'bg-gold-400/25 font-bold' : 'bg-emerald-50'}`}>
                    <span>{bn(i + 1)}. {t.name} <span className="text-emerald-900/60">· SL {bn(t.sl)}</span></span>
                    <span>{bn(t.refs)} জন</span>
                  </li>
                ))}
              </ol>
            </div>
          )}
          {c.prizes && c.prizes.some((p) => p.prize.trim()) && (
            <div className="rounded-xl bg-gold-400/15 p-3">
              <h3 className="mb-1.5 flex items-center gap-2 font-bold"><Gift className="h-4 w-4" aria-hidden /> পুরস্কার</h3>
              <ul className="grid gap-1 text-[15px]">
                {c.prizes.filter((p) => p.prize.trim()).slice(0, 20).map((p) => <li key={p.place}><b>{bnPlace(p.place)}:</b> {p.prize}</li>)}
                {c.prizes.length > 20 && <li className="text-sm text-emerald-900/60">আরও {bn(c.prizes.length - 20)}টি পুরস্কার</li>}
              </ul>
            </div>
          )}
          <details className="rounded-xl border border-[#eee7d3] p-3">
            <summary className="cursor-pointer font-bold">এই প্রতিযোগিতার নিয়ম</summary>
            <div className="mt-2"><ContestRules c={c} /></div>
          </details>
        </section>
      )}

      {c && <ShareCard key={c.id} me={me} c={c} />}

      {show.tickets && <section className="nk-card p-4 sm:p-5">
        <h2 className="flex items-center gap-2 text-lg font-bold"><History className="h-5 w-5 text-emerald-700" aria-hidden /> টিকিটের হিসাব</h2>
        {(me.history ?? []).length === 0 && <p className="mt-2 text-sm text-emerald-900/60">এখনো কোনো টিকিট নেই।</p>}
        <ul className="mt-3 divide-y divide-[#eee7d3] text-sm">
          {(me.history ?? []).map((h, i) => (
            <li key={i} className="flex items-center justify-between gap-3 py-2">
              <span>{KIND_LABEL[h.kind]}{h.kind === 'referral' && h.from ? `: ${h.from}` : ''}<span className="block text-xs text-emerald-900/55">{h.contest}</span></span>
              <span className="shrink-0 text-emerald-900/60">+{bn(h.qty ?? 1)} · {new Date(h.at).toLocaleDateString('bn-BD', { day: 'numeric', month: 'short', timeZone: 'Asia/Dhaka' })}</span>
            </li>
          ))}
        </ul>
      </section>}
    </>
  );
}

function ShareCard({ me, c }: { me: ClubMe; c: Contest }) {
  const m = me.member!;
  const canvas = useRef<HTMLCanvasElement>(null);
  const [ready, setReady] = useState(false);
  const [note, setNote] = useState('');
  const original = fillCaption(c.caption, m, c);
  const [caption, setCaption] = useState(original);
  useEffect(() => setCaption(original), [original]);
  const canShareFile = typeof navigator !== 'undefined' && 'canShare' in navigator;

  useEffect(() => {
    if (!canvas.current) return;
    setReady(false);
    drawCard(canvas.current, {
      code: m.nusuk_code, sl: m.sl, name: m.name,
      theme: c.card.theme, headline: c.card.headline, sub: c.card.sub || c.title, line: c.card.line,
      badge: c.ends_at ? `শেষ: ${bnDate(c.ends_at)}` : undefined,
    }).then(() => setReady(true));
  }, [m.nusuk_code, m.sl, m.name, c]);

  const flash = (t: string) => { setNote(t); setTimeout(() => setNote(''), 2200); };
  async function copyCaption() {
    try { await navigator.clipboard.writeText(caption); flash('ক্যাপশন কপি হয়েছে'); } catch { flash('কপি হয়নি, লেখাটি সিলেক্ট করে কপি করুন'); }
  }
  async function download() {
    const b = canvas.current && (await cardBlob(canvas.current));
    if (!b) return;
    const a = document.createElement('a');
    a.href = URL.createObjectURL(b);
    a.download = `ribat-card-${m.sl}-${c.id}.png`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  }
  async function share() {
    const b = canvas.current && (await cardBlob(canvas.current));
    if (!b) return;
    const file = new File([b], `ribat-card-${m.sl}-${c.id}.png`, { type: 'image/png' });
    try { await navigator.clipboard.writeText(caption); } catch {}
    try {
      if (navigator.canShare?.({ files: [file] })) await navigator.share({ files: [file], text: caption });
      else await download();
      flash('ক্যাপশন কপি করা আছে, পোস্টে পেস্ট করে দিন');
    } catch { /* closed the share sheet */ }
  }

  return (
    <section className="nk-card p-4 sm:p-5">
      <h2 className="flex items-center gap-2 text-lg font-bold"><Share2 className="h-5 w-5 text-emerald-700" aria-hidden /> ফটোকার্ড ও ক্যাপশন</h2>
      <p className="mt-1 text-sm text-emerald-900/70">কার্ড ডাউনলোড করে ক্যাপশনসহ ফেসবুকে পোস্ট করুন। আপনার কোড দিয়ে যতজন যুক্ত হবেন, আপনার সুযোগ তত বাড়বে।</p>
      <div className="mt-4 grid gap-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="relative overflow-hidden rounded-xl border border-[#e7e1cf] bg-emerald-950">
          <canvas ref={canvas} className="block h-auto w-full" aria-label="আপনার ফটোকার্ড" />
          {!ready && <div className="absolute inset-0 grid place-items-center text-sm text-white/70">কার্ড তৈরি হচ্ছে…</div>}
        </div>
        <div className="grid content-start gap-2">
          <button type="button" onClick={download} disabled={!ready} className="nk-btn nk-green flex items-center justify-center gap-2 px-4 py-2.5"><Download className="h-4 w-4" aria-hidden /> কার্ড ডাউনলোড</button>
          {canShareFile && <button type="button" onClick={share} disabled={!ready} className="nk-btn nk-ghost flex items-center justify-center gap-2 px-4 py-2.5"><Share2 className="h-4 w-4" aria-hidden /> সরাসরি শেয়ার</button>}
          <textarea value={caption} onChange={(e) => setCaption(e.target.value)} rows={11} className="nk-input text-sm leading-relaxed" aria-label="ক্যাপশন (চাইলে বদলাতে পারেন)" />
          <div className="flex gap-2">
            <button type="button" onClick={copyCaption} className="nk-btn nk-ghost flex flex-1 items-center justify-center gap-2 px-4 py-2.5"><Copy className="h-4 w-4" aria-hidden /> ক্যাপশন কপি</button>
            {caption !== original && <button type="button" onClick={() => setCaption(original)} className="nk-btn nk-ghost px-3 py-2.5 text-sm">আগের মতো</button>}
          </div>
          {note && <p className="rounded-lg bg-emerald-100 px-3 py-2 text-sm font-semibold text-emerald-900" role="status">{note}</p>}
        </div>
      </div>
    </section>
  );
}
