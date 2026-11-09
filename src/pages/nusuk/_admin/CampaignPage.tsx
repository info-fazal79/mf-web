/* Nusuk Manager → Campaign: share campaign (tables nusuk_camp_*, see _sql/update_17_campaign.sql). */
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { supabase as sb } from '@/lib/supabase';
import { uploadMedia } from '@/admin/media';

type ToastFn = (t: string, ok?: boolean) => void;
type CampSettings = {
  published: boolean; title: string; rules: string; starts: string | null; ends: string | null;
  go_to: 'post' | 'nusuk'; secret: string; last_fb_hit: string | null;
};
type Post = { id: number; url: string; title: string; body: string; image: string; active: boolean; sort: number };
type BoardRow = { code: string; fb_profile: string; shares: number; follow: number; joined: number; total: number };
type Draw = {
  id: number; kind: 'day' | 'week' | 'final'; from_day: string; to_day: string; method: 'weighted' | 'top';
  code: string; fb_profile: string | null; tickets: number; pool_people: number; pool_tickets: number;
  status: 'drawn' | 'confirmed' | 'void'; created_at: string;
};
type Period = { kind: 'day' | 'week' | 'final'; from: string; to: string; label: string };

const errText = (e: unknown) => (e && typeof e === 'object' && 'message' in e ? String((e as { message: string }).message) : String(e));
const FB_RE = /^https:\/\/([a-z0-9-]+\.)*(facebook\.com|fb\.com|fb\.me)(\/|$)/i;
const dhaka = (d = new Date()) => d.toLocaleDateString('en-CA', { timeZone: 'Asia/Dhaka' });
const addDays = (s: string, n: number) => { const d = new Date(`${s}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const weekStart = (s: string) => { const dow = new Date(`${s}T00:00:00Z`).getUTCDay(); return addDays(s, -((dow + 1) % 7)); }; // Saturday
const when = (iso: string | null) => (iso ? new Date(iso).toLocaleString('en-GB', { timeZone: 'Asia/Dhaka', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : 'never');

function Card({ title, actions, children }: { title: string; actions?: ReactNode; children: ReactNode }) {
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
function Switch({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button type="button" role="switch" aria-checked={on} aria-label={label} onClick={() => onChange(!on)}
      className={`relative h-6 w-11 shrink-0 rounded-full transition ${on ? 'bg-emerald-600' : 'bg-gray-300'}`}>
      <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${on ? 'left-[22px]' : 'left-0.5'}`} />
    </button>
  );
}

function periodOf(kind: Period['kind'], day: string, s: CampSettings | null): Period {
  if (kind === 'day') return { kind, from: day, to: day, label: `Day ${day}` };
  if (kind === 'week') { const w = weekStart(day); return { kind, from: w, to: addDays(w, 6), label: `Week ${w} → ${addDays(w, 6)}` }; }
  const from = s?.starts || '2000-01-01', to = s?.ends || '2999-12-31';
  return { kind, from, to, label: `Final (${s?.starts || 'start'} → ${s?.ends || 'no end'})` };
}

