import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { supabase } from '@/lib/supabase';
import { deleteMedia, formatBytes, uploadMedia, type MediaItem } from './media';

/* ---------------- Icons ---------------- */
const paths: Record<string, string> = {
  dashboard: 'M3 3h7v9H3zM14 3h7v5h-7zM14 12h7v9h-7zM3 16h7v5H3z',
  settings: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z',
  home: 'M3 10.5 12 3l9 7.5V21h-6v-6H9v6H3z',
  user: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM4 21a8 8 0 0 1 16 0',
  image: 'M3 5h18v14H3zM3 16l5-5 4 4 3-3 6 6M15.5 9.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Z',
  quote: 'M3 21c3 0 7-1 7-8V5H3v8h4c0 3-1 5-4 5M14 21c3 0 7-1 7-8V5h-7v8h4c0 3-1 5-4 5',
  mail: 'M3 5h18v14H3zM3 7l9 6 9-6',
  calendar: 'M3 4h18v18H3zM16 2v4M8 2v4M3 10h18',
  users: 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM22 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8',
  plus: 'M12 5v14M5 12h14',
  trash: 'M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6',
  up: 'm18 15-6-6-6 6',
  down: 'm6 9 6 6 6-6',
  close: 'M18 6 6 18M6 6l12 12',
  upload: 'M12 15V3M7 8l5-5 5 5M5 21h14',
  copy: 'M9 9h12v12H9zM5 15H3V3h12v2',
  logout: 'M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9',
  external: 'M15 3h6v6M10 14 21 3M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6',
  menu: 'M4 6h16M4 12h16M4 18h16',
  check: 'M20 6 9 17l-5-5',
  link: 'M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7',
  layers: 'm12 2 10 5-10 5L2 7l10-5ZM2 17l10 5 10-5M2 12l10 5 10-5',
  eye: 'M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12ZM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z',
  file: 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6',
  refresh: 'M3 12a9 9 0 0 1 15.5-6.3L21 8M21 3v5h-5M21 12a9 9 0 0 1-15.5 6.3L3 16M3 21v-5h5',
};

export function I({ n, s = 18, className = '' }: { n: string; s?: number; className?: string }) {
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d={paths[n] ?? paths.layers} />
    </svg>
  );
}

