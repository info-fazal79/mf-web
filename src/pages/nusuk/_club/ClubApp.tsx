/* /nusuk/account · member account: Google sign-in, profile, competitions, tickets, photo card + caption. */
import { useCallback, useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { ArrowLeft, Check, Clock, UserRound, Copy, Download, Gift, History, LogOut, PenLine, Share2, Sparkles, Ticket, Trophy, UserPlus, Users } from 'lucide-react';
import {
  CODE_RE, KIND_LABEL, SIMPLE_CARD_LINE, markJoined, setMyDistrict, showOf, SAVE_ERR, bn, bnDate, bnTime, contestRules, fillCaption, memberClient, refLink, rememberRef, savedRef,
  type ClubMe, type Contest, type Member, type SaveResult,
} from '../_lib/club';
import { drawCard, cardBlob } from '../_lib/clubcard';
import { bnPlace } from '../_lib/clubdraw';
import { rememberMyCode } from '../_lib/photocard';
import { browserFp } from '../_lib/cq';
import { CampaignBanner, CompetitionView, useCq } from './QuizPanel';

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
    markJoined(Boolean((data as ClubMe).member));
    if ((data as ClubMe).member) setMyDistrict((data as ClubMe).member!.district ?? ''); // pin on the /nusuk district map
    if ((data as ClubMe).member?.nusuk_code) rememberMyCode((data as ClubMe).member!.nusuk_code); // photo card on /nusuk // the /nusuk top bar (50 Keys offer) is hidden for members
    // remember which browser the member uses (one account per device; look-alike list for the admin)
    if ((data as ClubMe).member) browserFp().then((fp) => c.rpc('nusuk_cq_seen', { p_device: deviceId(), p_fp: fp })).catch(() => {});
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
        ? <DeviceGate sb={sb}><ProfileForm sb={sb} email={me.email} onDone={reload} tickets={showOf(me.cfg).tickets} /></DeviceGate>
        : <section className="nk-card p-5 text-[15px]">নতুন অ্যাকাউন্ট খোলা শীঘ্রই চালু হবে, ইনশাআল্লাহ। একটু পরে আবার দেখুন।{me.email && <span className="mt-1 block text-xs text-emerald-900/60">লগইন: {me.email}</span>}</section>)}
      {me.member && !editing && <Dashboard sb={sb} me={me} onEdit={() => setEditing(true)} refBox={showOf(me.cfg).invite && !me.member.referred_by ? <RefLater sb={sb} myCode={me.member.nusuk_code} onDone={reload} /> : null} />}
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

