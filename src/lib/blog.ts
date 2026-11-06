/** Build-time blog data from Supabase (public, published posts only via RLS). */
import { createClient } from '@supabase/supabase-js';

export type Author = { name: string; slug: string; title: string | null; bio: string | null; avatar_url: string | null; website: string | null };
export type Category = { id: string; name: string; slug: string; description: string | null; sort_order: number };
export type Post = {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  content: string;
  cover_url: string | null;
  tags: string[];
  published_at: string;
  updated_at: string;
  featured: boolean;
  allow_comments: boolean;
  seo_title: string | null;
  seo_description: string | null;
  views: number;
  category: Pick<Category, 'name' | 'slug'> | null;
  author: Author | null;
};

const SELECT =
  'id,title,slug,excerpt,content,cover_url,tags,published_at,updated_at,featured,allow_comments,seo_title,seo_description,views,category:blog_categories(name,slug),author:authors(name,slug,title,bio,avatar_url,website)';

let cache: { at: number; promise: Promise<{ posts: Post[]; categories: Category[] }> } | null = null;
const TTL = import.meta.env.DEV ? 1500 : Infinity;

async function load() {
  const url = import.meta.env.PUBLIC_SUPABASE_URL as string | undefined;
  const key = import.meta.env.PUBLIC_SUPABASE_ANON_KEY as string | undefined;
  if (!url || !key) return { posts: [], categories: [] };
  const sb = createClient(url, key, { auth: { persistSession: false } });
  const [p, c] = await Promise.all([
    sb.from('posts').select(SELECT).eq('status', 'published').lte('published_at', new Date().toISOString()).order('published_at', { ascending: false }),
    sb.from('blog_categories').select('*').order('sort_order'),
  ]);
  if (p.error) console.warn('[blog] posts unavailable:', p.error.message);
  // The internal 'demo' tag marks sample content for easy removal; never show it.
  const posts = ((p.data as unknown as Post[]) ?? []).map((x) => ({ ...x, tags: x.tags.filter((t) => t !== 'demo') }));
  return { posts, categories: (c.data as Category[]) ?? [] };
}

export function getBlog() {
  if (!cache || Date.now() - cache.at > TTL) cache = { at: Date.now(), promise: load() };
  return cache.promise;
}

export const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Dhaka' });

export function excerptOf(p: Pick<Post, 'excerpt' | 'content'>, len = 160) {
  if (p.excerpt) return p.excerpt;
  const text = p.content
    .replace(/```[\s\S]*?```/g, '')
    .replace(/!\[[^\]]*]\([^)]*\)/g, '')
    .replace(/\[([^\]]*)]\([^)]*\)/g, '$1')
    .replace(/[#>*_`~-]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  return text.length > len ? `${text.slice(0, len).replace(/\s\S*$/, '')}…` : text;
}
