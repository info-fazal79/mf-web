/* Nusuk Manager → Social media: make post images (JPG) and captions for Facebook / Instagram.
   Three tabs: Feature update (ready designs for new features, e.g. the district map with live counts),
   Giveaway (prizes with pictures) and General (any post: announcement, quiz, winner, quote, event …).
   Everything is drawn in the browser (_lib/social.ts); drafts are kept on this computer. */
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Copy, Download, ImagePlus, Plus, RotateCcw, Trash2, X } from 'lucide-react';
import { supabase as sb } from '@/lib/supabase';
import { loadImage } from '../_lib/clubcard';
import { BD_DISTRICTS } from '../_lib/bdmap';
import { countDistricts } from '../_lib/distmap';
import { BN_RANK, OPTION_MARK, SIZES, THEMES, bnNum, downloadJpg, drawDesign, fileToImage, ribatLogo, type Block, type Design, type SizeKey, type ThemeKey, type Visual } from '../_lib/social';

type ToastFn = (t: string, ok?: boolean) => void;
export type SocialMode = 'social' | 'socialgive' | 'socialgen';

const SITE = 'muhammadfazal.com/nusuk';
const TAGS = '#Nusuk #নুসুক #উমরাহ #RibatulUmmah';

// ------------------------------------------------------------------ common look
type Look = { size: SizeKey; theme: ThemeKey; layout: Design['layout']; logo: string; brand: string; brandSub: string; footer: string };
const LOOK: Look = { size: 'portrait', theme: 'green', layout: 'auto', logo: '', brand: 'Ribatul Ummah', brandSub: 'Nusuk Code Share · উমরাহ প্রতিযোগিতা', footer: `🌐 ${SITE}` };

// ------------------------------------------------------------------ feature updates
type Feat = { preset: 'district'; tag: string; title: string; sub: string; list: string[]; stats: boolean; cta: string };
const FEAT: Feat = {
  preset: 'district',
  tag: '🆕 নতুন ফিচার',
  title: 'আপনার জেলা কতটা এগিয়ে?',
  sub: 'জেলাভিত্তিক মানচিত্র এখন নুসুক পেজে',
  list: [
    'কোন জেলা থেকে কতজন অ্যাকাউন্ট খুলেছেন, ম্যাপে দেখুন',
    'অ্যাকাউন্ট খুললেই আপনার জেলা গাঢ় সবুজ হয়ে উঠবে',
    'এগিয়ে থাকা জেলার র‍্যাংকিং ও সব জেলার তালিকা',
    'যেকোনো জেলায় চাপ দিলে বড় করে দেখুন',
  ],
  stats: true,
  cta: 'আজই অ্যাকাউন্ট খুলে জেলাকে এগিয়ে নিন',
};

// ------------------------------------------------------------------ giveaway
type GPrize = { rank: string; name: string; img: string };
type Give = { tag: string; title: string; sub: string; prizes: GPrize[]; steps: string[]; deadline: string; draw: string; cta: string };
const GIVE: Give = {
  tag: '🎁 গিভঅ্যাওয়ে',
  title: 'মেগা গিভঅ্যাওয়ে',
  sub: 'নুসুক কোড শেয়ার করুন, জিতে নিন আকর্ষণীয় পুরস্কার',
  prizes: [{ rank: '', name: 'প্রথম পুরস্কার', img: '' }, { rank: '', name: 'দ্বিতীয় পুরস্কার', img: '' }, { rank: '', name: 'তৃতীয় পুরস্কার', img: '' }],
  steps: ['পেজে অ্যাকাউন্ট খুলুন', 'আপনার নুসুক কোড জমা দিন', 'পোস্টটি শেয়ার করে বন্ধুদের মেনশন করুন'],
  deadline: '',
  draw: '',
  cta: 'অংশ নিতে এখনই ভিজিট করুন',
};