/* ---------------- Settings + setup ---------------- */
function SettingsCard({ s, setS, toast, reload }: { s: CampSettings; setS: (s: CampSettings) => void; toast: ToastFn; reload: () => void }) {
  const [busy, setBusy] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [showSecret, setShowSecret] = useState(false);
  const set = (p: Partial<CampSettings>) => { setS({ ...s, ...p }); setDirty(true); };

  async function save(next = s) {
    if (next.starts && next.ends && next.ends < next.starts) return toast('End date is before the start date', false);
    setBusy(true);
    const { error } = await sb!.from('nusuk_camp_settings').update({
      published: next.published, title: next.title.trim() || 'শেয়ার করুন, পুরস্কার জিতুন', rules: next.rules,
      starts: next.starts || null, ends: next.ends || null, go_to: next.go_to, updated_at: new Date().toISOString(),
    }).eq('id', 1);
    setBusy(false);
    if (error) return toast(errText(error), false);
    setDirty(false);
    toast(next.published ? 'Saved · campaign is PUBLIC' : 'Saved · campaign is hidden (only you can see it)');
    reload();
  }
  const fresh = s.last_fb_hit && Date.now() - new Date(s.last_fb_hit).getTime() < 7 * 864e5;

  return (
    <>
      <Card title="Campaign" actions={<><a href="/nusuk/" target="_blank" rel="noopener" className="nk-btn nk-ghost px-3.5 py-2 text-sm">Open /nusuk ↗</a><Btn onClick={() => save()} disabled={busy || !dirty}>{busy ? 'Saving…' : dirty ? 'Save' : 'Saved'}</Btn></>}>
        <div className={`flex items-center gap-3 rounded-xl border p-3.5 ${s.published ? 'border-emerald-600/40 bg-emerald-50' : 'border-gold-500/60 bg-gold-100/40'}`}>
          <Switch on={s.published} onChange={(v) => { const n = { ...s, published: v }; setS(n); save(n); }} label="Publish the campaign" />
          <div>
            <div className="font-semibold">{s.published ? '🌍 Published: everyone sees the campaign button on /nusuk' : '👁️ Hidden: only you see it'}</div>
            <div className="text-xs text-emerald-900/65">
              {s.published
                ? 'Switch off to hide it again. Shares already counted are kept.'
                : 'Open /nusuk in this browser (you are signed in here) to test it. Visitors cannot see or use it. Switch saves at once.'}
            </div>
          </div>
        </div>
        <div className="mt-4 grid gap-3">
          <Field label="Title"><input className="nk-input font-normal" maxLength={120} value={s.title} onChange={(e) => set({ title: e.target.value })} /></Field>
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Starts" hint="Shares count from this day."><input type="date" className="nk-input font-normal" value={s.starts ?? ''} onChange={(e) => set({ starts: e.target.value || null })} /></Field>
            <Field label="Ends" hint="Last day (inclusive)."><input type="date" className="nk-input font-normal" value={s.ends ?? ''} onChange={(e) => set({ ends: e.target.value || null })} /></Field>
            <Field label="When people click a shared link">
              <select className="nk-input font-normal" value={s.go_to} onChange={(e) => set({ go_to: e.target.value as CampSettings['go_to'] })}>
                <option value="post">Open the Facebook post</option>
                <option value="nusuk">Open /nusuk</option>
              </select>
            </Field>
          </div>
          <Field label="Rules (shown to visitors)" hint="Leave empty to use the built-in rules. Mention the prizes and dates here.">
            <textarea rows={6} className="nk-input font-normal" value={s.rules} onChange={(e) => set({ rules: e.target.value })} placeholder="১. … (empty = default rules)" />
          </Field>
        </div>
      </Card>

      <Card title="Setup (one time)">
        <div className={`mb-3 rounded-xl px-3.5 py-2.5 text-sm ${fresh ? 'bg-emerald-50 text-emerald-900' : 'bg-gold-100/60 text-emerald-950'}`}>
          Last time Facebook read a campaign link: <b>{when(s.last_fb_hit)}</b>
          {!fresh && <span className="block text-xs">If this stays "never" after you share a test link, the Cloudflare secret below is missing or wrong.</span>}
        </div>
        <ol className="grid list-decimal gap-1.5 pl-5 text-sm text-emerald-950">
          <li>Open <b>dash.cloudflare.com → Workers &amp; Pages → mf-web → Settings → Variables and Secrets</b>.</li>
          <li>Click <b>Add</b>, type <b>Secret</b>, name <code className="rounded bg-emerald-50 px-1 font-mono">NUSUK_CAMP_SECRET</code>, and paste the value below. Deploy.</li>
          <li>On /nusuk, join with your own code, copy a link and put it in a Facebook post (Only me is fine for a test). The ✓ should appear within a few seconds.</li>
        </ol>
        <div className="mt-3 flex flex-wrap gap-2">
          <input readOnly className="nk-input min-w-0 flex-1 font-mono text-xs" value={showSecret ? s.secret : '••••••••••••••••••••••••••••••••'} aria-label="Worker secret" />
          <Btn kind="ghost" onClick={() => setShowSecret(!showSecret)}>{showSecret ? 'Hide' : 'Show'}</Btn>
          <Btn kind="gold" onClick={() => { navigator.clipboard.writeText(s.secret).then(() => toast('Secret copied')); }}>Copy</Btn>
        </div>
      </Card>
    </>
  );
}

