import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { fmtDuration, type Lesson } from '@/lib/tutorials';
import { readCourse, readNote, writeCourse, writeNote } from '@/lib/progress';
import { Download } from 'lucide-react';

type YTPlayer = { loadVideoById: (id: string) => void; cueVideoById: (id: string) => void; destroy: () => void };
type YTNamespace = { Player: new (el: HTMLElement, opts: unknown) => YTPlayer; PlayerState: { ENDED: number } };
declare global {
  interface Window {
    YT?: YTNamespace;
    onYouTubeIframeAPIReady?: () => void;
  }
}

let apiPromise: Promise<YTNamespace> | null = null;
function loadYT(): Promise<YTNamespace> {
  if (window.YT?.Player) return Promise.resolve(window.YT);
  apiPromise ??= new Promise((resolve) => {
    const prev = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      prev?.();
      resolve(window.YT!);
    };
    const s = document.createElement('script');
    s.src = 'https://www.youtube.com/iframe_api';
    document.head.appendChild(s);
  });
  return apiPromise;
}

export default function CoursePlayer({ slug, lessons }: { slug: string; lessons: Lesson[] }) {
  const [current, setCurrent] = useState(0);
  const [done, setDone] = useState<string[]>([]);
  const [autoplay, setAutoplay] = useState(true);
  const [tab, setTab] = useState<'about' | 'resources' | 'notes'>('about');
  const [note, setNote] = useState('');
  const [noteSaved, setNoteSaved] = useState(true);
  const mount = useRef<HTMLDivElement>(null);
  const player = useRef<YTPlayer | null>(null);
  const state = useRef({ current, autoplay, done });
  state.current = { current, autoplay, done };

  const lesson = lessons[current];
  const pct = lessons.length ? Math.round((done.filter((d) => lessons.some((l) => l.youtube_id === d)).length / lessons.length) * 100) : 0;

  // Initial state: ?v=… deep link, else resume last lesson
  useEffect(() => {
    const p = readCourse(slug);
    setDone(p.done);
    try { setAutoplay(localStorage.getItem('tut:autoplay') !== '0'); } catch {}
    const v = new URLSearchParams(location.search).get('v') ?? p.last;
    const i = lessons.findIndex((l) => l.youtube_id === v);
    if (i >= 0) setCurrent(i);
  }, [slug, lessons]);

  const persist = useCallback((d: string[], last: string) => writeCourse(slug, { done: d, last, updated: Date.now() }), [slug]);

  const markDone = useCallback(
    (id: string, value = true) => {
      setDone((prev) => {
        const next = value ? [...new Set([...prev, id])] : prev.filter((x) => x !== id);
        persist(next, lessons[state.current.current]?.youtube_id ?? id);
        return next;
      });
    },
    [lessons, persist],
  );

  // Create the YouTube player once
  useEffect(() => {
    let cancelled = false;
    loadYT().then((YT) => {
      if (cancelled || !mount.current) return;
      const el = document.createElement('div');
      mount.current.appendChild(el);
      player.current = new YT.Player(el, {
        videoId: lessons[state.current.current]?.youtube_id,
        host: 'https://www.youtube-nocookie.com',
        playerVars: { rel: 0, modestbranding: 1, playsinline: 1 },
        events: {
          onStateChange: (e: { data: number }) => {
            if (e.data !== YT.PlayerState.ENDED) return;
            const { current: c, autoplay: auto } = state.current;
            markDone(lessons[c].youtube_id);
            if (auto && c < lessons.length - 1) setCurrent(c + 1);
          },
        },
      });
    });
    return () => {
      cancelled = true;
      player.current?.destroy();
      player.current = null;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Switch video + URL + notes when the lesson changes
  const first = useRef(true);
  useEffect(() => {
    if (!lesson) return;
    if (!first.current) player.current?.loadVideoById(lesson.youtube_id);
    first.current = false;
    const u = new URL(location.href);
    u.searchParams.set('v', lesson.youtube_id);
    history.replaceState(null, '', u);
    persist(state.current.done, lesson.youtube_id);
    setNote(readNote(lesson.youtube_id));
    setNoteSaved(true);
    if (!lesson.resources?.length && tab === 'resources') setTab('about');
    document.querySelector(`[data-lesson="${lesson.youtube_id}"]`)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [current]); // eslint-disable-line react-hooks/exhaustive-deps

  // Keyboard shortcuts: N = next, P = previous
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).closest('input,textarea')) return;
      if (e.key === 'n' || e.key === 'N') setCurrent((c) => Math.min(lessons.length - 1, c + 1));
      if (e.key === 'p' || e.key === 'P') setCurrent((c) => Math.max(0, c - 1));
    };
    addEventListener('keydown', k);
    return () => removeEventListener('keydown', k);
  }, [lessons.length]);

  // Debounced note save
  useEffect(() => {
    if (noteSaved || !lesson) return;
    const t = setTimeout(() => {
      writeNote(lesson.youtube_id, note);
      setNoteSaved(true);
    }, 600);
    return () => clearTimeout(t);
  }, [note, noteSaved, lesson]);

  const remaining = useMemo(() => lessons.filter((l) => !done.includes(l.youtube_id)).reduce((a, l) => a + (l.duration_seconds ?? 0), 0), [lessons, done]);

  if (!lessons.length) return <p className="card p-10 text-center text-muted">Lessons are coming soon.</p>;
  const isDone = done.includes(lesson.youtube_id);

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
      <div className="min-w-0">
        <div className="overflow-hidden rounded-2xl border border-line bg-black">
          <div ref={mount} className="aspect-video w-full [&_iframe]:h-full [&_iframe]:w-full" />
        </div>

        <div className="mt-4 flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="font-mono text-xs text-accent">Lesson {current + 1} of {lessons.length}{lesson.duration_seconds ? ` · ${fmtDuration(lesson.duration_seconds)}` : ''}</p>
            <h2 className="mt-1 text-xl font-bold sm:text-2xl">{lesson.title}</h2>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn-ghost px-3 py-2 text-xs" disabled={current === 0} onClick={() => setCurrent(current - 1)} title="Previous (P)">‹ Prev</button>
            <button type="button" className={isDone ? 'btn-ghost px-3 py-2 text-xs text-accent' : 'btn-ghost px-3 py-2 text-xs'} onClick={() => markDone(lesson.youtube_id, !isDone)}>
              {isDone ? '✓ Completed' : 'Mark complete'}
            </button>
            <button
              type="button"
              className="btn-primary px-3 py-2 text-xs"
              disabled={current === lessons.length - 1}
              onClick={() => {
                markDone(lesson.youtube_id);
                setCurrent(current + 1);
              }}
              title="Next (N)"
            >
              Next ›
            </button>
          </div>
        </div>

        <div className="mt-6 border-b border-line">
          <div className="flex gap-1">
            {(['about', 'resources', 'notes'] as const).map((t) => (
              <button key={t} type="button" onClick={() => setTab(t)} disabled={t === 'resources' && !lesson.resources?.length} className={`-mb-px border-b-2 px-4 py-2 text-sm font-semibold capitalize transition disabled:opacity-40 ${tab === t ? 'border-accent text-accent' : 'border-transparent text-muted hover:text-fg'}`}>
                {t}
                {t === 'resources' && lesson.resources?.length ? ` (${lesson.resources.length})` : ''}
              </button>
            ))}
          </div>
        </div>
        <div className="py-5">
          {tab === 'about' && <p className="text-sm leading-relaxed whitespace-pre-line text-muted">{lesson.description || 'No description for this lesson.'}</p>}
          {tab === 'resources' && (
            <ul className="grid gap-2 sm:grid-cols-2">
              {lesson.resources.map((r) => (
                <li key={r.url}>
                  <a href={r.url} target="_blank" rel="noopener" download className="flex items-center gap-3 rounded-xl border border-line px-4 py-3 text-sm transition hover:border-accent hover:text-accent">
                    <Download size={16} strokeWidth={1.8} aria-hidden="true" />
                    <span className="truncate">{r.name || r.url.split('/').pop()}</span>
                  </a>
                </li>
              ))}
            </ul>
          )}
          {tab === 'notes' && (
            <div>
              <textarea
                value={note}
                onChange={(e) => {
                  setNote(e.target.value);
                  setNoteSaved(false);
                }}
                rows={6}
                placeholder="Write your own notes for this lesson. They're saved privately in this browser."
                className="input resize-y"
              />
              <p className="mt-1 text-right text-xs text-muted">{noteSaved ? 'Saved' : 'Saving…'}</p>
            </div>
          )}
        </div>
      </div>

      <aside className="lg:sticky lg:top-24 lg:self-start">
        <div className="card overflow-hidden">
          <div className="border-b border-line p-4">
            <div className="flex items-center justify-between text-sm">
              <span className="font-semibold">Course progress</span>
              <span className="font-mono text-xs text-accent">{pct}%</span>
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-surface-2"><div className="h-full rounded-full bg-accent transition-all" style={{ width: `${pct}%` }} /></div>
            <div className="mt-3 flex items-center justify-between text-xs text-muted">
              <span>{remaining ? `${fmtDuration(remaining, true)} left` : pct === 100 ? 'All done! 🎉' : ''}</span>
              <label className="inline-flex cursor-pointer items-center gap-2">
                <input
                  type="checkbox"
                  checked={autoplay}
                  onChange={(e) => {
                    setAutoplay(e.target.checked);
                    try { localStorage.setItem('tut:autoplay', e.target.checked ? '1' : '0'); } catch {}
                  }}
                  className="accent-[var(--accent)]"
                />
                Autoplay next
              </label>
            </div>
          </div>
          <ol className="max-h-[60vh] overflow-y-auto">
            {lessons.map((l, i) => {
              const d = done.includes(l.youtube_id);
              return (
                <li key={l.id}>
                  <button type="button" data-lesson={l.youtube_id} onClick={() => setCurrent(i)} className={`flex w-full items-center gap-3 border-b border-line px-4 py-3 text-left transition last:border-0 ${i === current ? 'bg-accent-soft' : 'hover:bg-surface-2'}`}>
                    <span className={`grid h-6 w-6 shrink-0 place-items-center rounded-full border text-[11px] font-bold ${d ? 'border-accent bg-accent text-accent-contrast' : i === current ? 'border-accent text-accent' : 'border-line text-muted'}`}>{d ? '✓' : i + 1}</span>
                    <img src={l.thumbnail_url || `https://i.ytimg.com/vi/${l.youtube_id}/mqdefault.jpg`} alt="" loading="lazy" className="h-10 w-16 shrink-0 rounded object-cover" />
                    <span className="min-w-0 flex-1">
                      <span className={`line-clamp-2 text-sm ${i === current ? 'font-semibold text-accent' : ''}`}>{l.title}</span>
                      <span className="font-mono text-[11px] text-muted">{fmtDuration(l.duration_seconds)}</span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ol>
        </div>
        <p className="mt-2 text-center text-[11px] text-muted">Shortcuts: <kbd className="font-mono">N</kbd> next · <kbd className="font-mono">P</kbd> previous</p>
      </aside>
    </div>
  );
}
