/* Nusuk Manager → Campaign: share campaigns (tables nusuk_campaigns / nusuk_camp_*, see _sql/update_18_campaigns.sql). */
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { supabase as sb } from '@/lib/supabase';
import { uploadMedia } from '@/admin/media';

type ToastFn = (t: string, ok?: boolean) => void;
type Status = 'hidden' | 'live' | 'closed';
type Campaign = {
  id: number; title: string; rules: string; status: Status; starts: string | null; ends: string | null;
  go_to: 'post' | 'nusuk'; follow_points: number; join_points: number; created_at: string;
};
type Config = { secret: string; last_fb_hit: string | null };
type Post = {
  id: number; campaign_id: number; url: string; title: string; body: string; image: string; active: boolean; sort: number;
  points: number; every_days: number; from_day: string | null; to_day: string | null;
};
type BoardRow = { code: string; fb_profile: string; shares: number; share_points: number; bonus: number; total: number };
type Draw = {
  id: number; campaign_id: number; from_day: string; to_day: string; with_bonus: boolean; method: 'weighted' | 'top';
  code: string; fb_profile: string | null; points: number; pool_people: number; pool_points: number;
  status: 'drawn' | 'confirmed' | 'void'; created_at: string;
};

const errText = (e: unknown) => (e && typeof e === 'object' && 'message' in e ? String((e as { message: string }).message) : String(e));
const FB_RE = /^https:\/\/([a-z0-9-]+\.)*(facebook\.com|fb\.com|fb\.me)(\/|$)/i;
const dhaka = (d = new Date()) => d.toLocaleDateString('en-CA', { timeZone: 'Asia/Dhaka' });
const addDays = (s: string, n: number) => { const d = new Date(`${s}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const weekStart = (s: string) => { const dow = new Date(`${s}T00:00:00Z`).getUTCDay(); return addDays(s, -((dow + 1) % 7)); }; // Saturday
const when = (iso: string | null) => (iso ? new Date(iso).toLocaleString('en-GB', { timeZone: 'Asia/Dhaka', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : 'never');
const everyLabel = (n: number) => (n === 0 ? 'once in the campaign' : n === 1 ? 'once a day' : n === 7 ? 'once a week' : `once every ${n} days`);
const statusInfo: Record<Status, { label: string; cls: string; hint: string }> = {
  hidden: { label: 'Hidden', cls: 'bg-gold-500 text-emerald-950', hint: 'Only you see it on /nusuk (in this browser, while signed in to Nusuk Manager). Use it to test.' },
  live: { label: 'Live', cls: 'bg-emerald-600 text-white', hint: 'Everyone sees the campaign button on /nusuk. Only one campaign can be Live.' },
  closed: { label: 'Closed', cls: 'bg-gray-200 text-gray-700', hint: 'Finished. Nobody sees it and no more shares count. The results stay here.' },
};

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
function Switch({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button type="button" role="switch" aria-checked={on} aria-label={label} onClick={() => onChange(!on)}
      className={`relative h-6 w-11 shrink-0 rounded-full transition ${on ? 'bg-emerald-600' : 'bg-gray-300'}`}>
      <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${on ? 'left-[22px]' : 'left-0.5'}`} />
    </button>
  );
}