/* ---------------- Posts ---------------- */
function PostsCard({ toast }: { toast: ToastFn }) {
  const [posts, setPosts] = useState<Post[]>([]);
  const [edit, setEdit] = useState<Partial<Post> | null>(null);
  const [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    const { data, error } = await sb!.from('nusuk_camp_posts').select('*').order('sort').order('id');
    if (error) return toast(errText(error), false);
    setPosts((data ?? []) as Post[]);
  }, [toast]);
  useEffect(() => { load(); }, [load]);

  async function save() {
    if (!edit) return;
    const url = (edit.url ?? '').trim(), image = (edit.image ?? '').trim();
    if (!FB_RE.test(url)) return toast('Post link must be a https://facebook.com/… link', false);
    if (image && !/^https:\/\//i.test(image)) return toast('Picture must be an https:// link', false);
    setBusy(true);
    const row = { url, title: (edit.title ?? '').trim(), body: (edit.body ?? '').trim(), image, active: edit.active ?? true };
    const { error } = edit.id
      ? await sb!.from('nusuk_camp_posts').update(row).eq('id', edit.id)
      : await sb!.from('nusuk_camp_posts').insert({ ...row, sort: (posts.at(-1)?.sort ?? 0) + 1 });
    setBusy(false);
    if (error) return toast(errText(error), false);
    setEdit(null);
    toast('Post saved');
    load();
  }
  async function patch(p: Post, v: Partial<Post>) {
    const { error } = await sb!.from('nusuk_camp_posts').update(v).eq('id', p.id);
    if (error) return toast(errText(error), false);
    load();
  }
  async function move(i: number, d: -1 | 1) {
    const a = posts[i], b = posts[i + d];
    if (!a || !b) return;
    await sb!.from('nusuk_camp_posts').update({ sort: b.sort }).eq('id', a.id);
    await sb!.from('nusuk_camp_posts').update({ sort: a.sort === b.sort ? a.sort + d : a.sort }).eq('id', b.id);
    load();
  }
  async function remove(p: Post) {
    if (!confirm('Delete this post? Its links and counted shares are deleted too.')) return;
    const { error } = await sb!.from('nusuk_camp_posts').delete().eq('id', p.id);
    if (error) return toast(errText(error), false);
    load();
  }
  async function pick(file?: File) {
    if (!file || !edit) return;
    try { const m = await uploadMedia(file, 'nusuk-campaign'); setEdit({ ...edit, image: m.url }); } catch (e) { toast(`Upload failed: ${errText(e)}`, false); }
  }

  return (
    <Card title={`Posts to share (${posts.filter((p) => p.active).length} active)`} actions={!edit && <Btn kind="gold" onClick={() => setEdit({ active: true })}>+ Add post</Btn>}>
      <p className="mb-3 text-xs text-emerald-900/60">Each active post gives every participant one personal link per day, so with 5 active posts someone can earn up to 5 shares a day. The title, text and picture are what the shared link shows on Facebook.</p>
      {edit && (
        <div className="mb-4 grid gap-3 rounded-xl border border-gold-500/50 bg-gold-100/30 p-3.5">
          <Field label="Facebook post link *"><input className="nk-input font-normal" value={edit.url ?? ''} onChange={(e) => setEdit({ ...edit, url: e.target.value })} placeholder="https://www.facebook.com/…/posts/…" /></Field>
          <Field label="Preview title"><input className="nk-input font-normal" maxLength={120} value={edit.title ?? ''} onChange={(e) => setEdit({ ...edit, title: e.target.value })} placeholder="নুসুক উমরাহ কোড শেয়ার" /></Field>
          <Field label="Preview text"><textarea rows={2} maxLength={300} className="nk-input font-normal" value={edit.body ?? ''} onChange={(e) => setEdit({ ...edit, body: e.target.value })} /></Field>
          <Field label="Preview picture" hint="1200×630 looks best on Facebook.">
            <div className="flex gap-2">
              <input className="nk-input font-normal" value={edit.image ?? ''} onChange={(e) => setEdit({ ...edit, image: e.target.value })} placeholder="https://…" />
              <label className="nk-btn nk-ghost shrink-0 cursor-pointer px-3 text-sm">Upload<input type="file" accept="image/*" className="sr-only" onChange={(e) => { pick(e.target.files?.[0]); e.target.value = ''; }} /></label>
            </div>
            {edit.image && <img src={edit.image} alt="" className="mt-1 max-h-28 w-auto self-start rounded-lg border object-contain" />}
          </Field>
          <div className="flex gap-2"><Btn onClick={save} disabled={busy}>{busy ? 'Saving…' : 'Save post'}</Btn><Btn kind="ghost" onClick={() => setEdit(null)}>Cancel</Btn></div>
        </div>
      )}
      <div className="grid gap-2">
        {posts.map((p, i) => (
          <article key={p.id} className={`flex flex-wrap items-center gap-3 rounded-xl border p-3 ${p.active ? 'border-emerald-600/30 bg-white' : 'border-[#e7e1cf] bg-gray-50 opacity-70'}`}>
            <Switch on={p.active} onChange={(v) => patch(p, { active: v })} label="Active" />
            {p.image ? <img src={p.image} alt="" className="h-12 w-12 rounded-lg object-cover" /> : <span className="grid h-12 w-12 place-items-center rounded-lg bg-[#1877f2] font-bold text-white">f</span>}
            <div className="min-w-0 flex-1">
              <div className="truncate font-semibold">{p.title || <span className="text-emerald-900/50">No title</span>}</div>
              <a href={p.url} target="_blank" rel="noopener noreferrer" className="block truncate text-xs text-emerald-800 underline">{p.url}</a>
            </div>
            <span className="flex gap-1">
              <Btn kind="ghost" className="px-2! py-1!" disabled={i === 0} onClick={() => move(i, -1)} aria-label="Move up">↑</Btn>
              <Btn kind="ghost" className="px-2! py-1!" disabled={i === posts.length - 1} onClick={() => move(i, 1)} aria-label="Move down">↓</Btn>
              <Btn kind="ghost" className="px-2.5! py-1!" onClick={() => setEdit(p)}>Edit</Btn>
              <Btn kind="ghost" className="px-2.5! py-1! text-red-700" onClick={() => remove(p)}>Delete</Btn>
            </span>
          </article>
        ))}
        {!posts.length && !edit && <p className="rounded-xl bg-emerald-50 p-6 text-center text-sm text-emerald-900/70">No posts yet. Add the Facebook posts you want people to share.</p>}
      </div>
    </Card>
  );
}

