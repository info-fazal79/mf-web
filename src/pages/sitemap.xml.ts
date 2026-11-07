import type { APIRoute } from 'astro';
import { getBlog } from '@/lib/blog';
import { getProjects } from '@/lib/projects';
import { getTutorials } from '@/lib/tutorials';
import { getEbooks } from '@/lib/ebooks';

const STATIC = ['/', '/about', '/ebooks', '/projects', '/tutorials', '/blog', '/contact'];

export const GET: APIRoute = async ({ site }) => {
  const base = (site?.href ?? 'https://muhammadfazal.com/').replace(/\/$/, '');
  const [{ posts }, { projects }, playlists, { books }] = await Promise.all([getBlog(), getProjects(), getTutorials(), getEbooks()]);
  const urls: { loc: string; lastmod?: string; priority: string }[] = [
    ...STATIC.map((p) => ({ loc: p, priority: p === '/' ? '1.0' : '0.8' })),
    ...posts.map((p) => ({ loc: `/blog/${p.slug}`, lastmod: p.updated_at, priority: '0.7' })),
    ...projects.map((p) => ({ loc: `/projects/${p.slug}`, priority: '0.6' })),
    ...playlists.map((p) => ({ loc: `/tutorials/${p.slug}`, lastmod: p.updated_at, priority: '0.7' })),
    ...books.map((b) => ({ loc: `/ebooks/${b.slug}`, lastmod: b.published_at ?? undefined, priority: '0.8' })),
  ];
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((u) => `  <url><loc>${base}${u.loc}</loc>${u.lastmod ? `<lastmod>${new Date(u.lastmod).toISOString().slice(0, 10)}</lastmod>` : ''}<priority>${u.priority}</priority></url>`).join('\n')}
</urlset>`;
  return new Response(xml, { headers: { 'Content-Type': 'application/xml; charset=utf-8' } });
};