/* ---------------- Toasts ---------------- */
type Toast = { id: number; text: string; ok: boolean };
const ToastCtx = createContext<(text: string, ok?: boolean) => void>(() => {});
export const useToast = () => useContext(ToastCtx);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<Toast[]>([]);
  const push = useCallback((text: string, ok = true) => {
    const id = Date.now() + Math.random();
    setItems((x) => [...x, { id, text, ok }]);
    setTimeout(() => setItems((x) => x.filter((t) => t.id !== id)), 3500);
  }, []);
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="fixed right-4 bottom-4 z-[100] grid gap-2" role="status" aria-live="polite">
        {items.map((t) => (
          <div key={t.id} className={`card flex items-center gap-2 px-4 py-3 text-sm font-medium ${t.ok ? 'text-fg' : 'text-red-500'}`}>
            <span className={`h-2 w-2 rounded-full ${t.ok ? 'bg-accent' : 'bg-red-500'}`} />
            {t.text}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

/* ---------------- Basic UI ---------------- */
export function PageTitle({ title, sub, actions }: { title: string; sub?: string; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
        {sub && <p className="mt-1 text-sm text-muted">{sub}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function Panel({ title, children, className = '' }: { title?: string; children: ReactNode; className?: string }) {
  return (
    <section className={`card p-5 sm:p-6 ${className}`}>
      {title && <h2 className="mb-4 text-sm font-bold tracking-wide text-muted uppercase">{title}</h2>}
      {children}
    </section>
  );
}

export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label?: string }) {
  return (
    <label className="inline-flex cursor-pointer items-center gap-3 select-none">
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative h-6 w-11 shrink-0 rounded-full transition ${checked ? 'bg-accent' : 'bg-line'}`}
      >
        <span className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition ${checked ? 'translate-x-5' : ''}`} />
      </button>
      {label && <span className="text-sm">{label}</span>}
    </label>
  );
}

export function Modal({ open, onClose, title, children, wide }: { open: boolean; onClose: () => void; title: string; children: ReactNode; wide?: boolean }) {
  useEffect(() => {
    if (!open) return;
    const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[90] grid place-items-center p-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className={`card relative flex max-h-[90vh] w-full flex-col ${wide ? 'max-w-5xl' : 'max-w-lg'}`}>
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <h2 className="font-bold">{title}</h2>
          <button type="button" onClick={onClose} className="grid h-8 w-8 place-items-center rounded-lg text-muted hover:bg-surface-2" aria-label="Close">
            <I n="close" />
          </button>
        </div>
        <div className="overflow-y-auto p-5">{children}</div>
      </div>
    </div>
  );
}

export function Empty({ text, icon = 'layers' }: { text: string; icon?: string }) {
  return (
    <div className="grid place-items-center gap-3 py-14 text-center text-sm text-muted">
      <span className="grid h-12 w-12 place-items-center rounded-2xl bg-accent-soft text-accent"><I n={icon} s={22} /></span>
      {text}
    </div>
  );
}

/* ---------------- Media picker ---------------- */
export function MediaLibrary({ onPick, accept = 'image/*' }: { onPick?: (m: MediaItem) => void; accept?: string }) {
  const toast = useToast();
  const [items, setItems] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(0);
  const [q, setQ] = useState('');
  const [drag, setDrag] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    if (!supabase) return;
    setLoading(true);
    const { data, error } = await supabase.from('media').select('*').order('created_at', { ascending: false }).limit(500);
    if (error) toast(error.message, false);
    setItems((data as MediaItem[]) ?? []);
    setLoading(false);
  }, [toast]);
  useEffect(() => {
    load();
  }, [load]);

  async function handleFiles(files: FileList | File[]) {
    const list = Array.from(files);
    setUploading((n) => n + list.length);
    for (const f of list) {
      try {
        if (f.size > 50 * 1024 * 1024) throw new Error(`${f.name} is larger than 50 MB`);
        const m = await uploadMedia(f);
        setItems((x) => [m, ...x]);
      } catch (e) {
        toast((e as Error).message, false);
      } finally {
        setUploading((n) => n - 1);
      }
    }
    toast('Upload finished');
  }

  async function remove(m: MediaItem) {
    if (!confirm(`Delete "${m.name}" permanently? Pages using it will show a broken image.`)) return;
    try {
      await deleteMedia(m);
      setItems((x) => x.filter((i) => i.id !== m.id));
      toast('Deleted');
    } catch (e) {
      toast((e as Error).message, false);
    }
  }

  const shown = items.filter((m) => !q || m.name.toLowerCase().includes(q.toLowerCase()));

  return (
    <div>
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDrag(true);
        }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDrag(false);
          if (e.dataTransfer.files.length) handleFiles(e.dataTransfer.files);
        }}
        onClick={() => input.current?.click()}
        className={`grid cursor-pointer place-items-center gap-2 rounded-2xl border-2 border-dashed px-4 py-8 text-center transition ${drag ? 'border-accent bg-accent-soft' : 'border-line hover:border-accent'}`}
      >
        <I n="upload" s={26} className="text-accent" />
        <p className="text-sm font-semibold">{uploading > 0 ? `Uploading ${uploading} file(s)…` : 'Drop files here or click to upload'}</p>
        <p className="text-xs text-muted">Images are resized and converted to WebP automatically · max 50 MB</p>
        <input ref={input} type="file" multiple accept={accept === '*' ? undefined : accept} className="hidden" onChange={(e) => e.target.files && handleFiles(e.target.files)} />
      </div>

      <div className="mt-5 flex items-center gap-3">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search files…" className="input max-w-xs" />
        <span className="text-xs text-muted">{shown.length} files</span>
      </div>

      {loading ? (
        <p className="py-10 text-center text-sm text-muted">Loading…</p>
      ) : shown.length === 0 ? (
        <Empty text="No files yet. Upload your first image above." icon="image" />
      ) : (
        <ul className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {shown.map((m) => (
            <li key={m.id} className="group overflow-hidden rounded-xl border border-line bg-surface-2">
              <button type="button" onClick={() => onPick?.(m)} className={`relative block aspect-square w-full ${onPick ? 'cursor-pointer' : 'cursor-default'}`}>
                {m.mime?.startsWith('image/') ? (
                  <img src={m.url} alt={m.alt ?? ''} loading="lazy" className="h-full w-full object-cover" />
                ) : (
                  <span className="grid h-full place-items-center text-muted"><I n="file" s={32} /></span>
                )}
                {onPick && <span className="absolute inset-0 grid place-items-center bg-accent/80 font-semibold text-accent-contrast opacity-0 transition group-hover:opacity-100">Select</span>}
              </button>
              <div className="flex items-center gap-1 p-2">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-medium" title={m.name}>{m.name}</p>
                  <p className="font-mono text-[10px] text-muted">
                    {formatBytes(m.size)}
                    {m.width ? ` · ${m.width}×${m.height}` : ''}
                  </p>
                </div>
                <button
                  type="button"
                  title="Copy link"
                  onClick={() => {
                    navigator.clipboard.writeText(m.url);
                    toast('Link copied');
                  }}
                  className="grid h-7 w-7 place-items-center rounded-md text-muted hover:bg-surface hover:text-fg"
                >
                  <I n="copy" s={14} />
                </button>
                <button type="button" title="Delete" onClick={() => remove(m)} className="grid h-7 w-7 place-items-center rounded-md text-muted hover:bg-surface hover:text-red-500">
                  <I n="trash" s={14} />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function ImageField({ value, onChange, accept = 'image/*' }: { value: string; onChange: (v: string) => void; accept?: string }) {
  const [open, setOpen] = useState(false);
  const isImage = !value || /\.(png|jpe?g|webp|gif|svg|avif)(\?|$)/i.test(value);
  return (
    <div className="flex items-start gap-3">
      <div className="grid h-20 w-20 shrink-0 place-items-center overflow-hidden rounded-xl border border-line bg-surface-2">
        {value && isImage ? <img src={value} alt="" className="h-full w-full object-cover" /> : <I n={value ? 'file' : 'image'} s={22} className="text-muted" />}
      </div>
      <div className="grid min-w-0 flex-1 gap-2">
        <input value={value} onChange={(e) => onChange(e.target.value)} placeholder="https://… or choose from library" className="input" />
        <div className="flex gap-2">
          <button type="button" onClick={() => setOpen(true)} className="btn-ghost px-3 py-1.5 text-xs">
            <I n="image" s={14} /> Choose / upload
          </button>
          {value && (
            <button type="button" onClick={() => onChange('')} className="btn-ghost px-3 py-1.5 text-xs">
              Remove
            </button>
          )}
        </div>
      </div>
      <Modal open={open} onClose={() => setOpen(false)} title="Media library" wide>
        <MediaLibrary
          accept={accept}
          onPick={(m) => {
            onChange(m.url);
            setOpen(false);
          }}
        />
      </Modal>
    </div>
  );
}

export function TagsField({ value, onChange, placeholder = 'Type and press Enter' }: { value: string[]; onChange: (v: string[]) => void; placeholder?: string }) {
  const [draft, setDraft] = useState('');
  const add = () => {
    const v = draft.trim();
    if (v && !value.includes(v)) onChange([...value, v]);
    setDraft('');
  };
  return (
    <div className="input flex min-h-11 flex-wrap items-center gap-1.5 py-1.5">
      {value.map((t, i) => (
        <span key={t + i} className="inline-flex items-center gap-1 rounded-md bg-accent-soft px-2 py-0.5 text-xs font-medium text-accent">
          {t}
          <button type="button" onClick={() => onChange(value.filter((_, j) => j !== i))} aria-label={`Remove ${t}`} className="opacity-70 hover:opacity-100">
            ×
          </button>
        </span>
      ))}
      <input
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ',') {
            e.preventDefault();
            add();
          } else if (e.key === 'Backspace' && !draft && value.length) onChange(value.slice(0, -1));
        }}
        onBlur={add}
        placeholder={value.length ? '' : placeholder}
        className="min-w-24 flex-1 bg-transparent text-sm outline-none"
      />
    </div>
  );
}
