/** Build-time portfolio data + live-preview helpers. */
import { createClient } from '@supabase/supabase-js';

export type ProjectCategory = { id: string; name: string; slug: string; sort_order: number };
export type PreviewType = 'none' | 'website' | 'google' | 'office' | 'pdf' | 'video' | 'app';
export type Project = {
  id: string;
  title: string;
  slug: string;
  summary: string | null;
  content: string;
  cover_url: string | null;
  gallery: { url: string; caption?: string }[];
  files: { name: string; url: string }[];
  tools: string[];
  tags: string[];
  client: string | null;
  project_date: string | null;
  live_url: string | null;
  repo_url: string | null;
  preview_type: PreviewType;
  preview_url: string | null;
  problem: string | null;
  solution: string | null;
  results: string | null;
  downloads_enabled: boolean;
  featured: boolean;
  sort_order: number;
  views: number;
  seo_title: string | null;
  seo_description: string | null;
  category: Pick<ProjectCategory, 'name' | 'slug'> | null;
};

let cache: { at: number; promise: Promise<{ projects: Project[]; categories: ProjectCategory[] }> } | null = null;
const TTL = import.meta.env.DEV ? 1500 : Infinity;

async function load() {
  const url = import.meta.env.PUBLIC_SUPABASE_URL as string | undefined;
  const key = import.meta.env.PUBLIC_SUPABASE_ANON_KEY as string | undefined;
  if (!url || !key) return { projects: [], categories: [] };
  const sb = createClient(url, key, { auth: { persistSession: false } });
  const [p, c] = await Promise.all([
    sb.from('projects').select('*,category:project_categories(name,slug)').eq('status', 'published').order('sort_order').order('project_date', { ascending: false, nullsFirst: false }),
    sb.from('project_categories').select('*').order('sort_order'),
  ]);
  if (p.error) console.warn('[projects] unavailable:', p.error.message);
  // The internal 'demo' tag marks sample content for easy removal; never show it.
  const projects = ((p.data as unknown as Project[]) ?? []).map((x) => ({ ...x, tags: x.tags.filter((t) => t !== 'demo') }));
  return { projects, categories: (c.data as ProjectCategory[]) ?? [] };
}

export function getProjects() {
  if (!cache || Date.now() - cache.at > TTL) cache = { at: Date.now(), promise: load() };
  return cache.promise;
}

export const yearOf = (d: string | null) => (d ? new Date(d).getFullYear() : null);

/** Turn a pasted link into something that can be embedded in an iframe. */
export function embedSrc(type: PreviewType, raw: string | null): string | null {
  if (!raw) return null;
  const url = raw.trim();
  switch (type) {
    case 'website':
    case 'pdf':
      return url;
    case 'google': {
      // Docs/Sheets/Slides/Forms: /edit…  → /preview (works for "anyone with the link" files)
      const m = url.match(/^(https:\/\/docs\.google\.com\/(?:document|spreadsheets|presentation|forms)\/d\/[^/]+)/);
      if (m) return url.includes('/forms/') ? `${m[1]}/viewform?embedded=true` : `${m[1]}/preview`;
      const drive = url.match(/drive\.google\.com\/file\/d\/([^/]+)/);
      if (drive) return `https://drive.google.com/file/d/${drive[1]}/preview`;
      return url;
    }
    case 'office':
      // Microsoft's free viewer renders public .docx/.xlsx/.pptx files
      return `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(url)}`;
    case 'video': {
      const yt = url.match(/(?:youtu\.be\/|v=|embed\/|shorts\/)([\w-]{11})/);
      return yt ? `https://www.youtube-nocookie.com/embed/${yt[1]}` : url;
    }
    default:
      return null;
  }
}

export const previewLabel: Record<PreviewType, string> = {
  none: '',
  website: 'Live website',
  google: 'Google file',
  office: 'Office document',
  pdf: 'PDF document',
  video: 'Video walkthrough',
  app: 'Mobile app',
};
