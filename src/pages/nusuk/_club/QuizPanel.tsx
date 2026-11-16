/* /nusuk/account · Ribat quiz competition for a member (update_44 / 45):
   the campaign banner on the dashboard, and the competition page: my numbers, rules,
   today's question times, extra (referral) keys, prizes, then the photo card.
   The question screen asks for the pledge first, gives N seconds, and leaving the page cancels it. */
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { ArrowLeft, ArrowRight, CalendarClock, CheckCircle2, Clock, Gift, Hourglass, KeyRound, Lock, ScrollText, Sparkles, Ticket, Trophy, Users, XCircle } from 'lucide-react';
import { DEFAULT_PLEDGE, QUIZ_RULES, SIMPLE_QUIZ_RULES, bn, bnDate, bnTime } from '../_lib/club';
import { MEDAL, placeName, shownPrizes } from '../_lib/prizes';
import { OPEN_ERR, leaveBeacon, timeBn, type CqAnswer, type CqMe, type CqOpen, type CqSlot } from '../_lib/cq';

const errText = (e: unknown) => (e && typeof e === 'object' && 'message' in e ? String((e as { message: string }).message) : String(e));
const MARKS = ['ক', 'খ', 'গ', 'ঘ', 'ঙ', 'চ'];

const SLOT_LOOK: Record<CqSlot['status'], { t: string; cls: string; icon: ReactNode }> = {
  upcoming: { t: 'খুলবে', cls: 'bg-[#f1ede1] text-emerald-900/70', icon: <Lock className="h-4 w-4" aria-hidden /> },
  ready: { t: 'এখন খোলা', cls: 'bg-gold-400/30 text-emerald-950', icon: <Sparkles className="h-4 w-4" aria-hidden /> },
  open: { t: 'চলছে', cls: 'bg-gold-400/30 text-emerald-950', icon: <Hourglass className="h-4 w-4" aria-hidden /> },
  right: { t: 'সঠিক · +১ টিকিট', cls: 'bg-emerald-100 text-emerald-900', icon: <CheckCircle2 className="h-4 w-4" aria-hidden /> },
  wrong: { t: 'ভুল উত্তর', cls: 'bg-red-50 text-red-800', icon: <XCircle className="h-4 w-4" aria-hidden /> },
  late: { t: 'সময় শেষ হয়েছিল', cls: 'bg-red-50 text-red-800', icon: <Clock className="h-4 w-4" aria-hidden /> },
  left: { t: 'পেজ ছাড়ায় বাতিল', cls: 'bg-red-50 text-red-800', icon: <XCircle className="h-4 w-4" aria-hidden /> },
  missed: { t: 'সময় পেরিয়ে গেছে', cls: 'bg-[#f1ede1] text-emerald-900/55', icon: <Clock className="h-4 w-4" aria-hidden /> },
};

/** The member's quiz data; reloads itself when a question time starts or ends (no polling) */
export function useCq(sb: SupabaseClient) {
  const [d, setD] = useState<CqMe | null>(null);
  const [err, setErr] = useState('');
  const [now, setNow] = useState(Date.now());
  const skew = useRef(0);
  const load = useCallback(async () => {
    const { data, error } = await sb.rpc('nusuk_cq_me');
    if (error) { setErr(errText(error)); return; }
    setErr('');
    const x = data as CqMe | null;
    if (x?.now) skew.current = new Date(x.now).getTime() - Date.now();
    setD(x);
  }, [sb]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 20_000); return () => clearInterval(t); }, []);
  useEffect(() => {
    if (!d?.slots) return;
    const t = now + skew.current;
    const edges = d.slots.flatMap((s) => [new Date(s.from).getTime(), new Date(s.to).getTime()]).filter((x) => x > t);
    if (!edges.length) return;
    const wait = Math.min(...edges) - t + 1500;
    if (wait > 2 ** 31 - 1) return;
    const id = setTimeout(load, wait);
    return () => clearTimeout(id);
  }, [d, load, now]);
  return { d, err, load, now, skew: skew.current };
}

