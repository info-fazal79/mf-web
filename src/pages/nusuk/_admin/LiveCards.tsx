/* Nusuk Manager → Top notice: Vote and Giveaway (tables from _sql/update_21_vote_giveaway.sql). */
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { supabase as sb } from '@/lib/supabase';
import { uploadMedia } from '@/admin/media';
import { countdownText } from '../_lib/content';
import { parseBonus } from '../_lib/bonus';

type ToastFn = (t: string, ok?: boolean) => void;
const errText = (e: unknown) => (e && typeof e === 'object' && 'message' in e ? String((e as { message: string }).message) : String(e));
const when = (iso: string | null) => (iso ? new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '');
const pad = (n: number) => String(n).padStart(2, '0');
const toLocal = (iso?: string | null) => { if (!iso) return ''; const d = new Date(iso); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`; };
const fromLocal = (v: string) => (v ? new Date(v).toISOString() : null);

function Card({ title, actions, children }: { title: ReactNode; actions?: ReactNode; children: ReactNode }) {
  return (
    <section className="nk-card p-4 sm:p-5">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-base font-bold text-emerald-950">{title}</h2>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
      {children}
    </section>
  );
}
function Btn({ kind = 'green', className = '', ...p }: React.ButtonHTMLAttributes<HTMLButtonElement> & { kind?: 'green' | 'gold' | 'ghost' }) {
  return <button type="button" {...p} className={`nk-btn nk-${kind} px-3.5 py-2 text-sm ${className}`} />;
}
function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="grid gap-1 text-sm font-semibold">
      {label}
      {children}
      {hint && <span className="text-xs font-normal text-emerald-900/60">{hint}</span>}
    </label>
  );
}
function useNow() {
  const [n, setN] = useState(Date.now());
  useEffect(() => { const t = setInterval(() => setN(Date.now()), 1000); return () => clearInterval(t); }, []);
  return n;
}
const Missing = ({ title }: { title: string }) => (
  <Card title={title}><p className="text-sm">Run <code className="font-mono">src/pages/nusuk/_sql/update_21_vote_giveaway.sql</code> in Supabase → SQL Editor, then reload this page.</p></Card>
);

/* ================= Vote ================= */
type Poll = { id: number; question: string; is_on: boolean; ends_at: string | null; created_at: string };
type Vote = { poll_id: number; vote: 1 | -1; reason: string | null; created_at: string };

export function PollCard({ toast }: { toast: ToastFn }) {
  const [polls, setPolls] = useState<Poll[]>([]);
  const [votes, setVotes] = useState<Vote[]>([]);
  const [missing, setMissing] = useState(false);
  const [q, setQ] = useState('');
  const [ends, setEnds] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [openId, setOpenId] = useState<number | null>(null);
  const now = useNow();

  const load = useCallback(async () => {
    const { data, error } = await sb!.from('nusuk_polls').select('*').order('id', { ascending: false }).limit(20);
    if (error) { setMissing(true); return; }
    setMissing(false);
    const list = (data ?? []) as Poll[];
    setPolls(list);
    if (list.length) {
      const { data: v } = await sb!.from('nusuk_poll_votes').select('poll_id,vote,reason,created_at').in('poll_id', list.map((p) => p.id)).order('created_at', { ascending: false }).limit(5000);
      setVotes((v ?? []) as Vote[]);
    }
  }, []);
  useEffect(() => { load(); const t = setInterval(load, 20000); return () => clearInterval(t); }, [load]);

  async function create() {
    if (q.trim().length < 3) return toast('Write the question', false);
    setBusy(true);
    // Only one vote shows at a time
    await sb!.from('nusuk_polls').update({ is_on: false }).eq('is_on', true);
    const { error } = await sb!.from('nusuk_polls').insert({ question: q.trim(), ends_at: ends, is_on: true });
    setBusy(false);
    if (error) return toast(errText(error), false);
    setQ(''); setEnds(null);
    toast('Vote is live in the top bar');
    load();
  }
  async function toggle(p: Poll) {
    if (!p.is_on) await sb!.from('nusuk_polls').update({ is_on: false }).eq('is_on', true);
    const { error } = await sb!.from('nusuk_polls').update({ is_on: !p.is_on }).eq('id', p.id);
    if (error) return toast(errText(error), false);
    load();
  }
  async function remove(p: Poll) {
    if (!confirm('Delete this vote and all its answers?')) return;
    const { error } = await sb!.from('nusuk_polls').delete().eq('id', p.id);
    if (error) return toast(errText(error), false);
    load();
  }

  if (missing) return <Missing title="🗳️ Vote" />;
  return (
    <Card title="🗳️ Vote (in the top bar)">
      <p className="mb-3 text-sm text-emerald-900/70">Ask visitors a question. They answer 👍 yes or 👎 no (one vote per phone/browser; they can change it). A 👎 must give a reason, which you read here. The bar shows the live counts.</p>
      <div className="grid gap-3 rounded-xl border border-gold-500/50 bg-gold-100/30 p-3.5">
        <Field label="New question"><textarea rows={2} maxLength={300} className="nk-input font-normal" value={q} onChange={(e) => setQ(e.target.value)} placeholder="যেমন: প্রতি সপ্তাহে একটা গিভঅ্যাওয়ে আয়োজন করলে কেমন হয়?" /></Field>
        <div className="flex flex-wrap items-end gap-2">
          <Field label="Ends (optional)"><input type="datetime-local" className="nk-input font-normal" value={toLocal(ends)} onChange={(e) => setEnds(fromLocal(e.target.value))} /></Field>
          {[1, 6, 24, 72].map((h) => <Btn key={h} kind="ghost" className="px-2! py-1! text-xs!" onClick={() => setEnds(new Date(Date.now() + h * 3600e3).toISOString())}>+{h < 24 ? `${h} h` : `${h / 24} d`}</Btn>)}
          {ends && <Btn kind="ghost" className="px-2! py-1! text-xs! text-red-700" onClick={() => setEnds(null)}>No end</Btn>}
        </div>
        <div><Btn kind="gold" onClick={create} disabled={busy}>{busy ? 'Saving…' : '🗳️ Start this vote'}</Btn> <span className="text-xs text-emerald-900/60">Starting a new vote hides the previous one.</span></div>
      </div>
      <div className="mt-4 grid gap-3">
        {polls.map((p) => {
          const vs = votes.filter((v) => v.poll_id === p.id);
          const yes = vs.filter((v) => v.vote === 1).length, no = vs.length - yes;
          const pct = vs.length ? Math.round((yes / vs.length) * 100) : 0;
          const ended = p.ends_at && Date.parse(p.ends_at) <= now;
          const reasons = vs.filter((v) => v.vote === -1 && v.reason);
          return (
            <article key={p.id} className={`rounded-xl border p-3.5 ${p.is_on ? 'border-emerald-600/40 bg-white' : 'border-[#e7e1cf] bg-gray-50'}`}>
              <div className="flex flex-wrap items-start gap-2">
                <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${p.is_on && !ended ? 'bg-emerald-600 text-white' : 'bg-gray-200 text-gray-700'}`}>{p.is_on ? (ended ? 'ended' : 'LIVE') : 'hidden'}</span>
                <b className="min-w-0 flex-1">{p.question}</b>
                <span className="flex gap-1">
                  <Btn kind="ghost" className="px-2.5! py-1!" onClick={() => toggle(p)}>{p.is_on ? 'Hide' : 'Show'}</Btn>
                  <Btn kind="ghost" className="px-2.5! py-1! text-red-700" onClick={() => remove(p)}>Delete</Btn>
                </span>
              </div>
              <div className="mt-2 text-xs text-emerald-900/60">{when(p.created_at)}{p.ends_at ? ` · ${ended ? 'ended' : `ends in ${countdownText(Date.parse(p.ends_at) - now)}`}` : ''}</div>
              <div className="mt-2 flex items-center gap-3 text-sm">
                <span className="font-bold text-emerald-700">👍 {yes}</span>
                <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-red-200"><div className="h-full bg-emerald-500" style={{ width: `${pct}%` }} /></div>
                <span className="font-bold text-red-700">👎 {no}</span>
              </div>
              {reasons.length > 0 && (
                <div className="mt-2">
                  <button type="button" className="text-xs font-semibold text-emerald-800 underline" onClick={() => setOpenId(openId === p.id ? null : p.id)}>{openId === p.id ? 'Hide' : 'Show'} the {reasons.length} "no" reason(s)</button>
                  {openId === p.id && (
                    <ul className="mt-2 grid max-h-72 gap-1.5 overflow-y-auto">
                      {reasons.map((r, i) => <li key={i} className="rounded-lg bg-red-50 px-3 py-2 text-sm"><span className="whitespace-pre-line">{r.reason}</span><span className="ml-2 text-xs text-emerald-900/50">{when(r.created_at)}</span></li>)}
                    </ul>
                  )}
                </div>
              )}
            </article>
          );
        })}
        {!polls.length && <p className="text-sm text-emerald-900/60">No votes yet.</p>}
      </div>
    </Card>
  );
}