// ------------------------------------------------------------------ general
type GenType = 'announce' | 'feature' | 'quiz' | 'winner' | 'event' | 'steps' | 'stats' | 'quote';
type Gen = {
  type: GenType; tag: string; title: string; sub: string; body: string; big: string;
  list: string[]; options: string[]; stats: { v: string; l: string }[];
  quote: string; source: string; date: string; time: string; place: string; image: string; cta: string;
};
type Field = 'tag' | 'title' | 'big' | 'sub' | 'body' | 'list' | 'steps' | 'options' | 'stats' | 'quote' | 'info' | 'image' | 'cta';
const GEN_TYPES: { key: GenType; label: string; hint: string; fields: Field[]; emoji: string; d: Partial<Gen> }[] = [
  { key: 'announce', label: '📢 ঘোষণা / নোটিশ', emoji: '📢', hint: 'জরুরি খবর, নিয়ম বদল, নোটিশ', fields: ['tag', 'title', 'sub', 'body', 'list', 'image', 'cta'],
    d: { tag: '📢 জরুরি ঘোষণা', title: 'গুরুত্বপূর্ণ ঘোষণা', sub: '', body: 'এখানে ঘোষণার বিস্তারিত লিখুন।', list: [''], cta: '' } },
  { key: 'feature', label: '✨ ফিচার / স্ক্রিনশট', emoji: '✨', hint: 'নতুন ফিচার, পাশে স্ক্রিনশট', fields: ['tag', 'title', 'sub', 'body', 'list', 'image', 'cta'],
    d: { tag: '🆕 নতুন ফিচার', title: 'ফিচারের নাম', sub: 'এক লাইনে ফিচারটি কী করে', body: '', list: ['প্রথম সুবিধা', 'দ্বিতীয় সুবিধা'], cta: 'এখনই দেখুন' } },
  { key: 'quiz', label: '❓ প্রশ্ন / কুইজ / পোল', emoji: '❓', hint: 'প্রশ্ন আর ২–৪টি অপশন', fields: ['tag', 'title', 'options', 'image', 'cta'],
    d: { tag: '❓ আজকের প্রশ্ন', title: 'আজ কোন দেশ থেকে বিজয়ী হওয়ার সম্ভাবনা বেশি?', options: ['বাংলাদেশ', 'পাকিস্তান', 'ইন্দোনেশিয়া', 'মিশর'], cta: 'কমেন্টে উত্তর দিন' } },
  { key: 'winner', label: '🏆 বিজয়ী ঘোষণা', emoji: '🏆', hint: 'বিজয়ীর নাম, দেশ/জেলা, ছবি', fields: ['tag', 'big', 'sub', 'body', 'image', 'cta'],
    d: { tag: '🎉 অভিনন্দন', big: 'বিজয়ীর নাম', sub: 'দেশ · পুরস্কার', body: 'আল্লাহ তাঁর উমরাহ কবুল করুন।', cta: 'আপনিও অংশ নিন' } },
  { key: 'event', label: '📅 ইভেন্ট / লাইভ', emoji: '📅', hint: 'তারিখ, সময়, কোথায়', fields: ['tag', 'title', 'sub', 'info', 'body', 'image', 'cta'],
    d: { tag: '🔴 লাইভ', title: 'আজ রাতে লাইভ ড্র', sub: 'সরাসরি বিজয়ী ঘোষণা', date: 'আজ', time: 'রাত ৯টা', place: 'ফেসবুক পেজে লাইভ', cta: 'লাইভে থাকুন' } },
  { key: 'steps', label: '🧭 ধাপে ধাপে / টিপস', emoji: '🧭', hint: 'কীভাবে করবেন, নম্বরসহ ধাপ', fields: ['tag', 'title', 'sub', 'steps', 'image', 'cta'],
    d: { tag: '💡 টিপস', title: 'কীভাবে কোড ব্যবহার করবেন', sub: '', list: ['Copy Code চাপুন', 'Nusuk অ্যাপ খুলুন', 'Start the Challenge চেপে কোড পেস্ট করুন'], cta: '' } },
  { key: 'stats', label: '📊 পরিসংখ্যান', emoji: '📊', hint: '২–৪টি সংখ্যা ও লেবেল', fields: ['tag', 'title', 'sub', 'stats', 'body', 'cta'],
    d: { tag: '📊 এক নজরে', title: 'আমাদের অগ্রগতি', stats: [{ v: '১৪৯', l: 'অ্যাকাউন্ট' }, { v: '৩৮', l: 'জেলা' }, { v: '১১', l: 'বিজয়ী' }], body: '', cta: '' } },
  { key: 'quote', label: '💬 উক্তি / হাদিস', emoji: '💬', hint: 'একটি উক্তি ও সূত্র', fields: ['tag', 'quote', 'cta'],
    d: { tag: '', quote: 'উক্তি বা হাদিসের লেখা এখানে', source: 'সূত্র', cta: '' } },
];
const GEN_EMPTY: Gen = { type: 'announce', tag: '', title: '', sub: '', body: '', big: '', list: [''], options: ['', ''], stats: [{ v: '', l: '' }, { v: '', l: '' }], quote: '', source: '', date: '', time: '', place: '', image: '', cta: '' };
const genOf = (t: GenType): Gen => ({ ...GEN_EMPTY, ...GEN_TYPES.find((x) => x.key === t)!.d, type: t });

// ------------------------------------------------------------------ drafts on this computer
function useDraft<T>(key: string, init: T) {
  const [v, setV] = useState<T>(() => {
    try { const s = localStorage.getItem(key); return s ? { ...init, ...JSON.parse(s) } : init; } catch { return init; }
  });
  useEffect(() => {
    const t = setTimeout(() => {
      try { localStorage.setItem(key, JSON.stringify(v)); } catch { /* pictures too big to keep: fine */ }
    }, 400);
    return () => clearTimeout(t);
  }, [key, v]);
  return [v, setV] as const;
}

