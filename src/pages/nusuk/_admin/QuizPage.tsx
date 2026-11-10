/* Nusuk Manager → Quiz: settings, questions, today's schedule and the leaderboard (database: update_23_quiz.sql). */
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { supabase as sb } from '@/lib/supabase';

type ToastFn = (t: string, ok?: boolean) => void;
type Settings = { id: number; enabled: boolean; title: string; start_min: number; end_min: number; per_day: number; points: number; season_start: string };
type Question = { id: number; question: string; options: string[]; correct: number; explanation: string | null; active: boolean; created_at: string };
type Overview = {
  today: string; players: number; new_today: number; answers_today: number; correct_today: number; questions: number;
  schedule: { slot: number; opens: string; question_id: number; question: string; answers: number; right: number }[];
  board: { rank: number; id: number; name: string; points: number; correct: number; code: string }[];
};

const errText = (e: unknown) => (e && typeof e === 'object' && 'message' in e ? String((e as { message: string }).message) : String(e));
const fmt = (n: number | undefined) => (n ?? 0).toLocaleString('en-US');
const hhmm = (m: number) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
const toMin = (v: string) => { const [h, m] = v.split(':').map(Number); return (h || 0) * 60 + (m || 0); };
const dhaka = (iso: string) => new Date(iso).toLocaleTimeString('en-GB', { timeZone: 'Asia/Dhaka', hour: '2-digit', minute: '2-digit' });

