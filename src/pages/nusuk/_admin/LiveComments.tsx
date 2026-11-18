/* Nusuk Manager → Live screen → Live comments (under the preview).
   Comments of the Facebook live come in here every few seconds; the filter puts code shares, links and
   very short ones in "Hidden". "Show" puts one comment on the live screen as a card, over every view
   (normal, raffle draw, winner). Settings (⚙) = Facebook connection, filter, and how the card looks. */
import { useEffect, useMemo, useRef, useState } from 'react';
import { EyeOff, MessageSquareText, Pause, Pencil, Play, RefreshCw, Settings, X } from 'lucide-react';
import { supabase as sb } from '@/lib/supabase';
import { CMT_POS, type Cmt, type CmtShow } from '../_lib/livecfg';
import {
  FbError, NEEDED_PERMS, fbComments, fbConnect, fbCurrentLive, fbVideoId, hideReason, initial, nameHue,
  type FbComment, type FbConn, type FbLive, type FbPage,
} from '../_lib/livecomments';

type ToastFn = (t: string, ok?: boolean) => void;
const errText = (e: unknown) => (e && typeof e === 'object' && 'message' in e ? String((e as { message: string }).message) : String(e));
const KEEP = 300; // newest comments kept in the list
const ago = (t: number, now: number) => {
  const s = Math.max(0, Math.round((now - t) / 1000));
  return s < 60 ? `${s}s` : s < 3600 ? `${Math.floor(s / 60)}m` : `${Math.floor(s / 3600)}h`;
};

/** Facebook "f" (lucide has no brand icons) */
const Facebook = ({ className = '' }: { className?: string }) => (
  <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden><path d="M24 12.07C24 5.4 18.63 0 12 0S0 5.4 0 12.07C0 18.1 4.39 23.1 10.13 24v-8.44H7.08v-3.49h3.05V9.41c0-3.02 1.79-4.69 4.53-4.69 1.31 0 2.68.23 2.68.23v2.97h-1.51c-1.49 0-1.96.93-1.96 1.89v2.26h3.33l-.53 3.49h-2.8V24C19.61 23.1 24 18.1 24 12.07z" /></svg>
);

function Avatar({ name, size = 36 }: { name: string; size?: number }) {
  const h = nameHue(name || '?');
  return <span className="grid shrink-0 place-items-center rounded-full font-bold text-white" style={{ width: size, height: size, fontSize: size * 0.45, background: `linear-gradient(135deg,hsl(${h} 65% 48%),hsl(${(h + 40) % 360} 70% 38%))` }}>{initial(name)}</span>;
}