/** data-URL / path → loaded image, cached */
const imgCache = new Map<string, Promise<HTMLImageElement | null>>();
const img = (url: string) => {
  if (!url) return Promise.resolve(null);
  if (!imgCache.has(url)) imgCache.set(url, loadImage(url));
  return imgCache.get(url)!;
};

// ------------------------------------------------------------------ small form parts
const Lbl = ({ t, children, hint }: { t: string; hint?: string; children: ReactNode }) => (
  <label className="grid gap-1">
    <span className="text-sm font-semibold text-emerald-950">{t}{hint && <span className="ml-1.5 text-xs font-normal text-emerald-900/55">{hint}</span>}</span>
    {children}
  </label>
);
function ListEdit({ items, set, ph, max = 8, numbered }: { items: string[]; set: (v: string[]) => void; ph: string; max?: number; numbered?: boolean }) {
  return (
    <div className="grid gap-1.5">
      {items.map((t, i) => (
        <div key={i} className="flex items-center gap-1.5">
          <span className="w-5 shrink-0 text-right text-xs font-bold text-emerald-800">{numbered ? bnNum(i + 1) : '•'}</span>
          <input className="nk-input flex-1" value={t} maxLength={120} placeholder={ph} onChange={(e) => set(items.map((x, j) => (j === i ? e.target.value : x)))} />
          <button type="button" className="nk-btn nk-ghost px-2 py-1.5 text-red-700" aria-label="Remove" onClick={() => set(items.length > 1 ? items.filter((_, j) => j !== i) : [''])}><X className="h-4 w-4" /></button>
        </div>
      ))}
      {items.length < max && <button type="button" className="nk-btn nk-ghost w-fit px-3 py-1.5 text-xs" onClick={() => set([...items, ''])}><Plus className="h-3.5 w-3.5" /> Add line</button>}
    </div>
  );
}
function ImagePick({ url, set, label = 'Upload picture' }: { url: string; set: (u: string) => void; label?: string }) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <div className="flex items-center gap-2">
      {url ? <img src={url} alt="" className="h-14 w-14 rounded-lg border border-[#e7e1cf] bg-white object-contain" /> : <span className="grid h-14 w-14 place-items-center rounded-lg border border-dashed border-emerald-900/30 text-emerald-900/40"><ImagePlus className="h-5 w-5" /></span>}
      <button type="button" className="nk-btn nk-ghost px-3 py-2 text-xs" onClick={() => ref.current?.click()}>{url ? 'Change' : label}</button>
      {url && <button type="button" className="nk-btn nk-ghost px-2 py-2 text-xs text-red-700" onClick={() => set('')}><Trash2 className="h-3.5 w-3.5" /></button>}
      <input ref={ref} type="file" accept="image/*" hidden onChange={async (e) => {
        const f = e.target.files?.[0]; e.target.value = '';
        if (!f) return;
        const { url: u } = await fileToImage(f);
        if (u) set(await shrink(u));
      }} />
    </div>
  );
}
/** keep uploaded pictures at most 1600 px, so drafts stay small and drawing stays quick */
async function shrink(url: string) {
  const i = await loadImage(url);
  if (!i || Math.max(i.width, i.height) <= 1600) return url;
  const k = 1600 / Math.max(i.width, i.height);
  const c = document.createElement('canvas');
  c.width = Math.round(i.width * k); c.height = Math.round(i.height * k);
  c.getContext('2d')!.drawImage(i, 0, 0, c.width, c.height);
  return c.toDataURL(/png/i.test(url.slice(0, 30)) ? 'image/png' : 'image/jpeg', 0.9);
}

