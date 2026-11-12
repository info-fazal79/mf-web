/* Nusuk Manager → Reward Club: settings, members (leads), tickets, CSV export (update_31_reward_club.sql). */
import { useCallback, useEffect, useState } from 'react';
import { Download, ExternalLink, RefreshCw, Search, Ticket, Trophy, Users } from 'lucide-react';
import { supabase as sb } from '@/lib/supabase';
import { DEFAULT_CAPTION, DEFAULT_CARD_LINE, DEFAULT_RULES, DEFAULT_TITLE, parseClub, type ClubCfg } from '../_lib/club';

type ToastFn = (t: string, ok?: boolean) => void;
const errText = (e: unknown) => (e && typeof e === 'object' && 'message' in e ? String((e as { message: string }).message) : String(e));

type Row = {
  sl: number; name: string; phone: string; email: string | null; nusuk_code: string; district: string | null;
  umrah_done: string | null; consent: boolean; ref_ok: boolean; created_at: string; ref_name: string | null; ref_sl: number | null;
  tickets: number; tickets_today: number; referrals: number;
};
type Data = {
  today: string;
  stats: { members: number; members_today: number; referred: number; tickets: number; tickets_today: number; copy_today: number; holders_today: number };
  top: { sl: number; name: string; nusuk_code: string; refs: number }[];
  total: number;
  rows: Row[];
};
type DayRow = { sl: number; name: string; phone: string; code: string; tickets: number };

const PAGE = 50;
const UMRAH: Record<string, string> = { yes: 'Done', planning: 'Planning', no: 'No' };

