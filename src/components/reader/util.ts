/** Reader helpers: preferences, text-offset highlights, local fallbacks. */
import { supabase } from '@/lib/supabase';

export type Theme = 'light' | 'sepia' | 'dark' | 'night';
export type Prefs = { size: number; leading: number; font: 'serif' | 'sans' | 'bangla'; theme: Theme; width: 'narrow' | 'normal' | 'wide'; justify: boolean; rate: number };
export const defaultPrefs: Prefs = { size: 19, leading: 1.8, font: 'serif', theme: 'dark', width: 'normal', justify: false, rate: 1 };

export const themes: Record<Theme, { bg: string; fg: string; muted: string; panel: string; line: string; label: string }> = {
  light: { bg: '#ffffff', fg: '#1a1a1a', muted: '#666', panel: '#f6f6f4', line: '#e6e6e2', label: 'Light' },
  sepia: { bg: '#f5ecd9', fg: '#433422', muted: '#7d6a52', panel: '#ede1c8', line: '#dccfb3', label: 'Sepia' },
  dark: { bg: '#0d1b13', fg: '#e3efe7', muted: '#8eab98', panel: '#112218', line: '#1c3326', label: 'Dark' },
  night: { bg: '#000000', fg: '#c9c9c9', muted: '#7a7a7a', panel: '#0b0b0b', line: '#1f1f1f', label: 'Night' },
};
/** Site palette (Admin → Settings → Theme) so the reader matches the rest of the site. */
const palette = typeof document !== 'undefined' ? document.documentElement.dataset.palette : undefined;
export const isMono = palette === 'mono';
if (isMono) themes.dark = { bg: '#0c0c0c', fg: '#ededed', muted: '#8c8c8c', panel: '#141414', line: '#262626', label: 'Dark' };
if (palette === 'ink') themes.dark = { bg: '#0c0c0f', fg: '#e6e6ea', muted: '#8c8c97', panel: '#141418', line: '#24242a', label: 'Dark' };
if (palette === 'forest') themes.dark = { bg: '#0d100f', fg: '#e6ebe8', muted: '#8b9690', panel: '#141917', line: '#232a26', label: 'Dark' };

/** Accent colour for buttons, progress and highlights in the reader. */
export function readerAccent(t: { bg: string; fg: string }, theme: Theme): { accent: string; onAccent: string } {
  if (isMono) return { accent: t.fg, onAccent: t.bg };
  if (palette === 'ink') {
    const dark = theme === 'dark' || theme === 'night';
    return dark ? { accent: '#8b95ff', onAccent: '#0b0b16' } : { accent: '#4b55d6', onAccent: '#ffffff' };
  }
  if (palette === 'forest') {
    const dark = theme === 'dark' || theme === 'night';
    return dark ? { accent: '#3ec48d', onAccent: '#03130c' } : { accent: '#0f7f58', onAccent: '#ffffff' };
  }
  return { accent: '#22d38a', onAccent: '#04140b' };
}

export const fonts = {
  serif: '"Literata", "Noto Serif Bengali", Georgia, serif',
  sans: '"Inter", "Hind Siliguri", system-ui, sans-serif',
  bangla: '"Hind Siliguri", "Noto Sans Bengali", sans-serif',
};
export const widths = { narrow: '34rem', normal: '42rem', wide: '54rem' };
export const HL_COLORS = { yellow: 'rgba(250, 204, 21, 0.45)', green: 'rgba(34, 211, 138, 0.4)', blue: 'rgba(96, 165, 250, 0.4)', pink: 'rgba(244, 114, 182, 0.4)' };
export type HlColor = keyof typeof HL_COLORS;

export function loadPrefs(): Prefs {
  try {
    return { ...defaultPrefs, ...JSON.parse(localStorage.getItem('reader:prefs') ?? '{}') };
  } catch {
    return defaultPrefs;
  }
}
export function savePrefs(p: Prefs) {
  try {
    localStorage.setItem('reader:prefs', JSON.stringify(p));
  } catch {}
}

/* ---------- Text offsets inside an element ---------- */
function walker(root: Node) {
  return document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
}

export function rangeToOffsets(root: HTMLElement, range: Range): { start: number; end: number } | null {
  if (!root.contains(range.startContainer) || !root.contains(range.endContainer)) return null;
  const pre = document.createRange();
  pre.selectNodeContents(root);
  pre.setEnd(range.startContainer, range.startOffset);
  const start = pre.toString().length;
  const end = start + range.toString().length;
  return end > start ? { start, end } : null;
}

