/* Nusuk Manager → Ads: promotional ads on /nusuk (stored in nusuk_settings.content.ads). */
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { supabase as sb } from '@/lib/supabase';
import { uploadMedia } from '@/admin/media';
import { adHtml, adMissing, adTypes, defaultAds, liveAds, parseAds, sampleDuaAd, type Ad, type Ads, type AdType } from '../_lib/ads';

type ToastFn = (t: string, ok?: boolean) => void;
const errText = (e: unknown) => (e && typeof e === 'object' && 'message' in e ? String((e as { message: string }).message) : String(e));
const newId = () => `ad-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

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
function Preview({ ad }: { ad: Ad }) {
  // Same markup as the public page; links are disabled here
  return <div className="pointer-events-none" dangerouslySetInnerHTML={{ __html: adHtml(ad) }} />;
}

function ImageField({ label, value, onChange, toast, hint }: { label: string; value: string; onChange: (v: string) => void; toast: ToastFn; hint?: string }) {
  const [busy, setBusy] = useState(false);
  async function pick(file?: File) {
    if (!file) return;
    if (!file.type.startsWith('image/')) return toast('Choose an image file', false);
    setBusy(true);
    try {
      const m = await uploadMedia(file, 'nusuk-ads');
      onChange(m.url);
      toast('Picture uploaded');
    } catch (e) {
      toast(`Upload failed: ${errText(e)}`, false);
    }
    setBusy(false);
  }
  return (
    <Field label={label} hint={hint ?? 'Upload a picture, or paste an https:// image link.'}>
      <div className="flex gap-2">
        <input className="nk-input font-normal" value={value} onChange={(e) => onChange(e.target.value)} placeholder="https://…" />
        <label className={`nk-btn nk-ghost shrink-0 cursor-pointer px-3 text-sm ${busy ? 'opacity-50' : ''}`}>
          {busy ? 'Uploading…' : 'Upload'}
          <input type="file" accept="image/*" className="sr-only" disabled={busy} onChange={(e) => { pick(e.target.files?.[0]); e.target.value = ''; }} />
        </label>
      </div>
      {value && <img src={value} alt="" className="mt-1 max-h-24 w-auto self-start rounded-lg border border-[#e7e1cf] object-contain" />}
    </Field>
  );
}

function Editor({ ad, onChange, toast }: { ad: Ad; onChange: (a: Ad) => void; toast: ToastFn }) {
  const set = (p: Partial<Ad>) => onChange({ ...ad, ...p });
  const t = ad.type;
  return (
    <div className="grid gap-3">
      <Field label="Ad type">
        <select className="nk-input font-normal" value={t} onChange={(e) => set({ type: e.target.value as AdType })}>
          {adTypes.map((x) => <option key={x.type} value={x.type}>{x.name}: {x.hint}</option>)}
        </select>
      </Field>
      {t === 'app' && <ImageField label="App icon" value={ad.icon ?? ''} onChange={(v) => set({ icon: v })} toast={toast} hint="Square picture. Tip: copy it from your Google Play page." />}
      {(t === 'image' || t === 'card') && <ImageField label={t === 'image' ? 'Banner picture' : 'Picture'} value={ad.image ?? ''} onChange={(v) => set({ image: v })} toast={toast} hint={t === 'image' ? 'Any size works; wide pictures (e.g. 1200×400 or 1200×628) look best.' : undefined} />}
      <Field label={t === 'app' ? 'App name' : t === 'image' ? 'Picture description (for screen readers)' : 'Title'}>
        <input className="nk-input font-normal" maxLength={120} value={ad.title ?? ''} onChange={(e) => set({ title: e.target.value })} />
      </Field>
      {t !== 'image' && (
        <Field label={t === 'app' ? 'Short description' : 'Text'} hint="Keep it short: 1–3 lines read best.">
          <textarea rows={3} maxLength={600} className="nk-input font-normal" value={ad.text ?? ''} onChange={(e) => set({ text: e.target.value })} />
        </Field>
      )}
      {t === 'app' && (
        <div className="grid gap-3 sm:grid-cols-[6rem_1fr]">
          <Field label="Rating"><input className="nk-input font-normal" maxLength={6} value={ad.rating ?? ''} onChange={(e) => set({ rating: e.target.value })} placeholder="5.0" /></Field>
          <Field label="Small info line"><input className="nk-input font-normal" maxLength={120} value={ad.meta ?? ''} onChange={(e) => set({ meta: e.target.value })} placeholder="৫০০+ ডাউনলোড · ফ্রি" /></Field>
        </div>
      )}
      <Field label={t === 'video' ? 'YouTube video link' : t === 'app' ? 'Google Play / App Store link' : 'Link (where a click goes)'} hint={t === 'image' || t === 'text' ? 'Optional. Leave empty for an ad that is not clickable.' : 'Must start with https://'}>
        <input className="nk-input font-normal" value={ad.link ?? ''} onChange={(e) => set({ link: e.target.value })} placeholder="https://…" />
      </Field>
      {(t === 'app' || t === 'card' || t === 'text') && (
        <Field label="Button text" hint="Leave empty for the default.">
          <input className="nk-input font-normal" maxLength={60} value={ad.cta ?? ''} onChange={(e) => set({ cta: e.target.value })} placeholder={t === 'app' ? 'ডাউনলোড করুন' : 'বিস্তারিত দেখুন'} />
        </Field>
      )}
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Show from (optional)"><input type="date" className="nk-input font-normal" value={ad.start ?? ''} onChange={(e) => set({ start: e.target.value })} /></Field>
        <Field label="Show until (optional)"><input type="date" className="nk-input font-normal" value={ad.end ?? ''} onChange={(e) => set({ end: e.target.value })} /></Field>
      </div>
    </div>
  );
}

export default function AdsPage({ toast, settings, reload }: { toast: ToastFn; settings: { content: unknown }; reload: () => void }) {
  const stored = useMemo(() => (settings.content && typeof settings.content === 'object' && 'ads' in (settings.content as object) ? parseAds(settings.content) : null), [settings]);
  // First visit: start with the Dua After Salah sample ready (section switched off)
  const initial = (): Ads => stored ?? { ...defaultAds(), items: [sampleDuaAd()] };
  const [ads, setAds] = useState<Ads>(initial);
  const [open, setOpen] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [dirty, setDirty] = useState(!stored);
  useEffect(() => { setAds(initial()); setDirty(!stored); }, [settings]); // eslint-disable-line react-hooks/exhaustive-deps

  const change = (next: Ads) => { setAds(next); setDirty(true); };
  const setItem = (id: string, a: Ad) => change({ ...ads, items: ads.items.map((x) => (x.id === id ? a : x)) });
  const move = (i: number, d: -1 | 1) => {
    const j = i + d;
    if (j < 0 || j >= ads.items.length) return;
    const items = [...ads.items];
    [items[i], items[j]] = [items[j], items[i]];
    change({ ...ads, items });
  };
  const add = (type: AdType) => {
    const a: Ad = { id: newId(), on: true, type };
    change({ ...ads, items: [...ads.items, a] });
    setOpen(a.id);
  };

  async function save(next = ads) {
    setBusy(true);
    const { data, error: e1 } = await sb!.from('nusuk_settings').select('content').eq('id', 1).single();
    if (e1) { setBusy(false); return toast(errText(e1), false); }
    const content = { ...((data?.content as object) ?? {}), ads: next };
    const { error } = await sb!.from('nusuk_settings').update({ content, updated_at: new Date().toISOString() }).eq('id', 1);
    setBusy(false);
    if (error) return toast(errText(error), false);
    setDirty(false);
    toast(next.on ? 'Saved · ads are live on /nusuk' : 'Saved · ads section is OFF (use Preview to check)');
    reload();
  }

  const live = liveAds(ads);
  return (
    <div className="grid gap-4">
      <section className="nk-card p-4 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-emerald-950">Ads on /nusuk</h2>
            <p className="mt-0.5 max-w-xl text-sm text-emerald-900/70">A promotional space above the "submit your code" card. One active ad shows on its own; two or more rotate as a carousel.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <a href="/nusuk?adpreview#nk-ads" target="_blank" rel="noopener" className="nk-btn nk-ghost px-3.5 py-2 text-sm">Preview on page ↗</a>
            <Btn onClick={() => save()} disabled={busy || !dirty}>{busy ? 'Saving…' : dirty ? 'Save' : 'Saved'}</Btn>
          </div>
        </div>
        <div className="mt-4 grid gap-3 rounded-xl border border-[#e7e1cf] bg-cream p-3.5 sm:grid-cols-[1fr_auto_auto] sm:items-end">
          <div className="flex items-center gap-3">
            <Switch on={ads.on} onChange={(v) => { const n = { ...ads, on: v }; setAds(n); save(n); }} label="Show ads section" />
            <div>
              <div className="font-semibold">{ads.on ? 'Ads section is ON' : 'Ads section is OFF'}</div>
              <div className="text-xs text-emerald-900/65">{ads.on ? `${live.length} ad(s) showing to everyone` : 'Hidden from visitors. "Preview on page" still shows it to you.'} · switch saves at once</div>
            </div>
          </div>
          <Field label="Small label"><input className="nk-input w-36 py-1.5! font-normal" maxLength={30} value={ads.label} onChange={(e) => change({ ...ads, label: e.target.value })} /></Field>
          <Field label="Carousel speed">
            <select className="nk-input w-32 py-1.5! font-normal" value={ads.interval} onChange={(e) => change({ ...ads, interval: +e.target.value })}>
              {[4, 5, 6, 8, 10, 15].map((s) => <option key={s} value={s}>{s} seconds</option>)}
            </select>
          </Field>
        </div>
        {dirty && <p className="mt-2 text-xs font-semibold text-gold-600">{stored ? 'You have unsaved changes.' : 'The Dua After Salah sample is ready below. Click Save, then "Preview on page". Switch the section ON when you are happy.'}</p>}
      </section>

      <section className="nk-card p-4 sm:p-5">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-base font-bold text-emerald-950">Ads ({ads.items.length})</h2>
          <div className="flex flex-wrap gap-1.5">
            {adTypes.map((t) => <Btn key={t.type} kind="ghost" className="px-2.5! py-1! text-xs!" title={t.hint} onClick={() => add(t.type)}>+ {t.name}</Btn>)}
            {!ads.items.some((a) => a.id === 'dua-after-salah') && <Btn kind="gold" className="px-2.5! py-1! text-xs!" onClick={() => { change({ ...ads, items: [...ads.items, sampleDuaAd()] }); }}>+ Dua After Salah sample</Btn>}
          </div>
        </div>
        <div className="grid gap-3">
          {ads.items.map((a, i) => {
            const missing = adMissing(a);
            const isOpen = open === a.id;
            const typeName = adTypes.find((t) => t.type === a.type)?.name;
            const dates = [a.start && `from ${a.start}`, a.end && `until ${a.end}`].filter(Boolean).join(' ');
            return (
              <article key={a.id} className={`rounded-xl border p-3.5 ${a.on && !missing ? 'border-emerald-600/30 bg-white' : 'border-[#e7e1cf] bg-gray-50'}`}>
                <div className="flex flex-wrap items-center gap-2">
                  <Switch on={a.on} onChange={(v) => setItem(a.id, { ...a, on: v })} label={`Show ${a.title || typeName}`} />
                  <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-bold text-emerald-800">{typeName}</span>
                  <b className="min-w-0 flex-1 truncate">{a.title || <span className="font-normal text-emerald-900/50">Untitled</span>}</b>
                  {missing && <span className="rounded-full bg-red-50 px-2 py-0.5 text-xs text-red-700">needs {missing}</span>}
                  {dates && <span className="text-xs text-emerald-900/60">{dates}</span>}
                  <span className="flex gap-1">
                    <Btn kind="ghost" className="px-2! py-1!" disabled={i === 0} onClick={() => move(i, -1)} aria-label="Move up">↑</Btn>
                    <Btn kind="ghost" className="px-2! py-1!" disabled={i === ads.items.length - 1} onClick={() => move(i, 1)} aria-label="Move down">↓</Btn>
                    <Btn kind="ghost" className="px-2.5! py-1!" onClick={() => setOpen(isOpen ? null : a.id)}>{isOpen ? 'Close' : 'Edit'}</Btn>
                    <Btn kind="ghost" className="px-2.5! py-1!" onClick={() => { const c = { ...a, id: newId(), title: `${a.title ?? ''} (copy)`.trim() }; change({ ...ads, items: [...ads.items.slice(0, i + 1), c, ...ads.items.slice(i + 1)] }); setOpen(c.id); }}>Copy</Btn>
                    <Btn kind="ghost" className="px-2.5! py-1! text-red-700" onClick={() => confirm('Delete this ad?') && change({ ...ads, items: ads.items.filter((x) => x.id !== a.id) })}>Delete</Btn>
                  </span>
                </div>
                {isOpen ? (
                  <div className="mt-3 grid gap-4 lg:grid-cols-[1fr_22rem]">
                    <Editor ad={a} onChange={(n) => setItem(a.id, n)} toast={toast} />
                    <div>
                      <div className="mb-1.5 text-xs font-bold text-emerald-900/60">Preview</div>
                      {missing ? <p className="rounded-xl bg-gray-100 p-6 text-center text-sm text-emerald-900/60">Add a {missing} to see the preview.</p> : <Preview ad={a} />}
                    </div>
                  </div>
                ) : (
                  !missing && <div className="mt-3 max-w-md opacity-90"><Preview ad={a} /></div>
                )}
              </article>
            );
          })}
          {!ads.items.length && <p className="rounded-xl bg-emerald-50 p-6 text-center text-sm text-emerald-900/70">No ads yet. Pick a type above to add one.</p>}
        </div>
        {dirty && <div className="mt-4 flex justify-end"><Btn onClick={() => save()} disabled={busy}>{busy ? 'Saving…' : 'Save changes'}</Btn></div>}
      </section>
    </div>
  );
}