/* ================= Giveaway ================= */
type Give = {
  id: number; title: string; prize: string; prize_image: string; details: string; is_on: boolean;
  starts_at: string | null; ends_at: string | null; need_page: boolean; need_group: boolean; need_share: boolean;
  page_url: string; group_url: string; post_url: string; winner_code: string | null; winner_name: string | null; winner_at: string | null; created_at: string;
};
type Entry = { id: number; code: string; fb_name: string; share_link: string | null; did_page: boolean; did_group: boolean; status: 'ok' | 'invalid'; created_at: string };

export function GiveawayCard({ toast, content }: { toast: ToastFn; content: unknown }) {
  const [list, setList] = useState<Give[]>([]);
  const [sel, setSel] = useState<number | null>(null);
  const [g, setG] = useState<Give | null>(null);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [hours, setHours] = useState(1);
  const [busy, setBusy] = useState(false);
  const [missing, setMissing] = useState(false);
  const now = useNow();
  const bonus = parseBonus(content);

  const load = useCallback(async () => {
    const { data, error } = await sb!.from('nusuk_giveaways').select('*').order('id', { ascending: false }).limit(30);
    if (error) { setMissing(true); return; }
    setMissing(false);
    const l = (data ?? []) as Give[];
    setList(l);
    setSel((cur) => (cur && l.some((x) => x.id === cur) ? cur : l[0]?.id ?? null));
  }, []);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { setG(list.find((x) => x.id === sel) ?? null); }, [list, sel]);
  const loadEntries = useCallback(async () => {
    if (!sel) return setEntries([]);
    const { data } = await sb!.from('nusuk_giveaway_entries').select('*').eq('giveaway_id', sel).order('created_at', { ascending: false }).limit(2000);
    setEntries((data ?? []) as Entry[]);
  }, [sel]);
  useEffect(() => { loadEntries(); const t = setInterval(loadEntries, 15000); return () => clearInterval(t); }, [loadEntries]);

  async function create() {
    const { data, error } = await sb!.from('nusuk_giveaways').insert({
      title: 'গিভঅ্যাওয়ে', prize: '৫০টি Key', page_url: bonus.page_url, group_url: bonus.group_url,
      details: 'নিচের কাজগুলো করে আপনার নুসুক কোড দিয়ে অংশ নিন। সময় শেষে লটারির মাধ্যমে একজন বিজয়ী বাছাই করা হবে।',
    }).select('id').single();
    if (error) return toast(errText(error), false);
    setSel((data as { id: number }).id);
    toast('New giveaway (hidden). Fill it in and press Start.');
    load();
  }
  const set = (p: Partial<Give>) => g && setG({ ...g, ...p });
  async function save(extra: Partial<Give> = {}) {
    if (!g) return;
    const n = { ...g, ...extra };
    for (const [k, v] of [['Post link', n.post_url], ['Page link', n.page_url], ['Group link', n.group_url]] as const) {
      if (v && !/^https:\/\//i.test(v)) return toast(`${k} must start with https://`, false);
    }
    if (n.need_share && !n.post_url) return toast('Add the post link people must share', false);
    setBusy(true);
    const { id, created_at, ...row } = n; // eslint-disable-line @typescript-eslint/no-unused-vars
    const { error } = await sb!.from('nusuk_giveaways').update(row).eq('id', g.id);
    setBusy(false);
    if (error) return toast(errText(error), false);
    toast('Saved');
    load();
  }
  async function start() {
    if (!g) return;
    if (!g.prize.trim() && !g.prize_image) return toast('Write the prize first', false);
    // One giveaway in the bar at a time
    await sb!.from('nusuk_giveaways').update({ is_on: false }).neq('id', g.id).eq('is_on', true);
    save({ is_on: true, starts_at: new Date().toISOString(), ends_at: new Date(Date.now() + hours * 3600e3).toISOString() });
  }
  async function draw() {
    if (!g) return;
    const ok = entries.filter((e) => e.status === 'ok').length;
    if (!ok) return toast('No valid entries to draw from', false);
    if (!confirm(`Draw one winner from ${ok} valid entries? The winner shows in the top bar.`)) return;
    const { data, error } = await sb!.rpc('nusuk_giveaway_draw', { p_id: g.id });
    if (error) return toast(errText(error), false);
    const r = data as { ok: boolean; code?: string; name?: string };
    if (!r.ok) return toast('No valid entries', false);
    toast(`🎉 Winner: ${r.name} (${r.code})`);
    load();
  }
  async function setStatus(e: Entry, status: Entry['status']) {
    const { error } = await sb!.from('nusuk_giveaway_entries').update({ status }).eq('id', e.id);
    if (error) return toast(errText(error), false);
    loadEntries();
  }
  async function pick(file?: File) {
    if (!file) return;
    try { const m = await uploadMedia(file, 'nusuk-giveaway'); set({ prize_image: m.url }); toast('Picture uploaded, click Save'); } catch (e) { toast(`Upload failed: ${errText(e)}`, false); }
  }
  async function remove() {
    if (!g || !confirm('Delete this giveaway and all its entries?')) return;
    const { error } = await sb!.from('nusuk_giveaways').delete().eq('id', g.id);
    if (error) return toast(errText(error), false);
    setSel(null);
    load();
  }

  if (missing) return <Missing title="🎁 Giveaway" />;
  const running = g?.is_on && g.starts_at && (!g.ends_at || Date.parse(g.ends_at) > now);
  const ended = g?.is_on && g.ends_at && Date.parse(g.ends_at) <= now;
  const okCount = entries.filter((e) => e.status === 'ok').length;

  return (
    <Card title="🎁 Giveaway (in the top bar)" actions={<Btn kind="gold" onClick={create}>+ New giveaway</Btn>}>
      <p className="mb-3 text-sm text-emerald-900/70">A prize for a few hours with a live countdown in the top bar. Visitors do the tasks, give their Nusuk code and Facebook name (and the share link), and join the draw. Check the entries, then draw a winner; the winner shows in the bar for a day.</p>
      {list.length > 1 && (
        <div className="mb-3 flex flex-wrap gap-1.5">
          {list.map((x) => <button key={x.id} type="button" onClick={() => setSel(x.id)} className={`rounded-full px-3 py-1 text-xs font-semibold ${sel === x.id ? 'bg-emerald-900 text-gold-100' : 'bg-emerald-50 text-emerald-900'}`}>{x.title} · {when(x.created_at)}</button>)}
        </div>
      )}
      {!g ? <p className="text-sm text-emerald-900/60">No giveaways yet. Click "+ New giveaway".</p> : (
        <div className="grid gap-4">
          <div className={`flex flex-wrap items-center gap-3 rounded-xl border p-3.5 ${running ? 'border-emerald-600/40 bg-emerald-50' : 'border-[#e7e1cf] bg-cream'}`}>
            <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${running ? 'bg-emerald-600 text-white' : 'bg-gray-200 text-gray-700'}`}>
              {running ? `LIVE · ends in ${g.ends_at ? countdownText(Date.parse(g.ends_at) - now) : '—'}` : ended ? 'Ended' : g.is_on ? 'ON' : 'Hidden'}
            </span>
            <span className="text-sm"><b>{okCount}</b> valid entries{entries.length > okCount ? ` (${entries.length - okCount} marked invalid)` : ''}</span>
            <span className="ml-auto flex flex-wrap items-center gap-2">
              <input type="number" min={0.25} max={720} step={0.25} className="nk-input w-20 py-1.5! font-normal" value={hours} onChange={(e) => setHours(Math.max(0.25, +e.target.value || 1))} aria-label="Hours" />
              <span className="text-sm">hours</span>
              {[1, 2, 5, 12, 24].map((h) => <Btn key={h} kind="ghost" className="px-2! py-1! text-xs!" onClick={() => setHours(h)}>{h}h</Btn>)}
              <Btn kind="gold" onClick={start} disabled={busy}>▶ Start now</Btn>
              {g.is_on && <Btn kind="ghost" onClick={() => save({ is_on: false })}>Hide</Btn>}
            </span>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Title"><input className="nk-input font-normal" maxLength={80} value={g.title} onChange={(e) => set({ title: e.target.value })} /></Field>
            <Field label="Prize" hint="e.g. ৫০টি Key, or the name of a book"><input className="nk-input font-normal" maxLength={120} value={g.prize} onChange={(e) => set({ prize: e.target.value })} /></Field>
          </div>
          <Field label="Prize picture (optional)" hint="e.g. a photo of the book you'll gift">
            <div className="flex gap-2">
              <input className="nk-input font-normal" value={g.prize_image} onChange={(e) => set({ prize_image: e.target.value })} placeholder="https://…" />
              <label className="nk-btn nk-ghost shrink-0 cursor-pointer px-3 text-sm">Upload<input type="file" accept="image/*" className="sr-only" onChange={(e) => { pick(e.target.files?.[0]); e.target.value = ''; }} /></label>
            </div>
            {g.prize_image && <img src={g.prize_image} alt="" className="mt-1 max-h-32 w-auto self-start rounded-lg border object-contain" />}
          </Field>
          <Field label="Details"><textarea rows={3} maxLength={1000} className="nk-input font-normal" value={g.details} onChange={(e) => set({ details: e.target.value })} /></Field>

          <div className="grid gap-2 rounded-xl border border-[#1877f2]/25 bg-[#1877f2]/5 p-3.5">
            <b className="text-sm">Tasks to enter</b>
            {([['need_page', 'page_url', '📘 Follow the Facebook page'], ['need_group', 'group_url', '👥 Join the community group'], ['need_share', 'post_url', '📢 Share a Facebook post (they give the share link)']] as const).map(([need, url, label]) => (
              <div key={need} className="grid gap-1.5 sm:grid-cols-[16rem_1fr] sm:items-center">
                <label className="flex items-center gap-2 text-sm font-semibold"><input type="checkbox" className="h-4 w-4 accent-emerald-700" checked={g[need]} onChange={(e) => set({ [need]: e.target.checked } as Partial<Give>)} /> {label}</label>
                {g[need] && <input className="nk-input py-1.5! font-normal" value={g[url]} onChange={(e) => set({ [url]: e.target.value } as Partial<Give>)} placeholder="https://www.facebook.com/…" />}
              </div>
            ))}
            <p className="text-xs text-emerald-900/60">Everyone also gives their Nusuk code (that goes into the draw) and Facebook profile name (for checking).</p>
          </div>
          <div className="flex flex-wrap justify-between gap-2">
            <Btn onClick={() => save()} disabled={busy}>{busy ? 'Saving…' : 'Save'}</Btn>
            <button type="button" className="text-xs font-semibold text-red-700 underline" onClick={remove}>Delete this giveaway…</button>
          </div>

          <div className="grid gap-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <b>Entries ({entries.length})</b>
              <span className="flex gap-2">
                <Btn kind="ghost" className="px-2.5! py-1!" onClick={loadEntries}>Refresh</Btn>
                <Btn kind="gold" onClick={draw}>🎲 Draw winner</Btn>
                {g.winner_code && <Btn kind="ghost" className="text-red-700" onClick={() => confirm('Remove the winner (to draw again)?') && save({ winner_code: null, winner_name: null, winner_at: null })}>Clear winner</Btn>}
              </span>
            </div>
            {g.winner_code && <div className="rounded-xl bg-emerald-900 px-4 py-3 text-gold-100">🏆 Winner: <b>{g.winner_name}</b> · <span className="font-mono">{g.winner_code}</span> <span className="text-xs opacity-75">({when(g.winner_at)})</span></div>}
            <p className="text-xs text-emerald-900/60">Before giving the prize, check the winner's Facebook name in your page followers / group members and open their share link. Mark fake entries "Invalid" so they're left out of the draw.</p>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[36rem] text-sm">
                <thead><tr className="border-b text-left text-xs text-emerald-900/60"><th className="py-1.5 pr-2">Code</th><th className="pr-2">Facebook name</th><th className="pr-2">Tasks</th><th className="pr-2">Share link</th><th className="pr-2">Time</th><th /></tr></thead>
                <tbody>
                  {entries.map((e) => (
                    <tr key={e.id} className={`border-b border-emerald-900/5 ${e.status === 'invalid' ? 'opacity-50 line-through' : ''}`}>
                      <td className="py-1.5 pr-2 font-mono">{e.code}</td>
                      <td className="pr-2">{e.fb_name}</td>
                      <td className="pr-2 text-xs">{e.did_page ? '📘' : ''}{e.did_group ? '👥' : ''}</td>
                      <td className="max-w-[10rem] truncate pr-2">{e.share_link ? <a href={e.share_link} target="_blank" rel="noopener noreferrer" className="text-emerald-800 underline">open ↗</a> : ''}</td>
                      <td className="pr-2 text-xs text-emerald-900/60">{when(e.created_at)}</td>
                      <td><Btn kind="ghost" className="px-2! py-0.5! text-xs!" onClick={() => setStatus(e, e.status === 'ok' ? 'invalid' : 'ok')}>{e.status === 'ok' ? 'Invalid' : 'Valid'}</Btn></td>
                    </tr>
                  ))}
                  {!entries.length && <tr><td colSpan={6} className="py-5 text-center text-emerald-900/60">No entries yet.</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </Card>
  );
}