/** Wrap the characters [start, end) of root's text in <mark> elements (works across tags). */
export function wrapOffsets(root: HTMLElement, start: number, end: number, attrs: Record<string, string>, style?: string) {
  const w = walker(root);
  let pos = 0;
  const parts: [Text, number, number][] = [];
  for (let n = w.nextNode() as Text | null; n; n = w.nextNode() as Text | null) {
    const len = n.data.length;
    const s = Math.max(start, pos);
    const e = Math.min(end, pos + len);
    if (s < e) parts.push([n, s - pos, e - pos]);
    pos += len;
    if (pos >= end) break;
  }
  for (const [node, s, e] of parts) {
    if (!node.data.slice(s, e).trim() && parts.length > 1) continue;
    const r = document.createRange();
    r.setStart(node, s);
    r.setEnd(node, e);
    const mark = document.createElement('mark');
    for (const [k, v] of Object.entries(attrs)) mark.setAttribute(k, v);
    if (style) mark.setAttribute('style', style);
    r.surroundContents(mark);
  }
}

export function unwrapAll(root: HTMLElement, selector: string) {
  root.querySelectorAll(selector).forEach((m) => {
    const parent = m.parentNode!;
    while (m.firstChild) parent.insertBefore(m.firstChild, m);
    parent.removeChild(m);
    parent.normalize();
  });
}

/* ---------- Annotations: Supabase when signed in, else this browser ---------- */
export type Annotation = {
  id: string;
  kind: 'highlight' | 'bookmark';
  location: { chapter?: string; start?: number; end?: number; page?: number; pct?: number };
  quote: string | null;
  note: string | null;
  color: string | null;
  created_at: string;
};

const localKey = (ebookId: string) => `reader:ann:${ebookId}`;
function readLocal(ebookId: string): Annotation[] {
  try {
    return JSON.parse(localStorage.getItem(localKey(ebookId)) ?? '[]');
  } catch {
    return [];
  }
}
function writeLocal(ebookId: string, list: Annotation[]) {
  try {
    localStorage.setItem(localKey(ebookId), JSON.stringify(list));
  } catch {}
}

export async function listAnnotations(ebookId: string, userId: string | null): Promise<Annotation[]> {
  if (userId && supabase) {
    const { data } = await supabase.from('ebook_annotations').select('id,kind,location,quote,note,color,created_at').eq('ebook_id', ebookId).order('created_at');
    return (data as Annotation[]) ?? [];
  }
  return readLocal(ebookId);
}
export async function addAnnotation(ebookId: string, userId: string | null, a: Omit<Annotation, 'id' | 'created_at'>): Promise<Annotation> {
  if (userId && supabase) {
    const { data, error } = await supabase.from('ebook_annotations').insert({ ...a, ebook_id: ebookId, user_id: userId }).select('id,kind,location,quote,note,color,created_at').single();
    if (error) throw error;
    return data as Annotation;
  }
  const row = { ...a, id: crypto.randomUUID(), created_at: new Date().toISOString() };
  writeLocal(ebookId, [...readLocal(ebookId), row]);
  return row;
}
export async function updateAnnotation(ebookId: string, userId: string | null, id: string, patch: Partial<Annotation>) {
  if (userId && supabase) {
    await supabase.from('ebook_annotations').update(patch).eq('id', id);
    return;
  }
  writeLocal(ebookId, readLocal(ebookId).map((x) => (x.id === id ? { ...x, ...patch } : x)));
}
export async function removeAnnotation(ebookId: string, userId: string | null, id: string) {
  if (userId && supabase) {
    await supabase.from('ebook_annotations').delete().eq('id', id);
    return;
  }
  writeLocal(ebookId, readLocal(ebookId).filter((x) => x.id !== id));
}

/* ---------- Reading position ---------- */
export type Position = { chapter?: number; pct?: number; page?: number; mode?: 'book' | 'pdf' };
export async function loadPosition(ebookId: string, userId: string | null): Promise<Position | null> {
  if (userId && supabase) {
    const { data } = await supabase.from('reading_progress').select('location').eq('ebook_id', ebookId).maybeSingle();
    if (data) return data.location as Position;
  }
  try {
    return JSON.parse(localStorage.getItem(`reader:pos:${ebookId}`) ?? 'null');
  } catch {
    return null;
  }
}
export async function savePosition(ebookId: string, userId: string | null, pos: Position, percent: number) {
  try {
    localStorage.setItem(`reader:pos:${ebookId}`, JSON.stringify(pos));
  } catch {}
  if (userId && supabase) {
    await supabase.from('reading_progress').upsert({ user_id: userId, ebook_id: ebookId, location: pos, percent: Math.min(100, Math.round(percent * 100) / 100), updated_at: new Date().toISOString() });
  }
}
