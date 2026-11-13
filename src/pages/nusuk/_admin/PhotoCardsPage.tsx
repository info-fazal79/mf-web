/* Nusuk Manager → Photo cards: how many people made a photo card on /nusuk (Download / Share), per day,
   top codes and the latest cards (update_39_photo_cards.sql). */
import { useCallback, useEffect, useState } from 'react';
import { Download, ExternalLink, RefreshCw, Share2, Users } from 'lucide-react';
import { supabase as sb } from '@/lib/supabase';
import { CARD_MESSAGES } from '../_lib/photocard';

type ToastFn = (t: string, ok?: boolean) => void;
type Counts = { downloads: number; shares: number; people: number; codes?: number };
type Data = {
  total: Counts;
  today: Counts;
  days: { day: string; downloads: number; shares: number; people: number }[];
  top: { code: string; name: string | null; cards: number }[];
  messages: Record<string, number>;
  themes: Record<string, number>;
  recent: { at: string; action: 'download' | 'share'; code: string; name: string; theme: string; msg: number }[];
};

const errText = (e: unknown) => (e && typeof e === 'object' && 'message' in e ? String((e as { message: string }).message) : String(e));
const n = (v: number | undefined) => (v ?? 0).toLocaleString('en-US');
const THEME: Record<string, string> = { green: 'Green', gold: 'Cream', night: 'Blue' };
const when = (iso: string) => new Date(iso).toLocaleString('en-GB', { timeZone: 'Asia/Dhaka', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });

