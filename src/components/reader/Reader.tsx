import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { marked } from 'marked';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import PdfView, { type PdfHandle } from './PdfView';
import {
  HL_COLORS,
  addAnnotation,
  fonts,
  listAnnotations,
  loadPosition,
  loadPrefs,
  rangeToOffsets,
  removeAnnotation,
  savePosition,
  savePrefs,
  themes,
  readerAccent,
  unwrapAll,
  updateAnnotation,
  widths,
  wrapOffsets,
  type Annotation,
  type HlColor,
  type Prefs,
} from './util';

type Book = { id: string; title: string; slug: string; author_name: string; cover_url: string | null; format: 'native' | 'pdf' | 'both'; pdf_path: string | null; access_mode: string; allow_download: boolean };
type Toc = { id: string; title: string; chapter_position: number; is_preview: boolean };
type Chapter = { id: string; title: string; content: string; position: number };
type Panel = 'toc' | 'notes' | 'search' | null;

const I = ({ d, s = 18 }: { d: string; s?: number }) => (
  <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={d} /></svg>
);
const ICON = {
  back: 'm15 18-6-6 6-6',
  toc: 'M4 6h16M4 12h10M4 18h14',
  notes: 'M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z',
  search: 'M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14ZM21 21l-4.3-4.3',
  type: 'M4 7V4h16v3M9 20h6M12 4v16',
  bookmark: 'M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z',
  speak: 'M11 5 6 9H2v6h4l5 4V5ZM15.5 8.5a5 5 0 0 1 0 7M19 5a10 10 0 0 1 0 14',
  full: 'M8 3H5a2 2 0 0 0-2 2v3M21 8V5a2 2 0 0 0-2-2h-3M3 16v3a2 2 0 0 0 2 2h3M16 21h3a2 2 0 0 0 2-2v-3',
  close: 'M18 6 6 18M6 6l12 12',
  lock: 'M5 11h14v10H5zM8 11V7a4 4 0 0 1 8 0v4',
};