/** One account per device: a second Google account on this browser is asked to use the first one */
function DeviceGate({ sb, children }: { sb: SupabaseClient; children: ReactNode }) {
  const [owner, setOwner] = useState<{ taken: boolean; email?: string } | null>(null);
  useEffect(() => {
    sb.rpc('nusuk_club_device_owner', { p_device: deviceId() }).then(({ data, error }) => setOwner(error ? { taken: false } : (data as { taken: boolean; email?: string })));
  }, [sb]);
  if (!owner) return <section className="nk-card p-5 text-sm text-emerald-900/60">একটু অপেক্ষা করুন…</section>;
  if (!owner.taken) return <>{children}</>;
  return (
    <section className="nk-card grid gap-3 border-gold-500/70 p-5 text-[15px]">
      <h2 className="text-lg font-bold">এই ফোনে আগেই একটি অ্যাকাউন্ট আছে</h2>
      <p>এই ফোন/ব্রাউজার থেকে আগেই {owner.email ? <b className="font-mono">{owner.email}</b> : 'অন্য একটি Google অ্যাকাউন্ট'} দিয়ে অ্যাকাউন্ট খোলা হয়েছে। একজন ব্যক্তি একটিই অ্যাকাউন্ট রাখতে পারেন।</p>
      <p>দয়া করে লগআউট করে সেই Google অ্যাকাউন্ট দিয়েই লগইন করুন।</p>
      <button type="button" onClick={() => sb.auth.signOut()} className="nk-btn nk-green w-fit px-5 py-2.5">লগআউট করে আগের অ্যাকাউন্টে যান</button>
    </section>
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
    if (error) return setMsg({ t: errText(error).includes('device_taken') ? 'এই ফোন থেকে আগেই একটি অ্যাকাউন্ট খোলা হয়েছে। সেই Google অ্যাকাউন্ট দিয়ে লগইন করুন।' : errText(error), ok: false });
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

function Dashboard({ sb, me, onEdit, refBox }: { sb: SupabaseClient; me: ClubMe; onEdit: () => void; refBox?: ReactNode }) {
  const m = me.member!;
  const cq = useCq(sb);
  const [view, setView] = useState<'home' | 'comp'>(() => (typeof location !== 'undefined' && location.hash === '#competition' ? 'comp' : 'home'));
  const quiz = me.contests.find((x) => x.kind === 'quiz');
  const go = (v: 'home' | 'comp') => {
    setView(v);
    history.replaceState(null, '', v === 'comp' ? '#competition' : location.pathname);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  if (view === 'comp' && cq.d?.campaign) {
    return <CompetitionView sb={sb} cq={cq} onBack={() => go('home')} share={quiz ? <ShareCard key={quiz.id} me={me} simple={cq.d.campaign.mode === 'simple'} c={{ ...quiz, caption: cq.d.campaign.caption, card: cq.d.campaign.card }} /> : null} />;
  }

  const my = cq.d?.my;
  const joined = new Date(m.joined).toLocaleDateString('bn-BD', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Dhaka' });
  return (
    <>
      {/* profile */}
      <section className="nk-card overflow-hidden p-0">
        <div className="nk-quiz-head px-4 pt-5 pb-14 text-white sm:px-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-sm text-emerald-50/80">আসসালামু আলাইকুম,</div>
              <div className="text-2xl font-bold">{m.name}</div>
            </div>
            <button type="button" onClick={onEdit} className="nk-quiz-icon flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-semibold"><PenLine className="h-4 w-4" aria-hidden /> এডিট</button>
          </div>
        </div>
        <div className="-mt-10 grid gap-3 px-4 pb-4 sm:px-5">
          <div className="grid grid-cols-2 gap-2 rounded-2xl border border-[#eee7d3] bg-white p-3 text-sm shadow-sm sm:grid-cols-4">
            <div><div className="text-xs text-emerald-900/60">সদস্য নম্বর</div><div className="font-bold">SL {bn(m.sl)}</div></div>
            <div className="min-w-0"><div className="text-xs text-emerald-900/60">নুসুক কোড</div><div className="truncate font-mono font-bold">{m.nusuk_code}</div></div>
            <div><div className="text-xs text-emerald-900/60">জেলা</div><div className="font-bold">{m.district || '—'}</div></div>
            <div><div className="text-xs text-emerald-900/60">সদস্য হয়েছেন</div><div className="font-bold">{joined}</div></div>
          </div>
          {showOf(me.cfg).invite && m.referred_by && <p className="text-sm text-emerald-900/70">আপনাকে আমন্ত্রণ জানিয়েছেন: <b>{m.referred_by}</b></p>}
        </div>
      </section>

      {/* my code */}
      <section className="nk-card grid gap-3 p-4 sm:p-5">
        <h2 className="flex items-center gap-2 text-lg font-bold"><Sparkles className="h-5 w-5 text-emerald-700" aria-hidden /> আমার কোডের হিসাব</h2>
        <div className="grid grid-cols-2 gap-2.5">
          <div className="rounded-2xl border border-gold-500/40 bg-gold-400/15 p-3.5">
            <div className="flex items-center gap-2 text-[13px] font-semibold text-emerald-900/75"><span className="grid h-8 w-8 place-items-center rounded-full bg-gold-400 text-emerald-950"><Copy className="h-4 w-4" aria-hidden /></span>কোড কপি হয়েছে</div>
            <div className="mt-1.5 text-3xl font-bold">{my ? bn(my.copies) : '…'}</div>
            <div className="text-xs text-emerald-900/65">এই সাইট থেকে আপনার কোড যতবার কপি হয়েছে</div>
          </div>
          <div className="rounded-2xl border border-emerald-100 bg-emerald-50/70 p-3.5">
            <div className="flex items-center gap-2 text-[13px] font-semibold text-emerald-900/75"><span className="grid h-8 w-8 place-items-center rounded-full bg-emerald-800 text-white"><Gift className="h-4 w-4" aria-hidden /></span>স্পন্সরে পাওয়া Key</div>
            <div className="mt-1.5 text-3xl font-bold">{my ? bn(my.gift_keys) : '…'}</div>
            <div className="text-xs text-emerald-900/65">রিবাতের পক্ষ থেকে আপনার কোডে পাঠানো</div>
          </div>
        </div>
      </section>

      {me.keys && <KeysCard k={me.keys} />}

      {/* competition */}
      <CampaignBanner d={cq.d} onOpen={() => go('comp')} />

      {/* a simple quiz has no referral keys, so the referral link would only confuse */}
      {cq.d?.campaign?.mode !== 'simple' && <RefLinkBox code={m.nusuk_code} refs={my?.refs ?? 0} keys={my?.ref_keys ?? 0} />}

      {refBox}
    </>
  );
}

/** The member's own referral link, ready to copy or share */
function RefLinkBox({ code, refs, keys }: { code: string; refs: number; keys: number }) {
  const link = refLink(code);
  const [note, setNote] = useState('');
  async function copy() {
    try { await navigator.clipboard.writeText(link); setNote('লিংক কপি হয়েছে'); } catch { setNote('লিংকটি সিলেক্ট করে কপি করুন'); }
    setTimeout(() => setNote(''), 2000);
  }
  async function share() {
    try { await navigator.share({ title: 'রিবাত ইসলামিক কুইজ', text: 'আমার লিংক দিয়ে অ্যাকাউন্ট খুললে আপনিও পাবেন ১টি বাড়তি চাবি:', url: link }); } catch { /* closed */ }
  }
  return (
    <section className="nk-card grid gap-3 p-4 sm:p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1">
          <h2 className="flex items-center gap-2 text-lg font-bold"><UserPlus className="h-5 w-5 text-emerald-700" aria-hidden /> আমার রেফারেল লিংক</h2>
          <p className="mt-0.5 text-sm text-emerald-900/70">এই লিংকে কেউ অ্যাকাউন্ট খুললে আপনি ও তিনি দুজনেই ১টি করে বাড়তি চাবি পাবেন।</p>
        </div>
        <div className="flex gap-2 text-center">
          <div className="rounded-xl bg-emerald-50 px-3 py-1.5"><div className="text-lg font-bold">{bn(refs)}</div><div className="text-[11px] text-emerald-900/65">যুক্ত হয়েছেন</div></div>
          <div className="rounded-xl bg-gold-400/20 px-3 py-1.5"><div className="text-lg font-bold">{bn(keys)}</div><div className="text-[11px] text-emerald-900/65">বাড়তি চাবি</div></div>
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <input readOnly value={link} onFocus={(e) => e.target.select()} className="nk-input min-w-0 flex-1 font-mono text-sm" aria-label="রেফারেল লিংক" />
        <button type="button" onClick={copy} className="nk-btn nk-green flex items-center gap-1.5 px-4 py-2.5"><Copy className="h-4 w-4" aria-hidden /> কপি</button>
        {typeof navigator !== 'undefined' && 'share' in navigator && <button type="button" onClick={share} className="nk-btn nk-ghost flex items-center gap-1.5 px-4 py-2.5"><Share2 className="h-4 w-4" aria-hidden /> শেয়ার</button>}
      </div>
      {note && <p className="text-sm font-semibold text-emerald-800" role="status">{note}</p>}
    </section>
  );
}

function ShareCard({ me, c, simple = false }: { me: ClubMe; c: Contest; simple?: boolean }) {
  const m = me.member!;
  const canvas = useRef<HTMLCanvasElement>(null);
  const [ready, setReady] = useState(false);
  const [note, setNote] = useState('');
  // a simple quiz: caption from the simple template unless the admin wrote one with a referral link in mind
  const original = fillCaption(simple && /\{ref_link\}|বাড়তি চাবি/.test(c.caption) ? '' : c.caption, m, c, simple);
  const [caption, setCaption] = useState(original);
  useEffect(() => setCaption(original), [original]);
  const canShareFile = typeof navigator !== 'undefined' && 'canShare' in navigator;

  useEffect(() => {
    if (!canvas.current) return;
    setReady(false);
    drawCard(canvas.current, {
      code: m.nusuk_code, sl: m.sl, name: m.name,
      theme: c.card.theme, headline: c.card.headline, sub: c.card.sub || c.title,
      line: c.card.line || (simple ? SIMPLE_CARD_LINE : c.kind === 'quiz' ? 'এই লিংকে যুক্ত হলে আপনিও পাবেন ১টি বাড়তি চাবি' : undefined),
      site: simple,
      badge: c.ends_at ? `শেষ: ${bnDate(c.ends_at)}` : undefined,
    }).then(() => setReady(true));
  }, [m.nusuk_code, m.sl, m.name, c, simple]);

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
