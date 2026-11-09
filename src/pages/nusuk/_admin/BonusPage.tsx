/* Nusuk Manager → Bonus popup: shown after a feature request (stored in nusuk_settings.content.bonus). */
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { supabase as sb } from '@/lib/supabase';
import { bonusReady, defaultBonus, defaultCommunity, isFbUrl, isWaUrl, parseBonus, parseCommunity, type Bonus, type Community } from '../_lib/bonus';

type ToastFn = (t: string, ok?: boolean) => void;
const errText = (e: unknown) => (e && typeof e === 'object' && 'message' in e ? String((e as { message: string }).message) : String(e));

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

export default function BonusPage({ toast, settings, reload }: { toast: ToastFn; settings: { content: unknown }; reload: () => void }) {
  const stored = useMemo(() => parseBonus(settings.content), [settings]);
  const storedC = useMemo(() => parseCommunity(settings.content), [settings]);
  const [b, setB] = useState<Bonus>(stored);
  const [cm, setCm] = useState<Community>(storedC);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  useEffect(() => { setB(stored); setCm(storedC); setDirty(false); }, [stored, storedC]);
  const set = (p: Partial<Bonus>) => { setB({ ...b, ...p }); setDirty(true); };
  const setC = (p: Partial<Community>) => { setCm({ ...cm, ...p }); setDirty(true); };

  async function save() {
    for (const [k, v] of [['Page link', b.page_url], ['Group link', b.group_url]] as const) {
      if (v && !isFbUrl(v)) return toast(`${k} must be a https://facebook.com/… link`, false);
    }
    if (cm.whatsapp_url && !isWaUrl(cm.whatsapp_url)) return toast('WhatsApp link must start with https://chat.whatsapp.com/ or https://wa.me/', false);
    setBusy(true);
    const { data, error: e1 } = await sb!.from('nusuk_settings').select('content').eq('id', 1).single();
    if (e1) { setBusy(false); return toast(errText(e1), false); }
    const content = { ...((data?.content as object) ?? {}), bonus: b, community: cm };
    const { error } = await sb!.from('nusuk_settings').update({ content, updated_at: new Date().toISOString() }).eq('id', 1);
    setBusy(false);
    if (error) return toast(errText(error), false);
    setDirty(false);
    toast('Saved');
    reload();
  }

  const ready = bonusReady(b);
  const num = (k: 'page_keys' | 'group_keys' | 'both_keys') => (
    <input type="number" min={0} max={1000} className="nk-input w-24 font-normal" value={b[k]} onChange={(e) => set({ [k]: Math.max(0, Math.min(1000, Math.round(+e.target.value) || 0)) })} />
  );

  return (
    <div className="grid gap-4">
      <section className="nk-card p-4 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-emerald-950">Community &amp; bonus popup</h2>
            <p className="mt-0.5 max-w-xl text-sm text-emerald-900/70">
              Right after someone sends a feature request, this popup invites them to follow your Facebook page and join your community group for extra Keys.
              What they tick and their Facebook name appear on the request in <b>Feature requests</b>, and the extra copies are added when you approve.
            </p>
          </div>
          <button type="button" className="nk-btn nk-green px-3.5 py-2 text-sm" onClick={save} disabled={busy || !dirty}>{busy ? 'Saving…' : dirty ? 'Save' : 'Saved'}</button>
        </div>
        <div className="mt-4 flex items-center gap-3 rounded-xl border border-[#e7e1cf] bg-cream p-3.5">
          <Switch on={b.on} onChange={(v) => set({ on: v })} label="Show the bonus popup" />
          <div>
            <div className="font-semibold">{b.on ? 'Popup is ON' : 'Popup is OFF'}</div>
            <div className="text-xs text-emerald-900/65">{ready ? 'Shows after every successful feature request.' : b.on ? 'Add the page link or the group link below, or it will not show.' : 'Feature requests work as before, with no popup.'}</div>
          </div>
        </div>
      </section>

      <section className="nk-card grid gap-3.5 p-4 sm:p-5">
        <h2 className="text-base font-bold text-emerald-950">Links</h2>
        <p className="-mt-2 text-sm text-emerald-900/70">Used by both the bonus popup and the community card at the bottom of /nusuk.</p>
        <Field label="📘 Facebook page link" hint="Leave empty to hide the page row.">
          <input className="nk-input font-normal" value={b.page_url} onChange={(e) => set({ page_url: e.target.value.trim() })} placeholder="https://www.facebook.com/…" />
        </Field>
        <Field label="👥 Community group link" hint="Leave empty to hide the group row.">
          <input className="nk-input font-normal" value={b.group_url} onChange={(e) => set({ group_url: e.target.value.trim() })} placeholder="https://www.facebook.com/groups/…" />
        </Field>
        <Field label="💬 WhatsApp group/channel link" hint="Community card only. Leave empty to hide it.">
          <input className="nk-input font-normal" value={cm.whatsapp_url} onChange={(e) => setC({ whatsapp_url: e.target.value.trim() })} placeholder="https://chat.whatsapp.com/…" />
        </Field>
      </section>

      <section className="nk-card grid gap-3.5 p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-base font-bold text-emerald-950">Community card (bottom of /nusuk)</h2>
          <div className="flex items-center gap-2 text-sm font-semibold">
            <Switch on={cm.on} onChange={(v) => setC({ on: v })} label="Show the community card" />
            {cm.on ? 'ON' : 'OFF'}
          </div>
        </div>
        <p className="-mt-2 text-sm text-emerald-900/70">A friendly "join us" card under the visitor feedback, with buttons for the page, the group and WhatsApp. It shows when it is ON and at least one link is set.</p>
        <Field label="Title">
          <input className="nk-input font-normal" maxLength={120} value={cm.title} onChange={(e) => setC({ title: e.target.value })} />
        </Field>
        <Field label="Message">
          <textarea rows={3} maxLength={600} className="nk-input font-normal" value={cm.text} onChange={(e) => setC({ text: e.target.value })} />
        </Field>
        <button type="button" className="self-start text-xs font-semibold text-emerald-800 underline" onClick={() => { const d = defaultCommunity(); setC({ title: d.title, text: d.text }); }}>Reset title and message to the default</button>
      </section>

      <section className="nk-card grid gap-3.5 p-4 sm:p-5">
        <h2 className="text-base font-bold text-emerald-950">Bonus popup text</h2>
        <Field label="Title">
          <input className="nk-input font-normal" maxLength={120} value={b.title} onChange={(e) => set({ title: e.target.value })} />
        </Field>
        <Field label="Message" hint="Tell them what they get and why. Empty lines become paragraphs.">
          <textarea rows={6} maxLength={1000} className="nk-input font-normal" value={b.text} onChange={(e) => set({ text: e.target.value })} />
        </Field>
        <button type="button" className="self-start text-xs font-semibold text-emerald-800 underline" onClick={() => { const d = defaultBonus(); set({ title: d.title, text: d.text }); }}>Reset title and message to the default</button>
      </section>

      <section className="nk-card grid gap-3.5 p-4 sm:p-5">
        <h2 className="text-base font-bold text-emerald-950">Extra Keys</h2>
        <p className="-mt-2 text-sm text-emerald-900/70">How many extra copies their code gets when you approve. You can still change the number on each request before approving.</p>
        <div className="flex flex-wrap gap-4">
          <Field label="Followed the page">{num('page_keys')}</Field>
          <Field label="Joined the group">{num('group_keys')}</Field>
          <Field label="Did both (total)">{num('both_keys')}</Field>
        </div>
        <div className="flex items-center gap-3 rounded-xl border border-[#e7e1cf] bg-cream p-3.5">
          <Switch on={b.show_numbers} onChange={(v) => set({ show_numbers: v })} label="Show the numbers to visitors" />
          <div>
            <div className="font-semibold">{b.show_numbers ? 'Numbers are shown to visitors' : 'Numbers are hidden from visitors'}</div>
            <div className="text-xs text-emerald-900/65">
              {b.show_numbers
                ? `They see "+${b.page_keys} বাড়তি Key", "+${b.group_keys} বাড়তি Key" and "দুটোই করলে মোট +${b.both_keys}".`
                : 'They only see "বাড়তি Key", with no promised number.'}
            </div>
          </div>
        </div>
      </section>

      {dirty && <div className="flex justify-end"><button type="button" className="nk-btn nk-green px-4 py-2 text-sm" onClick={save} disabled={busy}>{busy ? 'Saving…' : 'Save changes'}</button></div>}
    </div>
  );
}