export default function PhotoCardsPage({ toast }: { toast: ToastFn }) {
  const [d, setD] = useState<Data | null>(null);
  const [days, setDays] = useState(14);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!sb) return;
    setBusy(true);
    const { data, error } = await sb.rpc('nusuk_admin_photocards', { p_days: days });
    setBusy(false);
    if (error) return toast(errText(error).includes('nusuk_admin_photocards') ? 'Run update_39_photo_cards.sql in Supabase first' : errText(error), false);
    setD(data as Data);
  }, [days, toast]);
  useEffect(() => { load(); }, [load]);

  const tile = (label: string, v: number | undefined, hint: string, Icon: typeof Users) => (
    <div className="rounded-xl bg-emerald-50 p-3">
      <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-900/70"><Icon className="h-3.5 w-3.5" aria-hidden />{label}</div>
      <div className="text-2xl font-bold tabular-nums text-emerald-950">{n(v)}</div>
      <div className="text-xs text-emerald-900/60">{hint}</div>
    </div>
  );
  const maxDay = Math.max(1, ...(d?.days ?? []).map((x) => x.downloads + x.shares));

  return (
    <div className="grid gap-4">
      <section className="nk-card p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-base font-bold text-emerald-950">Photo cards made on /nusuk</h2>
            <p className="text-sm text-emerald-900/70">Counted each time someone presses Download or Share in "ফটো কার্ড বানান". People = different phones/browsers.</p>
          </div>
          <div className="flex gap-2">
            <a href="/nusuk#nk-pcard" target="_blank" rel="noopener" className="nk-btn nk-ghost flex items-center gap-1.5 px-3 py-2 text-sm"><ExternalLink className="h-4 w-4" aria-hidden /> Open</a>
            <button type="button" onClick={load} disabled={busy} className="nk-btn nk-ghost flex items-center gap-1.5 px-3 py-2 text-sm"><RefreshCw className={`h-4 w-4 ${busy ? 'animate-spin' : ''}`} aria-hidden /> Refresh</button>
          </div>
        </div>
        {d && (
          <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {tile('Downloads', d.total.downloads, `+${n(d.today.downloads)} today`, Download)}
            {tile('Shares', d.total.shares, `+${n(d.today.shares)} today`, Share2)}
            {tile('People', d.total.people, `${n(d.today.people)} today`, Users)}
            {tile('Codes on cards', d.total.codes, 'different codes', Users)}
          </div>
        )}
      </section>

      {d && (
        <div className="grid gap-4 lg:grid-cols-2">
          <section className="nk-card p-4 sm:p-5">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-base font-bold text-emerald-950">Day by day</h2>
              <select className="nk-input w-auto py-1.5 text-sm" value={days} onChange={(e) => setDays(Number(e.target.value))} aria-label="Days">
                {[7, 14, 30, 90].map((x) => <option key={x} value={x}>Last {x} days</option>)}
              </select>
            </div>
            <table className="mt-3 w-full text-sm">
              <thead><tr className="text-left text-xs text-emerald-900/60"><th className="py-1 font-semibold">Day</th><th className="font-semibold">Downloads</th><th className="font-semibold">Shares</th><th className="font-semibold">People</th><th className="w-1/3" /></tr></thead>
              <tbody>
                {d.days.map((x) => (
                  <tr key={x.day} className="border-t border-[#eee7d3]">
                    <td className="py-1.5">{new Date(`${x.day}T00:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</td>
                    <td className="tabular-nums">{n(x.downloads)}</td>
                    <td className="tabular-nums">{n(x.shares)}</td>
                    <td className="tabular-nums">{n(x.people)}</td>
                    <td><div className="h-2 rounded-full bg-emerald-600" style={{ width: `${((x.downloads + x.shares) / maxDay) * 100}%` }} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          <section className="nk-card grid content-start gap-4 p-4 sm:p-5">
            <div>
              <h2 className="text-base font-bold text-emerald-950">Top codes</h2>
              {d.top.length === 0 && <p className="mt-2 text-sm text-emerald-900/60">No cards yet.</p>}
              <ol className="mt-2 grid gap-1 text-sm">
                {d.top.map((t, i) => (
                  <li key={t.code} className="flex items-center justify-between gap-2 rounded-lg bg-emerald-50 px-3 py-1.5">
                    <span className="min-w-0 truncate">{i + 1}. <span className="font-mono font-semibold">{t.code}</span>{t.name ? <span className="text-emerald-900/60"> · {t.name}</span> : null}</span>
                    <span className="shrink-0 tabular-nums">{n(t.cards)}</span>
                  </li>
                ))}
              </ol>
            </div>
            <div>
              <h2 className="text-base font-bold text-emerald-950">Messages chosen</h2>
              <ul className="mt-2 grid gap-1 text-sm">
                {CARD_MESSAGES.map((m, i) => (m || d.messages[String(i)]) && (
                  <li key={i} className="flex items-center justify-between gap-2"><span className="min-w-0">{m || <span className="text-emerald-900/50">(removed message)</span>}</span><b className="shrink-0 tabular-nums">{n(d.messages[String(i)])}</b></li>
                ))}
              </ul>
              <p className="mt-2 text-xs text-emerald-900/60">Colours: {Object.entries(THEME).map(([k, v]) => `${v} ${n(d.themes[k])}`).join(' · ')}</p>
            </div>
          </section>
        </div>
      )}

      {d && (
        <section className="nk-card p-4 sm:p-5">
          <h2 className="text-base font-bold text-emerald-950">Latest cards</h2>
          {d.recent.length === 0 && <p className="mt-2 text-sm text-emerald-900/60">No cards yet.</p>}
          <div className="mt-2 overflow-x-auto">
            <table className="w-full min-w-[34rem] text-sm">
              <thead><tr className="text-left text-xs text-emerald-900/60"><th className="py-1 font-semibold">Time</th><th className="font-semibold">Action</th><th className="font-semibold">Code</th><th className="font-semibold">Name</th><th className="font-semibold">Colour</th></tr></thead>
              <tbody>
                {d.recent.map((r, i) => (
                  <tr key={i} className="border-t border-[#eee7d3]">
                    <td className="py-1.5 whitespace-nowrap">{when(r.at)}</td>
                    <td>{r.action === 'share' ? <span className="inline-flex items-center gap-1 text-sky-700"><Share2 className="h-3.5 w-3.5" aria-hidden />Share</span> : <span className="inline-flex items-center gap-1 text-emerald-700"><Download className="h-3.5 w-3.5" aria-hidden />Download</span>}</td>
                    <td className="font-mono">{r.code}</td>
                    <td>{r.name || <span className="text-emerald-900/40">-</span>}</td>
                    <td>{THEME[r.theme] ?? r.theme}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
