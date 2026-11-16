/* Nusuk Manager → Map: what the /nusuk district map shows (update_48_map_modes.sql).
   accounts per district, or tickets per district in the quiz campaign running now.
   Saved in nusuk_settings.content.map.mode; the map refreshes itself (cached for 60 s). */
import { useCallback, useEffect, useState } from 'react';
import { ExternalLink, MapPin, RefreshCw, Ticket, Users } from 'lucide-react';
import { supabase as sb } from '@/lib/supabase';
import { rpc } from '../_lib/rpc';

type ToastFn = (t: string, ok?: boolean) => void;
type Mode = 'members' | 'quiz';
type MapData = { mode?: Mode; campaign?: string; total: number; people?: number; d: Record<string, number> };

const errText = (e: unknown) => (e && typeof e === 'object' && 'message' in e ? String((e as { message: string }).message) : String(e));
const n = (v: number) => (v ?? 0).toLocaleString('en-US');

export default function MapPage({ toast }: { toast: ToastFn }) {
  const [mode, setMode] = useState<Mode | null>(null);
  const [live, setLive] = useState<{ id: number; title: string } | null | undefined>(undefined);
  const [data, setData] = useState<MapData | null>(null);
  const [busy, setBusy] = useState(false);

  const loadData = useCallback(async () => {
    try { setData(await rpc<MapData>('nusuk_district_map')); } catch { setData(null); }
  }, []);

  useEffect(() => {
    if (!sb) return;
    sb.from('nusuk_settings').select('content').eq('id', 1).single().then(({ data: s }) => {
      const m = ((s?.content as Record<string, unknown> | null)?.map as { mode?: string } | undefined)?.mode;
      setMode(m === 'quiz' ? 'quiz' : 'members');
    });
    // the quiz campaign that is on and inside its start / end time
    sb.from('nusuk_club_contests').select('id,title,active,starts_at,ends_at').eq('kind', 'quiz').eq('active', true).then(({ data: l }) => {
      const now = Date.now();
      const c = (l ?? []).find((x) => (!x.starts_at || Date.parse(x.starts_at) <= now) && (!x.ends_at || Date.parse(x.ends_at) > now));
      setLive(c ? { id: c.id, title: c.title } : null);
    });
    loadData();
  }, [loadData]);

  async function choose(m: Mode) {
    if (!sb || m === mode) return;
    setBusy(true);
    const { data: s, error: e1 } = await sb.from('nusuk_settings').select('content').eq('id', 1).single();
    if (e1) { setBusy(false); return toast(errText(e1), false); }
    const content = { ...((s?.content as object) ?? {}), map: { mode: m } };
    const { error } = await sb.from('nusuk_settings').update({ content, updated_at: new Date().toISOString() }).eq('id', 1);
    setBusy(false);
    if (error) return toast(errText(error), false);
    setMode(m);
    toast(m === 'quiz' ? 'Map: competition tickets per district (shows within a minute)' : 'Map: accounts per district (shows within a minute)');
    setTimeout(loadData, 1500);
  }

  const top = data ? Object.entries(data.d ?? {}).sort((a, b) => b[1] - a[1]).slice(0, 10) : [];
  const showing: Mode | undefined = data?.mode;

  return (
    <div className="grid gap-4">
      <section className="nk-card grid gap-4 p-4 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="flex items-center gap-2 text-base font-bold text-emerald-950"><MapPin className="h-5 w-5 text-emerald-700" aria-hidden /> District map on /nusuk</h2>
            <p className="mt-0.5 max-w-3xl text-sm text-emerald-900/70">Choose what the Bangladesh map on the code page shows. Visitors see only numbers per district, never names. The map updates by itself (about once a minute).</p>
          </div>
          <a href="/nusuk#nk-dm" target="_blank" rel="noopener" className="nk-btn nk-ghost flex items-center gap-1.5 px-4 py-2 text-sm"><ExternalLink className="h-4 w-4" aria-hidden /> Open the map</a>
        </div>
        {mode === null ? <p className="text-sm text-emerald-900/60">Loading…</p> : (
          <div className="grid gap-2 sm:grid-cols-2" role="radiogroup" aria-label="What the map shows">
            {([
              ['members', Users, 'Accounts', 'How many people made an account from each district (as before).'],
              ['quiz', Ticket, 'Competition tickets', live ? `Tickets per district in "${live.title}", live as people answer. Header: "কোন জেলা থেকে কত টিকিট?"` : 'Tickets per district in the running quiz campaign. No campaign is running now, so the map would show accounts until one starts.'],
            ] as const).map(([k, Icon, t, h]) => (
              <button key={k} type="button" role="radio" aria-checked={mode === k} disabled={busy} onClick={() => choose(k)}
                className={`rounded-xl border p-3 text-left transition ${mode === k ? 'border-emerald-600 bg-emerald-50 ring-2 ring-emerald-600/20' : 'border-[#e7e1cf] bg-white hover:border-emerald-600/40'}`}>
                <div className="flex items-center gap-2 font-bold"><Icon className="h-4 w-4 text-emerald-700" aria-hidden />{t}{mode === k ? ' ✓' : ''}</div>
                <div className="mt-0.5 text-xs text-emerald-900/65">{h}</div>
              </button>
            ))}
          </div>
        )}
      </section>

      <section className="nk-card p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-base font-bold text-emerald-950">On the map now</h2>
          <button type="button" onClick={loadData} className="nk-btn nk-ghost flex items-center gap-1.5 px-3 py-1.5 text-sm"><RefreshCw className="h-4 w-4" aria-hidden /> Refresh</button>
        </div>
        {!data && <p className="mt-2 text-sm text-emerald-900/60">Loading… (if this stays, run update_43 / update_48 in Supabase)</p>}
        {data && (
          <>
            <p className="mt-1 text-sm text-emerald-900/70">
              {showing === 'quiz'
                ? <>Competition tickets · <b>{data.campaign}</b> · {n(data.total)} tickets from {n(data.people ?? 0)} people</>
                : <>Accounts · {n(data.total)} in total{mode === 'quiz' && <span className="text-gold-600"> (competition chosen, but no campaign is running, or the change is still on its way)</span>}</>}
            </p>
            <ol className="mt-3 grid gap-1 text-sm sm:grid-cols-2">
              {top.map(([k, v], i) => (
                <li key={k} className="flex items-center justify-between rounded-lg bg-emerald-50 px-3 py-1.5"><span>{i + 1}. {k}</span><b className="tabular-nums">{n(v)}</b></li>
              ))}
              {top.length === 0 && <li className="text-emerald-900/60">Nothing yet.</li>}
            </ol>
            <p className="mt-2 text-xs text-emerald-900/55">Top 10 as people wrote their district; the map joins spellings of the same district.</p>
          </>
        )}
      </section>
    </div>
  );
}