export default function Reader() {
  const params = useMemo(() => new URLSearchParams(location.search), []);
  const slug = params.get('book') ?? '';
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const [book, setBook] = useState<Book | null>(null);
  const [error, setError] = useState('');
  const [canRead, setCanRead] = useState(false);
  const [toc, setToc] = useState<Toc[]>([]);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [mode, setMode] = useState<'book' | 'pdf'>('book');
  const [pdfUrl, setPdfUrl] = useState('');
  const [chapter, setChapter] = useState(0);
  const [page, setPage] = useState({ n: 1, total: 0 });
  const [zoom, setZoom] = useState(1);
  const [prefs, setPrefs] = useState<Prefs>(loadPrefs);
  const [panel, setPanel] = useState<Panel>(null);
  const [showType, setShowType] = useState(false);
  const [notes, setNotes] = useState<Annotation[]>([]);
  const [sel, setSel] = useState<{ x: number; y: number; start: number; end: number; quote: string } | null>(null);
  const [active, setActive] = useState<Annotation | null>(null);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<{ chapter?: number; page?: number; snippet: string }[]>([]);
  const [speaking, setSpeaking] = useState<'off' | 'on' | 'paused'>('off');
  const [chromeHidden, setChromeHidden] = useState(false);
  const [scrollPct, setScrollPct] = useState(0);
  const [restore, setRestore] = useState<{ pct?: number; page?: number } | null>(null);
  const content = useRef<HTMLDivElement>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const pdf = useRef<PdfHandle>(null);
  const userId = session?.user.id ?? null;
  const t = themes[prefs.theme];
  const { accent, onAccent } = readerAccent(t, prefs.theme);
  const protect = book?.access_mode === 'paid';

  useEffect(() => savePrefs(prefs), [prefs]);

  /* ---------------- Load session, book, access, chapters ---------------- */
  useEffect(() => {
    if (!supabase) return setError('Reader is not configured.');
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => data.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (session === undefined || !supabase) return;
    (async () => {
      const { data: b, error: e } = await supabase.from('ebooks').select('id,title,slug,author_name,cover_url,format,pdf_path,access_mode,allow_download').eq('slug', slug).maybeSingle();
      if (e || !b) return setError('This e-book could not be found.');
      setBook(b as Book);
      document.title = `${b.title} · Reader`;
      const [{ data: ok }, { data: tocRows }, { data: chs }] = await Promise.all([
        supabase.rpc('can_read_ebook', { p_ebook: b.id }),
        supabase.rpc('ebook_toc', { p_ebook: b.id }),
        supabase.from('ebook_chapters').select('id,title,content,position').eq('ebook_id', b.id).order('position'),
      ]);
      setCanRead(Boolean(ok));
      setToc((tocRows as Toc[]) ?? []);
      setChapters((chs as Chapter[]) ?? []);
      const hasChapters = ((tocRows as Toc[]) ?? []).length > 0;
      const startMode = b.format === 'pdf' || !hasChapters ? 'pdf' : 'book';
      if (ok && b.pdf_path) {
        const { data: signed } = await supabase.storage.from('ebooks').createSignedUrl(b.pdf_path, 60 * 60 * 3);
        if (signed) setPdfUrl(signed.signedUrl);
      }
      const pos = await loadPosition(b.id, session?.user.id ?? null);
      const ch = params.get('ch');
      if (ch !== null) setChapter(Number(ch) || 0);
      else if (pos?.chapter !== undefined) setChapter(pos.chapter);
      setMode((pos?.mode as 'book' | 'pdf') && (pos?.mode !== 'pdf' || b.pdf_path) && (pos?.mode !== 'book' || hasChapters) ? pos!.mode! : startMode);
      setRestore({ pct: ch === null ? pos?.pct : 0, page: pos?.page });
      setNotes(await listAnnotations(b.id, session?.user.id ?? null));
    })();
  }, [session === undefined, userId]); // eslint-disable-line react-hooks/exhaustive-deps

  const current = toc[chapter];
  const loaded = chapters.find((c) => c.id === current?.id);
  const locked = mode === 'book' && current && !loaded;
  const html = useMemo(() => (loaded ? (marked.parse(loaded.content, { async: false }) as string) : ''), [loaded]);

  /* ---------------- Render chapter + highlights ---------------- */
  const paintHighlights = useCallback(() => {
    const root = content.current;
    if (!root || !loaded) return;
    unwrapAll(root, 'mark[data-hl]');
    for (const n of notes) {
      if (n.kind !== 'highlight' || n.location.chapter !== loaded.id) continue;
      try {
        wrapOffsets(root, n.location.start!, n.location.end!, { 'data-hl': n.id, class: n.note ? 'has-note' : '' }, `background:${HL_COLORS[(n.color as HlColor) ?? 'yellow'] ?? HL_COLORS.yellow}`);
      } catch {}
    }
  }, [notes, loaded]);

  useEffect(() => {
    if (mode !== 'book' || !content.current) return;
    content.current.innerHTML = html;
    paintHighlights();
  }, [html, mode]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => paintHighlights(), [paintHighlights]);

  // Restore scroll position after the chapter renders
  useEffect(() => {
    if (!restore || !scroller.current || mode !== 'book' || !html) return;
    const el = scroller.current;
    requestAnimationFrame(() => {
      el.scrollTop = (restore.pct ?? 0) * (el.scrollHeight - el.clientHeight);
      setRestore(null);
    });
  }, [restore, html, mode]);

  /* ---------------- Save position (debounced) ---------------- */
  useEffect(() => {
    if (!book) return;
    const tm = setTimeout(() => {
      const percent = mode === 'pdf' ? (page.total ? (page.n / page.total) * 100 : 0) : toc.length ? ((chapter + scrollPct) / toc.length) * 100 : 0;
      savePosition(book.id, canRead ? userId : null, { chapter, pct: scrollPct, page: page.n, mode }, percent);
    }, 1200);
    return () => clearTimeout(tm);
  }, [chapter, scrollPct, page.n, mode, book, userId, canRead, toc.length, page.total]);

  /* ---------------- Scroll tracking, auto-hide chrome ---------------- */
  const lastY = useRef(0);
  function onScroll() {
    const el = scroller.current!;
    const pct = el.scrollHeight > el.clientHeight ? el.scrollTop / (el.scrollHeight - el.clientHeight) : 0;
    if (mode === 'book') setScrollPct(Math.min(1, Math.max(0, pct)));
    const y = el.scrollTop;
    if (Math.abs(y - lastY.current) > 30) {
      setChromeHidden(y > lastY.current && y > 120);
      lastY.current = y;
    }
    setSel(null);
  }

  const go = useCallback(
    (n: number) => {
      if (n < 0 || n >= toc.length) return;
      stopSpeak();
      setChapter(n);
      setScrollPct(0);
      setRestore({ pct: 0 });
      setPanel(null);
    },
    [toc.length], // eslint-disable-line react-hooks/exhaustive-deps
  );

  /* ---------------- Keyboard + swipe navigation ---------------- */
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).closest('input,textarea')) return;
      if (e.key === 'ArrowRight') mode === 'book' ? go(chapter + 1) : pdf.current?.goTo(page.n + 1);
      if (e.key === 'ArrowLeft') mode === 'book' ? go(chapter - 1) : pdf.current?.goTo(page.n - 1);
      if (e.key === 'Escape') { setPanel(null); setShowType(false); setSel(null); }
    };
    addEventListener('keydown', k);
    return () => removeEventListener('keydown', k);
  }, [mode, chapter, page.n, go]);

  const touch = useRef<{ x: number; y: number } | null>(null);

  /* ---------------- Selection → highlight toolbar ---------------- */
  function onPointerUp() {
    setTimeout(() => {
      const s = window.getSelection();
      if (!s || s.isCollapsed || !content.current || mode !== 'book') return;
      const range = s.getRangeAt(0);
      const off = rangeToOffsets(content.current, range);
      if (!off) return;
      const rect = range.getBoundingClientRect();
      setActive(null);
      setSel({ x: rect.left + rect.width / 2, y: rect.top, ...off, quote: s.toString().slice(0, 1000) });
    }, 10);
  }

  async function highlight(color: HlColor, withNote = false) {
    if (!sel || !book || !loaded) return;
    const a = await addAnnotation(book.id, userId, { kind: 'highlight', location: { chapter: loaded.id, start: sel.start, end: sel.end }, quote: sel.quote, note: null, color });
    setNotes((x) => [...x, a]);
    window.getSelection()?.removeAllRanges();
    setSel(null);
    if (withNote) setActive(a);
  }

  function onContentClick(e: React.MouseEvent) {
    const m = (e.target as HTMLElement).closest('mark[data-hl]');
    if (!m) return;
    const a = notes.find((n) => n.id === m.getAttribute('data-hl'));
    if (a) setActive(a);
  }

  async function toggleBookmark() {
    if (!book) return;
    const existing = notes.find((n) => n.kind === 'bookmark' && (mode === 'pdf' ? n.location.page === page.n : n.location.chapter === current?.id && Math.abs((n.location.pct ?? 0) - scrollPct) < 0.03));
    if (existing) {
      await removeAnnotation(book.id, userId, existing.id);
      return setNotes((x) => x.filter((n) => n.id !== existing.id));
    }
    const label = mode === 'pdf' ? `Page ${page.n}` : `${current?.title ?? ''} · ${Math.round(scrollPct * 100)}%`;
    const a = await addAnnotation(book.id, userId, { kind: 'bookmark', location: mode === 'pdf' ? { page: page.n } : { chapter: current?.id, pct: scrollPct }, quote: label, note: null, color: null });
    setNotes((x) => [...x, a]);
  }
  const isBookmarked = notes.some((n) => n.kind === 'bookmark' && (mode === 'pdf' ? n.location.page === page.n : n.location.chapter === current?.id && Math.abs((n.location.pct ?? 0) - scrollPct) < 0.03));

  function openAnnotation(n: Annotation) {
    if (n.location.page) {
      setMode('pdf');
      setTimeout(() => pdf.current?.goTo(n.location.page!), 100);
    } else {
      const idx = toc.findIndex((c) => c.id === n.location.chapter);
      if (idx < 0) return;
      setMode('book');
      if (idx !== chapter) setChapter(idx);
      setRestore({ pct: n.location.pct ?? 0 });
      if (n.kind === 'highlight') setTimeout(() => content.current?.querySelector(`mark[data-hl="${n.id}"]`)?.scrollIntoView({ block: 'center' }), 250);
    }
    setPanel(null);
  }

  /* ---------------- Search ---------------- */
  async function runSearch(q: string) {
    setQuery(q);
    if (q.trim().length < 2) return setResults([]);
    if (mode === 'pdf') return setResults((await pdf.current?.search(q)) ?? []);
    const term = q.toLowerCase();
    const out: { chapter: number; snippet: string }[] = [];
    chapters.forEach((c) => {
      const text = c.content.replace(/[#*_`>[\]()!-]/g, ' ').replace(/\s+/g, ' ');
      let at = text.toLowerCase().indexOf(term);
      let hits = 0;
      while (at >= 0 && hits < 5) {
        out.push({ chapter: toc.findIndex((x) => x.id === c.id), snippet: `…${text.slice(Math.max(0, at - 40), at + term.length + 50)}…` });
        at = text.toLowerCase().indexOf(term, at + term.length);
        hits++;
      }
    });
    setResults(out);
  }
  function openResult(r: { chapter?: number; page?: number }) {
    if (r.page) return pdf.current?.goTo(r.page);
    if (r.chapter === undefined) return;
    if (r.chapter !== chapter) go(r.chapter);
    setTimeout(() => {
      const root = content.current;
      if (!root) return;
      unwrapAll(root, 'mark[data-find]');
      const at = (root.textContent ?? '').toLowerCase().indexOf(query.toLowerCase());
      if (at < 0) return;
      wrapOffsets(root, at, at + query.length, { 'data-find': '1' }, 'background: rgba(250,204,21,.7); color: inherit; border-radius: 2px');
      root.querySelector('mark[data-find]')?.scrollIntoView({ block: 'center', behavior: 'smooth' });
      setTimeout(() => unwrapAll(root, 'mark[data-find]'), 4000);
    }, 200);
    setPanel(null);
  }

  /* ---------------- Text-to-speech ---------------- */
  const speakQueue = useRef<HTMLElement[]>([]);
  function speakFrom(i: number) {
    const el = speakQueue.current[i];
    content.current?.querySelectorAll('.tts-now').forEach((x) => x.classList.remove('tts-now'));
    if (!el) return setSpeaking('off');
    el.classList.add('tts-now');
    el.scrollIntoView({ block: 'center', behavior: 'smooth' });
    const u = new SpeechSynthesisUtterance(el.innerText);
    const bn = /[ঀ-৿]/.test(el.innerText);
    const voice = speechSynthesis.getVoices().find((v) => (bn ? v.lang.startsWith('bn') : v.lang.startsWith('en')));
    if (voice) u.voice = voice;
    u.lang = voice?.lang ?? (bn ? 'bn-BD' : 'en-US');
    u.rate = prefs.rate;
    // stopSpeak() empties the queue, so a cancelled utterance does not continue.
    u.onend = () => {
      if (speakQueue.current.length) speakFrom(i + 1);
    };
    speechSynthesis.speak(u);
  }
  function startSpeak() {
    if (!('speechSynthesis' in window) || !content.current) return alert('Text-to-speech is not supported in this browser.');
    speechSynthesis.cancel();
    const blocks = [...content.current.querySelectorAll<HTMLElement>('p, li, h1, h2, h3, h4, blockquote')];
    const top = scroller.current!.getBoundingClientRect().top;
    const first = Math.max(0, blocks.findIndex((b) => b.getBoundingClientRect().bottom > top + 80));
    speakQueue.current = blocks;
    setSpeaking('on');
    speakFrom(first);
  }
  function stopSpeak() {
    speakQueue.current = [];
    if ('speechSynthesis' in window) speechSynthesis.cancel();
    content.current?.querySelectorAll('.tts-now').forEach((x) => x.classList.remove('tts-now'));
    setSpeaking('off');
  }
  useEffect(() => () => stopSpeak(), []); // eslint-disable-line react-hooks/exhaustive-deps

  /* ---------------- Render ---------------- */
  if (error) return <Center t={t}><p className="text-lg font-semibold">{error}</p><a href="/ebooks" className="btn-primary mt-6">Browse e-books</a></Center>;
  if (!book) return <Center t={t}><p className="opacity-70">Opening book…</p></Center>;

  const progress = mode === 'pdf' ? (page.total ? page.n / page.total : 0) : toc.length ? (chapter + scrollPct) / toc.length : 0;
  const noContent = mode === 'book' ? toc.length === 0 : !book.pdf_path;
  const paywall = (
    <div className="mx-auto my-16 max-w-md rounded-2xl border p-8 text-center" style={{ borderColor: t.line, background: t.panel }}>
      <span className="mx-auto grid h-12 w-12 place-items-center rounded-full" style={{ background: 'color-mix(in srgb, var(--r-accent) 15%, transparent)', color: 'var(--r-accent)' }}><I d={ICON.lock} /></span>
      <h2 className="mt-4 text-xl font-bold">Continue reading</h2>
      <p className="mt-2 text-sm" style={{ color: t.muted }}>
        {book.access_mode === 'paid' ? 'This part is available after purchase. Your highlights and place are kept.' : book.access_mode === 'whatsapp' ? 'Join the WhatsApp group to get the full book.' : 'Sign in to keep reading.'}
      </p>
      <a href={`/ebooks/${book.slug}`} className="btn-primary mt-6">{book.access_mode === 'paid' ? 'Get the full book' : 'See how to get it'}</a>
      {!session && <a href="/account" className="mt-3 block text-sm" style={{ color: t.muted }}>Already own it? Sign in</a>}
    </div>
  );

  return (
    <div
      className="reader fixed inset-0 flex flex-col"
      style={{ background: t.bg, color: t.fg, ['--r-line' as string]: t.line, ['--r-muted' as string]: t.muted, ['--r-panel' as string]: t.panel, ['--r-accent' as string]: accent, ['--r-on-accent' as string]: onAccent }}
      onCopy={(e) => protect && (e.preventDefault(), alert('Copying is disabled for this e-book.'))}
      onContextMenu={(e) => protect && e.preventDefault()}
    >
      {/* Top bar */}
      <header className={`z-20 flex items-center gap-1 border-b px-2 py-2 transition-transform duration-300 sm:px-3 ${chromeHidden ? '-translate-y-full' : ''}`} style={{ borderColor: t.line, background: t.bg }}>
        <a href={`/ebooks/${book.slug}`} className="r-btn" aria-label="Back to book page"><I d={ICON.back} /></a>
        <button type="button" className="r-btn" onClick={() => setPanel(panel === 'toc' ? null : 'toc')} aria-label="Contents"><I d={ICON.toc} /></button>
        <div className="min-w-0 flex-1 px-2">
          <p className="truncate text-sm font-semibold">{book.title}</p>
          <p className="truncate text-xs" style={{ color: t.muted }}>{mode === 'pdf' ? `Page ${page.n} of ${page.total || '…'}` : current?.title}</p>
        </div>
        {book.format === 'both' && toc.length > 0 && book.pdf_path && canRead && (
          <div className="mr-1 hidden rounded-lg border p-0.5 text-xs sm:flex" style={{ borderColor: t.line }}>
            {(['book', 'pdf'] as const).map((m) => (
              <button key={m} type="button" onClick={() => { stopSpeak(); setMode(m); }} className="rounded-md px-2.5 py-1 font-semibold capitalize" style={mode === m ? { background: 'var(--r-accent)', color: 'var(--r-on-accent)' } : { color: t.muted }}>{m === 'book' ? 'Book' : 'PDF'}</button>
            ))}
          </div>
        )}
        <button type="button" className="r-btn" onClick={() => setPanel(panel === 'search' ? null : 'search')} aria-label="Search in book"><I d={ICON.search} /></button>
        {mode === 'book' && <button type="button" className={`r-btn ${speaking !== 'off' ? 'text-[var(--r-accent)]' : ''}`} onClick={() => (speaking === 'off' ? startSpeak() : stopSpeak())} aria-label="Read aloud"><I d={ICON.speak} /></button>}
        <button type="button" className={`r-btn ${isBookmarked ? 'text-[var(--r-accent)]' : ''}`} onClick={toggleBookmark} aria-label="Bookmark this place"><I d={ICON.bookmark} /></button>
        <button type="button" className="r-btn" onClick={() => setPanel(panel === 'notes' ? null : 'notes')} aria-label="Highlights and notes"><I d={ICON.notes} /></button>
        <button type="button" className="r-btn" onClick={() => setShowType(!showType)} aria-label="Display settings"><I d={ICON.type} /></button>
        <span className="hidden sm:block"><button type="button" className="r-btn" onClick={() => (document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen?.())} aria-label="Fullscreen"><I d={ICON.full} /></button></span>
      </header>

      {/* Progress bar */}
      <div className="h-0.5 w-full" style={{ background: t.line }}><div className="h-full bg-[var(--r-accent)] transition-all" style={{ width: `${progress * 100}%` }} /></div>

      {/* Display settings */}
      {showType && (
        <div className="absolute top-14 right-2 z-30 w-72 rounded-2xl border p-4 shadow-2xl" style={{ background: t.panel, borderColor: t.line }}>
          <p className="r-label">Theme</p>
          <div className="grid grid-cols-4 gap-2">
            {(Object.keys(themes) as (keyof typeof themes)[]).map((k) => (
              <button key={k} type="button" onClick={() => setPrefs((p) => ({ ...p, theme: k }))} className="rounded-lg border py-2 text-xs font-semibold" style={{ background: themes[k].bg, color: themes[k].fg, borderColor: prefs.theme === k ? 'var(--r-accent)' : themes[k].line, borderWidth: prefs.theme === k ? 2 : 1 }}>{themes[k].label}</button>
            ))}
          </div>
          {mode === 'book' ? (
            <>
              <p className="r-label mt-4">Text size · {prefs.size}px</p>
              <div className="flex items-center gap-2">
                <button type="button" className="r-chip" onClick={() => setPrefs((p) => ({ ...p, size: Math.max(14, prefs.size - 1) }))}>A−</button>
                <input type="range" min={14} max={30} value={prefs.size} onChange={(e) => setPrefs((p) => ({ ...p, size: Number(e.target.value) }))} className="flex-1 accent-[var(--r-accent)]" aria-label="Text size" />
                <button type="button" className="r-chip" onClick={() => setPrefs((p) => ({ ...p, size: Math.min(30, prefs.size + 1) }))}>A+</button>
              </div>
              <p className="r-label mt-4">Line spacing</p>
              <div className="grid grid-cols-3 gap-2">{[1.5, 1.8, 2.1].map((l) => <button key={l} type="button" className="r-chip" data-on={prefs.leading === l} onClick={() => setPrefs((p) => ({ ...p, leading: l }))}>{l === 1.5 ? 'Tight' : l === 1.8 ? 'Normal' : 'Loose'}</button>)}</div>
              <p className="r-label mt-4">Font</p>
              <div className="grid grid-cols-3 gap-2">{(['serif', 'sans', 'bangla'] as const).map((f) => <button key={f} type="button" className="r-chip" data-on={prefs.font === f} style={{ fontFamily: fonts[f] }} onClick={() => setPrefs((p) => ({ ...p, font: f }))}>{f === 'bangla' ? 'বাংলা' : f === 'serif' ? 'Serif' : 'Sans'}</button>)}</div>
              <p className="r-label mt-4">Page width</p>
              <div className="grid grid-cols-3 gap-2">{(['narrow', 'normal', 'wide'] as const).map((w) => <button key={w} type="button" className="r-chip capitalize" data-on={prefs.width === w} onClick={() => setPrefs((p) => ({ ...p, width: w }))}>{w}</button>)}</div>
              <label className="mt-4 flex items-center justify-between text-sm"><span>Justify text</span><input type="checkbox" checked={prefs.justify} onChange={(e) => setPrefs((p) => ({ ...p, justify: e.target.checked }))} className="accent-[var(--r-accent)]" /></label>
              <p className="r-label mt-4">Read-aloud speed · {prefs.rate}×</p>
              <input type="range" min={0.6} max={1.8} step={0.1} value={prefs.rate} onChange={(e) => setPrefs((p) => ({ ...p, rate: Number(e.target.value) }))} className="w-full accent-[var(--r-accent)]" aria-label="Speech rate" />
            </>
          ) : (
            <>
              <p className="r-label mt-4">Zoom · {Math.round(zoom * 100)}%</p>
              <div className="flex gap-2">
                <button type="button" className="r-chip flex-1" onClick={() => setZoom(Math.max(0.6, +(zoom - 0.15).toFixed(2)))}>−</button>
                <button type="button" className="r-chip flex-1" onClick={() => setZoom(1)}>Fit</button>
                <button type="button" className="r-chip flex-1" onClick={() => setZoom(Math.min(2.5, +(zoom + 0.15).toFixed(2)))}>+</button>
              </div>
            </>
          )}
        </div>
      )}

      <div className="relative flex min-h-0 flex-1">
        {/* Side panel */}
        {panel && (
          <aside className="absolute inset-y-0 left-0 z-20 flex w-[min(22rem,90vw)] flex-col border-r shadow-2xl" style={{ background: t.panel, borderColor: t.line }}>
            <div className="flex items-center justify-between border-b px-4 py-3" style={{ borderColor: t.line }}>
              <p className="font-semibold">{panel === 'toc' ? 'Contents' : panel === 'notes' ? 'Highlights & bookmarks' : 'Search'}</p>
              <button type="button" className="r-btn" onClick={() => setPanel(null)} aria-label="Close"><I d={ICON.close} s={16} /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-2">
              {panel === 'toc' && (
                <ol>
                  {toc.length === 0 && <p className="p-3 text-sm" style={{ color: t.muted }}>This book is PDF only. Use search or the page counter.</p>}
                  {toc.map((c, i) => {
                    const available = chapters.some((x) => x.id === c.id);
                    return (
                      <li key={c.id}>
                        <button type="button" onClick={() => { setMode('book'); go(i); }} className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm" style={i === chapter && mode === 'book' ? { background: 'color-mix(in srgb, var(--r-accent) 14%, transparent)', color: 'var(--r-accent)' } : undefined}>
                          <span className="w-6 font-mono text-xs opacity-60">{i + 1}</span>
                          <span className="flex-1">{c.title}</span>
                          {!available && <span className="opacity-50"><I d={ICON.lock} s={14} /></span>}
                        </button>
                      </li>
                    );
                  })}
                </ol>
              )}
              {panel === 'notes' && (
                <div className="grid gap-2">
                  {!userId && <p className="rounded-lg p-3 text-xs" style={{ background: t.bg, color: t.muted }}>Saved in this browser. <a href="/account" className="text-[var(--r-accent)] underline">Sign in</a> to sync across devices.</p>}
                  {notes.length === 0 && <p className="p-3 text-sm" style={{ color: t.muted }}>Select text to highlight it, or tap the bookmark icon to save your place.</p>}
                  {notes.slice().reverse().map((n) => (
                    <div key={n.id} className="rounded-xl border p-3" style={{ borderColor: t.line, background: t.bg }}>
                      <button type="button" onClick={() => openAnnotation(n)} className="block w-full text-left">
                        <p className="text-[11px] uppercase opacity-60">{n.kind === 'bookmark' ? '🔖 Bookmark' : `Highlight · ${toc.find((c) => c.id === n.location.chapter)?.title ?? ''}`}</p>
                        <p className="mt-1 line-clamp-3 text-sm" style={n.kind === 'highlight' ? { borderLeft: `3px solid ${HL_COLORS[(n.color as HlColor) ?? 'yellow']}`, paddingLeft: 8 } : undefined}>{n.quote}</p>
                        {n.note && <p className="mt-1.5 text-xs italic" style={{ color: t.muted }}>📝 {n.note}</p>}
                      </button>
                      <button type="button" onClick={async () => { await removeAnnotation(book.id, userId, n.id); setNotes((x) => x.filter((y) => y.id !== n.id)); }} className="mt-2 text-xs opacity-60 hover:opacity-100">Delete</button>
                    </div>
                  ))}
                </div>
              )}
              {panel === 'search' && (
                <div>
                  <input autoFocus value={query} onChange={(e) => runSearch(e.target.value)} placeholder="Search this book…" className="w-full rounded-lg border px-3 py-2 text-sm outline-none" style={{ background: t.bg, borderColor: t.line, color: t.fg }} />
                  <p className="px-1 py-2 text-xs" style={{ color: t.muted }}>{query.length >= 2 ? `${results.length} result${results.length === 1 ? '' : 's'}` : 'Type at least 2 letters'}</p>
                  <ul className="grid gap-1">
                    {results.map((r, i) => (
                      <li key={i}>
                        <button type="button" onClick={() => openResult(r)} className="w-full rounded-lg px-3 py-2 text-left text-sm hover:opacity-80" style={{ background: t.bg }}>
                          <span className="text-[11px] opacity-60">{r.page ? `Page ${r.page}` : toc[r.chapter!]?.title}</span>
                          <span className="mt-0.5 line-clamp-2 block">{r.snippet}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </aside>
        )}

        {/* Reading area */}
        <main
          ref={scroller}
          onScroll={onScroll}
          onTouchStart={(e) => (touch.current = { x: e.touches[0].clientX, y: e.touches[0].clientY })}
          onTouchEnd={(e) => {
            if (!touch.current || mode !== 'book') return;
            const dx = e.changedTouches[0].clientX - touch.current.x;
            const dy = e.changedTouches[0].clientY - touch.current.y;
            if (Math.abs(dx) > 90 && Math.abs(dy) < 50 && !window.getSelection()?.toString()) go(chapter + (dx < 0 ? 1 : -1));
            touch.current = null;
          }}
          className="relative min-w-0 flex-1 overflow-y-auto"
          onClick={() => { setShowType(false); }}
        >
          {noContent ? (
            <Center t={t} inline><p>This e-book has no content yet.</p></Center>
          ) : mode === 'pdf' ? (
            canRead && pdfUrl ? (
              <PdfView ref={pdf} url={pdfUrl} theme={prefs.theme} zoom={zoom} startPage={restore?.page ?? 1} onPage={(n, total) => setPage({ n, total })} onError={setError} />
            ) : canRead ? (
              <Center t={t} inline><p className="opacity-70">Preparing PDF…</p></Center>
            ) : (
              paywall
            )
          ) : (
            <article className="mx-auto px-5 pt-10 pb-24 sm:px-8" style={{ maxWidth: widths[prefs.width] }}>
              <p className="font-mono text-xs tracking-widest uppercase" style={{ color: t.muted }}>Chapter {chapter + 1}</p>
              <h1 className="mt-2 mb-8 text-3xl leading-tight font-bold" style={{ fontFamily: fonts[prefs.font] }}>{current?.title}</h1>
              {locked ? (
                <div key="paywall">{paywall}</div>
              ) : (
                // Keyed so React never reuses this node (its HTML is set manually) for the paywall.
                <div
                  key={`content-${loaded?.id}`}
                  ref={content}
                  onMouseUp={onPointerUp}
                  onTouchEnd={onPointerUp}
                  onClick={onContentClick}
                  className={`reader-content ${protect ? 'select-text' : ''}`}
                  style={{ fontSize: prefs.size, lineHeight: prefs.leading, fontFamily: fonts[prefs.font], textAlign: prefs.justify ? 'justify' : 'left' }}
                />
              )}
              <nav className="mt-16 flex items-center justify-between gap-4 border-t pt-6 text-sm" style={{ borderColor: t.line }}>
                <button type="button" disabled={chapter === 0} onClick={() => go(chapter - 1)} className="r-chip px-4 py-2 disabled:opacity-30">← {toc[chapter - 1]?.title ?? 'Previous'}</button>
                <span style={{ color: t.muted }}>{chapter + 1} / {toc.length}</span>
                <button type="button" disabled={chapter >= toc.length - 1} onClick={() => go(chapter + 1)} className="r-chip px-4 py-2 disabled:opacity-30">{toc[chapter + 1]?.title ?? 'Next'} →</button>
              </nav>
            </article>
          )}

          {protect && session?.user.email && (
            <div className="pointer-events-none fixed inset-0 z-10 overflow-hidden opacity-[0.05] select-none" aria-hidden="true">
              <div className="grid -rotate-[24deg] grid-cols-3 gap-x-16 gap-y-24 p-10 text-sm font-semibold" style={{ width: '160%', marginLeft: '-30%' }}>
                {Array.from({ length: 45 }, (_, i) => <span key={i}>{session.user.email}</span>)}
              </div>
            </div>
          )}
        </main>
      </div>

      {/* Bottom status (PDF) */}
      {mode === 'pdf' && page.total > 0 && (
        <footer className="flex items-center justify-center gap-3 border-t py-2 text-sm" style={{ borderColor: t.line }}>
          <button type="button" className="r-chip" onClick={() => pdf.current?.goTo(page.n - 1)}>‹</button>
          <input
            type="number"
            min={1}
            max={page.total}
            defaultValue={page.n}
            key={page.n}
            onKeyDown={(e) => e.key === 'Enter' && pdf.current?.goTo(Number((e.target as HTMLInputElement).value))}
            className="w-16 rounded-md border bg-transparent px-2 py-1 text-center"
            style={{ borderColor: t.line }}
            aria-label="Go to page"
          />
          <span style={{ color: t.muted }}>of {page.total}</span>
          <button type="button" className="r-chip" onClick={() => pdf.current?.goTo(page.n + 1)}>›</button>
        </footer>
      )}

      {/* Read-aloud bar */}
      {speaking !== 'off' && (
        <div className="fixed bottom-4 left-1/2 z-30 flex -translate-x-1/2 items-center gap-2 rounded-full border px-4 py-2 shadow-2xl" style={{ background: t.panel, borderColor: t.line }}>
          <span className="h-2 w-2 animate-pulse rounded-full bg-[var(--r-accent)]" />
          <span className="text-sm">Reading aloud</span>
          <button type="button" className="r-chip" onClick={() => { if (speaking === 'on') { speechSynthesis.pause(); setSpeaking('paused'); } else { speechSynthesis.resume(); setSpeaking('on'); } }}>{speaking === 'on' ? 'Pause' : 'Resume'}</button>
          <button type="button" className="r-chip" onClick={stopSpeak}>Stop</button>
        </div>
      )}

      {/* Selection toolbar */}
      {sel && (
        <div className="fixed z-40 flex -translate-x-1/2 -translate-y-full items-center gap-1 rounded-xl border p-1.5 shadow-2xl" style={{ left: Math.min(Math.max(sel.x, 140), innerWidth - 140), top: Math.max(sel.y - 8, 60), background: t.panel, borderColor: t.line }} onMouseDown={(e) => e.preventDefault()}>
          {(Object.keys(HL_COLORS) as HlColor[]).map((c) => (
            <button key={c} type="button" onClick={() => highlight(c)} className="h-7 w-7 rounded-full border-2 border-white/30" style={{ background: HL_COLORS[c] }} aria-label={`Highlight ${c}`} />
          ))}
          <button type="button" onClick={() => highlight('yellow', true)} className="r-chip ml-1">Note</button>
          {!protect && <button type="button" onClick={() => { navigator.clipboard.writeText(sel.quote); setSel(null); }} className="r-chip">Copy</button>}
          {'speechSynthesis' in window && (
            <button type="button" onClick={() => { const u = new SpeechSynthesisUtterance(sel.quote); u.rate = prefs.rate; speechSynthesis.cancel(); speechSynthesis.speak(u); }} className="r-chip">🔊</button>
          )}
        </div>
      )}

      {/* Highlight / note editor */}
      {active && (
        <div className="fixed inset-x-0 bottom-0 z-40 mx-auto max-w-lg rounded-t-2xl border p-4 shadow-2xl sm:bottom-6 sm:rounded-2xl" style={{ background: t.panel, borderColor: t.line }}>
          <p className="line-clamp-3 text-sm" style={{ borderLeft: `3px solid ${HL_COLORS[(active.color as HlColor) ?? 'yellow']}`, paddingLeft: 8 }}>{active.quote}</p>
          <textarea
            defaultValue={active.note ?? ''}
            key={active.id}
            rows={3}
            autoFocus
            placeholder="Add a note…"
            className="mt-3 w-full rounded-lg border p-2 text-sm outline-none"
            style={{ background: t.bg, borderColor: t.line, color: t.fg }}
            onBlur={async (e) => {
              const note = e.target.value.trim() || null;
              if (note === active.note) return;
              await updateAnnotation(book.id, userId, active.id, { note });
              setNotes((x) => x.map((n) => (n.id === active.id ? { ...n, note } : n)));
            }}
          />
          <div className="mt-2 flex items-center gap-2">
            {(Object.keys(HL_COLORS) as HlColor[]).map((c) => (
              <button key={c} type="button" onClick={async () => { await updateAnnotation(book.id, userId, active.id, { color: c }); setNotes((x) => x.map((n) => (n.id === active.id ? { ...n, color: c } : n))); setActive({ ...active, color: c }); }} className="h-6 w-6 rounded-full" style={{ background: HL_COLORS[c], outline: active.color === c ? '2px solid var(--r-accent)' : undefined }} aria-label={c} />
            ))}
            <button type="button" className="r-chip ml-auto" onClick={async () => { await removeAnnotation(book.id, userId, active.id); setNotes((x) => x.filter((n) => n.id !== active.id)); setActive(null); }}>Remove</button>
            <button type="button" className="r-chip" style={{ background: 'var(--r-accent)', color: 'var(--r-on-accent)' }} onClick={() => setActive(null)}>Done</button>
          </div>
        </div>
      )}
    </div>
  );
}

function Center({ children, t, inline = false }: { children: React.ReactNode; t: (typeof themes)[keyof typeof themes]; inline?: boolean }) {
  return (
    <div className={`${inline ? 'h-full' : 'fixed inset-0'} grid place-items-center p-6 text-center`} style={{ background: t.bg, color: t.fg }}>
      <div className="flex flex-col items-center">{children}</div>
    </div>
  );
}