function Btn({ kind = 'green', className = '', ...p }: React.ButtonHTMLAttributes<HTMLButtonElement> & { kind?: 'green' | 'gold' | 'ghost' }) {
  return <button type="button" {...p} className={`nk-btn nk-${kind} px-3.5 py-2 text-sm ${className}`} />;
}
function Card({ title, actions, children }: { title: ReactNode; actions?: ReactNode; children: ReactNode }) {
  return (
    <section className="nk-card p-4 sm:p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-base font-bold text-emerald-950">{title}</h2>
        {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
      </div>
      {children}
    </section>
  );
}
function Switch({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button type="button" role="switch" aria-checked={on} aria-label={label} onClick={() => onChange(!on)}
      className={`relative h-6 w-11 shrink-0 rounded-full transition ${on ? 'bg-emerald-600' : 'bg-gray-300'}`}>
      <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${on ? 'left-[22px]' : 'left-0.5'}`} />
    </button>
  );
}

const blankQ = (): Omit<Question, 'id' | 'created_at'> => ({ question: '', options: ['', '', '', ''], correct: 0, explanation: '', active: true });

function QuestionEditor({ q, onSave, onCancel, busy }: { q: Omit<Question, 'id' | 'created_at'>; onSave: (q: Omit<Question, 'id' | 'created_at'>) => void; onCancel: () => void; busy: boolean }) {
  const [f, setF] = useState(q);
  const setOpt = (i: number, v: string) => setF({ ...f, options: f.options.map((o, j) => (j === i ? v : o)) });
  return (
    <div className="grid gap-3 rounded-xl border border-emerald-600/30 bg-emerald-50/40 p-3.5">
      <label className="grid gap-1 text-sm font-semibold">Question
        <textarea rows={2} maxLength={500} className="nk-input font-normal" value={f.question} onChange={(e) => setF({ ...f, question: e.target.value })} />
      </label>
      <div className="grid gap-2">
        <div className="text-sm font-semibold">Options <span className="font-normal text-emerald-900/60">(tick the correct one)</span></div>
        {f.options.map((o, i) => (
          <div key={i} className="flex items-center gap-2">
            <input type="radio" name="correct" className="h-4 w-4 accent-emerald-700" checked={f.correct === i} onChange={() => setF({ ...f, correct: i })} aria-label={`Option ${i + 1} is correct`} />
            <input className="nk-input py-1.5! font-normal" maxLength={200} value={o} onChange={(e) => setOpt(i, e.target.value)} placeholder={`Option ${i + 1}`} />
            {f.options.length > 2 && <Btn kind="ghost" className="px-2! py-1! text-red-700" onClick={() => setF({ ...f, options: f.options.filter((_, j) => j !== i), correct: f.correct === i ? 0 : f.correct > i ? f.correct - 1 : f.correct })} aria-label="Remove option">×</Btn>}
          </div>
        ))}
        {f.options.length < 6 && <Btn kind="ghost" className="justify-self-start px-2.5! py-1! text-xs!" onClick={() => setF({ ...f, options: [...f.options, ''] })}>+ Option</Btn>}
      </div>
      <label className="grid gap-1 text-sm font-semibold">Explanation (optional, shown after answering)
        <textarea rows={2} maxLength={1000} className="nk-input font-normal" value={f.explanation ?? ''} onChange={(e) => setF({ ...f, explanation: e.target.value })} />
      </label>
      <div className="flex justify-end gap-2">
        <Btn kind="ghost" onClick={onCancel}>Cancel</Btn>
        <Btn disabled={busy} onClick={() => onSave(f)}>{busy ? 'Saving…' : 'Save question'}</Btn>
      </div>
    </div>
  );
}

export default function QuizPage({ toast }: { toast: ToastFn }) {
  const [s, setS] = useState<Settings | null>(null);
  const [ov, setOv] = useState<Overview | null>(null);
  const [qs, setQs] = useState<Question[]>([]);
  const [missing, setMissing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [edit, setEdit] = useState<number | 'new' | null>(null);
  const [q, setQ] = useState('');
  const [showAll, setShowAll] = useState(false);

  const load = useCallback(async () => {
    const st = await sb!.from('nusuk_quiz_settings').select('*').eq('id', 1).maybeSingle();
    if (st.error) { if (/nusuk_quiz/.test(st.error.message)) setMissing(true); else toast(errText(st.error), false); return; }
    setMissing(false);
    setS(st.data as Settings);
    const [o, qq] = await Promise.all([
      sb!.rpc('nusuk_admin_quiz'),
      sb!.from('nusuk_quiz_questions').select('*').order('id', { ascending: false }),
    ]);
    if (o.error) toast(errText(o.error), false); else setOv(o.data as Overview);
    if (qq.error) toast(errText(qq.error), false); else setQs((qq.data ?? []) as Question[]);
  }, [toast]);
  useEffect(() => { load(); }, [load]);

  async function saveSettings(patch: Partial<Settings>) {
    if (!s) return;
    const next = { ...s, ...patch };
    if (next.end_min <= next.start_min) return toast('End time must be after start time', false);
    setBusy(true);
    const { error } = await sb!.from('nusuk_quiz_settings').update({ ...patch, updated_at: new Date().toISOString() }).eq('id', 1);
    setBusy(false);
    if (error) return toast(errText(error), false);
    setS(next);
    toast('Saved');
    load();
  }

  async function saveQuestion(id: number | 'new', f: Omit<Question, 'id' | 'created_at'>) {
    const options = f.options.map((o) => o.trim()).filter(Boolean);
    if (!f.question.trim()) return toast('Write the question', false);
    if (options.length < 2) return toast('At least 2 options', false);
    const correctText = f.options[f.correct]?.trim();
    const correct = options.indexOf(correctText ?? '');
    if (correct < 0) return toast('Tick the correct option (it cannot be empty)', false);
    const row = { question: f.question.trim(), options, correct, explanation: f.explanation?.trim() || null, active: f.active };
    setBusy(true);
    const { error } = id === 'new' ? await sb!.from('nusuk_quiz_questions').insert(row) : await sb!.from('nusuk_quiz_questions').update(row).eq('id', id);
    setBusy(false);
    if (error) return toast(errText(error), false);
    setEdit(null);
    toast(id === 'new' ? 'Question added' : 'Question saved');
    load();
  }
  async function toggleQ(x: Question) {
    const { error } = await sb!.from('nusuk_quiz_questions').update({ active: !x.active }).eq('id', x.id);
    if (error) return toast(errText(error), false);
    setQs((l) => l.map((y) => (y.id === x.id ? { ...y, active: !x.active } : y)));
  }
  async function deleteQ(x: Question) {
    if (!confirm('Delete this question? Answers people already gave to it are deleted too. (Switching it off keeps them.)')) return;
    const { error } = await sb!.from('nusuk_quiz_questions').delete().eq('id', x.id);
    if (error) return toast(errText(error), false);
    setQs((l) => l.filter((y) => y.id !== x.id));
    toast('Deleted');
  }
  async function resetPassword(id: number, label = '') {
    const pw = prompt(`New password for player ${id}${label ? ` (${label})` : ''} (at least 4 characters). They will be signed out on every device and must use this password.`);
    if (pw === null) return;
    if (pw.trim().length < 4) return toast('Password must be at least 4 characters', false);
    const { data, error } = await sb!.rpc('nusuk_admin_quiz_password', { p_id: id, p_password: pw.trim() });
    if (error) return toast(/nusuk_admin_quiz_password/.test(error.message) ? 'Run update_24_quiz_password.sql in Supabase first' : errText(error), false);
    const r = data as { ok: boolean; reason?: string };
    if (!r.ok) return toast(r.reason === 'no_id' ? `No player with ID ${id}` : 'Could not set the password', false);
    toast(`Password set for ${id}. Tell them: ID ${id}, password ${pw.trim()}`);
  }
  async function deletePlayer(id: number, name: string) {
    if (!confirm(`Remove player ${id} (${name}) and all their answers? They can make a new ID later.`)) return;
    const { error } = await sb!.from('nusuk_quiz_players').delete().eq('id', id);
    if (error) return toast(errText(error), false);
    toast('Player removed');
    load();
  }

  const shown = useMemo(() => {
    const t = q.trim().toLowerCase();
    const l = t ? qs.filter((x) => x.question.toLowerCase().includes(t) || x.options.some((o) => o.toLowerCase().includes(t))) : qs;
    return showAll || t ? l : l.slice(0, 15);
  }, [qs, q, showAll]);

  if (missing) return <Card title="Quiz"><p className="text-sm">Run <code className="font-mono">src/pages/nusuk/_sql/update_23_quiz.sql</code> in Supabase → SQL Editor, then reload this page.</p></Card>;
  if (!s) return <Card title="Quiz"><p className="text-sm text-emerald-900/60">Loading…</p></Card>;

  const active = qs.filter((x) => x.active).length;
  const days = Math.floor(active / Math.max(1, s.per_day));
  return (
    <div className="grid gap-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          ['Players', ov?.players, `${fmt(ov?.new_today)} new today`],
          ['Answers today', ov?.answers_today, ov?.answers_today ? `${Math.round(((ov.correct_today ?? 0) / ov.answers_today) * 100)}% correct` : 'none yet'],
          ['Active questions', active, `enough for ~${days} day(s) before repeats`],
          ['Season since', undefined, s.season_start],
        ].map(([l, v, h]) => (
          <div key={String(l)} className="nk-card p-4">
            <div className="text-xs font-semibold text-emerald-900/70">{l}</div>
            <div className="mt-1 text-2xl font-bold">{v === undefined ? h : fmt(v as number)}</div>
            {v !== undefined && <div className="text-xs text-emerald-900/55">{h}</div>}
          </div>
        ))}
      </div>

      <Card title="Quiz settings" actions={<a href="/nusuk#quiz" target="_blank" rel="noopener" className="nk-btn nk-ghost px-3.5 py-2 text-sm">Open on page ↗</a>}>
        <div className="grid gap-4">
          <div className="flex items-center gap-3 rounded-xl border border-[#e7e1cf] bg-cream p-3.5">
            <Switch on={s.enabled} onChange={(v) => saveSettings({ enabled: v })} label="Quiz on" />
            <div><div className="font-semibold">{s.enabled ? 'Quiz is ON' : 'Quiz is OFF'}</div><div className="text-xs text-emerald-900/65">{s.enabled ? 'The quiz section shows on /nusuk.' : 'The section is hidden and nobody can answer.'} · saves at once</div></div>
          </div>
          <SettingsForm s={s} busy={busy} onSave={saveSettings} />
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-red-200 bg-red-50/40 p-3.5">
            <div className="text-sm"><b>New season</b><div className="text-xs text-emerald-900/65">The leaderboard starts again from today. Old answers are kept but no longer counted.</div></div>
            <Btn kind="ghost" className="text-red-700" disabled={busy} onClick={() => confirm('Start a new season from today? Everyone starts again at 0 points on the leaderboard.') && saveSettings({ season_start: ov?.today ?? new Date().toISOString().slice(0, 10) })}>Start new season</Btn>
          </div>
        </div>
      </Card>

      <Card title={`Today's questions (${ov?.today ?? ''})`} actions={<Btn kind="ghost" onClick={load}>Refresh</Btn>}>
        {ov?.schedule?.length ? (
          <ol className="grid gap-2">
            {ov.schedule.map((x) => (
              <li key={x.slot} className="grid grid-cols-[4.5rem_1fr_auto] items-center gap-3 rounded-xl border border-[#e7e1cf] bg-white p-3 text-sm">
                <span className="font-mono font-bold text-emerald-800">{dhaka(x.opens)}</span>
                <span className="min-w-0"><span className="text-xs text-emerald-900/55">Q{x.slot + 1} · #{x.question_id}</span><span className="block truncate font-semibold">{x.question}</span></span>
                <span className="text-right text-xs text-emerald-900/70 tabular-nums">{fmt(x.answers)} answers<br />{x.answers ? `${Math.round((x.right / x.answers) * 100)}% right` : '—'}</span>
              </li>
            ))}
          </ol>
        ) : <p className="text-sm text-emerald-900/60">No questions chosen for today. Add some active questions.</p>}
        <p className="mt-2 text-xs text-emerald-900/60">Each day the least-used active questions are picked once and stay fixed for that day.</p>
      </Card>

      <Card title={`Questions (${qs.length})`} actions={<><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search…" className="nk-input w-44 py-1.5!" /><Btn onClick={() => setEdit('new')}>+ Add question</Btn></>}>
        <div className="grid gap-2">
          {edit === 'new' && <QuestionEditor q={blankQ()} busy={busy} onCancel={() => setEdit(null)} onSave={(f) => saveQuestion('new', f)} />}
          {shown.map((x) => (edit === x.id ? (
            <QuestionEditor key={x.id} q={x} busy={busy} onCancel={() => setEdit(null)} onSave={(f) => saveQuestion(x.id, f)} />
          ) : (
            <article key={x.id} className={`rounded-xl border p-3 ${x.active ? 'border-[#e7e1cf] bg-white' : 'border-[#e7e1cf] bg-gray-50 opacity-70'}`}>
              <div className="flex items-start gap-3">
                <Switch on={x.active} onChange={() => toggleQ(x)} label="Active" />
                <div className="min-w-0 flex-1">
                  <div className="font-semibold">{x.question}</div>
                  <div className="mt-1 flex flex-wrap gap-1.5 text-xs">
                    {x.options.map((o, i) => <span key={i} className={`rounded-full px-2 py-0.5 ${i === x.correct ? 'bg-emerald-100 font-bold text-emerald-900' : 'bg-gray-100 text-gray-700'}`}>{i === x.correct ? '✓ ' : ''}{o}</span>)}
                  </div>
                </div>
                <span className="flex shrink-0 gap-1">
                  <Btn kind="ghost" className="px-2.5! py-1!" onClick={() => setEdit(x.id)}>Edit</Btn>
                  <Btn kind="ghost" className="px-2.5! py-1! text-red-700" onClick={() => deleteQ(x)}>Delete</Btn>
                </span>
              </div>
            </article>
          )))}
          {!showAll && !q && qs.length > 15 && <Btn kind="ghost" onClick={() => setShowAll(true)}>Show all {qs.length} questions</Btn>}
        </div>
      </Card>

      <Card title="Forgotten password">
        <ResetBox onReset={(id) => resetPassword(id)} />
      </Card>

      <Card title={`Leaderboard (this season)`}>
        {ov?.board?.length ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-xs text-emerald-900/60"><tr><th className="p-2">#</th><th className="p-2">ID</th><th className="p-2">Name</th><th className="p-2">Nusuk code</th><th className="p-2 text-right">Correct</th><th className="p-2 text-right">Points</th><th className="p-2" /></tr></thead>
              <tbody>
                {ov.board.map((r) => (
                  <tr key={r.id} className="border-t border-[#efe9d8]">
                    <td className="p-2 font-bold">{r.rank}</td>
                    <td className="p-2 font-mono">{r.id}</td>
                    <td className="p-2">{r.name}</td>
                    <td className="p-2 font-mono text-xs">{r.code}</td>
                    <td className="p-2 text-right tabular-nums">{fmt(r.correct)}</td>
                    <td className="p-2 text-right font-bold tabular-nums">{fmt(r.points)}</td>
                    <td className="p-2 text-right whitespace-nowrap"><Btn kind="ghost" className="px-2! py-0.5! text-xs!" onClick={() => resetPassword(r.id, r.name)}>Set password</Btn> <Btn kind="ghost" className="px-2! py-0.5! text-xs! text-red-700" onClick={() => deletePlayer(r.id, r.name)}>Remove</Btn></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <p className="text-sm text-emerald-900/60">Nobody has points yet.</p>}
      </Card>
    </div>
  );
}

function SettingsForm({ s, busy, onSave }: { s: Settings; busy: boolean; onSave: (p: Partial<Settings>) => void }) {
  const [f, setF] = useState({ title: s.title, start: hhmm(s.start_min), end: hhmm(s.end_min), per_day: s.per_day, points: s.points });
  useEffect(() => setF({ title: s.title, start: hhmm(s.start_min), end: hhmm(s.end_min), per_day: s.per_day, points: s.points }), [s]);
  const start = toMin(f.start), end = toMin(f.end);
  const gap = f.per_day > 0 ? Math.floor((end - start) / f.per_day) : 0;
  const times = end > start ? Array.from({ length: Math.min(f.per_day, 20) }, (_, i) => hhmm(start + Math.floor((i * (end - start)) / f.per_day))) : [];
  return (
    <div className="grid gap-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="grid gap-1 text-sm font-semibold sm:col-span-2">Section title<input className="nk-input font-normal" maxLength={80} value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} /></label>
        <label className="grid gap-1 text-sm font-semibold">First question opens (Bangladesh time)<input type="time" className="nk-input font-normal" value={f.start} onChange={(e) => setF({ ...f, start: e.target.value })} /></label>
        <label className="grid gap-1 text-sm font-semibold">Answers close<input type="time" className="nk-input font-normal" value={f.end} onChange={(e) => setF({ ...f, end: e.target.value })} /></label>
        <label className="grid gap-1 text-sm font-semibold">Questions per day<input type="number" min={1} max={20} className="nk-input font-normal" value={f.per_day} onChange={(e) => setF({ ...f, per_day: Math.max(1, Math.min(20, +e.target.value || 1)) })} /></label>
        <label className="grid gap-1 text-sm font-semibold">Points per correct answer<input type="number" min={1} max={1000} className="nk-input font-normal" value={f.points} onChange={(e) => setF({ ...f, points: Math.max(1, +e.target.value || 1) })} /></label>
      </div>
      <p className="text-xs text-emerald-900/65">{times.length ? <>Questions open at <b>{times.join(', ')}</b> (one every {Math.floor(gap / 60)}h {gap % 60}m). Each stays open until {f.end}.</> : 'End time must be after the start time.'}</p>
      <div className="flex justify-end"><Btn disabled={busy} onClick={() => onSave({ title: f.title.trim() || 'দৈনিক ইসলামিক কুইজ', start_min: start, end_min: end, per_day: f.per_day, points: f.points })}>{busy ? 'Saving…' : 'Save settings'}</Btn></div>
    </div>
  );
}

function ResetBox({ onReset }: { onReset: (id: number) => void }) {
  const [id, setId] = useState('');
  return (
    <div className="grid gap-2">
      <p className="text-sm text-emerald-900/70">If a player forgets their password, check it is really them (e.g. they tell you their Nusuk code), then set a new one here and send it to them.</p>
      <div className="flex flex-wrap gap-2">
        <input className="nk-input w-40 font-mono" inputMode="numeric" placeholder="Player ID, e.g. 1005" value={id} onChange={(e) => setId(e.target.value.replace(/\D/g, ''))} />
        <Btn disabled={!id} onClick={() => onReset(Number(id))}>Set new password</Btn>
      </div>
    </div>
  );
}
