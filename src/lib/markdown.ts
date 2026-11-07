/**
 * Markdown → HTML for blog posts, at build time.
 * Adds heading anchors, a table of contents, reading time and
 * Shiki syntax highlighting (light + dark) for code blocks.
 */
import { Marked, type Token, type Tokens } from 'marked';
import { createHighlighter, type Highlighter } from 'shiki';

export type TocItem = { id: string; text: string; depth: 2 | 3 };

const LANGS = ['javascript', 'typescript', 'html', 'css', 'json', 'bash', 'sql', 'python', 'php', 'markdown', 'vb', 'xml', 'yaml'];
let hl: Promise<Highlighter> | null = null;
const highlighter = () => (hl ??= createHighlighter({ themes: ['github-light', 'github-dark'], langs: LANGS }));

export function slugifyHeading(text: string) {
  return (
    text
      .toLowerCase()
      .replace(/<[^>]+>/g, '')
      .replace(/&[a-z]+;/g, '')
      .replace(/[^\p{L}\p{N}\s-]/gu, '')
      .trim()
      .replace(/\s+/g, '-') || 'section'
  );
}

const plain = (s: string) => s.replace(/[*_`~]|\[([^\]]*)\]\([^)]*\)/g, '$1');

export function readingMinutes(md: string) {
  const words = md.replace(/```[\s\S]*?```/g, ' ').split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 200));
}

export async function renderMarkdown(md: string): Promise<{ html: string; toc: TocItem[]; minutes: number }> {
  const toc: TocItem[] = [];
  const used = new Map<string, number>();
  const uniqueId = (text: string) => {
    const base = slugifyHeading(text);
    const n = used.get(base) ?? 0;
    used.set(base, n + 1);
    return n ? `${base}-${n}` : base;
  };

  const marked = new Marked({ gfm: true, breaks: false });
  marked.use({
    renderer: {
      heading(this: { parser: { parseInline: (t: Token[]) => string } }, { tokens, depth, text }: Tokens.Heading) {
        const inner = this.parser.parseInline(tokens);
        if (depth < 2 || depth > 4) return `<h${depth}>${inner}</h${depth}>`;
        const id = uniqueId(plain(text));
        if (depth <= 3) toc.push({ id, text: plain(text), depth: depth as 2 | 3 });
        return `<h${depth} id="${id}"><a class="anchor" href="#${id}" aria-hidden="true" tabindex="-1">#</a>${inner}</h${depth}>`;
      },
      link(this: { parser: { parseInline: (t: Token[]) => string } }, { href, title, tokens }: Tokens.Link) {
        const inner = this.parser.parseInline(tokens);
        const external = /^https?:\/\//.test(href);
        return `<a href="${href}"${title ? ` title="${title}"` : ''}${external ? ' target="_blank" rel="noopener"' : ''}>${inner}</a>`;
      },
      image({ href, title, text }: Tokens.Image) {
        const cap = title ? `<figcaption>${title}</figcaption>` : '';
        return `<figure><img src="${href}" alt="${text.replace(/"/g, '&quot;')}" loading="lazy" decoding="async" />${cap}</figure>`;
      },
    },
  });

  const tokens = marked.lexer(md);
  const h = await highlighter();
  const loaded = new Set(h.getLoadedLanguages());
  const walk = (list: Token[]) => {
    for (let i = 0; i < list.length; i++) {
      const t = list[i];
      if (t.type === 'code') {
        const lang = (t as Tokens.Code).lang?.split(/\s/)[0]?.toLowerCase() || 'text';
        const html = h.codeToHtml((t as Tokens.Code).text, {
          lang: loaded.has(lang) ? lang : 'text',
          themes: { light: 'github-light', dark: 'github-dark' },
          defaultColor: false,
        });
        const label = lang !== 'text' ? `<span class="code-lang">${lang}</span>` : '';
        list[i] = { type: 'html', raw: t.raw, text: `<div class="code-block">${label}<button type="button" class="code-copy" data-copy>Copy</button>${html}</div>`, block: true, pre: false } as Tokens.HTML;
      } else if ('tokens' in t && Array.isArray(t.tokens) && t.type === 'blockquote') {
        walk(t.tokens);
      }
    }
  };
  walk(tokens as Token[]);

  let html = marked.parser(tokens);
  // Wrap tables so they scroll on phones instead of breaking the layout.
  html = html.replace(/<table>/g, '<div class="table-wrap"><table>').replace(/<\/table>/g, '</table></div>');
  return { html, toc, minutes: readingMinutes(md) };
}