// ------------------------------------------------------------------ captions
const lines = (xs: (string | false | undefined)[]) => xs.filter((x) => x !== false && x !== undefined).join('\n').replace(/\n{3,}/g, '\n\n').trim();
function featCaption(f: Feat, total: number, dists: number) {
  return lines([
    `${f.tag.trim() ? `${f.tag.trim()}: ` : ''}${f.title.trim()}`,
    '',
    f.sub.trim() && `${f.sub.trim()}।`,
    '',
    ...f.list.filter((t) => t.trim()).map((t) => `✅ ${t.trim()}`),
    '',
    f.stats && total ? `📊 এখন পর্যন্ত ${bnNum(total)}টি অ্যাকাউন্ট, ${bnNum(dists)}টি জেলা যুক্ত হয়েছে। আপনার জেলা কোথায়?` : '',
    '',
    f.cta.trim() && `👉 ${f.cta.trim()}`,
    `🔗 ${SITE}`,
    '',
    `${TAGS} #জেলাভিত্তিক_মানচিত্র`,
  ]);
}
function giveCaption(g: Give) {
  const medals = ['🥇', '🥈', '🥉'];
  return lines([
    `${g.tag.trim() ? `${g.tag.trim()} | ` : ''}${g.title.trim()}`,
    '',
    g.sub.trim(),
    '',
    g.prizes.some((p) => p.name.trim()) ? '🏆 পুরস্কার:' : '',
    ...g.prizes.filter((p) => p.name.trim()).map((p, i) => `${medals[i] ?? '🎁'} ${p.rank.trim() || `${BN_RANK[i]} পুরস্কার`}: ${p.name.trim()}`),
    '',
    g.steps.some((t) => t.trim()) ? '📝 কীভাবে অংশ নেবেন:' : '',
    ...g.steps.filter((t) => t.trim()).map((t, i) => `${bnNum(i + 1)}. ${t.trim()}`),
    '',
    g.deadline.trim() && `⏰ শেষ সময়: ${g.deadline.trim()}`,
    g.draw.trim() && `🎯 ড্র: ${g.draw.trim()}`,
    '',
    g.cta.trim() && `👉 ${g.cta.trim()}`,
    `🔗 ${SITE}`,
    '',
    `${TAGS} #Giveaway #গিভঅ্যাওয়ে`,
  ]);
}
function genCaption(g: Gen) {
  const T = GEN_TYPES.find((x) => x.key === g.type)!;
  const has = (f: Field) => T.fields.includes(f);
  return lines([
    has('quote') ? `“${g.quote.trim()}”${g.source.trim() ? `\n— ${g.source.trim()}` : ''}` : `${g.tag.trim() ? `${g.tag.trim()} | ` : `${T.emoji} `}${(has('big') ? g.big : g.title).trim()}`,
    '',
    has('sub') && g.sub.trim(),
    has('body') && g.body.trim(),
    '',
    ...(has('list') ? g.list.filter((t) => t.trim()).map((t) => `✅ ${t.trim()}`) : []),
    ...(has('steps') ? g.list.filter((t) => t.trim()).map((t, i) => `${bnNum(i + 1)}. ${t.trim()}`) : []),
    ...(has('options') ? g.options.filter((t) => t.trim()).map((t, i) => `${OPTION_MARK[i]}) ${t.trim()}`) : []),
    ...(has('stats') ? g.stats.filter((s) => s.v.trim()).map((s) => `📌 ${s.l.trim()}: ${s.v.trim()}`) : []),
    ...(has('info') ? [g.date.trim() && `📅 ${g.date.trim()}`, g.time.trim() && `⏰ ${g.time.trim()}`, g.place.trim() && `📍 ${g.place.trim()}`].filter(Boolean) as string[] : []),
    '',
    g.cta.trim() && `👉 ${g.cta.trim()}`,
    `🔗 ${SITE}`,
    '',
    TAGS,
  ]);
}

