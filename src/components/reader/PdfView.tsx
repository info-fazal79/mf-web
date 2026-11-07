import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import type { Theme } from './util';

export type PdfHandle = { goTo: (page: number) => void; search: (q: string) => Promise<{ page: number; snippet: string }[]> };
type Props = { url: string; theme: Theme; zoom: number; startPage: number; onPage: (page: number, total: number) => void; onError: (msg: string) => void };

const filterFor: Record<Theme, string> = {
  light: 'none',
  sepia: 'sepia(0.35) brightness(0.97)',
  dark: 'invert(0.88) hue-rotate(180deg) brightness(0.95)',
  night: 'invert(1) hue-rotate(180deg) brightness(0.85)',
};

const PdfView = forwardRef<PdfHandle, Props>(function PdfView({ url, theme, zoom, startPage, onPage, onError }, ref) {
  const wrap = useRef<HTMLDivElement>(null);
  const [doc, setDoc] = useState<PDFDocumentProxy | null>(null);
  const [ratio, setRatio] = useState(1.414);
  const rendered = useRef(new Map<number, number>()); // page -> rendered width
  const textCache = useRef(new Map<number, string>());

  // Load the document (pdf.js is loaded only when a PDF is opened)
  useEffect(() => {
    let cancelled = false;
    let task: { destroy: () => Promise<void> } | null = null;
    (async () => {
      try {
        const pdfjs = await import('pdfjs-dist');
        const worker = (await import('pdfjs-dist/build/pdf.worker.min.mjs?url')).default;
        pdfjs.GlobalWorkerOptions.workerSrc = worker;
        const loading = pdfjs.getDocument({ url });
        task = loading;
        const loaded = await loading.promise;
        if (cancelled) return;
        const p1 = await loaded.getPage(1);
        const vp = p1.getViewport({ scale: 1 });
        setRatio(vp.height / vp.width);
        setDoc(loaded);
      } catch (e) {
        onError(`Could not open the PDF: ${(e as Error).message}`);
      }
    })();
    return () => {
      cancelled = true;
      task?.destroy();
    };
  }, [url]); // eslint-disable-line react-hooks/exhaustive-deps

  // Render visible pages; track the current page
  useEffect(() => {
    if (!doc || !wrap.current) return;
    rendered.current.clear();
    const els = [...wrap.current.querySelectorAll<HTMLElement>('[data-page]')];
    const render = async (el: HTMLElement) => {
      const n = Number(el.dataset.page);
      const width = el.clientWidth;
      if (rendered.current.get(n) === width) return;
      rendered.current.set(n, width);
      const page = await doc.getPage(n);
      const base = page.getViewport({ scale: 1 });
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const vp = page.getViewport({ scale: (width / base.width) * dpr });
      const canvas = document.createElement('canvas');
      canvas.width = vp.width;
      canvas.height = vp.height;
      canvas.style.width = '100%';
      canvas.style.height = '100%';
      const ctx = canvas.getContext('2d')!;
      await page.render({ canvasContext: ctx, canvas, viewport: vp } as never).promise;
      el.querySelector('canvas')?.remove();
      el.appendChild(canvas);
    };
    const lazy = new IntersectionObserver((es) => es.forEach((e) => e.isIntersecting && render(e.target as HTMLElement)), { rootMargin: '800px 0px' });
    const current = new IntersectionObserver(
      (es) => es.forEach((e) => e.isIntersecting && onPage(Number((e.target as HTMLElement).dataset.page), doc.numPages)),
      { rootMargin: '-45% 0px -45% 0px' },
    );
    els.forEach((el) => {
      lazy.observe(el);
      current.observe(el);
    });
    return () => {
      lazy.disconnect();
      current.disconnect();
    };
  }, [doc, zoom]); // eslint-disable-line react-hooks/exhaustive-deps

  // Jump to the saved page once loaded
  useEffect(() => {
    if (doc && startPage > 1) setTimeout(() => goTo(startPage), 50);
  }, [doc]); // eslint-disable-line react-hooks/exhaustive-deps

  function goTo(n: number) {
    wrap.current?.querySelector(`[data-page="${Math.max(1, Math.min(doc?.numPages ?? 1, n))}"]`)?.scrollIntoView({ block: 'start' });
  }

  useImperativeHandle(ref, () => ({
    goTo,
    async search(q: string) {
      if (!doc || !q.trim()) return [];
      const term = q.toLowerCase();
      const out: { page: number; snippet: string }[] = [];
      for (let i = 1; i <= doc.numPages && out.length < 100; i++) {
        let text = textCache.current.get(i);
        if (text === undefined) {
          const tc = await (await doc.getPage(i)).getTextContent();
          text = tc.items.map((it) => ('str' in it ? it.str : '')).join(' ');
          textCache.current.set(i, text);
        }
        const at = text.toLowerCase().indexOf(term);
        if (at >= 0) out.push({ page: i, snippet: `…${text.slice(Math.max(0, at - 40), at + term.length + 60)}…` });
      }
      return out;
    },
  }));

  if (!doc) return <p className="py-24 text-center opacity-70">Opening PDF…</p>;
  return (
    <div ref={wrap} className="mx-auto grid gap-4 px-3 py-6" style={{ maxWidth: `${Math.round(820 * zoom)}px` }}>
      {Array.from({ length: doc.numPages }, (_, i) => (
        <div
          key={i}
          data-page={i + 1}
          className="relative w-full overflow-hidden rounded-md bg-white shadow-lg"
          style={{ aspectRatio: `1 / ${ratio}`, filter: filterFor[theme] }}
        >
          <span className="absolute right-2 bottom-2 z-10 rounded bg-black/50 px-1.5 font-mono text-[10px] text-white" style={{ filter: theme === 'dark' || theme === 'night' ? 'invert(1)' : undefined }}>
            {i + 1}
          </span>
        </div>
      ))}
    </div>
  );
});

export default PdfView;
