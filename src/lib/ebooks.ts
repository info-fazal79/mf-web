/** E-book data (build time) + shared helpers for the store, reader and admin. */
import { createClient } from '@supabase/supabase-js';

export type AccessMode = 'free_read' | 'free_download' | 'email' | 'whatsapp' | 'paid';
export type Ebook = {
  id: string;
  title: string;
  slug: string;
  subtitle: string | null;
  description: string;
  cover_url: string | null;
  author_name: string;
  language: string;
  pages: number | null;
  format: 'native' | 'pdf' | 'both';
  pdf_path: string | null;
  access_mode: AccessMode;
  allow_download: boolean;
  price: number;
  sale_price: number | null;
  whatsapp_url: string | null;
  preview_pages: number;
  tags: string[];
  featured: boolean;
  sort_order: number;
  published_at: string | null;
  seo_title: string | null;
  seo_description: string | null;
  views: number;
  category: { name: string; slug: string } | null;
};
export type EbookCategory = { id: string; name: string; slug: string; sort_order: number };
export type TocEntry = { id: string; title: string; chapter_position: number; is_preview: boolean };
export type Rating = { avg: number; count: number };

let cache: { at: number; promise: Promise<{ books: Ebook[]; categories: EbookCategory[]; ratings: Record<string, Rating>; toc: Record<string, TocEntry[]> }> } | null = null;
const TTL = import.meta.env.DEV ? 1500 : Infinity;

async function load() {
  const url = import.meta.env.PUBLIC_SUPABASE_URL as string | undefined;
  const key = import.meta.env.PUBLIC_SUPABASE_ANON_KEY as string | undefined;
  const empty = { books: [], categories: [], ratings: {}, toc: {} };
  if (!url || !key) return empty;
  const sb = createClient(url, key, { auth: { persistSession: false } });
  const [b, c, r] = await Promise.all([
    sb.from('ebooks').select('*,category:ebook_categories(name,slug)').eq('status', 'published').order('sort_order').order('published_at', { ascending: false }),
    sb.from('ebook_categories').select('*').order('sort_order'),
    sb.rpc('ebook_ratings'),
  ]);
  if (b.error) {
    console.warn('[ebooks] unavailable:', b.error.message);
    return empty;
  }
  const books = (b.data as unknown as Ebook[]).map((x) => ({
    ...x,
    price: Number(x.price),
    sale_price: x.sale_price == null ? null : Number(x.sale_price),
    tags: x.tags.filter((t) => t !== 'demo'), // internal marker for sample content
  }));
  const ratings: Record<string, Rating> = {};
  for (const row of (r.data as { ebook_id: string; avg_rating: number; review_count: number }[] | null) ?? []) ratings[row.ebook_id] = { avg: Number(row.avg_rating), count: Number(row.review_count) };
  const tocs = await Promise.all(books.map((x) => sb.rpc('ebook_toc', { p_ebook: x.id })));
  const toc: Record<string, TocEntry[]> = {};
  books.forEach((x, i) => (toc[x.id] = (tocs[i].data as TocEntry[]) ?? []));
  return { books, categories: (c.data as EbookCategory[]) ?? [], ratings, toc };
}

export function getEbooks() {
  if (!cache || Date.now() - cache.at > TTL) cache = { at: Date.now(), promise: load() };
  return cache.promise;
}

export const isFree = (b: Pick<Ebook, 'access_mode'>) => b.access_mode !== 'paid';
export const effectivePrice = (b: Pick<Ebook, 'price' | 'sale_price'>) => (b.sale_price != null && b.sale_price < b.price ? b.sale_price : b.price);
export const taka = (n: number) => `৳${Number.isInteger(n) ? n : n.toFixed(2)}`;

export const accessLabel: Record<AccessMode, string> = {
  free_read: 'Free · read online',
  free_download: 'Free download',
  email: 'Free with email',
  whatsapp: 'Free via WhatsApp',
  paid: 'Premium',
};