/* ---------------- One campaign's settings ---------------- */
function SettingsCard({ c, onSaved, onDelete, toast }: { c: Campaign; onSaved: () => void; onDelete: () => void; toast: ToastFn }) {
  const [f, setF] = useState(c);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  useEffect(() => { setF(c); setDirty(false); }, [c]);
  const set = (p: Partial<Campaign>) => { setF({ ...f, ...p }); setDirty(true); };

  async function save() {
    if (f.starts && f.ends && f.ends < f.starts) return toast('End date is before the start date', false);
    setBusy(true);
    const { error } = await sb!.from('nusuk_campaigns').update({
      title: f.title.trim() || 'শেয়ার করুন, পুরস্কার জিতুন', rules: f.rules, status: f.status, starts: f.starts || null, ends: f.ends || null,
      go_to: f.go_to, follow_points: Math.max(0, Math.round(f.follow_points) || 0), join_points: Math.max(0, Math.round(f.join_points) || 0),
    }).eq('id', c.id);
    setBusy(false);
    if (error) return toast(/one_live/.test(error.message) ? 'Another campaign is already Live. Close it (or set it Hidden) first.' : errText(error), false);
    setDirty(false);
    toast(f.status === 'live' ? 'Saved · this campaign is LIVE for everyone' : f.status === 'hidden' ? 'Saved · hidden, only you can see it' : 'Saved · closed');
    onSaved();
  }

  return (
    <Card
      title={<>Campaign settings <span className={`ml-1 rounded-full px-2 py-0.5 align-middle text-xs ${statusInfo[c.status].cls}`}>{statusInfo[c.status].label}</span></>}
      actions={<><a href="/nusuk/" target="_blank" rel="noopener" className="nk-btn nk-ghost px-3.5 py-2 text-sm">Open /nusuk ↗</a><Btn onClick={save} disabled={busy || !dirty}>{busy ? 'Saving…' : dirty ? 'Save' : 'Saved'}</Btn></>}
    >
      <div className="grid gap-3">
        <Field label="Status (who can see it)">
          <div className="grid gap-2 sm:grid-cols-3">
            {(Object.keys(statusInfo) as Status[]).map((k) => (
              <button key={k} type="button" onClick={() => set({ status: k })}
                className={`rounded-xl border p-2.5 text-left text-sm ${f.status === k ? 'border-emerald-700 bg-emerald-50 ring-2 ring-emerald-600/30' : 'border-[#e7e1cf] bg-white'}`}>
                <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${statusInfo[k].cls}`}>{statusInfo[k].label}</span>
                <span className="mt-1 block text-xs font-normal text-emerald-900/70">{statusInfo[k].hint}</span>
              </button>
            ))}
          </div>
        </Field>
        <Field label="Title"><input className="nk-input font-normal" maxLength={120} value={f.title} onChange={(e) => set({ title: e.target.value })} /></Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Starts" hint="Shares count from this day (Bangladesh time)."><input type="date" className="nk-input font-normal" value={f.starts ?? ''} onChange={(e) => set({ starts: e.target.value || null })} /></Field>
          <Field label="Ends" hint="Last day (inclusive). Empty = no end."><input type="date" className="nk-input font-normal" value={f.ends ?? ''} onChange={(e) => set({ ends: e.target.value || null })} /></Field>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="📘 Points for following the page" hint="Once per person."><input type="number" min={0} max={1000} className="nk-input font-normal" value={f.follow_points} onChange={(e) => set({ follow_points: +e.target.value })} /></Field>
          <Field label="👥 Points for joining the group" hint="Once per person."><input type="number" min={0} max={1000} className="nk-input font-normal" value={f.join_points} onChange={(e) => set({ join_points: +e.target.value })} /></Field>
          <Field label="When a friend clicks a shared link" hint="Where people go who click the link in someone's Facebook post. Does not change counting.">
            <select className="nk-input font-normal" value={f.go_to} onChange={(e) => set({ go_to: e.target.value as Campaign['go_to'] })}>
              <option value="post">Open your Facebook post</option>
              <option value="nusuk">Open the /nusuk page</option>
            </select>
          </Field>
        </div>
        <p className="-mt-1 text-xs text-emerald-900/60">The page and group links come from Nusuk Manager → Community &amp; bonus.</p>
        <Field label="Rules (shown to visitors)" hint="Leave empty for the built-in rules. Write the prizes and dates here.">
          <textarea rows={6} className="nk-input font-normal" value={f.rules} onChange={(e) => set({ rules: e.target.value })} placeholder="১. … (empty = default rules)" />
        </Field>
        <div className="flex justify-end"><button type="button" className="text-xs font-semibold text-red-700 underline" onClick={onDelete}>Delete this campaign…</button></div>
      </div>
    </Card>
  );
}

/* ---------------- Worker setup (shared) ---------------- */
function SetupCard({ cfg, toast }: { cfg: Config; toast: ToastFn }) {
  const [show, setShow] = useState(false);
  const fresh = !!cfg.last_fb_hit && Date.now() - new Date(cfg.last_fb_hit).getTime() < 14 * 864e5;
  return (
    <details className="nk-card p-4 sm:p-5" open={!cfg.last_fb_hit}>
      <summary className="cursor-pointer text-base font-bold text-emerald-950">
        Setup (one time) {cfg.last_fb_hit ? <span className="ml-1 rounded-full bg-emerald-100 px-2 py-0.5 text-xs text-emerald-800">✓ working · Facebook last read a link {when(cfg.last_fb_hit)}</span> : <span className="ml-1 rounded-full bg-gold-500 px-2 py-0.5 text-xs text-emerald-950">not tested yet</span>}
      </summary>
      <div className="mt-3">
        {!fresh && <p className="mb-3 rounded-xl bg-gold-100/60 px-3.5 py-2.5 text-sm">If Facebook never reads your test link, the Cloudflare secret below is missing or wrong.</p>}
        <ol className="grid list-decimal gap-1.5 pl-5 text-sm text-emerald-950">
          <li>Open <b>dash.cloudflare.com → Workers &amp; Pages → mf-web → Settings → Variables and Secrets</b>.</li>
          <li>Click <b>Add</b>, type <b>Secret</b>, name <code className="rounded bg-emerald-50 px-1 font-mono">NUSUK_CAMP_SECRET</code>, paste the value below, and Deploy.</li>
          <li>Make a campaign Hidden, add a post, join on /nusuk with your own code, and put one link in a Facebook post (Only me is fine). The ✓ should appear in a few seconds.</li>
        </ol>
        <div className="mt-3 flex flex-wrap gap-2">
          <input readOnly className="nk-input min-w-0 flex-1 font-mono text-xs" value={show ? cfg.secret : '••••••••••••••••••••••••••••••••'} aria-label="Worker secret" />
          <Btn kind="ghost" onClick={() => setShow(!show)}>{show ? 'Hide' : 'Show'}</Btn>
          <Btn kind="gold" onClick={() => { navigator.clipboard.writeText(cfg.secret).then(() => toast('Secret copied')); }}>Copy</Btn>
        </div>
        <p className="mt-2 text-xs text-emerald-900/60">This box folds up once it works. It stays here so you can check that shares are still being read.</p>
      </div>
    </details>
  );
}

/* ---------------- Posts ---------------- */
const EVERY = [1, 2, 3, 5, 7, 14, 30, 0];
function PostsCard({ camp, toast }: { camp: Campaign; toast: ToastFn }) {
  const [posts, setPosts] = useState<Post[]>([]);
  const [edit, setEdit] = useState<Partial<Post> | null>(null);
  const [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    const { data, error } = await sb!.from('nusuk_camp_posts').select('*').eq('campaign_id', camp.id).order('sort').order('id');
    if (error) return toast(errText(error), false);
    setPosts((data ?? []) as Post[]);
  }, [camp.id, toast]);
  useEffect(() => { load(); setEdit(null); }, [load]);

  async function save() {
    if (!edit) return;
    const url = (edit.url ?? '').trim(), image = (edit.image ?? '').trim();
    if (!FB_RE.test(url)) return toast('Post link must be a https://facebook.com/… link', false);
    if (image && !/^https:\/\//i.test(image)) return toast('Picture must be an https:// link', false);
    if (edit.from_day && edit.to_day && edit.to_day < edit.from_day) return toast('"Until" is before "From"', false);
    setBusy(true);
    const row = {
      url, title: (edit.title ?? '').trim(), body: (edit.body ?? '').trim(), image, active: edit.active ?? true,
      points: Math.min(100, Math.max(1, Math.round(edit.points ?? 1) || 1)), every_days: edit.every_days ?? 1,
      from_day: edit.from_day || null, to_day: edit.to_day || null,
    };
    const { error } = edit.id
      ? await sb!.from('nusuk_camp_posts').update(row).eq('id', edit.id)
      : await sb!.from('nusuk_camp_posts').insert({ ...row, campaign_id: camp.id, sort: (posts.at(-1)?.sort ?? 0) + 1 });
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
    if (!confirm('Delete this post? Its links and the points already counted for it are deleted too.')) return;
    const { error } = await sb!.from('nusuk_camp_posts').delete().eq('id', p.id);
    if (error) return toast(errText(error), false);
    load();
  }
  async function pick(file?: File) {
    if (!file || !edit) return;
    try { const m = await uploadMedia(file, 'nusuk-campaign'); setEdit({ ...edit, image: m.url }); } catch (e) { toast(`Upload failed: ${errText(e)}`, false); }
  }

  return (
    <Card title={`Posts to share (${posts.filter((p) => p.active).length} active)`} actions={!edit && <Btn kind="gold" onClick={() => setEdit({ active: true, points: 1, every_days: 1 })}>+ Add post</Btn>}>
      <p className="mb-3 text-xs text-emerald-900/60">For each post, everyone gets a personal link. When Facebook reads it (they posted it), they get the post's points. After that they can share the same post again only when the next window opens (e.g. once a day: tomorrow).</p>
      {edit && (
        <div className="mb-4 grid gap-3 rounded-xl border border-gold-500/50 bg-gold-100/30 p-3.5">
          <Field label="Facebook post link *"><input className="nk-input font-normal" value={edit.url ?? ''} onChange={(e) => setEdit({ ...edit, url: e.target.value })} placeholder="https://www.facebook.com/…/posts/…" /></Field>
          <div className="grid gap-3 sm:grid-cols-4">
            <Field label="Points per share"><input type="number" min={1} max={100} className="nk-input font-normal" value={edit.points ?? 1} onChange={(e) => setEdit({ ...edit, points: +e.target.value })} /></Field>
            <Field label="Can be shared">
              <select className="nk-input font-normal" value={edit.every_days ?? 1} onChange={(e) => setEdit({ ...edit, every_days: +e.target.value })}>
                {EVERY.map((n) => <option key={n} value={n}>{everyLabel(n)}</option>)}
              </select>
            </Field>
            <Field label="From (optional)"><input type="date" className="nk-input font-normal" value={edit.from_day ?? ''} onChange={(e) => setEdit({ ...edit, from_day: e.target.value || null })} /></Field>
            <Field label="Until (optional)"><input type="date" className="nk-input font-normal" value={edit.to_day ?? ''} onChange={(e) => setEdit({ ...edit, to_day: e.target.value || null })} /></Field>
          </div>
          <p className="-mt-1 text-xs text-emerald-900/60">Empty dates = the campaign's own dates.</p>
          <Field label="Preview title (shown on Facebook)"><input className="nk-input font-normal" maxLength={120} value={edit.title ?? ''} onChange={(e) => setEdit({ ...edit, title: e.target.value })} placeholder="নুসুক উমরাহ কোড শেয়ার" /></Field>
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
              <div className="text-xs text-emerald-900/70"><b>+{p.points} pt</b> · {everyLabel(p.every_days)}{p.from_day || p.to_day ? ` · ${p.from_day ?? '…'} → ${p.to_day ?? '…'}` : ''}</div>
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

/* ---------------- Leaderboard + draw (any date range) ---------------- */
function BoardCard({ camp, toast }: { camp: Campaign; toast: ToastFn }) {
  const today = dhaka();
  const all = { from: camp.starts || addDays(camp.created_at.slice(0, 10), -1), to: camp.ends || today };
  const [from, setFrom] = useState(today);
  const [to, setTo] = useState(today);
  const [bonus, setBonus] = useState(false);
  const [rows, setRows] = useState<BoardRow[]>([]);
  const [method, setMethod] = useState<'weighted' | 'top'>('weighted');
  const [draws, setDraws] = useState<Draw[]>([]);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const [b, d] = await Promise.all([
      sb!.rpc('nusuk_camp_admin_board', { p_camp: camp.id, p_from: from, p_to: to, p_bonus: bonus }),
      sb!.from('nusuk_camp_draws').select('*').eq('campaign_id', camp.id).order('created_at', { ascending: false }).limit(100),
    ]);
    if (b.error) toast(errText(b.error), false);
    setRows((b.data ?? []) as BoardRow[]);
    setDraws((d.data ?? []) as Draw[]);
  }, [camp.id, from, to, bonus, toast]);
  useEffect(() => { load(); }, [load]);

  const quick: [string, () => void][] = [
    ['Today', () => { setFrom(today); setTo(today); setBonus(false); }],
    ['Yesterday', () => { const y = addDays(today, -1); setFrom(y); setTo(y); setBonus(false); }],
    ['This week', () => { setFrom(weekStart(today)); setTo(today); setBonus(false); }],
    ['Last 7 days', () => { setFrom(addDays(today, -6)); setTo(today); setBonus(false); }],
    ['Whole campaign', () => { setFrom(all.from); setTo(all.to); setBonus(true); }],
  ];

  async function draw() {
    if (to < from) return toast('"To" is before "From"', false);
    if (!confirm(`Draw a winner for ${from} → ${to}${bonus ? ' (with follow/join points)' : ''}?\nMethod: ${method === 'weighted' ? 'every point is one ticket' : 'only the top scorers, equal chance'}\nThe result is saved.`)) return;
    setBusy(true);
    const { data, error } = await sb!.rpc('nusuk_camp_draw', { p_camp: camp.id, p_from: from, p_to: to, p_bonus: bonus, p_method: method });
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
  const stBadge: Record<Draw['status'], string> = { drawn: 'bg-gold-500 text-emerald-950', confirmed: 'bg-emerald-600 text-white', void: 'bg-red-100 text-red-700 line-through' };
  const sum = rows.reduce((a, r) => a + r.total, 0);

  return (
    <>
      <Card title="Leaderboard" actions={<Btn kind="ghost" onClick={load}>Refresh</Btn>}>
        <div className="mb-2 flex flex-wrap gap-1.5">
          {quick.map(([l, f]) => <button key={l} type="button" onClick={f} className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-900 hover:bg-emerald-100">{l}</button>)}
        </div>
        <div className="mb-3 flex flex-wrap items-end gap-3">
          <Field label="From"><input type="date" className="nk-input w-40 py-1.5! font-normal" value={from} onChange={(e) => setFrom(e.target.value || today)} /></Field>
          <Field label="To"><input type="date" className="nk-input w-40 py-1.5! font-normal" value={to} onChange={(e) => setTo(e.target.value || today)} /></Field>
          <label className="flex items-center gap-2 pb-2 text-sm font-semibold"><input type="checkbox" className="h-4 w-4 accent-emerald-700" checked={bonus} onChange={(e) => setBonus(e.target.checked)} /> Add follow/join points</label>
          <span className="pb-2 text-xs text-emerald-900/60">{rows.length} people · {sum} points</span>
        </div>
        <p className="mb-2 text-xs text-emerald-900/60">Shares count on the day Facebook read the link (Bangladesh time). Follow/join points count if they did it inside the range. For daily or weekly prizes leave "Add follow/join points" off; for the final prize use "Whole campaign".</p>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[34rem] text-sm">
            <thead><tr className="border-b text-left text-xs text-emerald-900/60"><th className="py-1.5 pr-2">#</th><th className="pr-2">Code</th><th className="pr-2">Facebook</th><th className="pr-2 text-right">Shares</th><th className="pr-2 text-right">Share pts</th>{bonus && <th className="pr-2 text-right">Bonus</th>}<th className="text-right">Total</th></tr></thead>
            <tbody>
              {rows.slice(0, 200).map((r, i) => (
                <tr key={r.code} className="border-b border-emerald-900/5">
                  <td className="py-1.5 pr-2 text-emerald-900/60">{i + 1}</td>
                  <td className="pr-2 font-mono font-semibold">{r.code}</td>
                  <td className="pr-2"><a href={r.fb_profile} target="_blank" rel="noopener noreferrer" className="text-emerald-800 underline">profile ↗</a></td>
                  <td className="pr-2 text-right">{r.shares}</td>
                  <td className="pr-2 text-right">{r.share_points}</td>
                  {bonus && <td className="pr-2 text-right">{r.bonus}</td>}
                  <td className="text-right font-bold">{r.total}</td>
                </tr>
              ))}
              {!rows.length && <tr><td colSpan={7} className="py-6 text-center text-emerald-900/60">No points in this range yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </Card>

      <Card title="Draw a winner">
        <div className="mb-3 grid gap-2 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-950">
          <p><b>Which method?</b> Example: Rahim 10 points, Karim 5, Salma 10.</p>
          <p>🎟️ <b>Every point = 1 ticket:</b> 25 tickets in the box. Rahim and Salma each have a 10 in 25 chance, Karim 5 in 25. More points, better chance, but nobody is sure to win.</p>
          <p>🏆 <b>Only the top scorers:</b> the highest score is 10, so only Rahim and Salma are in, 50/50. Karim is out.</p>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <div className="text-sm"><div className="text-xs text-emerald-900/60">Range (from the leaderboard above)</div><b>{from} → {to}{bonus ? ' + follow/join' : ''}</b></div>
          <Field label="Method">
            <select className="nk-input py-1.5! font-normal" value={method} onChange={(e) => setMethod(e.target.value as typeof method)}>
              <option value="weighted">Every point = 1 ticket</option>
              <option value="top">Only the top scorers</option>
            </select>
          </Field>
          <Btn kind="gold" onClick={draw} disabled={busy || !rows.length}>{busy ? 'Drawing…' : '🎲 Draw'}</Btn>
        </div>
        <p className="mt-2 text-xs text-emerald-900/60">Before giving a prize: open the winner's Facebook profile to check the posts, and ask for a screenshot of the code in the Nusuk app. If they fail, mark the draw Void and draw again (people already drawn for the same range are skipped).</p>
        <div className="mt-3 grid gap-2">
          {draws.map((d) => (
            <article key={d.id} className="flex flex-wrap items-center gap-2 rounded-xl border border-[#e7e1cf] bg-white p-3 text-sm">
              <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${stBadge[d.status]}`}>{d.status}</span>
              <b className="font-mono">{d.code}</b>
              {d.fb_profile && <a href={d.fb_profile} target="_blank" rel="noopener noreferrer" className="text-emerald-800 underline">profile ↗</a>}
              <span className="text-xs text-emerald-900/60">{d.from_day === d.to_day ? d.from_day : `${d.from_day} → ${d.to_day}`}{d.with_bonus ? ' + bonus' : ''} · {d.points}/{d.pool_points} pts · {d.pool_people} people · {d.method === 'weighted' ? 'tickets' : 'top only'} · {when(d.created_at)}</span>
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

/* ---------------- Page ---------------- */
export default function CampaignPage({ toast }: { toast: ToastFn }) {
  const [camps, setCamps] = useState<Campaign[]>([]);
  const [sel, setSel] = useState<number | null>(null);
  const [cfg, setCfg] = useState<Config | null>(null);
  const [missing, setMissing] = useState(false);
  const [people, setPeople] = useState(0);

  const load = useCallback(async () => {
    const [c, g] = await Promise.all([
      sb!.from('nusuk_campaigns').select('*').order('id', { ascending: false }),
      sb!.from('nusuk_camp_config').select('secret,last_fb_hit').eq('id', 1).maybeSingle(),
    ]);
    if (c.error) { setMissing(true); return; }
    setMissing(false);
    const list = (c.data ?? []) as Campaign[];
    setCamps(list);
    setCfg((g.data as Config) ?? null);
    setSel((cur) => (cur && list.some((x) => x.id === cur) ? cur : (list.find((x) => x.status !== 'closed') ?? list[0])?.id ?? null));
  }, []);
  useEffect(() => { load(); }, [load]);
  const camp = camps.find((c) => c.id === sel) ?? null;
  useEffect(() => {
    if (!camp) return;
    sb!.from('nusuk_camp_people').select('code', { count: 'exact', head: true }).eq('campaign_id', camp.id).then((r) => setPeople(r.count ?? 0));
  }, [camp]);

  async function create() {
    const { data, error } = await sb!.from('nusuk_campaigns').insert({ status: 'hidden' }).select('id').single();
    if (error) return toast(errText(error), false);
    toast('New campaign created (Hidden)');
    setSel((data as { id: number }).id);
    load();
  }
  async function remove(c: Campaign) {
    if (!confirm(`Delete "${c.title}"?\nIts posts, participants, points and draws are deleted for good.`)) return;
    const { error } = await sb!.from('nusuk_campaigns').delete().eq('id', c.id);
    if (error) return toast(errText(error), false);
    toast('Campaign deleted');
    setSel(null);
    load();
  }

  if (missing) {
    return <Card title="Campaign"><p className="text-sm">Run <code className="font-mono">src/pages/nusuk/_sql/update_18_campaigns.sql</code> in Supabase → SQL Editor, then reload this page.</p></Card>;
  }
  return (
    <div className="grid gap-4">
      <Card title="Campaigns" actions={<Btn kind="gold" onClick={create}>+ New campaign</Btn>}>
        <div className="flex flex-wrap gap-2">
          {camps.map((c) => (
            <button key={c.id} type="button" onClick={() => setSel(c.id)}
              className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-left text-sm ${sel === c.id ? 'border-emerald-700 bg-emerald-50 ring-2 ring-emerald-600/30' : 'border-[#e7e1cf] bg-white'}`}>
              <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${statusInfo[c.status].cls}`}>{statusInfo[c.status].label}</span>
              <span className="max-w-[16rem] truncate font-semibold">{c.title}</span>
              <span className="text-xs text-emerald-900/55">{c.starts ?? '…'} → {c.ends ?? '…'}</span>
            </button>
          ))}
          {!camps.length && <p className="text-sm text-emerald-900/70">No campaigns yet. Click "+ New campaign".</p>}
        </div>
        <p className="mt-3 text-xs text-emerald-900/60">On /nusuk, visitors see the Live campaign. While you are signed in, you see the newest Hidden campaign instead (so you can test it); with no Hidden one you see the Live one.</p>
      </Card>
      {cfg && <SetupCard cfg={cfg} toast={toast} />}
      {camp && (
        <>
          <SettingsCard c={camp} onSaved={load} onDelete={() => remove(camp)} toast={toast} />
          <PostsCard camp={camp} toast={toast} />
          <p className="text-center text-sm text-emerald-900/70">Participants in this campaign: <b>{people}</b></p>
          <BoardCard key={camp.id} camp={camp} toast={toast} />
        </>
      )}
    </div>
  );
}
