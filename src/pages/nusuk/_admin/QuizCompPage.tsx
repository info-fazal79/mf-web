/* Nusuk Manager → Reward Club → Quiz competition (update_44_quiz_competition.sql):
   campaigns (time slots, seconds per question, extra-key limits, draw rule), welcome bonus,
   the question bank (add, edit, delete, CSV import) and today's numbers with look-alike accounts.
   Prizes and the live draw stay in Reward Club → Raffle draw (pick the campaign there). */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Download, Pencil, Plus, Power, RefreshCw, Trash2, Upload } from 'lucide-react';
import { supabase as sb } from '@/lib/supabase';
import { CONTEST_CAPTIONS, DEFAULT_PLEDGE, QUIZ_RULES, SIMPLE_QUIZ_CAPTION, SIMPLE_QUIZ_RULES, type Contest } from '../_lib/club';
import { DEFAULT_SLOTS, parseCqCfg, type CqCfg, type CqPrize } from '../_lib/cq';
import { MEDAL, placeName } from '../_lib/prizes';
import { uploadMedia } from '@/admin/media';

type ToastFn = (t: string, ok?: boolean) => void;
const errText = (e: unknown) => (e && typeof e === 'object' && 'message' in e ? String((e as { message: string }).message) : String(e));
const NEED_SQL = 'Run update_44_quiz_competition.sql in Supabase first';
type Camp = Contest & { quiz: unknown };
type Q = { id: number; question: string; options: string[]; correct: number; active: boolean; note: string };
type Stats = {
  today: string; totals: { people: number; tickets: number }; questions: number;
  day: { opened: number; right: number; wrong: number; late: number; left: number; people: number };
  top: { sl: number; name: string; code: string; tickets: number; answered: number }[];
  alike: { how: 'device' | 'browser'; val: string; n: number; people: { sl: number; name: string; email: string | null; phone: string; joined: string }[] }[];
};

function toLocal(iso: string | null) {
  if (!iso) return '';
  return new Date(new Date(iso).getTime() + 6 * 3600000).toISOString().slice(0, 16);
}
const fromLocal = (v: string) => (v ? new Date(`${v}:00+06:00`).toISOString() : null);
const n = (v: number | undefined) => (v ?? 0).toLocaleString('en-US');