export default function LiveComments({ cmt, setCmt, toast }: { cmt: Cmt; setCmt: (p: Partial<Cmt>, msg?: string) => void; toast: ToastFn }) {
  const [conn, setConn] = useState<FbConn | null>(null);
  const [connErr, setConnErr] = useState('');
  const [list, setList] = useState<FbComment[]>([]);
  const [live, setLive] = useState<FbLive | null>(null);
  const [state, setState] = useState<'off' | 'wait' | 'ok' | 'nolive' | 'error'>('off');
  const [err, setErr] = useState('');
  const [paused, setPaused] = useState(false);
  const [tab, setTab] = useState<'good' | 'hidden'>('good');
  const [shown, setShown] = useState<Set<string>>(new Set());
  const [open, setOpen] = useState(false);
  const [write, setWrite] = useState<{ name: string; text: string; edit?: string } | null>(null);
  const [now, setNow] = useState(Date.now());
  const liveAt = useRef(0);
  const liveRef = useRef<FbLive | null>(null);

  async function loadConn() {
    const { data, error } = await sb!.from('nusuk_fb_conn').select('app_id,app_secret,page_id,page_name,page_token').eq('id', 1).maybeSingle();
    if (error) { setConnErr(/relation|does not exist|schema cache/i.test(error.message) ? 'Run update_52_live_comments.sql in Supabase first.' : error.message); setConn(null); return; }
    setConnErr('');
    setConn((data as FbConn | null) ?? null);
  }
  useEffect(() => { loadConn(); }, []);
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);

  const ready = !!conn?.page_token && !!conn.page_id;
  // fetch the comments every few seconds while this page is open
  useEffect(() => {
    if (!ready || paused) { setState(ready ? 'wait' : 'off'); return; }
    let stop = false;
    let busy = false;
    async function tick() {
      if (busy || stop || document.hidden) return;
      busy = true;
      try {
        let ids: string[] = [];
        if (cmt.video.trim()) {
          const id = fbVideoId(cmt.video);
          if (!id) throw new FbError('The video link in Settings is not a Facebook video link');
          ids = [id];
          setLive({ id, title: 'Video from Settings', videoId: id });
        } else {
          // look for the Page's live now and then; comments are read every tick
          if (Date.now() - liveAt.current > 30_000 || !liveRef.current) {
            liveRef.current = await fbCurrentLive(conn!);
            liveAt.current = Date.now();
            setLive(liveRef.current);
          }
          const l = liveRef.current;
          if (!l) { if (!stop) { setState('nolive'); setErr(''); } return; }
          ids = [l.id, l.videoId].filter(Boolean);
        }
        let got: FbComment[] | null = null;
        let last: unknown = null;
        for (const id of ids) {
          try { got = await fbComments(id, conn!.page_token); break; } catch (e) { last = e; }
        }
        if (!got) throw last ?? new FbError('No comments');
        if (stop) return;
        setList((old) => {
          const m = new Map(old.map((x) => [x.id, x]));
          for (const x of got!) m.set(x.id, x);
          return [...m.values()].sort((a, b) => b.time - a.time).slice(0, KEEP);
        });
        setState('ok');
        setErr('');
      } catch (e) {
        if (!stop) { setState('error'); setErr(errText(e)); }
      } finally { busy = false; }
    }
    tick();
    const t = setInterval(tick, Math.max(2, cmt.poll) * 1000);
    const vis = () => { if (!document.hidden) tick(); };
    document.addEventListener('visibilitychange', vis);
    return () => { stop = true; clearInterval(t); document.removeEventListener('visibilitychange', vis); };
  }, [ready, paused, conn?.page_token, conn?.page_id, cmt.video, cmt.poll]); // eslint-disable-line react-hooks/exhaustive-deps
  // a different live or video: start a fresh list
  useEffect(() => { setList([]); liveRef.current = null; liveAt.current = 0; }, [cmt.video, conn?.page_id]);

  const sorted = useMemo(() => list.map((x) => ({ ...x, why: hideReason(x.text, cmt) })), [list, cmt]);
  const good = sorted.filter((x) => !x.why);
  const hidden = sorted.filter((x) => x.why);
  const rows = tab === 'good' ? good : hidden;

  const s = cmt.show;
  const left = s ? (cmt.secs ? Math.ceil((s.at + cmt.secs * 1000 - now) / 1000) : Infinity) : 0;
  const onAir = !!s && left > 0;
  function show(x: { id: string; name: string; text: string }) {
    const next: CmtShow = { id: x.id, name: x.name.trim(), text: x.text.trim(), at: Date.now() };
    setShown((o) => new Set(o).add(x.id));
    setCmt({ show: next }, 'Comment on the live screen');
  }

  return (
    <section className="nk-card grid min-w-0 grid-cols-[minmax(0,1fr)] gap-3 p-3 sm:p-4">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="flex items-center gap-2 text-base font-bold text-emerald-950"><MessageSquareText className="h-5 w-5 text-[#1877f2]" aria-hidden /> Live comments</h2>
        <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${state === 'ok' ? 'bg-emerald-100 text-emerald-800' : state === 'error' ? 'bg-red-100 text-red-800' : 'bg-[#efe9d8] text-emerald-900/70'}`}>
          {state === 'ok' ? `● ${live?.title?.slice(0, 40) || 'Live'}` : state === 'nolive' ? 'No live on the Page now' : state === 'error' ? 'Error' : state === 'wait' ? (paused ? 'Paused' : 'Connecting…') : 'Not connected'}
        </span>
        <div className="ml-auto flex flex-wrap gap-1.5">
          <button type="button" className="nk-btn nk-ghost flex items-center gap-1 px-2.5 py-1 text-xs" onClick={() => setWrite({ name: '', text: '' })} title="Write a comment yourself (or paste one from WhatsApp, YouTube…)"><Pencil className="h-3.5 w-3.5" /> Write one</button>
          {ready && <button type="button" className="nk-btn nk-ghost flex items-center gap-1 px-2.5 py-1 text-xs" onClick={() => setPaused((p) => !p)}>{paused ? <><Play className="h-3.5 w-3.5" /> Resume</> : <><Pause className="h-3.5 w-3.5" /> Pause</>}</button>}
          <button type="button" className="nk-btn nk-green flex items-center gap-1 px-2.5 py-1 text-xs" onClick={() => setOpen(true)}><Settings className="h-3.5 w-3.5" /> Settings</button>
        </div>
      </div>

      {connErr && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">{connErr}</p>}
      {!connErr && !ready && <p className="rounded-lg bg-[#1877f2]/10 px-3 py-2 text-sm text-emerald-950"><Facebook className="mr-1 inline h-4 w-4 text-[#1877f2]" /> Connect your Facebook Page in <button type="button" className="font-bold underline" onClick={() => setOpen(true)}>Settings</button> to bring the live comments here. Meanwhile “Write one” shows any text you type.</p>}
      {state === 'error' && <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-800">{err}</p>}
      {state === 'nolive' && <p className="text-xs text-emerald-900/60">Checking every 30 seconds; the comments come in by themselves when the Page goes live. To test now, put the link of any video of the Page in Settings → “Which video”.</p>}

      {/* the one on screen */}
      {s && (
        <div className={`flex items-start gap-3 rounded-xl border p-2.5 ${onAir ? 'border-red-400 bg-red-50' : 'border-[#e7e1cf] bg-cream/50 opacity-70'}`}>
          <Avatar name={s.name || '?'} />
          <div className="min-w-0 flex-1">
            <div className="text-[11px] font-bold text-red-700">{onAir ? `● ON SCREEN${left !== Infinity ? ` · ${left}s` : ' · until Hide'}` : 'Was on screen'}</div>
            <div className="text-sm font-bold">{s.name || 'No name'}</div>
            <p className="line-clamp-2 text-sm">{s.text}</p>
          </div>
          {onAir
            ? <button type="button" className="nk-btn flex items-center gap-1 bg-red-600 px-2.5 py-1 text-xs text-white" onClick={() => setCmt({ show: null }, 'Comment hidden')}><EyeOff className="h-3.5 w-3.5" /> Hide</button>
            : <button type="button" className="nk-btn nk-ghost flex items-center gap-1 px-2.5 py-1 text-xs" onClick={() => show(s)}><RefreshCw className="h-3.5 w-3.5" /> Again</button>}
        </div>
      )}

      {write && (
        <div className="grid gap-2 rounded-xl border border-[#1877f2]/40 bg-[#1877f2]/5 p-2.5">
          <div className="flex gap-2">
            <input className="nk-input min-w-0 flex-1 text-sm" placeholder="Name (optional)" maxLength={60} value={write.name} onChange={(e) => setWrite({ ...write, name: e.target.value })} />
            <button type="button" className="nk-btn nk-ghost px-2" onClick={() => setWrite(null)} aria-label="Close"><X className="h-4 w-4" /></button>
          </div>
          <textarea className="nk-input text-sm" rows={2} maxLength={400} placeholder="The comment to show" value={write.text} onChange={(e) => setWrite({ ...write, text: e.target.value })} />
          <button type="button" className="nk-btn nk-green justify-self-end px-3 py-1.5 text-sm" disabled={!write.text.trim()} onClick={() => { show({ id: write.edit ?? `w${Date.now()}`, name: write.name, text: write.text }); setWrite(null); }}>Show on screen</button>
        </div>
      )}

      {(ready || list.length > 0) && <>
        <div className="flex items-center gap-1 rounded-xl border border-[#e7e1cf] bg-white p-1 text-sm">
          {([['good', `Comments (${good.length})`], ['hidden', `Hidden by filter (${hidden.length})`]] as const).map(([k, t]) => (
            <button key={k} type="button" onClick={() => setTab(k)} className={`flex-1 rounded-lg px-2 py-1.5 font-semibold ${tab === k ? 'bg-emerald-900 text-white' : 'text-emerald-900 hover:bg-emerald-50'}`}>{t}</button>
          ))}
        </div>
        <ul className="grid max-h-[34rem] min-w-0 grid-cols-[minmax(0,1fr)] content-start gap-1.5 overflow-y-auto pr-1">
          {rows.length === 0 && <li className="py-6 text-center text-sm text-emerald-900/50">{state === 'ok' ? (tab === 'good' ? 'No comments to show yet.' : 'Nothing hidden.') : 'Waiting for comments…'}</li>}
          {rows.map((x) => {
            const air = onAir && s?.id === x.id;
            return (
              <li key={x.id} className={`flex items-start gap-2.5 rounded-xl border px-2.5 py-2 ${air ? 'border-red-400 bg-red-50' : 'border-[#eee7d3] bg-white'}`}>
                <Avatar name={x.name || '?'} size={32} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 text-xs">
                    <b className="truncate text-emerald-950">{x.name || 'Facebook user'}</b>
                    <span className="text-emerald-900/45">{ago(x.time, now)}</span>
                    {shown.has(x.id) && <span className="text-emerald-700">✓ shown</span>}
                    {x.why && <span className="rounded bg-[#efe9d8] px-1.5 text-[10px] font-semibold text-emerald-900/70">{x.why}</span>}
                  </div>
                  <p className="text-sm break-words whitespace-pre-line">{x.text}</p>
                </div>
                <div className="flex shrink-0 flex-col gap-1">
                  <button type="button" className={`nk-btn px-2.5 py-1 text-xs ${air ? 'bg-red-600 text-white' : 'nk-green'}`} onClick={() => (air ? setCmt({ show: null }, 'Comment hidden') : show(x))}>{air ? 'Hide' : 'Show'}</button>
                  <button type="button" className="nk-btn nk-ghost px-2 py-0.5 text-[11px]" title="Fix the spelling or shorten it before showing" onClick={() => setWrite({ name: x.name, text: x.text, edit: x.id })}>Edit</button>
                </div>
              </li>
            );
          })}
        </ul>
      </>}

      {open && <CommentSettings cmt={cmt} conn={conn} toast={toast} onClose={() => setOpen(false)} onConn={(c) => { setConn(c); setPaused(false); }} save={(p) => setCmt(p, 'Comment settings saved')} />}
    </section>
  );
}

// ---------------------------------------------------------------- settings pop-up
function CommentSettings({ cmt, conn, toast, onClose, onConn, save }: {
  cmt: Cmt; conn: FbConn | null; toast: ToastFn; onClose: () => void; onConn: (c: FbConn) => void; save: (p: Partial<Cmt>) => void;
}) {
  const [d, setD] = useState({ ...cmt, blockText: cmt.block.join(', ') });
  const [appId, setAppId] = useState(conn?.app_id ?? '');
  const [secret, setSecret] = useState(conn?.app_secret ?? '');
  const [token, setToken] = useState('');
  const [busy, setBusy] = useState(false);
  const [pages, setPages] = useState<FbPage[] | null>(null);
  const [missing, setMissing] = useState<string[]>([]);
  const [help, setHelp] = useState(!conn?.page_token);
  const connected = !!conn?.page_token;

  async function storeConn(p: FbPage) {
    const row = { id: 1, app_id: appId.trim(), app_secret: secret.trim(), page_id: p.id, page_name: p.name, page_token: p.access_token, updated_at: new Date().toISOString() };
    const { error } = await sb!.from('nusuk_fb_conn').upsert(row);
    if (error) return toast(errText(error), false);
    onConn(row);
    setPages(null);
    setToken('');
    toast(`Connected to ${p.name}`);
  }
  async function connect() {
    if (!appId.trim() || !secret.trim() || !token.trim()) return toast('Fill in App ID, App secret and the token', false);
    setBusy(true);
    try {
      const r = await fbConnect(appId, secret, token);
      setMissing(NEEDED_PERMS.filter((p) => !r.granted.includes(p)));
      if (!r.pages.length) toast('This Facebook account manages no Page, or the Page was not ticked when the token was made', false);
      else if (r.pages.length === 1) await storeConn(r.pages[0]);
      else setPages(r.pages);
    } catch (e) { toast(errText(e), false); }
    setBusy(false);
  }
  async function disconnect() {
    if (!confirm('Remove the Facebook connection? Comments stop coming in until you connect again.')) return;
    const { error } = await sb!.from('nusuk_fb_conn').update({ page_id: '', page_name: '', page_token: '', updated_at: new Date().toISOString() }).eq('id', 1);
    if (error) return toast(errText(error), false);
    onConn({ app_id: appId, app_secret: secret, page_id: '', page_name: '', page_token: '' });
    toast('Disconnected');
  }

  const lab = 'grid gap-1 text-sm font-semibold';
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-emerald-950/50 p-3" onClick={onClose}>
      <div className="nk-card grid max-h-[92vh] w-full max-w-2xl gap-4 overflow-y-auto p-4 sm:p-5" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Live comment settings">
        <div className="flex items-center gap-2">
          <h3 className="text-lg font-bold text-emerald-950">Live comment settings</h3>
          <button type="button" className="nk-btn nk-ghost ml-auto px-2 py-1" onClick={onClose} aria-label="Close"><X className="h-4 w-4" /></button>
        </div>

        {/* ---------- Facebook */}
        <fieldset className="grid gap-2.5 rounded-xl border border-[#1877f2]/30 p-3">
          <legend className="flex items-center gap-1.5 px-1 text-sm font-bold text-[#1877f2]"><Facebook className="h-4 w-4" /> Facebook Page</legend>
          {connected
            ? <div className="flex flex-wrap items-center gap-2 rounded-lg bg-emerald-50 px-3 py-2 text-sm">✅ Connected to <b>{conn!.page_name}</b><button type="button" className="ml-auto text-xs font-semibold text-red-700 underline" onClick={disconnect}>Disconnect</button></div>
            : <p className="text-sm text-emerald-900/70">Not connected yet. Three things from Facebook are needed, once:</p>}
          <button type="button" className="justify-self-start text-xs font-semibold text-[#1877f2] underline" onClick={() => setHelp((h) => !h)}>{help ? 'Hide the steps' : 'How do I get these?'}</button>
          {help && (
            <ol className="grid list-decimal gap-1.5 rounded-lg bg-[#1877f2]/5 py-2.5 pr-3 pl-7 text-xs leading-relaxed text-emerald-950">
              <li>Open <a className="font-semibold underline" href="https://developers.facebook.com/apps" target="_blank" rel="noopener">developers.facebook.com/apps</a> → <b>Create app</b>. Use case: <b>“Manage everything on your Page”</b> (if it asks for a type: <b>Business</b>). Any name, e.g. “Nusuk Live”.</li>
              <li>In the app: <b>App settings → Basic</b>. Copy <b>App ID</b> and <b>App secret</b> (press “Show”) into the boxes below.</li>
              <li>Open <a className="font-semibold underline" href="https://developers.facebook.com/tools/explorer/" target="_blank" rel="noopener">Graph API Explorer</a>. On the right: pick your app under <b>Meta App</b>, <b>User or Page</b> = “Get User Access Token”.</li>
              <li>Under <b>Permissions</b> add: <code>pages_show_list</code>, <code>pages_read_engagement</code>, <code>pages_read_user_content</code>. Press <b>Generate Access Token</b>, allow it and tick your Page.</li>
              <li>Copy the long <b>Access Token</b> at the top, paste it below and press <b>Connect</b>. That’s all: the rest is done here, and the connection does not run out.</li>
            </ol>
          )}
          <div className="grid gap-2 sm:grid-cols-2">
            <label className={lab}>App ID<input className="nk-input font-mono text-xs font-normal" value={appId} onChange={(e) => setAppId(e.target.value)} placeholder="1234567890" /></label>
            <label className={lab}>App secret<input className="nk-input font-mono text-xs font-normal" type="password" value={secret} onChange={(e) => setSecret(e.target.value)} placeholder="••••••••" autoComplete="off" /></label>
          </div>
          <label className={lab}>Access token from Graph API Explorer<textarea className="nk-input font-mono text-xs font-normal" rows={2} value={token} onChange={(e) => setToken(e.target.value)} placeholder="EAAB…" autoComplete="off" /></label>
          <button type="button" className="nk-btn nk-green justify-self-start px-4 py-1.5 text-sm" disabled={busy} onClick={connect}>{busy ? 'Connecting…' : connected ? 'Connect again' : 'Connect'}</button>
          {pages && (
            <div className="grid gap-1.5 rounded-lg bg-white p-2 text-sm">
              <b>Which Page?</b>
              {pages.map((p) => <button key={p.id} type="button" className="nk-btn nk-ghost justify-start px-3 py-1.5 text-left" onClick={() => storeConn(p)}>{p.name}</button>)}
            </div>
          )}
          {missing.length > 0 && <p className="rounded-lg bg-gold-400/15 px-3 py-2 text-xs text-emerald-950">These permissions were not given: <b>{missing.join(', ')}</b>. Without <code>pages_read_user_content</code> the names of the people may be missing. Make the token again with them ticked.</p>}
        </fieldset>

        {/* ---------- which video */}
        <fieldset className="grid gap-2 rounded-xl border border-[#e7e1cf] p-3">
          <legend className="px-1 text-sm font-bold">Which video</legend>
          <label className={lab}>Facebook video link <span className="text-xs font-normal text-emerald-900/60">empty = the Page’s live right now (found by itself)</span>
            <input className="nk-input font-mono text-xs font-normal" value={d.video} onChange={(e) => setD({ ...d, video: e.target.value })} placeholder="https://www.facebook.com/…/videos/1234567890" /></label>
          {d.video.trim() && !fbVideoId(d.video) && <p className="text-xs text-red-700">This does not look like a Facebook video link.</p>}
        </fieldset>

        {/* ---------- filter */}
        <fieldset className="grid gap-2.5 rounded-xl border border-[#e7e1cf] p-3">
          <legend className="px-1 text-sm font-bold">Filter</legend>
          <label className="flex items-start gap-2 text-sm"><input type="checkbox" className="mt-0.5 h-4 w-4 accent-emerald-700" checked={d.filter} onChange={(e) => setD({ ...d, filter: e.target.checked })} />
            <span><b>Hide code shares and junk</b><br /><span className="text-xs text-emerald-900/60">Nusuk codes (NG-…), code-like words, links, phone numbers, emoji-only and too-short comments go to “Hidden”.</span></span></label>
          <label className="flex items-start gap-2 text-sm"><input type="checkbox" className="mt-0.5 h-4 w-4 accent-emerald-700" checked={d.bangla} onChange={(e) => setD({ ...d, bangla: e.target.checked })} />
            <span><b>Only Bangla comments</b><br /><span className="text-xs text-emerald-900/60">Comments with no Bangla letter are hidden.</span></span></label>
          <label className="flex items-center gap-2 text-sm font-semibold">Shortest comment to keep
            <input type="number" min={0} max={10} className="w-16 rounded-md border border-[#d9d2bd] bg-white px-1 py-0.5 text-right text-sm" value={d.min_words} onChange={(e) => setD({ ...d, min_words: Math.max(0, Math.min(10, Math.round(+e.target.value) || 0)) })} /> words</label>
          <label className={lab}>Blocked words <span className="text-xs font-normal text-emerald-900/60">comments with any of these are hidden, even with the filter off · separate with commas</span>
            <textarea className="nk-input text-sm font-normal" rows={2} value={d.blockText} onChange={(e) => setD({ ...d, blockText: e.target.value })} placeholder="বিক্রি, ইনবক্স, টাকা, inbox, sell" /></label>
        </fieldset>

        {/* ---------- on screen */}
        <fieldset className="grid gap-2.5 rounded-xl border border-[#e7e1cf] p-3">
          <legend className="px-1 text-sm font-bold">On the live screen</legend>
          <label className="flex flex-wrap items-center gap-2 text-sm font-semibold">A comment stays for
            <input type="number" min={0} max={600} className="w-16 rounded-md border border-[#d9d2bd] bg-white px-1 py-0.5 text-right text-sm" value={d.secs} onChange={(e) => setD({ ...d, secs: Math.max(0, Math.min(600, Math.round(+e.target.value) || 0)) })} /> seconds
            <span className="text-xs font-normal text-emerald-900/60">(0 = until you press Hide)</span></label>
          <div className="grid gap-1 text-sm font-semibold">Where
            <div className="grid grid-cols-3 gap-1 rounded-xl border border-[#e7e1cf] bg-white p-1">
              {CMT_POS.map((p) => <button key={p.key} type="button" onClick={() => setD({ ...d, pos: p.key })} className={`rounded-lg px-2 py-1.5 text-xs font-bold ${d.pos === p.key ? 'bg-emerald-900 text-white' : 'text-emerald-900 hover:bg-emerald-50'}`}>{p.name}</button>)}
            </div>
          </div>
          <label className="flex flex-wrap items-center gap-2 text-sm font-semibold">Check for new comments every
            <input type="number" min={2} max={60} className="w-16 rounded-md border border-[#d9d2bd] bg-white px-1 py-0.5 text-right text-sm" value={d.poll} onChange={(e) => setD({ ...d, poll: Math.max(2, Math.min(60, Math.round(+e.target.value) || 5)) })} /> seconds</label>
        </fieldset>

        <div className="flex justify-end gap-2">
          <button type="button" className="nk-btn nk-ghost px-4 py-2 text-sm" onClick={onClose}>Cancel</button>
          <button type="button" className="nk-btn nk-green px-5 py-2 text-sm" onClick={() => {
            const { blockText, ...rest } = d;
            save({ ...rest, show: cmt.show, block: blockText.split(/[,\n]/).map((x) => x.trim()).filter(Boolean).slice(0, 100) });
            onClose();
          }}>Save</button>
        </div>
      </div>
    </div>
  );
}