function Tile({ icon, label, value, hint, tone = 'green' }: { icon: ReactNode; label: string; value: number; hint?: ReactNode; tone?: 'green' | 'gold' }) {
  return (
    <div className={`rounded-2xl border p-3.5 ${tone === 'gold' ? 'border-gold-500/40 bg-gold-400/15' : 'border-emerald-100 bg-emerald-50/70'}`}>
      <div className="flex items-center gap-2 text-[13px] font-semibold text-emerald-900/75">
        <span className={`grid h-8 w-8 place-items-center rounded-full ${tone === 'gold' ? 'bg-gold-400 text-emerald-950' : 'bg-emerald-800 text-white'}`}>{icon}</span>{label}
      </div>
      <div className="mt-1.5 text-3xl font-bold text-emerald-950">{bn(value)}</div>
      {hint && <div className="mt-0.5 text-xs text-emerald-900/65">{hint}</div>}
    </div>
  );
}

/** Dashboard: a big banner while a campaign runs, a calm card when none does */
export function CampaignBanner({ d, onOpen }: { d: CqMe | null; onOpen: () => void }) {
  const c = d?.campaign;
  if (!c) {
    return (
      <section className="nk-card flex items-center gap-4 p-5">
        <span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-emerald-50 text-emerald-700"><Trophy className="h-7 w-7" aria-hidden /></span>
        <div>
          <h2 className="text-lg font-bold">এখন কোনো প্রতিযোগিতা চলছে না</h2>
          <p className="mt-0.5 text-[15px] text-emerald-900/70">নতুন প্রতিযোগিতা শুরু হলে এখানে ব্যানার দেখাবে, ইনশাআল্লাহ। আপনার রেফারেল লিংক শেয়ার করে বাড়তি চাবি জমিয়ে রাখুন।</p>
        </div>
      </section>
    );
  }
  const ready = (d?.slots ?? []).filter((s) => s.status === 'ready').length;
  const next = (d?.slots ?? []).find((s) => s.status === 'upcoming');
  return (
    <section className="nk-quiz-head overflow-hidden rounded-[1.25rem] p-5 text-white shadow-lg ring-1 ring-gold-400/40">
      <div className="flex items-start gap-4">
        <span className="nk-quiz-icon grid h-14 w-14 shrink-0 place-items-center rounded-2xl text-gold-100"><Trophy className="h-7 w-7" aria-hidden /></span>
        <div className="min-w-0 flex-1">
          <span className="inline-block rounded-full bg-gold-400 px-2.5 py-0.5 text-xs font-bold text-emerald-950">চলমান প্রতিযোগিতা</span>
          <h2 className="mt-1.5 text-xl font-bold leading-snug">{c.title}</h2>
          {c.info.trim() && <p className="mt-1 text-[15px] text-emerald-50/85">{c.info}</p>}
        </div>
      </div>
      <div className="mt-4 flex flex-wrap gap-2 text-sm">
        {c.ends_at && <span className="nk-quiz-icon flex items-center gap-1.5 rounded-full px-3 py-1"><CalendarClock className="h-4 w-4" aria-hidden />শেষ: {bnDate(c.ends_at)}</span>}
        <span className="nk-quiz-icon flex items-center gap-1.5 rounded-full px-3 py-1"><Ticket className="h-4 w-4" aria-hidden />আপনার টিকিট {bn(d?.my.tickets ?? 0)}টি</span>
        {ready > 0
          ? <span className="flex items-center gap-1.5 rounded-full bg-gold-400 px-3 py-1 font-bold text-emerald-950"><Sparkles className="h-4 w-4" aria-hidden />এখন {bn(ready)}টি প্রশ্ন খোলা</span>
          : next && <span className="nk-quiz-icon flex items-center gap-1.5 rounded-full px-3 py-1"><Clock className="h-4 w-4" aria-hidden />পরের প্রশ্ন {timeBn(next.from)}-এ</span>}
      </div>
      <button type="button" onClick={onOpen} className="nk-btn nk-gold mt-4 flex w-full items-center justify-center gap-2 py-3.5 text-base shadow-lg">
        প্রতিযোগিতায় অংশ নিন <ArrowRight className="h-5 w-5" aria-hidden />
      </button>
    </section>
  );
}

type Flow = { kind: 'slot' | 'ref'; slot?: number } | null;