export default function QuizCompPage({ toast }: { toast: ToastFn }) {
  const [camps, setCamps] = useState<Camp[] | null>(null);
  const [edit, setEdit] = useState<{ c: Partial<Camp>; q: CqCfg } | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [statFor, setStatFor] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [defs, setDefs] = useState<Defaults>(BUILT_IN);

  // default caption / rules / pledge for new campaigns (nusuk_settings.content.cq_defaults)
  useEffect(() => {
    sb!.from('nusuk_settings').select('content').eq('id', 1).single().then(({ data }) => {
      const d = ((data?.content as Record<string, unknown> | null)?.cq_defaults ?? {}) as Partial<Defaults>;
      setDefs({ caption: d.caption?.trim() || BUILT_IN.caption, rules: d.rules?.trim() || BUILT_IN.rules, pledge: d.pledge?.trim() || BUILT_IN.pledge });
    });
  }, []);
  async function saveDefault(key: keyof Defaults, text: string) {
    if (!text.trim()) return toast('Write something first', false);
    const { data, error: e1 } = await sb!.from('nusuk_settings').select('content').eq('id', 1).single();
    if (e1) return toast(errText(e1), false);
    const content = (data?.content as Record<string, unknown>) ?? {};
    const cur = (content.cq_defaults ?? {}) as Partial<Defaults>;
    const { error } = await sb!.from('nusuk_settings').update({ content: { ...content, cq_defaults: { ...cur, [key]: text.trim() } }, updated_at: new Date().toISOString() }).eq('id', 1);
    if (error) return toast(errText(error), false);
    setDefs((d) => ({ ...d, [key]: text.trim() }));
    toast('Saved as default: new campaigns start with this text');
  }

  const load = useCallback(async () => {
    const { data, error } = await sb!.from('nusuk_club_contests').select('*').eq('kind', 'quiz').order('id', { ascending: false });
    if (error) { toast(errText(error), false); setCamps([]); return; }
    const l = (data ?? []) as Camp[];
    setCamps(l);
    setStatFor((s) => s ?? l[0]?.id ?? null);
  }, [toast]);
  useEffect(() => { load(); }, [load]);

  const loadStats = useCallback(async () => {
    if (!statFor) return setStats(null);
    const { data, error } = await sb!.rpc('nusuk_admin_cq', { p_contest: statFor });
    if (error) return toast(errText(error).includes('nusuk_admin_cq') ? NEED_SQL : errText(error), false);
    setStats(data as Stats);
  }, [statFor, toast]);
  useEffect(() => { loadStats(); }, [loadStats]);

  function startNew() {
    setEdit({
      c: { title: 'রিবাত ইসলামিক কুইজ প্রতিযোগিতা', kind: 'quiz', active: false, starts_at: null, ends_at: null, info: 'প্রতিদিন ৫টি প্রশ্ন, প্রতিটি সঠিক উত্তরে ড্রয়ের ১টি টিকিট।',
        t_join: 0, t_enter: 0, t_ref_bonus: 0, t_referral: 0, t_copy: 0, copy_from: '09:00', copy_to: '17:00',
        card: { theme: 'green', headline: 'রিবাত ইসলামিক কুইজ', sub: 'প্রতিদিন পুরস্কার জেতার সুযোগ', line: 'আমার লিংকে যুক্ত হলে আপনিও পাবেন ১টি বাড়তি চাবি' },
        caption: defs.caption, sort: 0 },
      q: { ...parseCqCfg({}), rules: defs.rules, pledge: defs.pledge },
    });
  }
  async function save() {
    if (!edit) return;
    const { c, q } = edit;
    if (!c.title || c.title.trim().length < 2) return toast('Give the campaign a name', false);
    if (c.starts_at && c.ends_at && new Date(c.starts_at) >= new Date(c.ends_at)) return toast('End must be after start', false);
    if (q.rule !== 'date' && q.target < 1) return toast('Set the target number', false);
    setBusy(true);
    const { id, my: _m, top: _t, in_window: _w, ...row } = c as Camp;
    const clean = { ...row, title: row.title.trim(), kind: 'quiz', t_join: 0, t_enter: 0, t_ref_bonus: 0, t_referral: 0, t_copy: 0, quiz: q };
    const { error } = id ? await sb!.from('nusuk_club_contests').update(clean).eq('id', id) : await sb!.from('nusuk_club_contests').insert(clean);
    setBusy(false);
    if (error) return toast(errText(error).includes('kind_check') || errText(error).includes('quiz') ? NEED_SQL : errText(error), false);
    toast(id ? 'Campaign saved' : 'Campaign created');
    setEdit(null);
    load();
  }
  async function toggle(c: Camp) {
    if (!c.active && camps?.some((x) => x.active && x.id !== c.id)) {
      if (!confirm('Another quiz campaign is On. Only one should run at a time; turn the other one off first. Turn this on anyway?')) return;
    }
    const { error } = await sb!.from('nusuk_club_contests').update({ active: !c.active }).eq('id', c.id);
    if (error) return toast(errText(error), false);
    toast(c.active ? 'Campaign is off' : 'Campaign is on');
    load();
  }
  async function remove(c: Camp) {
    if (!confirm(`Delete "${c.title}" with all its answers and tickets? This cannot be undone.`)) return;
    const { error } = await sb!.from('nusuk_club_contests').delete().eq('id', c.id);
    if (error) return toast(errText(error), false);
    toast('Deleted');
    if (statFor === c.id) setStatFor(null);
    load();
  }
  async function bonus(c: Camp) {
    const k = Number(prompt('Extra keys for every member who joined before this campaign started (once per campaign):', '2'));
    if (!k || k < 1) return;
    const { data, error } = await sb!.rpc('nusuk_admin_cq_bonus', { p_contest: c.id, p_keys: Math.round(k) });
    if (error) return toast(errText(error).includes('nusuk_admin_cq_bonus') ? NEED_SQL : errText(error), false);
    const r = data as { ok: boolean; reason?: string; people?: number };
    if (!r.ok) return toast(r.reason === 'done' ? 'The bonus was already given for this campaign' : 'Could not give the bonus', false);
    toast(`${k} keys given to ${r.people} members`);
    load();
  }

  const now = Date.now();
  return (
    <div className="grid gap-4">
      <section className="nk-card p-4 text-sm text-emerald-900/80 sm:p-5">
        <h2 className="mb-1 text-base font-bold text-emerald-950">How it works</h2>
        Members get daily keys (one question per time slot) and extra keys from referrals. A correct answer = 1 ticket in the running campaign.
        Use <b>Test mode</b> in Reward Club first: only the tester emails see it. Prizes and the live draw: <b>Reward Club → Raffle draw</b> (choose this campaign).
        Only one quiz runs at a time; turn the public <b>Quiz</b> page off while a campaign runs.
      </section>

      {/* ---------- campaigns ---------- */}
      <section className="nk-card grid gap-3 p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-base font-bold text-emerald-950">Campaigns</h2>
          <button type="button" className="nk-btn nk-green flex items-center gap-1.5 px-4 py-2 text-sm" onClick={startNew}><Plus className="h-4 w-4" aria-hidden /> New campaign</button>
        </div>
        {!camps && <p className="text-sm text-emerald-900/60">Loading…</p>}
        {camps?.length === 0 && <p className="text-sm text-emerald-900/60">No campaign yet.</p>}
        {camps?.map((c) => {
          const q = parseCqCfg(c.quiz);
          const running = c.active && (!c.starts_at || now >= new Date(c.starts_at).getTime()) && (!c.ends_at || now < new Date(c.ends_at).getTime());
          return (
            <div key={c.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#e7e1cf] p-3">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <b>{c.title}</b>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${running ? 'bg-emerald-100 text-emerald-900' : 'bg-[#f1ede1] text-emerald-900/60'}`}>{running ? 'Running' : c.active ? 'On (not in time)' : 'Off'}</span>
                </div>
                <div className="mt-0.5 text-xs text-emerald-900/65">
                  <b>{q.mode === 'simple' ? 'Simple quiz' : 'Quiz + referral keys'}</b> · {q.slots.length} slots · {q.secs}s per question{q.mode !== 'simple' && <> · extra keys {q.ref_per_day}/day ({q.ref_from}–{q.ref_to})</>} ·
                  draw: {q.rule === 'date' ? (c.ends_at ? `on ${new Date(c.ends_at).toLocaleString('en-GB', { timeZone: 'Asia/Dhaka', dateStyle: 'medium', timeStyle: 'short' })}` : 'no end set') : `at ${q.target} ${q.rule}`}
                  {q.bonus_done && <> · bonus {q.bonus_keys} keys → {q.bonus_people} members</>}
                </div>
              </div>
              <div className="flex shrink-0 flex-wrap gap-1.5">
                <button type="button" className={`nk-btn flex items-center gap-1 px-3 py-1.5 text-sm ${c.active ? 'nk-green' : 'nk-ghost'}`} onClick={() => toggle(c)}><Power className="h-4 w-4" aria-hidden />{c.active ? 'On' : 'Off'}</button>
                {!q.bonus_done && q.mode !== 'simple' && <button type="button" className="nk-btn nk-ghost px-3 py-1.5 text-sm" onClick={() => bonus(c)}>Give bonus</button>}
                <button type="button" className="nk-btn nk-ghost px-2.5 py-1.5" onClick={() => setEdit({ c: { ...c, caption: c.caption?.trim() || defs.caption }, q: { ...q, rules: q.rules.trim() || defs.rules, pledge: q.pledge.trim() || defs.pledge } })} aria-label="Edit"><Pencil className="h-4 w-4" aria-hidden /></button>
                <button type="button" className="nk-btn nk-ghost px-2.5 py-1.5 text-red-700" onClick={() => remove(c)} aria-label="Delete"><Trash2 className="h-4 w-4" aria-hidden /></button>
              </div>
            </div>
          );
        })}
        {edit && <CampaignForm edit={edit} setEdit={setEdit} busy={busy} onSave={save} onDefault={saveDefault} />}
      </section>

      {/* ---------- numbers ---------- */}
      {camps && camps.length > 0 && (
        <section className="nk-card grid gap-3 p-4 sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-base font-bold text-emerald-950">Numbers</h2>
            <div className="flex gap-2">
              <select className="nk-input py-1.5 text-sm" value={statFor ?? ''} onChange={(e) => setStatFor(Number(e.target.value))}>
                {camps.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
              </select>
              <button type="button" className="nk-btn nk-ghost px-3 py-1.5" onClick={loadStats} aria-label="Refresh"><RefreshCw className="h-4 w-4" aria-hidden /></button>
            </div>
          </div>
          {stats && (
            <>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {[['People with tickets', stats.totals.people], ['Tickets', stats.totals.tickets], ['Active questions', stats.questions], ['Played today', stats.day.people]].map(([l, v]) => (
                  <div key={l as string} className="rounded-xl bg-emerald-50 p-3"><div className="text-xs font-semibold text-emerald-900/70">{l}</div><div className="text-2xl font-bold">{n(v as number)}</div></div>
                ))}
              </div>
              <p className="text-sm text-emerald-900/75">Today: {n(stats.day.opened)} opened · <b className="text-emerald-800">{n(stats.day.right)} right</b> · {n(stats.day.wrong)} wrong · {n(stats.day.late)} too late · {n(stats.day.left)} left the page</p>
              {stats.top.length > 0 && (
                <details className="rounded-xl border border-[#e7e1cf] p-3">
                  <summary className="cursor-pointer text-sm font-bold">Most tickets (admin only, members never see this)</summary>
                  <ol className="mt-2 grid gap-1 text-sm">
                    {stats.top.map((t, i) => <li key={t.sl} className="flex justify-between gap-2 rounded-lg bg-emerald-50 px-3 py-1"><span>{i + 1}. {t.name} · SL {t.sl} · <span className="font-mono">{t.code}</span></span><b>{t.tickets} / {t.answered}</b></li>)}
                  </ol>
                </details>
              )}
              <div className="rounded-xl border border-gold-500/60 bg-gold-400/10 p-3">
                <h3 className="text-sm font-bold">Accounts that look like the same phone ({stats.alike.length})</h3>
                <p className="text-xs text-emerald-900/65">Same device id (the same browser) or the same browser signature. A match is a hint, not proof (two people can have the same phone model). Check before giving a prize.</p>
                {stats.alike.length === 0 && <p className="mt-1 text-sm text-emerald-900/60">None found.</p>}
                <div className="mt-2 grid gap-2">
                  {stats.alike.map((g) => (
                    <div key={g.how + g.val} className="rounded-lg bg-white p-2 text-sm">
                      <b>{g.how === 'device' ? 'Same device' : 'Same browser signature'}</b> · {g.n} accounts
                      <ul className="mt-1 grid gap-0.5 text-xs">
                        {g.people.map((p) => <li key={p.sl}>SL {p.sl} · {p.name} · {p.phone} · {p.email ?? ''} · joined {new Date(p.joined).toLocaleDateString('en-GB', { timeZone: 'Asia/Dhaka' })}</li>)}
                      </ul>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </section>
      )}

      {statFor && <People contest={statFor} title={camps?.find((c) => c.id === statFor)?.title ?? ''} toast={toast} />}

      <Questions toast={toast} />
    </div>
  );
}

// ------------------------------------------------------------------ prizes
function PrizesEdit({ prizes, set }: { prizes: CqPrize[]; set: (p: CqPrize[]) => void }) {
  const [busy, setBusy] = useState<number | null>(null);
  const [err, setErr] = useState('');
  const list = prizes.length ? prizes : [];
  const renumber = (l: CqPrize[]) => l.map((p, i) => ({ ...p, place: i + 1 }));
  async function upload(i: number, f: File) {
    setBusy(i); setErr('');
    try {
      const m = await uploadMedia(f, 'nusuk-prizes');
      set(list.map((p, j) => (j === i ? { ...p, img: m.url } : p)));
    } catch (e) { setErr(errText(e)); }
    setBusy(null);
  }
  return (
    <div className="grid gap-2 rounded-xl border border-gold-500/50 bg-gold-400/10 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-sm font-semibold">Prizes (members see them as cards; can also be shown on the home page)</span>
        <button type="button" className="nk-btn nk-ghost px-3 py-1.5 text-xs" onClick={() => set(renumber([{ place: 1, prize: '২০০টি Nusuk Key' }, { place: 2, prize: '১০০টি Nusuk Key' }, { place: 3, prize: '৫০টি Nusuk Key' }]))}>Fill: 200 / 100 / 50 Keys</button>
      </div>
      {list.length === 0 && <p className="text-xs text-emerald-900/60">No prizes yet.</p>}
      {list.map((p, i) => (
        <div key={i} className="flex flex-wrap items-center gap-2 rounded-lg bg-white p-2">
          <b className="w-28 shrink-0 text-sm">{MEDAL(i + 1)} {placeName(i + 1)}</b>
          <input className="nk-input min-w-0 flex-1 py-1.5" placeholder="পুরস্কারের নাম, যেমন: ২০০টি Nusuk Key" value={p.prize} onChange={(e) => set(list.map((x, j) => (j === i ? { ...x, prize: e.target.value } : x)))} />
          {p.img ? <img src={p.img} alt="" className="h-12 w-12 rounded-lg border object-contain" /> : null}
          <label className="nk-btn nk-ghost cursor-pointer px-3 py-1.5 text-xs">
            {busy === i ? 'Uploading…' : p.img ? 'Change picture' : 'Picture'}
            <input type="file" accept="image/*" hidden onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) upload(i, f); }} />
          </label>
          {p.img && <button type="button" className="nk-btn nk-ghost px-2 py-1.5 text-xs" onClick={() => set(list.map((x, j) => (j === i ? { place: x.place, prize: x.prize } : x)))}>No picture</button>}
          <button type="button" className="nk-btn nk-ghost px-2 py-1.5 text-red-700" aria-label="Remove" onClick={() => set(renumber(list.filter((_, j) => j !== i)))}><Trash2 className="h-4 w-4" aria-hidden /></button>
        </div>
      ))}
      {err && <p className="text-xs text-red-700">{err}</p>}
      {list.length < 12 && <button type="button" className="nk-btn nk-ghost w-fit px-3 py-1.5 text-xs" onClick={() => set(renumber([...list, { place: list.length + 1, prize: '' }]))}><Plus className="h-3.5 w-3.5" /> Add prize</button>}
      <p className="text-xs text-emerald-900/60">The draw (Reward Club → Raffle draw) uses the same places. Pictures are made smaller before upload.</p>
    </div>
  );
}

// ------------------------------------------------------------------ participants
type Person = { sl: number; name: string; phone: string; email: string | null; code: string; district: string | null; joined: string;
  tickets: number; answered: number; correct_all: number; refs: number; ref_keys: number; today: number; left_page: number };
function People({ contest, title, toast }: { contest: number; title: string; toast: ToastFn }) {
  const [rows, setRows] = useState<Person[] | null>(null);
  const [total, setTotal] = useState(0);
  const [q, setQ] = useState('');
  const [page, setPage] = useState(0);
  const PER = 50;
  const load = useCallback(async (search: string, pg: number) => {
    const { data, error } = await sb!.rpc('nusuk_admin_cq_people', { p_contest: contest, p_search: search, p_limit: PER, p_offset: pg * PER });
    if (error) { toast(errText(error).includes('nusuk_admin_cq_people') ? 'Run update_46_quiz_prizes_people.sql in Supabase first' : errText(error), false); setRows([]); return; }
    const r = data as { total: number; rows: Person[] };
    setRows(r.rows); setTotal(r.total);
  }, [contest, toast]);
  useEffect(() => { setPage(0); load('', 0); setQ(''); }, [load]);
  async function exportCsv() {
    const { data, error } = await sb!.rpc('nusuk_admin_cq_people', { p_contest: contest, p_search: q, p_limit: 5000, p_offset: 0 });
    if (error) return toast(errText(error), false);
    const all = (data as { rows: Person[] }).rows;
    const head = ['SL', 'Name', 'Mobile', 'Email', 'Nusuk code', 'District', 'Tickets', 'Answered', 'Right today', 'Left the page', 'Referrals', 'Extra keys', 'Joined'];
    const cell = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const csv = '\uFEFF' + [head, ...all.map((r) => [r.sl, r.name, r.phone, r.email, r.code, r.district, r.tickets, r.answered, r.today, r.left_page, r.refs, r.ref_keys,
      new Date(r.joined).toLocaleString('en-GB', { timeZone: 'Asia/Dhaka' })])].map((l) => l.map(cell).join(',')).join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    a.download = `quiz-participants-${contest}.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 3000);
  }
  const pages = Math.max(1, Math.ceil(total / PER));
  return (
    <section className="nk-card grid gap-3 p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-base font-bold text-emerald-950">Participants <span className="text-sm font-normal text-emerald-900/60">({total})</span></h2>
          <p className="text-xs text-emerald-900/65">Everyone who answered at least one question in "{title}" (pick another campaign in Numbers above). Admin only.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <form onSubmit={(e) => { e.preventDefault(); setPage(0); load(q, 0); }} className="flex gap-2">
            <input className="nk-input py-1.5 text-sm" style={{ width: 220 }} placeholder="Name, mobile, code, email, SL" value={q} onChange={(e) => setQ(e.target.value)} />
            <button type="submit" className="nk-btn nk-ghost px-3 py-1.5 text-sm">Search</button>
          </form>
          <button type="button" className="nk-btn nk-ghost px-3 py-1.5" onClick={() => load(q, page)} aria-label="Refresh"><RefreshCw className="h-4 w-4" aria-hidden /></button>
          <button type="button" className="nk-btn nk-ghost flex items-center gap-1.5 px-3 py-1.5 text-sm" onClick={exportCsv}><Download className="h-4 w-4" aria-hidden /> CSV</button>
        </div>
      </div>
      {!rows && <p className="text-sm text-emerald-900/60">Loading…</p>}
      {rows && rows.length === 0 && <p className="text-sm text-emerald-900/60">Nobody has answered yet.</p>}
      {rows && rows.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="text-xs text-emerald-900/60">
              <tr>{['SL', 'Name', 'Mobile', 'Code', 'District', 'Tickets', 'Today ✓', 'Answered', 'Left page', 'Referrals', 'Extra keys'].map((h) => <th key={h} className="px-2 py-1.5 font-semibold">{h}</th>)}</tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.sl} className="border-t border-[#eee7d3]">
                  <td className="px-2 py-1.5 font-bold">{r.sl}</td>
                  <td className="px-2 py-1.5">{r.name}<span className="block text-xs text-emerald-900/55">{r.email}</span></td>
                  <td className="px-2 py-1.5">{r.phone}</td>
                  <td className="px-2 py-1.5 font-mono text-xs">{r.code}</td>
                  <td className="px-2 py-1.5">{r.district ?? ''}</td>
                  <td className="px-2 py-1.5 font-bold text-emerald-800">{r.tickets}</td>
                  <td className="px-2 py-1.5">{r.today}</td>
                  <td className="px-2 py-1.5">{r.answered}</td>
                  <td className={`px-2 py-1.5 ${r.left_page ? 'text-red-700' : ''}`}>{r.left_page}</td>
                  <td className="px-2 py-1.5">{r.refs}</td>
                  <td className="px-2 py-1.5">{r.ref_keys}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {pages > 1 && (
        <div className="flex items-center justify-center gap-2 text-sm">
          <button type="button" className="nk-btn nk-ghost px-3 py-1" disabled={page === 0} onClick={() => { setPage(page - 1); load(q, page - 1); }}>‹</button>
          <span>{page + 1} / {pages}</span>
          <button type="button" className="nk-btn nk-ghost px-3 py-1" disabled={page >= pages - 1} onClick={() => { setPage(page + 1); load(q, page + 1); }}>›</button>
        </div>
      )}
    </section>
  );
}

// ------------------------------------------------------------------ campaign form
type Defaults = { caption: string; rules: string; pledge: string };
const BUILT_IN: Defaults = { caption: CONTEST_CAPTIONS.quiz, rules: QUIZ_RULES, pledge: DEFAULT_PLEDGE };
const DefBtn = ({ onClick }: { onClick: () => void }) => (
  <button type="button" onClick={onClick} className="-mt-2 w-fit text-xs font-semibold text-emerald-700 hover:underline">★ Save this text as the default for new campaigns</button>
);
function CampaignForm({ edit, setEdit, busy, onSave, onDefault }: { edit: { c: Partial<Camp>; q: CqCfg }; setEdit: (e: { c: Partial<Camp>; q: CqCfg } | null) => void; busy: boolean; onSave: () => void; onDefault: (k: keyof Defaults, t: string) => void }) {
  const { c, q } = edit;
  const setC = (p: Partial<Camp>) => setEdit({ c: { ...c, ...p }, q });
  const setQ = (p: Partial<CqCfg>) => setEdit({ c, q: { ...q, ...p } });
  const label = 'mb-1 block text-sm font-semibold';
  // switching type also swaps the rules / caption if they are still the built-in text of the other type
  const switchMode = (mode: CqCfg['mode']) => {
    if (mode === q.mode) return;
    const simple = mode === 'simple';
    const rules = [QUIZ_RULES, SIMPLE_QUIZ_RULES, ''].includes(q.rules.trim()) ? (simple ? SIMPLE_QUIZ_RULES : QUIZ_RULES) : q.rules;
    const cap = (c.caption ?? '').trim();
    const caption = simple ? (!cap || /\{ref_link\}|বাড়তি চাবি/.test(cap) ? SIMPLE_QUIZ_CAPTION : cap) : (!cap || cap === SIMPLE_QUIZ_CAPTION ? CONTEST_CAPTIONS.quiz : cap);
    setEdit({ c: { ...c, caption }, q: { ...q, mode, rules } });
  };
  return (
    <div className="grid gap-4 rounded-xl border-2 border-emerald-700/40 bg-[#fbfaf5] p-4">
      <h3 className="font-bold">{c.id ? 'Edit campaign' : 'New campaign'}</h3>
      <div className="grid gap-2">
        <span className={label}>Type</span>
        <div className="grid gap-2 sm:grid-cols-2" role="radiogroup" aria-label="Campaign type">
          {([
            ['referral', 'Quiz + referral keys', 'Daily keys, plus extra keys when someone joins with a member\'s link. Referral link, extra-key section and a personal QR on the photo card.'],
            ['simple', 'Simple quiz', 'Daily keys only, e.g. 5 questions today and a draw for 3 winners. No referral link or extra keys anywhere; the photo card QR goes to muhammadfazal.com/nusuk.'],
          ] as const).map(([k, t, h]) => (
            <button key={k} type="button" role="radio" aria-checked={q.mode === k} onClick={() => switchMode(k)}
              className={`rounded-xl border p-3 text-left transition ${q.mode === k ? 'border-emerald-600 bg-emerald-50 ring-2 ring-emerald-600/20' : 'border-[#e7e1cf] bg-white hover:border-emerald-600/40'}`}>
              <div className="font-bold">{t}{q.mode === k ? ' ✓' : ''}</div>
              <div className="mt-0.5 text-xs text-emerald-900/65">{h}</div>
            </button>
          ))}
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <label><span className={label}>Name (members see this)</span><input className="nk-input" maxLength={80} value={c.title ?? ''} onChange={(e) => setC({ title: e.target.value })} /></label>
        <label className="flex items-center gap-2.5 self-end text-sm font-semibold"><input type="checkbox" checked={!!c.active} onChange={(e) => setC({ active: e.target.checked })} /> On (inside the start / end time)</label>
      </div>
      <label><span className={label}>Short line under the name</span><input className="nk-input" maxLength={200} value={c.info ?? ''} onChange={(e) => setC({ info: e.target.value })} /></label>
      <div className="grid gap-3 sm:grid-cols-2">
        <label><span className={label}>Starts (Bangladesh time, empty = now)</span><input type="datetime-local" className="nk-input" value={toLocal(c.starts_at ?? null)} onChange={(e) => setC({ starts_at: fromLocal(e.target.value) })} /></label>
        <label><span className={label}>Ends (empty = no end)</span><input type="datetime-local" className="nk-input" value={toLocal(c.ends_at ?? null)} onChange={(e) => setC({ ends_at: fromLocal(e.target.value) })} /></label>
      </div>

      <div className="grid gap-2">
        <span className={label}>When is the draw?</span>
        <div className="flex flex-wrap gap-2">
          {([['date', 'On the end date'], ['people', 'When N people have tickets'], ['tickets', 'When N tickets are collected']] as const).map(([k, l]) => (
            <button key={k} type="button" onClick={() => setQ({ rule: k })} className={`nk-btn px-3 py-1.5 text-sm ${q.rule === k ? 'nk-green' : 'nk-ghost'}`}>{l}</button>
          ))}
        </div>
        {q.rule !== 'date' && <label className="max-w-xs"><span className="mb-1 block text-xs font-semibold">N =</span><input type="number" min={1} className="nk-input" value={q.target || ''} onChange={(e) => setQ({ target: Math.max(0, Number(e.target.value)) })} /></label>}
        <p className="text-xs text-emerald-900/60">When the target is reached, members can no longer answer (the page says the draw is coming). Keep an end date too, so it never runs forever.</p>
      </div>

      <div className="grid gap-2">
        <span className={label}>Daily keys: question times (Bangladesh time)</span>
        {q.slots.map((s, i) => (
          <div key={i} className="flex flex-wrap items-center gap-2">
            <b className="w-6 text-sm">{i + 1}.</b>
            <input type="time" className="nk-input py-1.5" style={{ width: 140 }} value={s.at} onChange={(e) => setQ({ slots: q.slots.map((x, j) => (j === i ? { ...x, at: e.target.value } : x)) })} />
            <span className="text-sm">open for</span>
            <input type="number" min={5} max={1440} className="nk-input py-1.5" style={{ width: 96 }} value={s.mins} onChange={(e) => setQ({ slots: q.slots.map((x, j) => (j === i ? { ...x, mins: Number(e.target.value) } : x)) })} />
            <span className="text-sm">minutes</span>
            {q.slots.length > 1 && <button type="button" className="nk-btn nk-ghost px-2 py-1 text-red-700" onClick={() => setQ({ slots: q.slots.filter((_, j) => j !== i) })} aria-label="Remove"><Trash2 className="h-4 w-4" aria-hidden /></button>}
          </div>
        ))}
        <div className="flex gap-2">
          {q.slots.length < 10 && <button type="button" className="nk-btn nk-ghost w-fit px-3 py-1.5 text-xs" onClick={() => setQ({ slots: [...q.slots, { at: '21:00', mins: 120 }] })}><Plus className="h-3.5 w-3.5" /> Add a time</button>}
          <button type="button" className="nk-btn nk-ghost w-fit px-3 py-1.5 text-xs" onClick={() => setQ({ slots: DEFAULT_SLOTS.map((s) => ({ ...s })) })}>Default 5 times</button>
        </div>
      </div>

      <div className={`grid gap-3 ${q.mode === 'simple' ? 'max-w-xs' : 'sm:grid-cols-4'}`}>
        <label><span className="mb-1 block text-xs font-semibold">Seconds to answer</span><input type="number" min={10} max={300} className="nk-input" value={q.secs} onChange={(e) => setQ({ secs: Number(e.target.value) })} /></label>
        {q.mode !== 'simple' && <>
        <label><span className="mb-1 block text-xs font-semibold">Extra keys usable per day</span><input type="number" min={0} max={100} className="nk-input" value={q.ref_per_day} onChange={(e) => setQ({ ref_per_day: Number(e.target.value) })} /></label>
        <label><span className="mb-1 block text-xs font-semibold">Extra keys from</span><input type="time" className="nk-input" value={q.ref_from} onChange={(e) => setQ({ ref_from: e.target.value })} /></label>
        <label><span className="mb-1 block text-xs font-semibold">until</span><input type="time" className="nk-input" value={q.ref_to} onChange={(e) => setQ({ ref_to: e.target.value })} /></label>
        </>}
      </div>
      {q.mode !== 'simple' && <p className="-mt-2 text-xs text-emerald-900/60">Extra keys (referrals, bonus) never expire; members can use this many per day, inside this daily time. 00:00–23:59 = all day.</p>}

      <PrizesEdit prizes={(c.prizes ?? []) as CqPrize[]} set={(prizes) => setC({ prizes } as Partial<Camp>)} />

      <label><span className={label}>Pledge before every question (members must tick it)</span>
        <textarea className="nk-input text-sm" rows={2} value={q.pledge} placeholder={DEFAULT_PLEDGE} onChange={(e) => setQ({ pledge: e.target.value })} /></label>
      <DefBtn onClick={() => onDefault('pledge', q.pledge)} />
      <label><span className={label}>Rules (one per line)</span>
        <textarea className="nk-input text-sm" rows={8} value={q.rules} placeholder={QUIZ_RULES} onChange={(e) => setQ({ rules: e.target.value })} /></label>
      <DefBtn onClick={() => onDefault('rules', q.rules)} />
      <label><span className={label}>Caption for the members' photo card</span>
        <textarea className="nk-input text-sm" rows={6} value={c.caption ?? ''} placeholder={CONTEST_CAPTIONS.quiz} onChange={(e) => setC({ caption: e.target.value })} />
        <span className="mt-0.5 block text-xs text-emerald-900/60">{'{ref_link}'} = the member's own referral link · {'{code}'} = their Nusuk code · {'{name}'} · {'{sl}'}</span></label>
      <DefBtn onClick={() => onDefault('caption', c.caption ?? '')} />
      <div className="grid gap-3 sm:grid-cols-2">
        <label><span className="mb-1 block text-xs font-semibold">Photo card heading</span><input className="nk-input" maxLength={60} value={c.card?.headline ?? ''} onChange={(e) => setC({ card: { ...(c.card ?? {}), headline: e.target.value } })} /></label>
        <label><span className="mb-1 block text-xs font-semibold">Photo card line</span><input className="nk-input" maxLength={80} value={c.card?.sub ?? ''} onChange={(e) => setC({ card: { ...(c.card ?? {}), sub: e.target.value } })} /></label>
      </div>
      <div className="flex gap-2">
        <button type="button" disabled={busy} className="nk-btn nk-green px-5 py-2.5" onClick={onSave}>{busy ? 'Saving…' : 'Save campaign'}</button>
        <button type="button" className="nk-btn nk-ghost px-5 py-2.5" onClick={() => setEdit(null)}>Cancel</button>
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ question bank
/** A small CSV reader (quotes, commas and new lines inside quotes) */
function parseCsv(text: string) {
  const rows: string[][] = [];
  let row: string[] = [], cell = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (q) {
      if (ch === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (ch === '"') q = false;
      else cell += ch;
    } else if (ch === '"') q = true;
    else if (ch === ',') { row.push(cell); cell = ''; }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(cell); cell = '';
      if (row.some((c) => c.trim())) rows.push(row);
      row = [];
    } else cell += ch;
  }
  row.push(cell);
  if (row.some((c) => c.trim())) rows.push(row);
  return rows;
}
const BN_DIGITS = '০১২৩৪৫৬৭৮৯';
const toNum = (s: string) => Number(s.trim().replace(/[০-৯]/g, (d) => String(BN_DIGITS.indexOf(d))));

function Questions({ toast }: { toast: ToastFn }) {
  const [list, setList] = useState<Q[] | null>(null);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const [edit, setEdit] = useState<Partial<Q> | null>(null);
  const [busy, setBusy] = useState(false);
  const file = useRef<HTMLInputElement>(null);
  const PER = 25;

  const load = useCallback(async () => {
    const { data, error } = await sb!.from('nusuk_cq_questions').select('id, question, options, correct, active, note').order('id', { ascending: false }).limit(5000);
    if (error) { toast(errText(error).includes('nusuk_cq_questions') ? NEED_SQL : errText(error), false); setList([]); return; }
    setList((data ?? []) as Q[]);
  }, [toast]);
  useEffect(() => { load(); }, [load]);

  const shown = useMemo(() => {
    const s = search.trim().toLowerCase();
    return (list ?? []).filter((q) => !s || q.question.toLowerCase().includes(s) || q.options.some((o) => o.toLowerCase().includes(s)) || String(q.id) === s);
  }, [list, search]);
  const pages = Math.max(1, Math.ceil(shown.length / PER));

  async function save() {
    if (!edit) return;
    const opts = (edit.options ?? []).map((o) => o.trim()).filter(Boolean);
    if (!edit.question || edit.question.trim().length < 3) return toast('Write the question', false);
    if (opts.length < 2) return toast('At least 2 options', false);
    if (edit.correct == null || edit.correct >= opts.length) return toast('Pick the right answer', false);
    setBusy(true);
    const row = { question: edit.question.trim(), options: opts, correct: edit.correct, active: edit.active ?? true, note: edit.note ?? '', updated_at: new Date().toISOString() };
    const { error } = edit.id ? await sb!.from('nusuk_cq_questions').update(row).eq('id', edit.id) : await sb!.from('nusuk_cq_questions').insert(row);
    setBusy(false);
    if (error) return toast(errText(error), false);
    toast(edit.id ? 'Question saved' : 'Question added');
    setEdit(null);
    load();
  }
  async function del(q: Q) {
    if (!confirm(`Delete question #${q.id}? Answers to it are deleted too. (To keep history, switch it off instead.)`)) return;
    const { error } = await sb!.from('nusuk_cq_questions').delete().eq('id', q.id);
    if (error) return toast(errText(error), false);
    toast('Deleted');
    load();
  }
  async function toggle(q: Q) {
    const { error } = await sb!.from('nusuk_cq_questions').update({ active: !q.active }).eq('id', q.id);
    if (error) return toast(errText(error), false);
    load();
  }
  function template() {
    const csv = '﻿question,option1,option2,option3,option4,correct\n"পবিত্র কুরআনে মোট কতটি সূরা আছে?","১১০টি","১১৪টি","১২০টি","১১২টি",2\n';
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    a.download = 'quiz-questions-template.csv';
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 3000);
  }
  async function importCsv(f: File) {
    const rows = parseCsv((await f.text()).replace(/^﻿/, ''));
    if (!rows.length) return toast('The file is empty', false);
    const head = rows[0].map((h) => h.trim().toLowerCase());
    const body = head[0] === 'question' ? rows.slice(1) : rows;
    const good: { question: string; options: string[]; correct: number }[] = [];
    const bad: number[] = [];
    body.forEach((r, i) => {
      const question = (r[0] ?? '').trim();
      const options = r.slice(1, -1).map((o) => o.trim()).filter(Boolean).slice(0, 6);
      const correct = toNum(r[r.length - 1] ?? '') - 1;
      if (question.length < 3 || options.length < 2 || !Number.isInteger(correct) || correct < 0 || correct >= options.length) bad.push(i + 2);
      else good.push({ question, options, correct });
    });
    if (!good.length) return toast(`No valid rows. Check the format (row ${bad.slice(0, 5).join(', ')})`, false);
    if (!confirm(`Add ${good.length} questions?${bad.length ? `\n${bad.length} rows skipped (rows ${bad.slice(0, 10).join(', ')}${bad.length > 10 ? '…' : ''}).` : ''}`)) return;
    setBusy(true);
    for (let i = 0; i < good.length; i += 200) {
      const { error } = await sb!.from('nusuk_cq_questions').insert(good.slice(i, i + 200));
      if (error) { setBusy(false); return toast(`Stopped after ${i} rows: ${errText(error)}`, false); }
    }
    setBusy(false);
    toast(`${good.length} questions added`);
    load();
  }

  const active = (list ?? []).filter((q) => q.active).length;
  return (
    <section className="nk-card grid gap-3 p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-base font-bold text-emerald-950">Question bank</h2>
          <p className="text-xs text-emerald-900/65">{list ? `${list.length} questions · ${active} on` : 'Loading…'}. Every member gets these in their own random order and never sees a repeat until they have seen them all; options are shuffled each time.</p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <button type="button" className="nk-btn nk-green flex items-center gap-1.5 px-3 py-2 text-sm" onClick={() => setEdit({ question: '', options: ['', '', '', ''], correct: 0, active: true, note: '' })}><Plus className="h-4 w-4" aria-hidden /> Add</button>
          <button type="button" disabled={busy} className="nk-btn nk-ghost flex items-center gap-1.5 px-3 py-2 text-sm" onClick={() => file.current?.click()}><Upload className="h-4 w-4" aria-hidden /> Import CSV</button>
          <button type="button" className="nk-btn nk-ghost flex items-center gap-1.5 px-3 py-2 text-sm" onClick={template}><Download className="h-4 w-4" aria-hidden /> CSV template</button>
          <input ref={file} type="file" accept=".csv,text/csv" hidden onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) importCsv(f); }} />
        </div>
      </div>
      <p className="text-xs text-emerald-900/60">CSV columns: <span className="font-mono">question, option1, option2, option3, option4, correct</span> (correct = 1–4, which option is right). 2 to 6 options per row. Save from Excel / Google Sheets as "CSV UTF-8".</p>

      {edit && (
        <div className="grid gap-2 rounded-xl border-2 border-emerald-700/40 bg-[#fbfaf5] p-3">
          <textarea className="nk-input" rows={2} placeholder="প্রশ্ন" value={edit.question ?? ''} onChange={(e) => setEdit({ ...edit, question: e.target.value })} />
          {(edit.options ?? []).map((o, i) => (
            <label key={i} className="flex items-center gap-2">
              <input type="radio" name="cq-right" checked={edit.correct === i} onChange={() => setEdit({ ...edit, correct: i })} aria-label="Right answer" />
              <input className="nk-input flex-1 py-1.5" placeholder={`Option ${i + 1}`} value={o} onChange={(e) => setEdit({ ...edit, options: (edit.options ?? []).map((x, j) => (j === i ? e.target.value : x)) })} />
            </label>
          ))}
          <div className="flex flex-wrap items-center gap-2">
            {(edit.options ?? []).length < 6 && <button type="button" className="nk-btn nk-ghost px-3 py-1.5 text-xs" onClick={() => setEdit({ ...edit, options: [...(edit.options ?? []), ''] })}>+ option</button>}
            <span className="text-xs text-emerald-900/60">Tick the circle next to the right answer.</span>
            <label className="ml-auto flex items-center gap-1.5 text-sm"><input type="checkbox" checked={edit.active ?? true} onChange={(e) => setEdit({ ...edit, active: e.target.checked })} /> On</label>
          </div>
          <div className="flex gap-2">
            <button type="button" disabled={busy} className="nk-btn nk-green px-4 py-2 text-sm" onClick={save}>{busy ? 'Saving…' : 'Save question'}</button>
            <button type="button" className="nk-btn nk-ghost px-4 py-2 text-sm" onClick={() => setEdit(null)}>Cancel</button>
          </div>
        </div>
      )}

      <input className="nk-input" placeholder="Search questions or options" value={search} onChange={(e) => { setSearch(e.target.value); setPage(0); }} />
      <ol className="grid gap-2">
        {shown.slice(page * PER, page * PER + PER).map((q) => (
          <li key={q.id} className={`rounded-xl border p-3 ${q.active ? 'border-[#e7e1cf]' : 'border-dashed border-[#e7e1cf] opacity-60'}`}>
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="font-semibold">#{q.id} · {q.question}</div>
                <div className="mt-1 flex flex-wrap gap-1.5 text-xs">
                  {q.options.map((o, i) => <span key={i} className={`rounded-full px-2 py-0.5 ${i === q.correct ? 'bg-emerald-600 font-bold text-white' : 'bg-emerald-50'}`}>{o}</span>)}
                </div>
              </div>
              <div className="flex shrink-0 gap-1">
                <button type="button" className="nk-btn nk-ghost px-2 py-1 text-xs" onClick={() => toggle(q)}>{q.active ? 'On' : 'Off'}</button>
                <button type="button" className="nk-btn nk-ghost px-2 py-1" onClick={() => setEdit({ ...q, options: [...q.options] })} aria-label="Edit"><Pencil className="h-3.5 w-3.5" aria-hidden /></button>
                <button type="button" className="nk-btn nk-ghost px-2 py-1 text-red-700" onClick={() => del(q)} aria-label="Delete"><Trash2 className="h-3.5 w-3.5" aria-hidden /></button>
              </div>
            </div>
          </li>
        ))}
      </ol>
      {pages > 1 && (
        <div className="flex items-center justify-center gap-2 text-sm">
          <button type="button" className="nk-btn nk-ghost px-3 py-1" disabled={page === 0} onClick={() => setPage(page - 1)}>‹</button>
          <span>{page + 1} / {pages}</span>
          <button type="button" className="nk-btn nk-ghost px-3 py-1" disabled={page >= pages - 1} onClick={() => setPage(page + 1)}>›</button>
        </div>
      )}
    </section>
  );
}