/* ---------------- Leaderboard + draw ---------------- */
function BoardCard({ s, toast }: { s: CampSettings; toast: ToastFn }) {
  const [kind, setKind] = useState<Period['kind']>('day');
  const [day, setDay] = useState(dhaka());
  const [rows, setRows] = useState<BoardRow[]>([]);
  const [method, setMethod] = useState<'weighted' | 'top'>('weighted');
  const [draws, setDraws] = useState<Draw[]>([]);
  const [busy, setBusy] = useState(false);
  const p = periodOf(kind, day, s);

  const load = useCallback(async () => {
    const [b, d] = await Promise.all([
      sb!.rpc('nusuk_camp_admin_board', { p_from: p.from, p_to: p.to, p_final: p.kind === 'final' }),
      sb!.from('nusuk_camp_draws').select('*').order('created_at', { ascending: false }).limit(50),
    ]);
    if (b.error) toast(errText(b.error), false);
    setRows((b.data ?? []) as BoardRow[]);
    setDraws((d.data ?? []) as Draw[]);
  }, [p.from, p.to, p.kind, toast]);
  useEffect(() => { load(); }, [load]);

  async function draw() {
    if (!confirm(`Draw a winner for ${p.label}?\nMethod: ${method === 'weighted' ? 'every share is one ticket' : 'only the top scorers, equal chance'}\nThe result is saved.`)) return;
    setBusy(true);
    const { data, error } = await sb!.rpc('nusuk_camp_draw', { p_kind: p.kind, p_from: p.from, p_to: p.to, p_method: method });
    setBusy(false);
    if (error) return toast(errText(error), false);
    const r = data as { ok: boolean; reason?: string; draw?: Draw };
    if (!r.ok) return toast(r.reason === 'empty' ? 'Nobody to draw from (no points, or everyone was already drawn).' : 'Draw failed', false);
    toast(`🎉 Winner: ${r.draw!.code}`);
    load();
  }
  async function setStatus(d: Draw, status: Draw['status']) {
    const { error } = await sb!.from('nusuk_camp_draws').update({ status }).eq('id', d.id);
    if (error) return toast(errText(error), false);
    load();
  }
  const kinds: [Period['kind'], string][] = [['day', 'Daily'], ['week', 'Weekly'], ['final', 'Final']];
  const stBadge: Record<Draw['status'], string> = { drawn: 'bg-gold-500 text-emerald-950', confirmed: 'bg-emerald-600 text-white', void: 'bg-red-100 text-red-700 line-through' };
  const sumTickets = rows.reduce((a, r) => a + r.total, 0);

  return (
    <>
      <Card title="Leaderboard" actions={<Btn kind="ghost" onClick={load}>Refresh</Btn>}>
        <div className="mb-3 flex flex-wrap items-end gap-2">
          <div className="flex rounded-full bg-emerald-50 p-1">
            {kinds.map(([k, l]) => <button key={k} type="button" onClick={() => setKind(k)} className={`rounded-full px-3 py-1 text-sm font-semibold ${kind === k ? 'bg-emerald-900 text-gold-100' : 'text-emerald-900'}`}>{l}</button>)}
          </div>
          {kind !== 'final' && <input type="date" className="nk-input w-40 py-1.5!" value={day} onChange={(e) => setDay(e.target.value || dhaka())} aria-label="Day" />}
          <span className="text-xs text-emerald-900/60">{p.label} · {rows.length} people · {sumTickets} {kind === 'final' ? 'points' : 'shares'}</span>
        </div>
        <p className="mb-2 text-xs text-emerald-900/60">{kind === 'final' ? 'Final = all shares in the campaign + 1 for following the page + 1 for joining the group.' : 'Daily and weekly count shares only. Weeks run Saturday → Friday.'}</p>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[34rem] text-sm">
            <thead><tr className="border-b text-left text-xs text-emerald-900/60"><th className="py-1.5 pr-2">#</th><th className="pr-2">Code</th><th className="pr-2">Facebook</th><th className="pr-2 text-right">Shares</th>{kind === 'final' && <><th className="pr-2 text-right">Follow</th><th className="pr-2 text-right">Group</th></>}<th className="text-right">Total</th></tr></thead>
            <tbody>
              {rows.slice(0, 100).map((r, i) => (
                <tr key={r.code} className="border-b border-emerald-900/5">
                  <td className="py-1.5 pr-2 text-emerald-900/60">{i + 1}</td>
                  <td className="pr-2 font-mono font-semibold">{r.code}</td>
                  <td className="max-w-[12rem] truncate pr-2"><a href={r.fb_profile} target="_blank" rel="noopener noreferrer" className="text-emerald-800 underline">profile ↗</a></td>
                  <td className="pr-2 text-right">{r.shares}</td>
                  {kind === 'final' && <><td className="pr-2 text-right">{r.follow ? '✓' : ''}</td><td className="pr-2 text-right">{r.joined ? '✓' : ''}</td></>}
                  <td className="text-right font-bold">{r.total}</td>
                </tr>
              ))}
              {!rows.length && <tr><td colSpan={7} className="py-6 text-center text-emerald-900/60">No points for this period yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </Card>

      <Card title="Draw a winner">
        <div className="flex flex-wrap items-end gap-3">
          <div className="text-sm"><div className="text-xs text-emerald-900/60">Period</div><b>{p.label}</b></div>
          <Field label="Method">
            <select className="nk-input py-1.5! font-normal" value={method} onChange={(e) => setMethod(e.target.value as typeof method)}>
              <option value="weighted">Every share = 1 ticket (more shares, better chance)</option>
              <option value="top">Only the top scorers, equal chance</option>
            </select>
          </Field>
          <Btn kind="gold" onClick={draw} disabled={busy || !rows.length}>{busy ? 'Drawing…' : '🎲 Draw'}</Btn>
        </div>
        <p className="mt-2 text-xs text-emerald-900/60">Pick Daily / Weekly / Final and the day in the leaderboard above. Before giving a prize: open the winner's Facebook profile to check the posts, and ask for a screenshot of the code in the Nusuk app. If they fail, mark the draw Void and draw again (they are skipped).</p>
        <div className="mt-3 grid gap-2">
          {draws.map((d) => (
            <article key={d.id} className="flex flex-wrap items-center gap-2 rounded-xl border border-[#e7e1cf] bg-white p-3 text-sm">
              <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${stBadge[d.status]}`}>{d.status}</span>
              <b className="font-mono">{d.code}</b>
              {d.fb_profile && <a href={d.fb_profile} target="_blank" rel="noopener noreferrer" className="text-emerald-800 underline">profile ↗</a>}
              <span className="text-xs text-emerald-900/60">{d.kind} {d.from_day === d.to_day ? d.from_day : `${d.from_day} → ${d.to_day}`} · {d.tickets}/{d.pool_tickets} tickets · {d.pool_people} people · {d.method} · {when(d.created_at)}</span>
              <span className="ml-auto flex gap-1">
                {d.status !== 'confirmed' && <Btn kind="ghost" className="px-2.5! py-1!" onClick={() => setStatus(d, 'confirmed')}>✓ Confirm</Btn>}
                {d.status !== 'void' && <Btn kind="ghost" className="px-2.5! py-1! text-red-700" onClick={() => setStatus(d, 'void')}>Void</Btn>}
              </span>
            </article>
          ))}
          {!draws.length && <p className="text-sm text-emerald-900/60">No draws yet.</p>}
        </div>
      </Card>
    </>
  );
}

export default function CampaignPage({ toast }: { toast: ToastFn }) {
  const [s, setS] = useState<CampSettings | null>(null);
  const [missing, setMissing] = useState(false);
  const [people, setPeople] = useState(0);
  const load = useCallback(async () => {
    const { data, error } = await sb!.from('nusuk_camp_settings').select('*').eq('id', 1).maybeSingle();
    if (error || !data) { setMissing(true); return; }
    setMissing(false);
    setS(data as CampSettings);
    const c = await sb!.from('nusuk_camp_people').select('code', { count: 'exact', head: true });
    setPeople(c.count ?? 0);
  }, []);
  useEffect(() => { load(); }, [load]);

  if (missing) {
    return <Card title="Campaign"><p className="text-sm">Run <code className="font-mono">src/pages/nusuk/_sql/update_17_campaign.sql</code> in Supabase → SQL Editor, then reload this page.</p></Card>;
  }
  if (!s) return <p className="p-6 text-center text-sm text-emerald-900/60">Loading…</p>;
  return (
    <div className="grid gap-4">
      <SettingsCard s={s} setS={setS} toast={toast} reload={load} />
      <PostsCard toast={toast} />
      <p className="text-center text-sm text-emerald-900/70">Participants so far: <b>{people}</b></p>
      <BoardCard s={s} toast={toast} />
    </div>
  );
}
