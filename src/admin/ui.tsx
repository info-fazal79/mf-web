import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { supabase } from '@/lib/supabase';
import { deleteMedia, formatBytes, uploadMedia, type MediaItem } from './media';
import { CropEditor, isCroppable } from './crop';
import { Calendar, Check, ChevronDown, ChevronUp, Copy, Crop, ExternalLink, Eye, FileText, House, Image, Layers, LayoutDashboard, Link, LogOut, Mail, Menu, Plus, Quote, RefreshCw, Send, Settings, Trash2, Upload, User, Users, X, type LucideIcon } from 'lucide-react';

/* ---------------- Icons ---------------- */
const icons: Record<string, LucideIcon> = {
  dashboard: LayoutDashboard,
  settings: Settings,
  home: House,
  user: User,
  image: Image,
  quote: Quote,
  mail: Mail,
  calendar: Calendar,
  users: Users,
  plus: Plus,
  trash: Trash2,
  up: ChevronUp,
  down: ChevronDown,
  close: X,
  upload: Upload,
  copy: Copy,
  logout: LogOut,
  external: ExternalLink,
  menu: Menu,
  check: Check,
  link: Link,
  layers: Layers,
  eye: Eye,
  file: FileText,
  send: Send,
  refresh: RefreshCw,
  crop: Crop,
};

/** Lucide icon by short name (kept so existing <I n="..." /> calls keep working) */
export function I({ n, s = 18, className = '' }: { n: string; s?: number; className?: string }) {
  const C = icons[n] ?? Layers;
  return <C size={s} strokeWidth={1.8} className={className} aria-hidden="true" />;
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
  const [cropping, setCropping] = useState<MediaItem | null>(null);
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
                {isCroppable(m.url, m.mime) && (
                  <button type="button" title="Crop" onClick={() => setCropping(m)} className="grid h-7 w-7 place-items-center rounded-md text-muted hover:bg-surface hover:text-fg">
                    <I n="crop" s={14} />
                  </button>
                )}
                <button type="button" title="Delete" onClick={() => remove(m)} className="grid h-7 w-7 place-items-center rounded-md text-muted hover:bg-surface hover:text-red-500">
                  <I n="trash" s={14} />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
      {cropping && (
        <CropEditor
          open
          src={cropping.url}
          name={cropping.name}
          folder={cropping.folder}
          onClose={() => setCropping(null)}
          onSaved={(m) => setItems((x) => [m, ...x])}
        />
      )}
    </div>
  );
}

export function ImageField({ value, onChange, accept = 'image/*' }: { value: string; onChange: (v: string) => void; accept?: string }) {
  const [open, setOpen] = useState(false);
  const [crop, setCrop] = useState(false);
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
          {value && isCroppable(value) && (
            <button type="button" onClick={() => setCrop(true)} className="btn-ghost px-3 py-1.5 text-xs">
              <I n="crop" s={14} /> Crop
            </button>
          )}
          {value && (
            <button type="button" onClick={() => onChange('')} className="btn-ghost px-3 py-1.5 text-xs">
              Remove
            </button>
          )}
        </div>
      </div>
      {crop && (
        <CropEditor
          open
          src={value}
          name={decodeURIComponent(value.split('?')[0].split('/').pop() ?? 'image').replace(/^[0-9a-f]{8}-/, '')}
          onClose={() => setCrop(false)}
          onSaved={(m) => onChange(m.url)}
        />
      )}
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