/** The competition page */
export function CompetitionView({ sb, cq, onBack, share }: { sb: SupabaseClient; cq: ReturnType<typeof useCq>; onBack: () => void; share?: ReactNode }) {
  const [flow, setFlow] = useState<Flow>(null);
  const { d, load, now, skew } = cq;
  if (!d?.campaign) return null;
  const c = d.campaign;
  const my = d.my;
  const t = now + skew;
  const slots = d.slots ?? [];
  const next = slots.find((s) => s.status === 'upcoming');
  const readyCount = slots.filter((s) => s.status === 'ready').length;
  const ref = d.ref!;
  const simple = c.mode === 'simple'; // a one-off quiz: daily keys only, nothing about referrals
  const refLeftToday = Math.max(0, ref.per_day - ref.used_today);
  const canRef = ref.keys > 0 && ref.in_window && refLeftToday > 0 && !c.full;
  const target = c.rule !== 'date' && c.target > 0 ? c.target : 0;
  const progress = target ? (c.rule === 'people' ? c.totals.people : c.totals.tickets) : 0;
  const rules = (d.rules?.trim() || (c.mode === 'simple' ? SIMPLE_QUIZ_RULES : QUIZ_RULES)).split('\n').filter((l) => l.trim());

  return (
    <>
      <button type="button" onClick={onBack} className="flex w-fit items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-semibold text-emerald-800 hover:bg-emerald-900/5"><ArrowLeft className="h-4 w-4" aria-hidden /> ড্যাশবোর্ডে ফিরুন</button>

      <section className="nk-quiz-head overflow-hidden rounded-[1.25rem] p-5 text-white shadow-lg">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <h1 className="flex items-center gap-2 text-xl font-bold"><Trophy className="h-6 w-6 text-gold-100" aria-hidden /> {c.title}</h1>
          {c.ends_at && <span className="nk-quiz-icon flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-bold"><Clock className="h-4 w-4" aria-hidden />শেষ: {bnDate(c.ends_at)}</span>}
        </div>
        {c.info.trim() && <p className="mt-1 text-[15px] text-emerald-50/85">{c.info}</p>}
        {target > 0 && (
          <div className="mt-3">
            <div className="mb-1 flex justify-between text-xs text-emerald-50/85">
              <span>{c.rule === 'people' ? 'অংশগ্রহণকারী' : 'মোট টিকিট'}: {bn(progress)} / {bn(target)}</span>
              <span>লক্ষ্য পূর্ণ হলেই ড্র</span>
            </div>
            <div className="h-2.5 overflow-hidden rounded-full bg-white/15"><div className="h-full rounded-full bg-gold-400" style={{ width: `${Math.min(100, (progress / target) * 100)}%` }} /></div>
          </div>
        )}
        {c.full && <p className="mt-3 rounded-xl bg-gold-400 px-3 py-2 text-sm font-bold text-emerald-950">🎉 লক্ষ্য পূর্ণ হয়েছে! লাইভ ড্রয়ের অপেক্ষায় থাকুন।</p>}
      </section>

      {shownPrizes(c.prizes).length > 0 && (
        <section className="nk-card grid gap-3 p-4 sm:p-5">
          <h2 className="flex items-center gap-2 text-lg font-bold"><Gift className="h-5 w-5 text-emerald-700" aria-hidden /> পুরস্কার</h2>
          <div className={`grid gap-3 ${shownPrizes(c.prizes).length === 1 ? '' : shownPrizes(c.prizes).length === 2 ? 'grid-cols-2' : 'grid-cols-2 sm:grid-cols-3'}`}>
            {shownPrizes(c.prizes).map((p) => (
              <div key={p.place} className={`nk-prize ${p.place === 1 ? 'nk-prize-first' : ''}`}>
                <span className="nk-prize-place">{MEDAL(p.place)} {placeName(p.place)}</span>
                <div className="nk-prize-img">{p.img ? <img src={p.img} alt="" loading="lazy" /> : <span aria-hidden>🎁</span>}</div>
                <div className="nk-prize-name">{p.prize}</div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* 1. my numbers in this competition */}
      <section className="nk-card grid gap-3 p-4 sm:p-5">
        <h2 className="flex items-center gap-2 text-lg font-bold"><Sparkles className="h-5 w-5 text-emerald-700" aria-hidden /> এই প্রতিযোগিতায় আপনার অবস্থান</h2>
        <div className="grid grid-cols-2 gap-2.5">
          <Tile tone="gold" icon={<Ticket className="h-4 w-4" aria-hidden />} label="মোট টিকিট" value={my.tickets ?? 0} hint="যত বেশি টিকিট, তত বেশি সুযোগ" />
          <Tile tone="gold" icon={<CalendarClock className="h-4 w-4" aria-hidden />} label="আজকের টিকিট" value={my.tickets_today ?? 0}
            hint={simple ? `আজকের ${bn(slots.length)}টি প্রশ্ন থেকে` : <>দৈনিক প্রশ্নে {bn(my.today_slot ?? 0)} · বাড়তি চাবিতে {bn(my.today_ref ?? 0)}</>} />
          <Tile icon={<CheckCircle2 className="h-4 w-4" aria-hidden />} label="সঠিক উত্তর" value={my.correct} hint={`মোট উত্তর ${bn(my.answered)}টি · আজ ${bn(my.answered_today ?? 0)}টি`} />
          {simple
            ? <Tile icon={<KeyRound className="h-4 w-4" aria-hidden />} label="আজ প্রশ্ন বাকি" value={slots.filter((s) => s.status === 'upcoming' || s.status === 'ready').length} hint={`মোট ${bn(slots.length)}টি প্রশ্ন`} />
            : <>
              <Tile icon={<Users className="h-4 w-4" aria-hidden />} label="আমার লিংকে যুক্ত" value={my.refs} hint="নতুন সদস্য" />
              <Tile icon={<KeyRound className="h-4 w-4" aria-hidden />} label="বাড়তি চাবি হাতে" value={ref.keys} hint={`এ পর্যন্ত পেয়েছেন ${bn(my.ref_earned)}টি`} />
              <Tile icon={<Gift className="h-4 w-4" aria-hidden />} label="আজ বাড়তি চাবি বাকি" value={Math.min(ref.keys, refLeftToday)} hint={`দিনে সর্বোচ্চ ${bn(ref.per_day)}টি`} />
            </>}
        </div>
      </section>

      {/* 2. rules, open */}
      <section className="nk-card p-4 sm:p-5">
        <h2 className="flex items-center gap-2 text-lg font-bold"><ScrollText className="h-5 w-5 text-emerald-700" aria-hidden /> প্রতিযোগিতার নিয়ম</h2>
        <ol className="mt-3 grid gap-2 text-[15px] leading-relaxed">
          {rules.map((l, i) => <li key={i} className="flex gap-3"><span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-emerald-800 text-xs font-bold text-white">{bn(i + 1)}</span><span>{l}</span></li>)}
        </ol>
      </section>

      {/* 3. today's keys */}
      <section className="nk-card grid gap-3 p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="flex items-center gap-2 text-lg font-bold"><KeyRound className="h-5 w-5 text-emerald-700" aria-hidden /> আজকের {bn(slots.length)}টি {simple ? 'প্রশ্ন' : 'চাবি'}</h2>
          {next && <span className="text-sm text-emerald-900/70">পরের প্রশ্ন খুলবে <b>{timeBn(next.from)}</b>-এ</span>}
        </div>
        <ol className="grid gap-2">
          {slots.map((s) => {
            const look = SLOT_LOOK[s.status];
            const canOpen = s.status === 'ready' && !c.full;
            const leftMin = Math.max(0, Math.round((new Date(s.to).getTime() - t) / 60000));
            return (
              <li key={s.i} className={`flex flex-wrap items-center gap-3 rounded-xl border p-3 ${canOpen ? 'border-gold-500 bg-gold-400/10' : 'border-[#eee7d3]'}`}>
                <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-full text-sm font-bold ${s.status === 'upcoming' ? 'bg-[#efe9d8] text-emerald-900/60' : 'bg-emerald-900 text-white'}`}>{s.status === 'upcoming' ? <Lock className="h-4 w-4" aria-hidden /> : bn(s.i + 1)}</span>
                <div className="min-w-0 flex-1">
                  <div className="font-semibold">{timeBn(s.from)} – {timeBn(s.to)}</div>
                  <span className={`mt-0.5 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-bold ${look.cls}`}>{look.icon}{look.t}{s.status === 'ready' && ` · আর ${bn(leftMin)} মিনিট`}</span>
                </div>
                {canOpen && <button type="button" onClick={() => setFlow({ kind: 'slot', slot: s.i })} className="nk-btn nk-green px-4 py-2 text-sm">উত্তর দিন</button>}
              </li>
            );
          })}
        </ol>
        {readyCount === 0 && !next && <p className="text-sm text-emerald-900/65">আজকের সব প্রশ্নের সময় শেষ। কাল আবার নতুন চাবি পাবেন, ইনশাআল্লাহ।</p>}
      </section>

      {/* 4. extra keys (not in a simple quiz) */}
      {!simple && <section className={`nk-card grid gap-3 p-4 sm:p-5 ${canRef ? 'border-gold-500/70' : ''}`}>
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <h2 className="flex items-center gap-2 text-lg font-bold"><Gift className="h-5 w-5 text-emerald-700" aria-hidden /> বাড়তি চাবি</h2>
            <p className="mt-0.5 text-sm text-emerald-900/70">আপনার রেফারেল লিংক দিয়ে কেউ অ্যাকাউন্ট খুললে আপনি ও তিনি দুজনেই ১টি করে বাড়তি চাবি পাবেন। এই চাবি নষ্ট হয় না।</p>
          </div>
          <div className="rounded-2xl bg-gold-400/25 px-4 py-2 text-center">
            <div className="text-2xl font-bold">{bn(ref.keys)}</div>
            <div className="text-xs font-semibold text-emerald-900/70">জমা আছে</div>
          </div>
        </div>
        <p className="text-sm text-emerald-900/75">
          আজ ব্যবহার করেছেন {bn(ref.used_today)}টি, আরও {bn(refLeftToday)}টি ব্যবহার করা যাবে (দিনে সর্বোচ্চ {bn(ref.per_day)}টি)।
          {!(ref.from === '00:00' && ref.to === '23:59') && <> ব্যবহারের সময়: {bnTime(ref.from)} – {bnTime(ref.to)}।</>}
        </p>
        <button type="button" disabled={!canRef} onClick={() => setFlow({ kind: 'ref' })} className="nk-btn nk-green w-full py-3 text-base disabled:opacity-50">
          {ref.keys <= 0 ? 'কোনো বাড়তি চাবি নেই' : !ref.in_window ? 'এখন ব্যবহারের সময় নয়' : refLeftToday <= 0 ? 'আজকের সীমা শেষ' : 'বাড়তি চাবি দিয়ে প্রশ্নের উত্তর দিন'}
        </button>
      </section>}



      {/* 5. photo card + caption */}
      {share}

      {flow && <QuestionFlow sb={sb} flow={flow} secs={d.secs ?? 30} pledge={d.pledge?.trim() || DEFAULT_PLEDGE} skew={skew}
        onClose={() => { setFlow(null); load(); }} />}
    </>
  );
}

/** Rules + pledge → the question with a countdown → result. Leaving the page cancels the question. */
function QuestionFlow({ sb, flow, secs, pledge, skew, onClose }: { sb: SupabaseClient; flow: NonNullable<Flow>; secs: number; pledge: string; skew: number; onClose: () => void }) {
  const [step, setStep] = useState<'intro' | 'loading' | 'question' | 'sending' | 'done'>('intro');
  const [agree, setAgree] = useState(false);
  const [q, setQ] = useState<CqOpen | null>(null);
  const [pick, setPick] = useState<number | null>(null);
  const [res, setRes] = useState<{ status: 'right' | 'wrong' | 'late' | 'left'; right?: number; tickets?: number; msg?: string } | null>(null);
  const [left, setLeft] = useState(secs);
  const token = useRef<string | null>(null);
  const live = useRef(false); // a question is on screen

  // no scrolling behind the screen
  useEffect(() => { const o = document.body.style.overflow; document.body.style.overflow = 'hidden'; return () => { document.body.style.overflow = o; }; }, []);

  async function start() {
    setStep('loading');
    token.current = (await sb.auth.getSession()).data.session?.access_token ?? null;
    const { data, error } = await sb.rpc('nusuk_cq_open', { p_kind: flow.kind, p_slot: flow.kind === 'slot' ? flow.slot : null });
    if (error) { setRes({ status: 'late', msg: errText(error) }); setStep('done'); return; }
    const o = data as CqOpen;
    if (!o.ok) { setRes({ status: 'late', msg: OPEN_ERR[o.reason ?? ''] ?? 'একটু পরে আবার চেষ্টা করুন।' }); setStep('done'); return; }
    setQ(o);
    live.current = true;
    setStep('question');
  }

  // countdown from the server's deadline
  useEffect(() => {
    if (step !== 'question' || !q?.deadline) return;
    const end = new Date(q.deadline).getTime() - 2000; // the server allows 2 s for the network
    const tick = () => {
      const s = Math.max(0, Math.ceil((end - (Date.now() + skew)) / 1000));
      setLeft(s);
      if (s <= 0) { live.current = false; setRes({ status: 'late' }); setStep('done'); }
    };
    tick();
    const id = setInterval(tick, 250);
    return () => clearInterval(id);
  }, [step, q, skew]);

  // leaving the page (other tab, other app, minimised, closed) cancels the question
  useEffect(() => {
    const gone = () => {
      if (!live.current || !q?.id) return;
      live.current = false;
      leaveBeacon(q.id, token.current);
      setRes({ status: 'left' });
      setStep('done');
    };
    const vis = () => { if (document.visibilityState === 'hidden') gone(); };
    document.addEventListener('visibilitychange', vis);
    window.addEventListener('pagehide', gone);
    return () => { document.removeEventListener('visibilitychange', vis); window.removeEventListener('pagehide', gone); };
  }, [q]);

  async function answer(i: number) {
    if (!q?.id || step !== 'question') return;
    live.current = false;
    setPick(i);
    setStep('sending');
    const { data, error } = await sb.rpc('nusuk_cq_answer', { p_id: q.id, p_choice: i });
    if (error) { setRes({ status: 'late', msg: errText(error) }); setStep('done'); return; }
    const a = data as CqAnswer;
    if (!a.ok) { setRes({ status: a.reason === 'left' ? 'left' : 'late', right: a.right }); setStep('done'); return; }
    setRes({ status: a.status ?? 'late', right: a.right, tickets: a.tickets });
    setStep('done');
  }

  const stop = (e: React.SyntheticEvent) => e.preventDefault();
  const mark = q?.mark ? `SL ${q.mark.sl} · ${q.mark.code}` : '';
  return (
    <div className="fixed inset-0 z-[60] overflow-y-auto bg-[#04241b]/95 p-3 text-emerald-950 sm:p-6" role="dialog" aria-modal="true">
      <div className="mx-auto max-w-xl">
        {step === 'intro' && (
          <div className="nk-card grid gap-4 p-5">
            <h2 className="text-lg font-bold">⚠️ উত্তর দেওয়ার আগে পড়ুন</h2>
            <ul className="grid gap-2 text-[15px] leading-relaxed">
              <li>• "শুরু করুন" চাপার পর <b>{bn(secs)} সেকেন্ডের</b> মধ্যে উত্তর দিতে হবে।</li>
              <li>• এই সময়ে পেজ থেকে বের হলে, অন্য ট্যাব বা অ্যাপে গেলে <b>প্রশ্নটি বাতিল হবে</b>।</li>
              <li>• একটি প্রশ্নের উত্তর একবারই দেওয়া যাবে। সঠিক উত্তরে পাবেন ১টি টিকিট।</li>
              <li>• ভালো ইন্টারনেট সংযোগে উত্তর দিন।</li>
            </ul>
            <label className="flex items-start gap-3 rounded-xl border border-gold-500/60 bg-gold-400/10 p-3 text-[15px] font-semibold leading-relaxed">
              <input type="checkbox" className="mt-1 h-5 w-5 shrink-0 accent-emerald-700" checked={agree} onChange={(e) => setAgree(e.target.checked)} />
              {pledge}
            </label>
            <div className="flex gap-2">
              <button type="button" disabled={!agree} onClick={start} className="nk-btn nk-green flex-1 py-3 text-base disabled:opacity-50">শুরু করুন</button>
              <button type="button" onClick={onClose} className="nk-btn nk-ghost px-5 py-3">পরে</button>
            </div>
            {!agree && <p className="-mt-2 text-center text-xs text-emerald-900/60">অঙ্গীকারে টিক দিলে "শুরু করুন" চালু হবে</p>}
          </div>
        )}

        {step === 'loading' && <div className="nk-card p-8 text-center text-emerald-900/70">প্রশ্ন আসছে…</div>}

        {(step === 'question' || step === 'sending') && q && (
          <div className="nk-card relative select-none overflow-hidden p-5" onContextMenu={stop} onCopy={stop} onCut={stop} style={{ WebkitTouchCallout: 'none', WebkitUserSelect: 'none' }}>
            {/* faint watermark: the member's SL and code */}
            <div className="pointer-events-none absolute inset-0 grid -rotate-12 scale-125 grid-cols-2 content-around gap-6 text-center text-sm font-bold text-emerald-900/[0.07]" aria-hidden>
              {Array.from({ length: 12 }, (_, i) => <span key={i}>{mark}</span>)}
            </div>
            <div className="relative">
              <div className="mb-3 flex items-center justify-between gap-3">
                <span className="text-sm font-semibold text-emerald-900/70">{flow.kind === 'ref' ? 'বাড়তি চাবির প্রশ্ন' : `${bn((flow.slot ?? 0) + 1)} নম্বর চাবি`}</span>
                <span className={`flex items-center gap-1.5 rounded-full px-3 py-1 font-mono text-lg font-bold tabular-nums ${left <= 10 ? 'bg-red-600 text-white' : 'bg-emerald-900 text-white'}`}><Hourglass className="h-4 w-4" aria-hidden />{bn(left)}</span>
              </div>
              <div className="mb-4 h-1.5 overflow-hidden rounded-full bg-emerald-100"><div className="h-full rounded-full bg-gold-500 transition-all duration-300" style={{ width: `${(left / secs) * 100}%` }} /></div>
              <p className="text-xl font-bold leading-relaxed">{q.question}</p>
              <div className="mt-4 grid gap-2">
                {(q.options ?? []).map((o, i) => (
                  <button key={i} type="button" disabled={step === 'sending'} onClick={() => answer(i)}
                    className={`flex items-center gap-3 rounded-xl border-2 p-3 text-left text-[16px] font-semibold transition ${pick === i ? 'border-emerald-700 bg-emerald-50' : 'border-[#e7e1cf] bg-white hover:border-emerald-600'}`}>
                    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-emerald-900 text-sm font-bold text-white">{MARKS[i]}</span>{o}
                  </button>
                ))}
              </div>
              {step === 'sending' && <p className="mt-3 text-center text-sm text-emerald-900/70">উত্তর যাচ্ছে…</p>}
              <p className="mt-4 text-center text-[11px] text-emerald-900/50">{mark}</p>
            </div>
          </div>
        )}

        {step === 'done' && res && (
          <div className="nk-card grid gap-4 p-6 text-center">
            {res.status === 'right' && <><div className="text-5xl">🎉</div><h2 className="text-2xl font-bold text-emerald-800">মাশাআল্লাহ, সঠিক উত্তর!</h2><p className="text-[15px]">আপনার ড্রয়ে ১টি টিকিট যোগ হয়েছে। এই প্রতিযোগিতায় এখন আপনার টিকিট <b>{bn(res.tickets ?? 0)}টি</b>।</p></>}
            {res.status === 'wrong' && <><div className="text-5xl">😔</div><h2 className="text-2xl font-bold text-red-700">উত্তরটি সঠিক হয়নি</h2>{q?.options && res.right != null && <p className="text-[15px]">সঠিক উত্তর: <b>{MARKS[res.right]}. {q.options[res.right]}</b></p>}<p className="text-sm text-emerald-900/70">হতাশ হবেন না, পরের প্রশ্নে আবার চেষ্টা করুন।</p></>}
            {res.status === 'late' && <><div className="text-5xl">⏰</div><h2 className="text-xl font-bold">{res.msg ? 'প্রশ্ন খোলা যায়নি' : 'সময় শেষ হয়ে গেছে'}</h2><p className="text-[15px]">{res.msg ?? 'নির্ধারিত সময়ের মধ্যে উত্তর দেওয়া হয়নি, তাই এই চাবিটি ব্যবহার হয়ে গেছে।'}</p></>}
            {res.status === 'left' && <><div className="text-5xl">🚫</div><h2 className="text-xl font-bold text-red-700">প্রশ্নটি বাতিল হয়েছে</h2><p className="text-[15px]">প্রশ্ন খোলা অবস্থায় আপনি পেজ ছেড়েছিলেন (অন্য ট্যাব বা অ্যাপে গিয়েছিলেন), তাই এই চাবিটি ব্যবহার হয়ে গেছে।</p></>}
            <button type="button" onClick={onClose} className="nk-btn nk-green mx-auto px-8 py-3">ঠিক আছে</button>
          </div>
        )}
      </div>
    </div>
  );
}