// ------------------------------------------------------------------ page
export default function SocialPage({ toast, mode }: { toast: ToastFn; mode: SocialMode }) {
  const [look, setLook] = useDraft<Look>('nusuk:social:look', LOOK);
  const [feat, setFeat] = useDraft<Feat>('nusuk:social:feat', FEAT);
  const [give, setGive] = useDraft<Give>('nusuk:social:give', GIVE);
  const [gen, setGen] = useDraft<Gen>('nusuk:social:gen', genOf('announce'));
  const [map, setMap] = useState<{ counts: number[]; total: number } | null>(null);
  const [caption, setCaption] = useState('');
  const [capEdited, setCapEdited] = useState(false);
  const [busy, setBusy] = useState(false);
  const canvas = useRef<HTMLCanvasElement>(null);

  // live district counts for the map design
  useEffect(() => {
    if (mode !== 'social' || map || !sb) return;
    sb.rpc('nusuk_district_map').then(({ data, error }) => {
      if (error) return toast('Could not load district counts (update_43)', false);
      const d = data as { total: number; d: Record<string, number> };
      setMap({ counts: countDistricts(BD_DISTRICTS, d.d ?? {}).counts, total: d.total || 0 });
    });
  }, [mode, map, toast]);
  const mapDists = map ? map.counts.filter((n) => n > 0).length : 0;

  const autoCaption = useMemo(() => (mode === 'social' ? featCaption(feat, map?.total ?? 0, mapDists) : mode === 'socialgive' ? giveCaption(give) : genCaption(gen)), [mode, feat, give, gen, map, mapDists]);
  useEffect(() => { setCapEdited(false); }, [mode]);
  useEffect(() => { if (!capEdited) setCaption(autoCaption); }, [autoCaption, capEdited]);

  // draw the picture whenever something changes
  useEffect(() => {
    let off = false;
    const t = setTimeout(async () => {
      const logo = look.logo ? await img(look.logo) : await ribatLogo();
      let blocks: Block[] = [];
      let visual: Visual = null;
      if (mode === 'social') {
        blocks = [
          { k: 'tag', text: feat.tag }, { k: 'title', text: feat.title }, { k: 'sub', text: feat.sub },
          ...(feat.stats && map ? [{ k: 'stats', items: [{ v: bnNum(map.total), l: 'মোট অ্যাকাউন্ট' }, { v: `${bnNum(mapDists)}/৬৪`, l: 'যুক্ত জেলা' }] } as Block] : []),
          { k: 'list', items: feat.list }, { k: 'cta', text: feat.cta },
        ];
        visual = { kind: 'map', counts: map?.counts ?? BD_DISTRICTS.map(() => 0) };
      } else if (mode === 'socialgive') {
        const prizes = await Promise.all(give.prizes.map(async (p, i) => ({ rank: p.rank || `${BN_RANK[i]} পুরস্কার`, name: p.name, img: await img(p.img) })));
        blocks = [
          { k: 'tag', text: give.tag }, { k: 'title', text: give.title }, { k: 'sub', text: give.sub },
          { k: 'prizes', items: prizes },
          { k: 'list', items: give.steps, numbered: true },
          { k: 'info', items: [{ icon: '⏰', text: give.deadline.trim() ? `শেষ সময়: ${give.deadline.trim()}` : '' }, { icon: '🎯', text: give.draw.trim() ? `ড্র: ${give.draw.trim()}` : '' }] },
          { k: 'cta', text: give.cta },
        ];
      } else {
        const T = GEN_TYPES.find((x) => x.key === gen.type)!;
        for (const f of T.fields) {
          if (f === 'tag') blocks.push({ k: 'tag', text: gen.tag });
          if (f === 'title') blocks.push({ k: 'title', text: gen.title });
          if (f === 'big') blocks.push({ k: 'big', text: gen.big });
          if (f === 'sub') blocks.push({ k: 'sub', text: gen.sub });
          if (f === 'body') blocks.push({ k: 'body', text: gen.body });
          if (f === 'list') blocks.push({ k: 'list', items: gen.list });
          if (f === 'steps') blocks.push({ k: 'list', items: gen.list, numbered: true });
          if (f === 'options') blocks.push({ k: 'options', items: gen.options });
          if (f === 'stats') blocks.push({ k: 'stats', items: gen.stats });
          if (f === 'quote') blocks.push({ k: 'quote', text: gen.quote, source: gen.source });
          if (f === 'info') blocks.push({ k: 'info', items: [{ icon: '📅', text: gen.date }, { icon: '⏰', text: gen.time }, { icon: '📍', text: gen.place }] });
          if (f === 'cta') blocks.push({ k: 'cta', text: gen.cta });
        }
        const pic = T.fields.includes('image') ? await img(gen.image) : null;
        visual = pic ? { kind: 'image', img: pic } : null;
      }
      if (off || !canvas.current) return;
      await drawDesign(canvas.current, { size: look.size, theme: look.theme, layout: look.layout, logo, brand: look.brand, brandSub: look.brandSub, footer: look.footer, blocks, visual });
    }, 150);
    return () => { off = true; clearTimeout(t); };
  }, [mode, look, feat, give, gen, map, mapDists]);

  async function download() {
    if (!canvas.current) return;
    setBusy(true);
    const name = mode === 'social' ? feat.title : mode === 'socialgive' ? give.title : gen.title || gen.big || 'post';
    const ok = await downloadJpg(canvas.current, `nusuk-${name}`);
    setBusy(false);
    toast(ok ? 'JPG downloaded' : 'Could not make the picture', ok);
  }
  async function copyCaption() {
    try { await navigator.clipboard.writeText(caption); toast('Caption copied'); } catch { toast('Select the text and copy it', false); }
  }

  const setL = (p: Partial<Look>) => setLook({ ...look, ...p });
  const genType = GEN_TYPES.find((x) => x.key === gen.type)!;
  const has = (f: Field) => genType.fields.includes(f);
  const setG = (p: Partial<Gen>) => setGen({ ...gen, ...p });

  return (
    <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,26rem)] xl:grid-cols-[minmax(0,1fr)_minmax(0,30rem)]">
      <div className="grid gap-4">
        {/* ---------- content ---------- */}
        <section className="nk-card grid gap-3 p-4 sm:p-5">
          {mode === 'social' && (
            <>
              <div>
                <h2 className="text-base font-bold text-emerald-950">Feature update post</h2>
                <p className="text-sm text-emerald-900/70">Ready designs for new features on /nusuk. The map shows live account counts per district.</p>
              </div>
              <Lbl t="Design"><select className="nk-input" value={feat.preset} onChange={() => setFeat({ ...feat, preset: 'district' })}><option value="district">📍 District map: আপনার জেলা কতটা এগিয়ে?</option></select></Lbl>
              <Lbl t="Tag"><input className="nk-input" value={feat.tag} maxLength={40} onChange={(e) => setFeat({ ...feat, tag: e.target.value })} /></Lbl>
              <Lbl t="Heading"><input className="nk-input" value={feat.title} maxLength={90} onChange={(e) => setFeat({ ...feat, title: e.target.value })} /></Lbl>
              <Lbl t="Sub heading"><input className="nk-input" value={feat.sub} maxLength={120} onChange={(e) => setFeat({ ...feat, sub: e.target.value })} /></Lbl>
              <Lbl t="What is new" hint="one line each"><ListEdit items={feat.list} set={(list) => setFeat({ ...feat, list })} ph="কী যোগ হয়েছে" /></Lbl>
              <label className="flex items-center gap-2 text-sm font-semibold text-emerald-950"><input type="checkbox" checked={feat.stats} onChange={(e) => setFeat({ ...feat, stats: e.target.checked })} /> Show live numbers (accounts, districts){map && <span className="font-normal text-emerald-900/60">: {map.total} accounts · {mapDists}/64 districts</span>}</label>
              <Lbl t="Button text"><input className="nk-input" value={feat.cta} maxLength={60} onChange={(e) => setFeat({ ...feat, cta: e.target.value })} /></Lbl>
              <div className="flex gap-2">
                <button type="button" className="nk-btn nk-ghost px-3 py-2 text-xs" onClick={() => setMap(null)}><RotateCcw className="h-3.5 w-3.5" /> Refresh counts</button>
                <button type="button" className="nk-btn nk-ghost px-3 py-2 text-xs" onClick={() => setFeat(FEAT)}>Reset text</button>
              </div>
            </>
          )}

          {mode === 'socialgive' && (
            <>
              <div>
                <h2 className="text-base font-bold text-emerald-950">Giveaway post</h2>
                <p className="text-sm text-emerald-900/70">Add the prizes with their pictures. Empty fields are left out of the picture.</p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <Lbl t="Tag"><input className="nk-input" value={give.tag} maxLength={40} onChange={(e) => setGive({ ...give, tag: e.target.value })} /></Lbl>
                <Lbl t="Heading"><input className="nk-input" value={give.title} maxLength={90} onChange={(e) => setGive({ ...give, title: e.target.value })} /></Lbl>
              </div>
              <Lbl t="Sub heading"><input className="nk-input" value={give.sub} maxLength={140} onChange={(e) => setGive({ ...give, sub: e.target.value })} /></Lbl>
              <div className="grid gap-2">
                <span className="text-sm font-semibold text-emerald-950">Prizes <span className="text-xs font-normal text-emerald-900/55">1st prize is highlighted</span></span>
                {give.prizes.map((p, i) => {
                  const setP = (q: Partial<GPrize>) => setGive({ ...give, prizes: give.prizes.map((x, j) => (j === i ? { ...x, ...q } : x)) });
                  return (
                    <div key={i} className="grid gap-2 rounded-xl border border-[#e7e1cf] bg-cream/40 p-3">
                      <div className="flex items-center gap-2">
                        <b className="w-14 shrink-0 text-sm text-emerald-900">{['🥇', '🥈', '🥉'][i] ?? '🎁'} {BN_RANK[i]}</b>
                        <input className="nk-input flex-1" value={p.name} maxLength={60} placeholder="পুরস্কারের নাম" onChange={(e) => setP({ name: e.target.value })} />
                        <button type="button" className="nk-btn nk-ghost px-2 py-1.5 text-red-700" aria-label="Remove prize" onClick={() => setGive({ ...give, prizes: give.prizes.filter((_, j) => j !== i) })}><X className="h-4 w-4" /></button>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <input className="nk-input w-44" value={p.rank} maxLength={24} placeholder={`${BN_RANK[i]} পুরস্কার`} onChange={(e) => setP({ rank: e.target.value })} />
                        <ImagePick url={p.img} set={(img) => setP({ img })} label="Prize picture" />
                      </div>
                    </div>
                  );
                })}
                {give.prizes.length < 6 && <button type="button" className="nk-btn nk-ghost w-fit px-3 py-1.5 text-xs" onClick={() => setGive({ ...give, prizes: [...give.prizes, { rank: '', name: '', img: '' }] })}><Plus className="h-3.5 w-3.5" /> Add prize</button>}
              </div>
              <Lbl t="How to take part" hint="numbered steps"><ListEdit items={give.steps} set={(steps) => setGive({ ...give, steps })} ph="ধাপ" numbered /></Lbl>
              <div className="grid gap-3 sm:grid-cols-2">
                <Lbl t="Last date"><input className="nk-input" value={give.deadline} maxLength={50} placeholder="যেমন: ৩০ নভেম্বর, রাত ১২টা" onChange={(e) => setGive({ ...give, deadline: e.target.value })} /></Lbl>
                <Lbl t="Draw"><input className="nk-input" value={give.draw} maxLength={50} placeholder="যেমন: ১ ডিসেম্বর, ফেসবুক লাইভে" onChange={(e) => setGive({ ...give, draw: e.target.value })} /></Lbl>
              </div>
              <Lbl t="Button text"><input className="nk-input" value={give.cta} maxLength={60} onChange={(e) => setGive({ ...give, cta: e.target.value })} /></Lbl>
              <button type="button" className="nk-btn nk-ghost w-fit px-3 py-2 text-xs" onClick={() => setGive(GIVE)}>Reset</button>
            </>
          )}

          {mode === 'socialgen' && (
            <>
              <div>
                <h2 className="text-base font-bold text-emerald-950">General post</h2>
                <p className="text-sm text-emerald-900/70">Pick a type, fill what you need. Only filled fields are drawn, and the layout arranges itself.</p>
              </div>
              <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
                {GEN_TYPES.map((t) => (
                  <button key={t.key} type="button" title={t.hint} onClick={() => setGen({ ...genOf(t.key), image: gen.image })}
                    className={`rounded-xl border px-2 py-2 text-left text-xs font-bold leading-snug ${gen.type === t.key ? 'border-emerald-900 bg-emerald-900 text-white' : 'border-[#e7e1cf] bg-white text-emerald-950 hover:bg-emerald-50'}`}>
                    {t.label}<span className={`mt-0.5 block font-normal ${gen.type === t.key ? 'text-emerald-50/80' : 'text-emerald-900/55'}`}>{t.hint}</span>
                  </button>
                ))}
              </div>
              {has('tag') && <Lbl t="Tag" hint="small label on top"><input className="nk-input" value={gen.tag} maxLength={40} onChange={(e) => setG({ tag: e.target.value })} /></Lbl>}
              {has('title') && <Lbl t={gen.type === 'quiz' ? 'Question' : 'Heading'}><textarea className="nk-input" rows={2} value={gen.title} maxLength={160} onChange={(e) => setG({ title: e.target.value })} /></Lbl>}
              {has('big') && <Lbl t="Name"><input className="nk-input" value={gen.big} maxLength={60} onChange={(e) => setG({ big: e.target.value })} /></Lbl>}
              {has('sub') && <Lbl t="Sub heading"><input className="nk-input" value={gen.sub} maxLength={140} onChange={(e) => setG({ sub: e.target.value })} /></Lbl>}
              {has('quote') && (
                <>
                  <Lbl t="Quote"><textarea className="nk-input" rows={4} value={gen.quote} maxLength={400} onChange={(e) => setG({ quote: e.target.value })} /></Lbl>
                  <Lbl t="Source"><input className="nk-input" value={gen.source} maxLength={80} onChange={(e) => setG({ source: e.target.value })} /></Lbl>
                </>
              )}
              {has('info') && (
                <div className="grid gap-3 sm:grid-cols-3">
                  <Lbl t="📅 Date"><input className="nk-input" value={gen.date} maxLength={40} onChange={(e) => setG({ date: e.target.value })} /></Lbl>
                  <Lbl t="⏰ Time"><input className="nk-input" value={gen.time} maxLength={40} onChange={(e) => setG({ time: e.target.value })} /></Lbl>
                  <Lbl t="📍 Where"><input className="nk-input" value={gen.place} maxLength={60} onChange={(e) => setG({ place: e.target.value })} /></Lbl>
                </div>
              )}
              {has('options') && (
                <Lbl t="Options" hint="2 to 4">
                  <div className="grid gap-1.5 sm:grid-cols-2">
                    {gen.options.map((o, i) => (
                      <div key={i} className="flex items-center gap-1.5">
                        <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-emerald-900 text-xs font-bold text-white">{OPTION_MARK[i]}</span>
                        <input className="nk-input flex-1" value={o} maxLength={60} onChange={(e) => setG({ options: gen.options.map((x, j) => (j === i ? e.target.value : x)) })} />
                        {gen.options.length > 2 && <button type="button" className="nk-btn nk-ghost px-2 py-1.5 text-red-700" aria-label="Remove" onClick={() => setG({ options: gen.options.filter((_, j) => j !== i) })}><X className="h-4 w-4" /></button>}
                      </div>
                    ))}
                  </div>
                  {gen.options.length < 4 && <button type="button" className="nk-btn nk-ghost mt-1 w-fit px-3 py-1.5 text-xs" onClick={() => setG({ options: [...gen.options, ''] })}><Plus className="h-3.5 w-3.5" /> Add option</button>}
                </Lbl>
              )}
              {has('stats') && (
                <Lbl t="Numbers" hint="up to 4">
                  <div className="grid gap-1.5">
                    {gen.stats.map((s, i) => (
                      <div key={i} className="flex items-center gap-1.5">
                        <input className="nk-input w-28" value={s.v} maxLength={12} placeholder="১৪৯" onChange={(e) => setG({ stats: gen.stats.map((x, j) => (j === i ? { ...x, v: e.target.value } : x)) })} />
                        <input className="nk-input flex-1" value={s.l} maxLength={30} placeholder="লেবেল" onChange={(e) => setG({ stats: gen.stats.map((x, j) => (j === i ? { ...x, l: e.target.value } : x)) })} />
                        <button type="button" className="nk-btn nk-ghost px-2 py-1.5 text-red-700" aria-label="Remove" onClick={() => setG({ stats: gen.stats.length > 1 ? gen.stats.filter((_, j) => j !== i) : [{ v: '', l: '' }] })}><X className="h-4 w-4" /></button>
                      </div>
                    ))}
                  </div>
                  {gen.stats.length < 4 && <button type="button" className="nk-btn nk-ghost mt-1 w-fit px-3 py-1.5 text-xs" onClick={() => setG({ stats: [...gen.stats, { v: '', l: '' }] })}><Plus className="h-3.5 w-3.5" /> Add number</button>}
                </Lbl>
              )}
              {has('body') && <Lbl t="Text"><textarea className="nk-input" rows={3} value={gen.body} maxLength={500} onChange={(e) => setG({ body: e.target.value })} /></Lbl>}
              {has('list') && <Lbl t="Points" hint="with ✓"><ListEdit items={gen.list} set={(list) => setG({ list })} ph="একটি পয়েন্ট" /></Lbl>}
              {has('steps') && <Lbl t="Steps" hint="numbered"><ListEdit items={gen.list} set={(list) => setG({ list })} ph="ধাপ" numbered /></Lbl>}
              {has('image') && <Lbl t={gen.type === 'feature' ? 'Screenshot' : 'Picture'} hint="optional; a tall picture goes on the side"><ImagePick url={gen.image} set={(image) => setG({ image })} /></Lbl>}
              {has('cta') && <Lbl t="Button text" hint="optional"><input className="nk-input" value={gen.cta} maxLength={60} onChange={(e) => setG({ cta: e.target.value })} /></Lbl>}
              <button type="button" className="nk-btn nk-ghost w-fit px-3 py-2 text-xs" onClick={() => setGen(genOf(gen.type))}>Reset this type</button>
            </>
          )}
        </section>

        {/* ---------- look ---------- */}
        <section className="nk-card grid gap-3 p-4 sm:p-5">
          <h2 className="text-base font-bold text-emerald-950">Design</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <Lbl t="Size"><select className="nk-input" value={look.size} onChange={(e) => setL({ size: e.target.value as SizeKey })}>{(Object.keys(SIZES) as SizeKey[]).map((k) => <option key={k} value={k}>{SIZES[k].label}</option>)}</select></Lbl>
            <Lbl t="Layout"><select className="nk-input" value={look.layout} onChange={(e) => setL({ layout: e.target.value as Design['layout'] })}>
              <option value="auto">Auto (best fit)</option><option value="split">Text left, picture right</option><option value="stack">One column (picture under the heading)</option>
            </select></Lbl>
          </div>
          <div className="flex flex-wrap gap-2">
            {(Object.keys(THEMES) as ThemeKey[]).map((k) => (
              <button key={k} type="button" onClick={() => setL({ theme: k })} className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-semibold ${look.theme === k ? 'border-emerald-900 ring-2 ring-emerald-900/30' : 'border-[#e7e1cf]'}`}>
                <i className="h-5 w-5 rounded-full" style={{ background: `linear-gradient(135deg, ${THEMES[k].bg1}, ${THEMES[k].bg2})`, boxShadow: `inset 0 0 0 2px ${THEMES[k].accent}` }} />{THEMES[k].name}
              </button>
            ))}
          </div>
          <Lbl t="Logo" hint="Ribat logo by default"><ImagePick url={look.logo} set={(logo) => setL({ logo })} label="Upload logo" /></Lbl>
          <div className="grid gap-3 sm:grid-cols-2">
            <Lbl t="Name next to the logo"><input className="nk-input" value={look.brand} maxLength={40} onChange={(e) => setL({ brand: e.target.value })} /></Lbl>
            <Lbl t="Line under the name"><input className="nk-input" value={look.brandSub} maxLength={60} onChange={(e) => setL({ brandSub: e.target.value })} /></Lbl>
          </div>
          <Lbl t="Footer" hint="empty = no footer"><input className="nk-input" value={look.footer} maxLength={80} onChange={(e) => setL({ footer: e.target.value })} /></Lbl>
        </section>
      </div>

      {/* ---------- preview + caption ---------- */}
      <aside className="grid gap-3 lg:sticky lg:top-4">
        <section className="nk-card p-3">
          <canvas ref={canvas} width={1080} height={1350} className="w-full rounded-lg bg-emerald-950/5" aria-label="Preview" />
          <button type="button" disabled={busy} onClick={download} className="nk-btn nk-green mt-3 flex w-full items-center justify-center gap-2 py-3 text-sm"><Download className="h-4 w-4" /> {busy ? 'Making…' : 'Download JPG'}</button>
        </section>
        <section className="nk-card grid gap-2 p-3">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-sm font-bold text-emerald-950">Caption</h2>
            {capEdited && <button type="button" className="text-xs font-semibold text-emerald-700 hover:underline" onClick={() => setCapEdited(false)}>↺ Make again from the fields</button>}
          </div>
          <textarea className="nk-input nk-scroll text-sm leading-relaxed" rows={10} value={caption} onChange={(e) => { setCaption(e.target.value); setCapEdited(true); }} />
          <button type="button" onClick={copyCaption} className="nk-btn nk-ghost flex items-center justify-center gap-2 py-2.5 text-sm"><Copy className="h-4 w-4" /> Copy caption</button>
        </section>
      </aside>
    </div>
  );
}
