/* /nusuk/club · Ribat Reward Club: Google sign-in, profile, ticket dashboard, photo card + caption. */
import { useCallback, useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { ArrowLeft, Check, Clock, Copy, Download, Gift, History, LogOut, PenLine, Share2, Sparkles, Ticket, UserPlus, Users } from 'lucide-react';
import {
  CODE_RE, DEFAULT_RULES, DEFAULT_TITLE, KIND_LABEL, SAVE_ERR, bn, bnTime, fillCaption, memberClient, rememberRef, savedRef,
  type ClubMe, type Member, type SaveResult,
} from '../_lib/club';
import { drawCard, cardBlob } from '../_lib/clubcard';

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
      <header className="bg-gradient-to-br from-emerald-900 to-[#032b20] text-white">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-4 py-4">
          <a href="/nusuk" className="flex items-center gap-2.5">
            <img src="/nusuk/ribat-logo-96.webp" alt="" width={40} height={40} className="h-10 w-10 rounded-full bg-white" />
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

function Rules({ text }: { text: string }) {
  const lines = (text.trim() || DEFAULT_RULES).split('\n').map((l) => l.trim()).filter(Boolean);
  return (
    <section className="nk-card p-4 sm:p-5">
      <h2 className="flex items-center gap-2 text-lg font-bold"><Ticket className="h-5 w-5 text-emerald-700" aria-hidden /> টিকিটের নিয়ম</h2>
      <ul className="mt-3 grid gap-2 text-[15px] leading-relaxed">
        {lines.map((l, i) => (
          <li key={i} className="flex gap-2.5"><Check className="mt-1 h-4 w-4 shrink-0 text-emerald-600" aria-hidden />{l}</li>
        ))}
      </ul>
    </section>
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

  const title = me.cfg.title.trim() || DEFAULT_TITLE;
  const reload = () => load(sb);

  return (
    <Shell>
      <section className="rounded-2xl bg-gradient-to-br from-emerald-800 to-emerald-950 p-5 text-white shadow-lg">
        <div className="flex items-center gap-2 text-sm font-semibold text-gold-400"><Gift className="h-4 w-4" aria-hidden /> রিবাতের সৌজন্যে</div>
        <h1 className="mt-1 text-2xl font-bold sm:text-3xl">{title}</h1>
        <p className="mt-2 text-[15px] leading-relaxed text-emerald-50/90">
          নুসুক কোড কপি করুন, বন্ধুদের যুক্ত করুন, টিকিট জমান। যত বেশি টিকিট, রিবাতের ইসলামিক পণ্য জেতার লাকি ড্রতে তত বেশি সুযোগ। অংশগ্রহণ সম্পূর্ণ ফ্রি।
        </p>
      </section>

      {!me.signed_in && <SignIn sb={sb} cfg={me.cfg} />}
      {me.signed_in && !me.member && (me.cfg.on
        ? <ProfileForm sb={sb} email={me.email} onDone={reload} />
        : <section className="nk-card p-5 text-[15px]">রিওয়ার্ড ক্লাব শীঘ্রই চালু হবে, ইনশাআল্লাহ। একটু পরে আবার দেখুন।</section>)}
      {me.member && !editing && <Dashboard me={me} onEdit={() => setEditing(true)} />}
      {me.member && editing && <ProfileForm sb={sb} member={me.member} email={me.member.email ?? undefined} onDone={async () => { setEditing(false); await reload(); }} onCancel={() => setEditing(false)} />}

      <Rules text={me.cfg.rules} />
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
      {inviter && (
        <p className="mx-auto mb-4 flex max-w-md items-center justify-center gap-2 rounded-xl bg-gold-400/20 px-3 py-2 text-[15px] font-semibold">
          <UserPlus className="h-4 w-4 shrink-0" aria-hidden /> {inviter.name} (SL {bn(inviter.sl)}) আপনাকে আমন্ত্রণ জানিয়েছেন। যুক্ত হলেই পাবেন ২টি টিকিট!
        </p>
      )}
      {!cfg.on && <p className="mb-3 text-sm text-emerald-900/70">রিওয়ার্ড ক্লাব শীঘ্রই চালু হবে। আগে থেকেই লগইন করে রাখতে পারেন।</p>}
      <h2 className="text-lg font-bold">যুক্ত হতে লগইন করুন</h2>
      <p className="mt-1 text-sm text-emerald-900/70">এক ক্লিকে Google অ্যাকাউন্ট দিয়ে। কোনো পাসওয়ার্ড লাগবে না।</p>
      <button type="button" onClick={go} disabled={busy}
        className="mx-auto mt-4 flex items-center gap-3 rounded-full border border-[#dadce0] bg-white px-6 py-3 font-semibold text-[#3c4043] shadow-sm transition hover:shadow-md disabled:opacity-60">
        <GoogleMark /> {busy ? 'অপেক্ষা করুন…' : 'Google দিয়ে লগইন'}
      </button>
      {err && <p className="mt-3 text-sm text-red-700">লগইন শুরু করা যায়নি: {err}</p>}
    </section>
  );
}

function ProfileForm({ sb, member, email, onDone, onCancel }: { sb: SupabaseClient; member?: Member; email?: string; onDone: () => void; onCancel?: () => void }) {
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
    if (isNew && !CODE_RE.test(code)) return setMsg({ t: SAVE_ERR.code, ok: false });
    if (isNew && ref && !CODE_RE.test(ref)) return setMsg({ t: 'রেফারেল কোড সঠিক নয়। যেমন: NG-y3JkB7lU (না থাকলে খালি রাখুন)', ok: false });
    setBusy(true); setMsg(null);
    const { data, error } = await sb.rpc('nusuk_club_save', {
      p_name: f.name, p_phone: f.phone, p_code: code, p_district: f.district, p_umrah: f.umrah || null,
      p_consent: f.consent, p_ref: isNew ? ref || null : null, p_device: deviceId(),
    });
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
        {isNew && <p className="mt-1 text-sm text-emerald-900/70">সেভ করলেই আপনার প্রথম টিকিট জমা হবে। আপনার নুসুক কোডটিই হবে আপনার রেফারেল কোড।</p>}
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
        <label><span className={label}>জেলা</span>
          <input className="nk-input" list="nk-districts" value={f.district} onChange={(e) => set({ district: e.target.value })} placeholder="যেমন: ঢাকা" />
          <datalist id="nk-districts">{DISTRICTS.map((d) => <option key={d} value={d} />)}</datalist></label>
        <label><span className={label}>আগে উমরাহ করেছেন?</span>
          <select className="nk-input" value={f.umrah} onChange={(e) => set({ umrah: e.target.value as typeof f.umrah })}>
            <option value="">বেছে নিন</option>
            <option value="yes">হ্যাঁ, করেছি</option>
            <option value="planning">না, শীঘ্রই যাওয়ার ইচ্ছা আছে</option>
            <option value="no">না</option>
          </select></label>
        {isNew && (
          <label className="sm:col-span-2"><span className={label}>রেফারেল কোড (যিনি আপনাকে পাঠিয়েছেন)</span>
            <input className="nk-input font-mono" placeholder="NG-xxxxxxxx (না থাকলে খালি রাখুন)" value={f.ref} onChange={(e) => set({ ref: e.target.value })} spellCheck={false} autoCapitalize="off" />
            <span className="mt-1 block text-xs text-emerald-900/60">কারো কোড দিলে আপনি ১টি বাড়তি টিকিট পাবেন, তিনিও পাবেন ১টি।</span></label>
        )}
        <label className="flex items-start gap-2.5 text-sm sm:col-span-2">
          <input type="checkbox" className="mt-1 h-4 w-4 accent-emerald-700" checked={f.consent} onChange={(e) => set({ consent: e.target.checked })} />
          রিবাতের নতুন পণ্য, অফার ও আয়োজনের খবর SMS/ফোনে জানতে চাই।
        </label>
      </div>
      {msg && <p className={`rounded-xl px-3.5 py-2.5 text-sm ${msg.ok ? 'bg-emerald-100 text-emerald-900' : 'bg-red-50 text-red-800'}`}>{msg.t}</p>}
      <div className="flex flex-wrap gap-2">
        <button type="submit" disabled={busy} className="nk-btn nk-green px-5 py-2.5">{busy ? 'সেভ হচ্ছে…' : isNew ? 'সেভ করে টিকিট নিন' : 'সেভ করুন'}</button>
        {onCancel && <button type="button" onClick={onCancel} className="nk-btn nk-ghost px-5 py-2.5">বাতিল</button>}
      </div>
    </form>
  );
}

function Stat({ icon, label, value, hint }: { icon: ReactNode; label: string; value: number; hint?: string }) {
  return (
    <div className="nk-card p-4">
      <div className="flex items-center gap-2 text-sm font-semibold text-emerald-900/70">{icon}{label}</div>
      <div className="mt-1 text-3xl font-bold text-emerald-950">{bn(value)}</div>
      {hint && <div className="mt-0.5 text-xs text-emerald-900/60">{hint}</div>}
    </div>
  );
}

function Dashboard({ me, onEdit }: { me: ClubMe; onEdit: () => void }) {
  const m = me.member!;
  const t = me.tickets!;
  const win = `${bnTime(me.cfg.copy_from)} – ${bnTime(me.cfg.copy_to)}`;
  return (
    <>
      <section className="nk-card flex flex-wrap items-center justify-between gap-3 p-4 sm:p-5">
        <div>
          <div className="text-sm text-emerald-900/70">আসসালামু আলাইকুম,</div>
          <div className="text-xl font-bold">{m.name}</div>
          <div className="mt-1 flex flex-wrap gap-2 text-sm">
            <span className="rounded-full bg-gold-400/25 px-2.5 py-0.5 font-bold">SL {bn(m.sl)}</span>
            <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 font-mono font-semibold">{m.nusuk_code}</span>
            {m.referred_by && <span className="rounded-full bg-emerald-50 px-2.5 py-0.5">আমন্ত্রণ: {m.referred_by}</span>}
          </div>
        </div>
        <button type="button" onClick={onEdit} className="nk-btn nk-ghost flex items-center gap-2 px-4 py-2 text-sm"><PenLine className="h-4 w-4" aria-hidden /> প্রোফাইল এডিট</button>
      </section>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Stat icon={<Sparkles className="h-4 w-4" aria-hidden />} label="আজকের টিকিট" value={t.today} hint="আজকের লাকি ড্রতে" />
        <Stat icon={<Ticket className="h-4 w-4" aria-hidden />} label="মোট টিকিট" value={t.total} />
        <Stat icon={<Users className="h-4 w-4" aria-hidden />} label="আপনার কোডে যুক্ত" value={t.referrals} hint={t.referrals_today ? `আজ ${bn(t.referrals_today)} জন` : undefined} />
      </div>

      <section className={`nk-card flex items-start gap-3 p-4 ${t.copied_today ? 'bg-emerald-50' : ''}`}>
        <Clock className="mt-0.5 h-5 w-5 shrink-0 text-emerald-700" aria-hidden />
        <div className="text-[15px]">
          {t.copied_today
            ? <><b>আজকের কোড কপির টিকিট জমা হয়েছে।</b> কাল আবার {win}-এর মধ্যে কপি করে নতুন টিকিট নিন।</>
            : <><b>আজকের কোড কপির টিকিট এখনো নেননি।</b> প্রতিদিন {win}-এর মধ্যে <a href="/nusuk" className="font-bold text-emerald-700 underline">কোড পেজে</a> একটি কোড কপি করলেই ১টি টিকিট।{!me.in_window && ' (এখন সময়ের বাইরে)'}</>}
        </div>
      </section>

      <ShareCard me={me} />

      <section className="nk-card p-4 sm:p-5">
        <h2 className="flex items-center gap-2 text-lg font-bold"><History className="h-5 w-5 text-emerald-700" aria-hidden /> টিকিটের হিসাব</h2>
        <ul className="mt-3 divide-y divide-[#eee7d3] text-sm">
          {(me.history ?? []).map((h, i) => (
            <li key={i} className="flex items-center justify-between gap-3 py-2">
              <span>{KIND_LABEL[h.kind]}{h.kind === 'referral' && h.from ? `: ${h.from}` : ''}</span>
              <span className="shrink-0 text-emerald-900/60">+১ · {new Date(h.at).toLocaleDateString('bn-BD', { day: 'numeric', month: 'short', timeZone: 'Asia/Dhaka' })}</span>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}

function ShareCard({ me }: { me: ClubMe }) {
  const m = me.member!;
  const canvas = useRef<HTMLCanvasElement>(null);
  const [ready, setReady] = useState(false);
  const [note, setNote] = useState('');
  const caption = fillCaption(me.cfg.caption, m);
  const canShareFile = typeof navigator !== 'undefined' && 'canShare' in navigator;

  useEffect(() => {
    if (!canvas.current) return;
    setReady(false);
    drawCard(canvas.current, { code: m.nusuk_code, sl: m.sl, name: m.name, line: me.cfg.card_line }).then(() => setReady(true));
  }, [m.nusuk_code, m.sl, m.name, me.cfg.card_line]);

  const flash = (t: string) => { setNote(t); setTimeout(() => setNote(''), 2200); };
  async function copyCaption() {
    try { await navigator.clipboard.writeText(caption); flash('ক্যাপশন কপি হয়েছে'); } catch { flash('কপি হয়নি, লেখাটি সিলেক্ট করে কপি করুন'); }
  }
  async function download() {
    const b = canvas.current && (await cardBlob(canvas.current));
    if (!b) return;
    const a = document.createElement('a');
    a.href = URL.createObjectURL(b);
    a.download = `ribat-card-${m.sl}.png`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  }
  async function share() {
    const b = canvas.current && (await cardBlob(canvas.current));
    if (!b) return;
    const file = new File([b], `ribat-card-${m.sl}.png`, { type: 'image/png' });
    try { await navigator.clipboard.writeText(caption); } catch {}
    try {
      if (navigator.canShare?.({ files: [file] })) await navigator.share({ files: [file], text: caption });
      else await download();
      flash('ক্যাপশন কপি করা আছে, পোস্টে পেস্ট করে দিন');
    } catch { /* closed the share sheet */ }
  }

  return (
    <section className="nk-card p-4 sm:p-5">
      <h2 className="flex items-center gap-2 text-lg font-bold"><Share2 className="h-5 w-5 text-emerald-700" aria-hidden /> আপনার ফটোকার্ড ও ক্যাপশন</h2>
      <p className="mt-1 text-sm text-emerald-900/70">কার্ড ডাউনলোড করে ক্যাপশনসহ ফেসবুকে পোস্ট করুন। আপনার কোড দিয়ে যতজন যুক্ত হবেন, ততটি টিকিট আপনার।</p>
      <div className="mt-4 grid gap-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="relative overflow-hidden rounded-xl border border-[#e7e1cf] bg-emerald-950">
          <canvas ref={canvas} className="block h-auto w-full" aria-label="আপনার ফটোকার্ড" />
          {!ready && <div className="absolute inset-0 grid place-items-center text-sm text-white/70">কার্ড তৈরি হচ্ছে…</div>}
        </div>
        <div className="grid content-start gap-2">
          <button type="button" onClick={download} disabled={!ready} className="nk-btn nk-green flex items-center justify-center gap-2 px-4 py-2.5"><Download className="h-4 w-4" aria-hidden /> কার্ড ডাউনলোড</button>
          {canShareFile && <button type="button" onClick={share} disabled={!ready} className="nk-btn nk-ghost flex items-center justify-center gap-2 px-4 py-2.5"><Share2 className="h-4 w-4" aria-hidden /> সরাসরি শেয়ার</button>}
          <textarea readOnly value={caption} rows={11} className="nk-input text-sm leading-relaxed" onFocus={(e) => e.target.select()} aria-label="ক্যাপশন" />
          <button type="button" onClick={copyCaption} className="nk-btn nk-ghost flex items-center justify-center gap-2 px-4 py-2.5"><Copy className="h-4 w-4" aria-hidden /> ক্যাপশন কপি</button>
          {note && <p className="rounded-lg bg-emerald-100 px-3 py-2 text-sm font-semibold text-emerald-900" role="status">{note}</p>}
        </div>
      </div>
    </section>
  );
}