function csv(name: string, head: string[], rows: (string | number | boolean | null)[][]) {
  const esc = (v: string | number | boolean | null) => {
    const s = v == null ? '' : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const text = '﻿' + [head, ...rows].map((r) => r.map(esc).join(',')).join('\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type: 'text/csv;charset=utf-8' }));
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}

export default function ClubPage({ toast }: { toast: ToastFn }) {
  const [c, setC] = useState<ClubCfg>(parseClub(null));
  const [loaded, setLoaded] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [data, setData] = useState<Data | null>(null);
  const [q, setQ] = useState('');
  const [page, setPage] = useState(0);
  const [day, setDay] = useState('');
  const [dayRows, setDayRows] = useState<DayRow[] | null>(null);

  useEffect(() => {
    sb!.from('nusuk_settings').select('content').eq('id', 1).single().then(({ data: d }) => {
      setC(parseClub((d?.content as Record<string, unknown> | null)?.club));
      setLoaded(true);
    });
  }, []);

  const loadData = useCallback(async (search: string, p: number) => {
    const { data: d, error } = await sb!.rpc('nusuk_admin_club', { p_search: search, p_limit: PAGE, p_offset: p * PAGE });
    if (error) return toast(errText(error).includes('nusuk_admin_club') ? 'Run update_31_reward_club.sql in Supabase first' : errText(error), false);
    setData(d as Data);
  }, [toast]);
  useEffect(() => { loadData('', 0); }, [loadData]);

  const set = (p: Partial<ClubCfg>) => { setC((x) => ({ ...x, ...p })); setDirty(true); };
  async function save(next = c) {
    setBusy(true);
    const { data: d, error: e1 } = await sb!.from('nusuk_settings').select('content').eq('id', 1).single();
    if (e1) { setBusy(false); return toast(errText(e1), false); }
    const content = { ...((d?.content as object) ?? {}), club: next };
    const { error } = await sb!.from('nusuk_settings').update({ content, updated_at: new Date().toISOString() }).eq('id', 1);
    setBusy(false);
    if (error) return toast(errText(error), false);
    setDirty(false);
    toast(next.on ? 'Saved · Reward Club is ON for everyone' : next.test ? 'Saved · test mode (listed emails only)' : 'Saved · Reward Club is OFF');
  }
  type Mode = 'off' | 'test' | 'on';
  const mode: Mode = c.on ? 'on' : c.test ? 'test' : 'off';
  async function setMode(m: Mode) {
    if (m === 'on' && !confirm('Open the Reward Club for EVERYONE? The banner will show on /nusuk.\n\nTip: delete the test data first (bottom of this page) so the real club starts from SL 1001.')) return;
    const next = { ...c, on: m === 'on', test: m === 'test' };
    setC(next);
    await save(next);
  }
  const [testersText, setTestersText] = useState('');
  useEffect(() => { if (loaded) setTestersText(c.testers.join('\n')); }, [loaded]); // eslint-disable-line react-hooks/exhaustive-deps
  const setTesters = (t: string) => { setTestersText(t); set({ testers: t.split(/[\s,;]+/).map((x) => x.trim().toLowerCase()).filter((x) => x.includes('@')).slice(0, 50) }); };
  async function resetAll() {
    const typed = prompt('This deletes ALL Reward Club members and tickets, and SL numbers start again from 1001.\nGoogle logins stay; people can make their profile again.\n\nType DELETE to continue:');
    if (typed !== 'DELETE') return;
    const { data: d, error } = await sb!.rpc('nusuk_admin_club_reset', { p_confirm: 'DELETE' });
    if (error) return toast(errText(error).includes('nusuk_admin_club_reset') ? 'Run update_32_club_test_mode.sql in Supabase first' : errText(error), false);
    const r = d as { ok: boolean; members?: number; tickets?: number };
    if (!r.ok) return toast('Nothing deleted', false);
    toast(`Deleted ${r.members} members and ${r.tickets} tickets`);
    setPage(0);
    loadData(q, 0);
    setDayRows(null);
  }

  async function exportMembers() {
    const { data: d, error } = await sb!.rpc('nusuk_admin_club', { p_search: q, p_limit: 5000, p_offset: 0 });
    if (error) return toast(errText(error), false);
    const rows = (d as Data).rows;
    csv(`reward-club-members-${(d as Data).today}.csv`,
      ['SL', 'Name', 'Mobile', 'Email', 'Nusuk code', 'District', 'Umrah', 'Offers OK', 'Referred by', 'Referral counted', 'Tickets', 'Tickets today', 'Referrals', 'Joined'],
      rows.map((r) => [r.sl, r.name, r.phone, r.email, r.nusuk_code, r.district, r.umrah_done ? UMRAH[r.umrah_done] : '', r.consent ? 'Yes' : 'No',
        r.ref_name ? `${r.ref_name} (SL ${r.ref_sl})` : '', r.ref_ok ? 'Yes' : 'No', r.tickets, r.tickets_today, r.referrals,
        new Date(r.created_at).toLocaleString('en-GB', { timeZone: 'Asia/Dhaka' })]));
  }
  async function loadDay(d = day) {
    const { data: x, error } = await sb!.rpc('nusuk_admin_club_day', { p_day: d || null });
    if (error) return toast(errText(error), false);
    const r = x as { day: string; rows: DayRow[] };
    setDay(r.day);
    setDayRows(r.rows);
  }
  function exportDay() {
    if (!dayRows) return;
    csv(`reward-club-tickets-${day}.csv`, ['SL', 'Name', 'Mobile', 'Nusuk code', 'Tickets'], dayRows.map((r) => [r.sl, r.name, r.phone, r.code, r.tickets]));
  }

  if (!loaded) return <section className="nk-card p-5 text-sm text-emerald-900/60">Loading…</section>;
  const s = data?.stats;
  const url = `${typeof location !== 'undefined' ? location.origin : ''}/nusuk/club`;
  const pages = data ? Math.max(1, Math.ceil(data.total / PAGE)) : 1;

  return (
    <div className="grid gap-4">
      <section className="nk-card p-4 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="flex items-center gap-2 text-base font-bold text-emerald-950"><Ticket className="h-5 w-5" aria-hidden /> Ribat Reward Club</h2>
            <p className="mt-1 max-w-3xl text-sm text-emerald-900/75">
              Visitors sign in with Google at /nusuk/club, fill a profile and collect tickets: 1 for joining, +1 if they joined with someone's code
              (the code owner also gets 1), and 1 a day for copying a code inside the time window. Their Nusuk code is their referral code.
              Each ticket is dated (Bangladesh time) for that day's draw.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <a href={url} target="_blank" rel="noopener" className="nk-btn nk-ghost flex items-center gap-1.5 px-4 py-2 text-sm"><ExternalLink className="h-4 w-4" aria-hidden /> Open page</a>
          </div>
        </div>
        <div className="mt-4 grid gap-2 sm:grid-cols-3" role="radiogroup" aria-label="Club status">
          {([
            ['off', 'Off', 'Closed for everyone. Banner hidden.'],
            ['test', 'Test mode', 'Only the emails listed below can use it. Everyone else sees it closed.'],
            ['on', 'On for everyone', 'Open to all. Banner shows on /nusuk.'],
          ] as const).map(([k, t, h]) => (
            <button key={k} type="button" role="radio" aria-checked={mode === k} disabled={busy} onClick={() => mode !== k && setMode(k)}
              className={`rounded-xl border p-3 text-left transition ${mode === k ? 'border-emerald-600 bg-emerald-50 ring-2 ring-emerald-600/20' : 'border-[#e7e1cf] bg-white hover:border-emerald-600/40'}`}>
              <div className="font-bold">{t}{mode === k ? ' ✓' : ''}</div>
              <div className="mt-0.5 text-xs text-emerald-900/65">{h}</div>
            </button>
          ))}
        </div>
        {mode === 'test' && (
          <label className="mt-3 block">
            <span className="mb-1 block text-sm font-semibold">Tester Google emails (one per line)</span>
            <textarea className="nk-input font-mono text-sm" rows={4} value={testersText} onChange={(e) => setTesters(e.target.value)} placeholder={'you@gmail.com\nfriend@gmail.com'} />
            <span className="mt-1 block text-xs text-emerald-900/60">{c.testers.length} tester{c.testers.length === 1 ? '' : 's'} · press Save after changing. Referral tickets only count from a different phone/browser than the inviter's.</span>
          </label>
        )}
        {s && (
          <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {([
              ['Members', s.members, `+${s.members_today} today`],
              ['Joined with a code', s.referred, 'referral tickets given'],
              ['Tickets today', s.tickets_today, `${s.holders_today} people · ${s.copy_today} from copying`],
              ['Tickets (all time)', s.tickets, ''],
            ] as const).map(([l, v, h]) => (
              <div key={l} className="rounded-xl bg-emerald-50 p-3">
                <div className="text-xs font-semibold text-emerald-900/70">{l}</div>
                <div className="text-2xl font-bold tabular-nums text-emerald-950">{v.toLocaleString('en-US')}</div>
                {h && <div className="text-xs text-emerald-900/60">{h}</div>}
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="nk-card grid gap-4 p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-base font-bold text-emerald-950">Settings</h2>
          <button type="button" className="nk-btn nk-green px-4 py-2 text-sm" disabled={busy || !dirty} onClick={() => save()}>{busy ? 'Saving…' : dirty ? 'Save' : 'Saved'}</button>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <label className="sm:col-span-1"><span className="mb-1 block text-sm font-semibold">Name of the club</span>
            <input className="nk-input" value={c.title} placeholder={DEFAULT_TITLE} maxLength={80} onChange={(e) => set({ title: e.target.value })} /></label>
          <label><span className="mb-1 block text-sm font-semibold">Copy ticket from (BD time)</span>
            <input type="time" className="nk-input" value={c.copy_from} onChange={(e) => set({ copy_from: e.target.value })} /></label>
          <label><span className="mb-1 block text-sm font-semibold">Copy ticket until</span>
            <input type="time" className="nk-input" value={c.copy_to} onChange={(e) => set({ copy_to: e.target.value })} /></label>
        </div>
        <p className="-mt-2 text-xs text-emerald-900/60">One copy ticket per member per day, only between these times. Copying more codes gives no extra tickets.</p>
        <label><span className="mb-1 block text-sm font-semibold">Line on the photo card (under the code)</span>
          <input className="nk-input" value={c.card_line} placeholder={DEFAULT_CARD_LINE} maxLength={120} onChange={(e) => set({ card_line: e.target.value })} /></label>
        <label><span className="mb-1 block text-sm font-semibold">Facebook caption</span>
          <textarea className="nk-input font-mono text-sm" rows={12} value={c.caption} placeholder={DEFAULT_CAPTION} onChange={(e) => set({ caption: e.target.value })} />
          <span className="mt-1 block text-xs text-emerald-900/60">Leave empty for the default. You can use {'{code}'} (their referral code), {'{name}'}, {'{sl}'} and {'{link}'} (muhammadfazal.com/nusuk).</span></label>
        <label><span className="mb-1 block text-sm font-semibold">Rules (one per line)</span>
          <textarea className="nk-input text-sm" rows={8} value={c.rules} placeholder={DEFAULT_RULES} onChange={(e) => set({ rules: e.target.value })} />
          <span className="mt-1 block text-xs text-emerald-900/60">Shown on /nusuk/club. Leave empty for the default rules.</span></label>
      </section>

      {data && data.top.length > 0 && (
        <section className="nk-card p-4 sm:p-5">
          <h2 className="mb-3 flex items-center gap-2 text-base font-bold text-emerald-950"><Trophy className="h-5 w-5" aria-hidden /> Top referrers</h2>
          <ol className="grid gap-1.5 text-sm sm:grid-cols-2">
            {data.top.map((t, i) => (
              <li key={t.sl} className="flex items-center justify-between gap-3 rounded-lg bg-emerald-50 px-3 py-2">
                <span><b>{i + 1}.</b> {t.name} <span className="text-emerald-900/60">· SL {t.sl} · <span className="font-mono">{t.nusuk_code}</span></span></span>
                <b className="tabular-nums">{t.refs}</b>
              </li>
            ))}
          </ol>
        </section>
      )}

      <section className="nk-card p-4 sm:p-5">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-base font-bold text-emerald-950">Tickets of a day (for the draw)</h2>
          <div className="flex flex-wrap gap-2">
            <input type="date" className="nk-input w-auto py-1.5 text-sm" value={day} onChange={(e) => setDay(e.target.value)} aria-label="Day" />
            <button type="button" className="nk-btn nk-ghost px-3 py-1.5 text-sm" onClick={() => loadDay()}>{dayRows ? 'Reload' : 'Show today'}</button>
            {dayRows && dayRows.length > 0 && <button type="button" className="nk-btn nk-ghost flex items-center gap-1.5 px-3 py-1.5 text-sm" onClick={exportDay}><Download className="h-4 w-4" aria-hidden /> CSV</button>}
          </div>
        </div>
        {dayRows && (dayRows.length === 0
          ? <p className="text-sm text-emerald-900/60">No tickets on {day}.</p>
          : <p className="text-sm text-emerald-900/75">{day}: <b>{dayRows.reduce((a, r) => a + r.tickets, 0)}</b> tickets from <b>{dayRows.length}</b> people. Most: {dayRows.slice(0, 5).map((r) => `${r.name} (${r.tickets})`).join(', ')}</p>)}
      </section>

      <section className="nk-card p-4 sm:p-5">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="flex items-center gap-2 text-base font-bold text-emerald-950"><Users className="h-5 w-5" aria-hidden /> Members {data && <span className="text-sm font-normal text-emerald-900/60">({data.total})</span>}</h2>
          <div className="flex flex-wrap gap-2">
            <form onSubmit={(e) => { e.preventDefault(); setPage(0); loadData(q, 0); }} className="flex gap-2">
              <input className="nk-input w-56 py-1.5 text-sm" placeholder="Name, mobile, code, email, SL" value={q} onChange={(e) => setQ(e.target.value)} />
              <button type="submit" className="nk-btn nk-ghost px-3 py-1.5" aria-label="Search"><Search className="h-4 w-4" aria-hidden /></button>
            </form>
            <button type="button" className="nk-btn nk-ghost px-3 py-1.5" onClick={() => loadData(q, page)} aria-label="Refresh"><RefreshCw className="h-4 w-4" aria-hidden /></button>
            <button type="button" className="nk-btn nk-ghost flex items-center gap-1.5 px-3 py-1.5 text-sm" onClick={exportMembers}><Download className="h-4 w-4" aria-hidden /> CSV</button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] text-left text-sm">
            <thead className="text-xs text-emerald-900/60">
              <tr>{['SL', 'Name', 'Mobile', 'Nusuk code', 'District', 'Umrah', 'Referred by', 'Tickets', 'Today', 'Refs', 'Joined'].map((h) => <th key={h} className="px-2 py-1.5 font-semibold">{h}</th>)}</tr>
            </thead>
            <tbody className="divide-y divide-[#eee7d3]">
              {data?.rows.map((r) => (
                <tr key={r.sl}>
                  <td className="px-2 py-1.5 tabular-nums">{r.sl}</td>
                  <td className="px-2 py-1.5"><div className="font-semibold">{r.name}</div><div className="text-xs text-emerald-900/60">{r.email}</div></td>
                  <td className="px-2 py-1.5 tabular-nums">{r.phone}</td>
                  <td className="px-2 py-1.5 font-mono">{r.nusuk_code}</td>
                  <td className="px-2 py-1.5">{r.district}</td>
                  <td className="px-2 py-1.5">{r.umrah_done ? UMRAH[r.umrah_done] : ''}</td>
                  <td className="px-2 py-1.5">{r.ref_name ? <span title={r.ref_ok ? 'Referral tickets given' : 'Not counted (same device as another member)'}>{r.ref_name} · {r.ref_sl}{r.ref_ok ? '' : ' ✗'}</span> : ''}</td>
                  <td className="px-2 py-1.5 font-bold tabular-nums">{r.tickets}</td>
                  <td className="px-2 py-1.5 tabular-nums">{r.tickets_today}</td>
                  <td className="px-2 py-1.5 tabular-nums">{r.referrals}</td>
                  <td className="px-2 py-1.5 text-xs text-emerald-900/60">{new Date(r.created_at).toLocaleDateString('en-GB', { timeZone: 'Asia/Dhaka' })}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {data && data.rows.length === 0 && <p className="py-6 text-center text-sm text-emerald-900/60">No members yet.</p>}
        </div>
        {pages > 1 && (
          <div className="mt-3 flex items-center justify-end gap-2 text-sm">
            <button type="button" className="nk-btn nk-ghost px-3 py-1" disabled={page === 0} onClick={() => { setPage(page - 1); loadData(q, page - 1); }}>‹ Prev</button>
            <span>{page + 1} / {pages}</span>
            <button type="button" className="nk-btn nk-ghost px-3 py-1" disabled={page + 1 >= pages} onClick={() => { setPage(page + 1); loadData(q, page + 1); }}>Next ›</button>
          </div>
        )}
      </section>

      <section className="nk-card flex flex-wrap items-center justify-between gap-3 border-red-200 p-4 sm:p-5">
        <div className="text-sm">
          <h2 className="text-base font-bold text-red-800">Delete all test data</h2>
          <p className="mt-0.5 text-emerald-900/70">Before opening the club for everyone: removes every member and ticket, SL starts again from 1001.</p>
        </div>
        <button type="button" onClick={resetAll} className="nk-btn border border-red-300 bg-white px-4 py-2 text-sm text-red-700 hover:bg-red-50">Delete all test data…</button>
      </section>

      <section className="nk-card p-4 text-sm text-emerald-900/80 sm:p-5">
        <h2 className="mb-2 text-base font-bold text-emerald-950">Google sign-in setup (once)</h2>
        <ol className="list-decimal space-y-1 pl-5">
          <li>Google Cloud Console → APIs &amp; Services → Credentials → Create OAuth client ID (Web application).</li>
          <li>Authorised redirect URI: <span className="font-mono">https://&lt;your-project&gt;.supabase.co/auth/v1/callback</span></li>
          <li>Supabase → Authentication → Sign In / Providers → Google: turn on, paste the Client ID and Secret.</li>
          <li>Supabase → Authentication → URL Configuration → Redirect URLs: add <span className="font-mono">https://muhammadfazal.com/nusuk/club</span> (and <span className="font-mono">http://localhost:4321/nusuk/club</span> for testing).</li>
        </ol>
      </section>
    </div>
  );
}
