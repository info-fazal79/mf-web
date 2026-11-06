import type { APIRoute } from 'astro';
import { excerptOf, getBlog } from '@/lib/blog';
import { getContent } from '@/lib/content';

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export const GET: APIRoute = async ({ site }) => {
  const { posts } = await getBlog();
  const g = (await getContent()).general;
  const base = site?.href.replace(/\/$/, '') ?? '';
  const items = posts
    .slice(0, 30)
    .map(
      (p) => `<item><title>${esc(p.title)}</title><link>${base}/blog/${p.slug}</link><guid>${base}/blog/${p.slug}</guid><pubDate>${new Date(p.published_at).toUTCString()}</pubDate><description>${esc(excerptOf(p, 300))}</description>${p.category ? `<category>${esc(p.category.name)}</category>` : ''}</item>`,
    )
    .join('');
  const xml = `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel><title>${esc(g.name)} Blog</title><link>${base}/blog</link><description>${esc(g.description)}</description><language>en</language>${items}</channel></rss>`;
  return new Response(xml, { headers: { 'Content-Type': 'application/rss+xml; charset=utf-8' } });
};
