import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { marked } from 'marked';
import { supabase } from '@/lib/supabase';
import { SchemaForm, type Field } from './SchemaForm';
import { Empty, I, ImageField, MediaLibrary, Modal, PageTitle, Panel, TagsField, Toggle, useToast } from './ui';

type Obj = Record<string, unknown>;
type Cat = { id: string; name: string; slug: string; description: string | null; sort_order: number };
type Author = { id: string; name: string; slug: string; title: string | null; bio: string | null; avatar_url: string | null; website: string | null };
type Post = {
  id?: string;
  title: string;
  slug: string;
  excerpt: string;
  content: string;
  cover_url: string;
  category_id: string | null;
  author_id: string | null;
  tags: string[];
  status: 'draft' | 'published';
  published_at: string | null;
  featured: boolean;
  allow_comments: boolean;
  seo_title: string;
  seo_description: string;
  views?: number;
  updated_at?: string;
};

const sb = () => supabase!;
export const slugify = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
const toLocalInput = (iso: string | null) => {
  if (!iso) return '';
  const d = new Date(iso);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
};

function useList<T>(table: string, order: string, ascending = true) {
  const toast = useToast();
  const [rows, setRows] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const reload = useCallback(async () => {
    setLoading(true);
    const { data, error } = await sb().from(table).select('*').order(order, { ascending });
    if (error) toast(error.message, false);
    setRows((data as T[]) ?? []);
    setLoading(false);
  }, [table, order, ascending, toast]);
  useEffect(() => {
    reload();
  }, [reload]);
  return { rows, loading, reload };
}

/* ======================= Posts list ======================= */
export function BlogPosts({ go, editId }: { go: (r: string) => void; editId?: string }) {
  if (editId) return <PostEditor id={editId === 'new' ? null : editId} go={go} />;
  return <PostList go={go} />;
}

function PostList({ go }: { go: (r: string) => void }) {
  const toast = useToast();
  const [rows, setRows] = useState<(Post & { category: { name: string } | null; comments: { count: number }[] })[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('all');

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await sb()
      .from('posts')
      .select('id,title,slug,status,published_at,featured,views,updated_at,category:blog_categories(name),comments(count)')
      .order('updated_at', { ascending: false });
    if (error) toast(error.message, false);
    setRows((data as never) ?? []);
    setLoading(false);
  }, [toast]);
  useEffect(() => {
    load();
  }, [load]);

  const now = Date.now();
  const stateOf = (p: Post) => (p.status === 'draft' ? 'draft' : p.published_at && Date.parse(p.published_at) > now ? 'scheduled' : 'published');
  const shown = rows.filter((p) => (status === 'all' || stateOf(p) === status) && (!q || p.title.toLowerCase().includes(q.toLowerCase())));

  async function remove(p: Post) {
    if (!confirm(`Delete "${p.title}" and all its comments? This cannot be undone.`)) return;
    const { error } = await sb().from('posts').delete().eq('id', p.id!);
    if (error) return toast(error.message, false);
    toast('Post deleted');
    load();
  }

  const badge: Record<string, string> = {
    draft: 'bg-surface-2 text-muted',
    scheduled: 'bg-blue-500/15 text-blue-500',
    published: 'bg-accent-soft text-accent',
  };

  return (
    <div>
      <PageTitle
        title="Blog posts"
        sub="Write, schedule and publish articles."
        actions={
          <button type="button" className="btn-primary" onClick={() => go('blog/new')}>
            <I n="plus" s={15} /> New post
          </button>
        }
      />
      <Panel>
        <div className="mb-4 flex flex-wrap items-center gap-2">
          {['all', 'published', 'scheduled', 'draft'].map((s) => (
            <button key={s} type="button" onClick={() => setStatus(s)} className={`rounded-lg px-3 py-1.5 text-xs font-semibold capitalize ${status === s ? 'bg-accent text-accent-contrast' : 'border border-line text-muted hover:text-fg'}`}>
              {s} <span className="opacity-70">{s === 'all' ? rows.length : rows.filter((r) => stateOf(r) === s).length}</span>
            </button>
          ))}
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search posts…" className="input ml-auto w-52 py-1.5 text-xs" />
        </div>
        {loading ? (
          <p className="py-8 text-center text-sm text-muted">Loading…</p>
        ) : shown.length === 0 ? (
          <Empty text={rows.length ? 'No posts match.' : 'No posts yet. Write your first article!'} icon="file" />
        ) : (
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-muted uppercase">
              <tr>
                <th className="pb-2">Title</th>
                <th className="hidden pb-2 md:table-cell">Category</th>
                <th className="pb-2">Status</th>
                <th className="hidden pb-2 sm:table-cell">Views</th>
                <th className="hidden pb-2 sm:table-cell">Comments</th>
                <th />
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {shown.map((p) => {
                const st = stateOf(p);
                return (
                  <tr key={p.id}>
                    <td className="py-3 pr-3">
                      <button type="button" onClick={() => go(`blog/${p.id}`)} className="text-left font-semibold hover:text-accent">
                        {p.title || '(untitled)'} {p.featured && <span className="ml-1 text-xs text-accent">★</span>}
                      </button>
                      <p className="font-mono text-[11px] text-muted">/{p.slug}</p>
                    </td>
                    <td className="hidden text-muted md:table-cell">{p.category?.name ?? '—'}</td>
                    <td>
                      <span className={`rounded-md px-2 py-0.5 text-xs font-semibold capitalize ${badge[st]}`}>{st}</span>
                      {p.published_at && st !== 'draft' && <p className="mt-0.5 font-mono text-[10px] text-muted">{new Date(p.published_at).toLocaleDateString()}</p>}
                    </td>
                    <td className="hidden font-mono text-xs sm:table-cell">{p.views ?? 0}</td>
                    <td className="hidden font-mono text-xs sm:table-cell">{p.comments?.[0]?.count ?? 0}</td>
                    <td className="text-right whitespace-nowrap">
                      {st === 'published' && (
                        <a href={`/blog/${p.slug}`} target="_blank" className="inline-grid h-8 w-8 place-items-center rounded-lg text-muted hover:text-fg" title="View"><I n="external" s={15} /></a>
                      )}
                      <button type="button" onClick={() => remove(p)} className="inline-grid h-8 w-8 place-items-center rounded-lg text-muted hover:text-red-500" title="Delete"><I n="trash" s={15} /></button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </Panel>
    </div>
  );
}

/* ======================= Markdown editor ======================= */
function MarkdownEditor({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const [tab, setTab] = useState<'write' | 'preview' | 'split'>('split');
  const [media, setMedia] = useState(false);
  const preview = useMemo(() => marked.parse(value || '*Nothing to preview yet.*', { async: false }) as string, [value]);

  function wrap(before: string, after = '', placeholder = '') {
    const ta = ref.current!;
    const { selectionStart: s, selectionEnd: e } = ta;
    const sel = value.slice(s, e) || placeholder;
    const next = value.slice(0, s) + before + sel + after + value.slice(e);
    onChange(next);
    requestAnimationFrame(() => {
      ta.focus();
      ta.setSelectionRange(s + before.length, s + before.length + sel.length);
    });
  }
  function line(prefix: string) {
    const ta = ref.current!;
    const s = value.lastIndexOf('\n', ta.selectionStart - 1) + 1;
    onChange(value.slice(0, s) + prefix + value.slice(s));
    requestAnimationFrame(() => ta.focus());
  }

  const tools: { t: string; label: string; run: () => void }[] = [
    { t: 'H2', label: 'Heading', run: () => line('## ') },
    { t: 'H3', label: 'Sub-heading', run: () => line('### ') },
    { t: 'B', label: 'Bold', run: () => wrap('**', '**', 'bold text') },
    { t: 'I', label: 'Italic', run: () => wrap('_', '_', 'italic text') },
    { t: '🔗', label: 'Link', run: () => wrap('[', '](https://)', 'link text') },
    { t: '•', label: 'List', run: () => line('- ') },
    { t: '1.', label: 'Numbered list', run: () => line('1. ') },
    { t: '❝', label: 'Quote', run: () => line('> ') },
    { t: '</>', label: 'Code block', run: () => wrap('\n```js\n', '\n```\n', 'code') },
    { t: '`', label: 'Inline code', run: () => wrap('`', '`', 'code') },
    { t: '⊞', label: 'Table', run: () => wrap('\n| Column | Column |\n| --- | --- |\n| ', ' | value |\n', 'value') },
    { t: '―', label: 'Divider', run: () => wrap('\n---\n') },
  ];

  return (
    <div className="overflow-hidden rounded-2xl border border-line">
      <div className="flex flex-wrap items-center gap-1 border-b border-line bg-surface-2 px-2 py-1.5">
        {tools.map((x) => (
          <button key={x.label} type="button" title={x.label} onClick={x.run} className="h-8 min-w-8 rounded-md px-2 font-mono text-xs font-bold text-muted hover:bg-surface hover:text-fg">
            {x.t}
          </button>
        ))}
        <button type="button" title="Insert image" onClick={() => setMedia(true)} className="h-8 rounded-md px-2 text-muted hover:bg-surface hover:text-fg"><I n="image" s={16} /></button>
        <div className="ml-auto flex rounded-lg border border-line bg-surface p-0.5 text-xs">
          {(['write', 'split', 'preview'] as const).map((m) => (
            <button key={m} type="button" onClick={() => setTab(m)} className={`rounded-md px-2.5 py-1 capitalize ${tab === m ? 'bg-accent font-semibold text-accent-contrast' : 'text-muted'}`}>
              {m}
            </button>
          ))}
        </div>
      </div>
      <div className={tab === 'split' ? 'grid lg:grid-cols-2' : ''}>
        {tab !== 'preview' && (
          <textarea
            ref={ref}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={(e) => {
              if ((e.ctrlKey || e.metaKey) && e.key === 'b') { e.preventDefault(); wrap('**', '**', 'bold'); }
              if ((e.ctrlKey || e.metaKey) && e.key === 'i') { e.preventDefault(); wrap('_', '_', 'italic'); }
            }}
            spellCheck
            placeholder={'Write in Markdown…\n\n## A heading\n\nSome **bold** text and a [link](https://example.com).'}
            className="min-h-[520px] w-full resize-y bg-surface p-4 font-mono text-sm leading-relaxed text-fg outline-none"
          />
        )}
        {tab !== 'write' && <div className={`prose max-h-[720px] min-h-[520px] overflow-y-auto bg-bg p-5 ${tab === 'split' ? 'border-t border-line lg:border-t-0 lg:border-l' : ''}`} dangerouslySetInnerHTML={{ __html: preview }} />}
      </div>
      <div className="flex justify-between border-t border-line bg-surface-2 px-3 py-1.5 font-mono text-[11px] text-muted">
        <span>Markdown · Ctrl+B bold · Ctrl+I italic</span>
        <span>{value.split(/\s+/).filter(Boolean).length} words · {Math.max(1, Math.round(value.split(/\s+/).filter(Boolean).length / 200))} min read</span>
      </div>
      <Modal open={media} onClose={() => setMedia(false)} title="Insert image" wide>
        <MediaLibrary
          onPick={(m) => {
            setMedia(false);
            wrap(`\n![${m.alt || m.name.replace(/\.[^.]+$/, '')}](${m.url})\n`);
          }}
        />
      </Modal>
    </div>
  );
}

/* ======================= Post editor ======================= */
const blank: Post = {
  title: '',
  slug: '',
  excerpt: '',
  content: '',
  cover_url: '',
  category_id: null,
  author_id: null,
  tags: [],
  status: 'draft',
  published_at: null,
  featured: false,
  allow_comments: true,
  seo_title: '',
  seo_description: '',
};

function PostEditor({ id, go }: { id: string | null; go: (r: string) => void }) {
  const toast = useToast();
  const [post, setPost] = useState<Post>(blank);
  const [saved, setSaved] = useState(JSON.stringify(blank));
  const [slugTouched, setSlugTouched] = useState(false);
  const [loading, setLoading] = useState(Boolean(id));
  const [saving, setSaving] = useState(false);
  const cats = useList<Cat>('blog_categories', 'sort_order');
  const authors = useList<Author>('authors', 'name');

  useEffect(() => {
    if (!id) return;
    sb()
      .from('posts')
      .select('*')
      .eq('id', id)
      .single()
      .then(({ data, error }) => {
        if (error) {
          toast(error.message, false);
          return go('blog');
        }
        const p = { ...blank, ...(data as Post), excerpt: data.excerpt ?? '', cover_url: data.cover_url ?? '', seo_title: data.seo_title ?? '', seo_description: data.seo_description ?? '' };
        setPost(p);
        setSaved(JSON.stringify(p));
        setSlugTouched(true);
        setLoading(false);
      });
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Default author for new posts
  useEffect(() => {
    if (!id && !post.author_id && authors.rows[0]) setPost((p) => ({ ...p, author_id: authors.rows[0].id }));
  }, [authors.rows]); // eslint-disable-line react-hooks/exhaustive-deps

  const set = <K extends keyof Post>(k: K, v: Post[K]) => setPost((p) => ({ ...p, [k]: v }));
  const dirty = JSON.stringify(post) !== saved;

  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => {
      if (dirty) e.preventDefault();
    };
    addEventListener('beforeunload', warn);
    return () => removeEventListener('beforeunload', warn);
  }, [dirty]);

  async function save(publish?: boolean) {
    const p = { ...post };
    if (!p.title.trim()) return toast('Add a title first', false);
    p.slug = slugify(p.slug || p.title);
    if (!p.slug) return toast('The URL slug is empty', false);
    if (publish === true) {
      p.status = 'published';
      p.published_at ??= new Date().toISOString();
    } else if (publish === false) p.status = 'draft';
    if (p.status === 'published' && !p.published_at) p.published_at = new Date().toISOString();
    setSaving(true);
    const { id: pid, views, updated_at, ...row } = p;
    void views;
    void updated_at;
    const payload = { ...row, excerpt: row.excerpt || null, cover_url: row.cover_url || null, seo_title: row.seo_title || null, seo_description: row.seo_description || null };
    const res = pid ? await sb().from('posts').update(payload).eq('id', pid).select().single() : await sb().from('posts').insert(payload).select().single();
    setSaving(false);
    if (res.error) return toast(res.error.code === '23505' ? 'Another post already uses this URL slug.' : res.error.message, false);
    const next = { ...p, id: res.data.id };
    setPost(next);
    setSaved(JSON.stringify(next));
    toast(p.status === 'published' ? (Date.parse(p.published_at!) > Date.now() ? 'Scheduled' : 'Published') : 'Draft saved');
    if (!pid) go(`blog/${res.data.id}`);
  }

  if (loading) return <p className="py-10 text-center text-sm text-muted">Loading…</p>;
  const scheduled = post.status === 'published' && post.published_at && Date.parse(post.published_at) > Date.now();
  const liveUrl = `/blog/${post.slug || slugify(post.title)}`;

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <button type="button" onClick={() => (!dirty || confirm('Discard unsaved changes?')) && go('blog')} className="btn-ghost px-3 py-1.5 text-xs">← All posts</button>
        <span className="text-sm text-muted">{id ? 'Edit post' : 'New post'}</span>
        <span className="ml-auto flex flex-wrap gap-2">
          {post.status === 'published' && post.id && !scheduled && (
            <a href={liveUrl} target="_blank" className="btn-ghost"><I n="external" s={15} /> View</a>
          )}
          <button type="button" className="btn-ghost" disabled={saving} onClick={() => save(post.status === 'published' ? undefined : false)}>
            {post.status === 'published' ? (dirty ? 'Update' : 'Saved') : 'Save draft'}
          </button>
          {post.status === 'draft' ? (
            <button type="button" className="btn-primary" disabled={saving} onClick={() => save(true)}><I n="check" s={15} /> {post.published_at && Date.parse(post.published_at) > Date.now() ? 'Schedule' : 'Publish'}</button>
          ) : (
            <button type="button" className="btn-ghost" disabled={saving} onClick={() => save(false)}>Unpublish</button>
          )}
        </span>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_320px]">
        <div className="grid min-w-0 content-start gap-4">
          <input value={post.title} onChange={(e) => { set('title', e.target.value); if (!slugTouched) set('slug', slugify(e.target.value)); }} placeholder="Post title" className="w-full bg-transparent text-3xl font-extrabold tracking-tight outline-none placeholder:text-muted/50" />
          <div className="flex items-center gap-1 font-mono text-xs text-muted">
            <span>/blog/</span>
            <input value={post.slug} onChange={(e) => { setSlugTouched(true); set('slug', e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-')); }} className="flex-1 rounded-md border border-transparent bg-transparent px-1 py-0.5 text-fg outline-none hover:border-line focus:border-accent" />
          </div>
          <textarea value={post.excerpt} onChange={(e) => set('excerpt', e.target.value)} rows={2} placeholder="Short summary shown on cards and search results (optional)" className="input resize-y" />
          <MarkdownEditor value={post.content} onChange={(v) => set('content', v)} />
        </div>

        <aside className="grid content-start gap-4">
          <Panel title="Publish">
            <div className="grid gap-4 text-sm">
              <p>
                Status:{' '}
                <strong className={post.status === 'published' ? 'text-accent' : ''}>
                  {post.status === 'draft' ? 'Draft' : scheduled ? 'Scheduled' : 'Published'}
                </strong>
                {dirty && <span className="ml-2 text-xs text-yellow-600 dark:text-yellow-400">● unsaved</span>}
              </p>
              <div>
                <label className="label" htmlFor="p-date">Publish date</label>
                <input id="p-date" type="datetime-local" value={toLocalInput(post.published_at)} onChange={(e) => set('published_at', e.target.value ? new Date(e.target.value).toISOString() : null)} className="input" />
                <p className="mt-1 text-xs text-muted">Pick a future time to schedule. Empty = now.</p>
              </div>
              <Toggle checked={post.featured} onChange={(v) => set('featured', v)} label="Featured post" />
              <Toggle checked={post.allow_comments} onChange={(v) => set('allow_comments', v)} label="Allow comments" />
            </div>
          </Panel>
          <Panel title="Cover image">
            <ImageField value={post.cover_url} onChange={(v) => set('cover_url', v)} />
          </Panel>
          <Panel title="Organize">
            <div className="grid gap-4">
              <div>
                <label className="label" htmlFor="p-cat">Category</label>
                <select id="p-cat" value={post.category_id ?? ''} onChange={(e) => set('category_id', e.target.value || null)} className="input">
                  <option value="">— None —</option>
                  {cats.rows.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div>
                <label className="label" htmlFor="p-author">Author</label>
                <select id="p-author" value={post.author_id ?? ''} onChange={(e) => set('author_id', e.target.value || null)} className="input">
                  <option value="">— None —</option>
                  {authors.rows.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
              </div>
              <div>
                <span className="label">Tags</span>
                <TagsField value={post.tags} onChange={(v) => set('tags', v)} />
              </div>
            </div>
          </Panel>
          <Panel title="SEO">
            <div className="grid gap-3">
              <div>
                <label className="label" htmlFor="p-seo-t">SEO title</label>
                <input id="p-seo-t" value={post.seo_title} onChange={(e) => set('seo_title', e.target.value)} placeholder={post.title} className="input" />
              </div>
              <div>
                <label className="label" htmlFor="p-seo-d">Meta description <span className="normal-case">({post.seo_description.length}/160)</span></label>
                <textarea id="p-seo-d" value={post.seo_description} onChange={(e) => set('seo_description', e.target.value)} rows={3} className="input resize-y" />
              </div>
              <div className="rounded-xl border border-line bg-surface-2 p-3">
                <p className="truncate text-sm font-medium text-blue-500">{post.seo_title || post.title || 'Post title'}</p>
                <p className="truncate font-mono text-[11px] text-accent">muhammadfazal.com{liveUrl}</p>
                <p className="mt-1 line-clamp-2 text-xs text-muted">{post.seo_description || post.excerpt || 'Meta description preview…'}</p>
              </div>
            </div>
          </Panel>
        </aside>
      </div>
    </div>
  );
}

/* ======================= Categories ======================= */
const catFields: Field[] = [
  { key: 'name', label: 'Name', type: 'text' },
  { key: 'slug', label: 'URL slug', type: 'text', help: 'Leave empty to generate from the name.' },
  { key: 'sort_order', label: 'Order', type: 'number' },
  { key: 'description', label: 'Description', type: 'textarea' },
];

export function BlogCategories() {
  const toast = useToast();
  const { rows, loading, reload } = useList<Cat>('blog_categories', 'sort_order');
  const [edit, setEdit] = useState<Obj | null>(null);

  async function save() {
    if (!edit) return;
    const { id, created_at, ...row } = edit;
    void created_at;
    row.slug = slugify(String(row.slug || row.name || ''));
    if (!String(row.name ?? '').trim()) return toast('Name is required', false);
    const { error } = id ? await sb().from('blog_categories').update(row).eq('id', id) : await sb().from('blog_categories').insert(row);
    if (error) return toast(error.code === '23505' ? 'That slug is already used.' : error.message, false);
    setEdit(null);
    reload();
  }
  async function remove(c: Cat) {
    if (!confirm(`Delete category "${c.name}"? Posts keep existing but lose this category.`)) return;
    const { error } = await sb().from('blog_categories').delete().eq('id', c.id);
    if (error) return toast(error.message, false);
    reload();
  }

  return (
    <div>
      <PageTitle title="Blog categories" sub="Group your posts by topic." actions={<button type="button" className="btn-primary" onClick={() => setEdit({ name: '', slug: '', sort_order: rows.length + 1, description: '' })}><I n="plus" s={15} /> Add category</button>} />
      <Panel>
        {loading ? <p className="py-8 text-center text-sm text-muted">Loading…</p> : rows.length === 0 ? <Empty text="No categories yet." /> : (
          <ul className="divide-y divide-line">
            {rows.map((c) => (
              <li key={c.id} className="flex items-center gap-3 py-3 text-sm">
                <span className="w-8 font-mono text-xs text-muted">{c.sort_order}</span>
                <span className="font-semibold">{c.name}</span>
                <span className="font-mono text-xs text-muted">/{c.slug}</span>
                <span className="ml-auto" />
                <button type="button" className="btn-ghost px-3 py-1.5 text-xs" onClick={() => setEdit({ ...c })}>Edit</button>
                <button type="button" className="text-muted hover:text-red-500" onClick={() => remove(c)} aria-label="Delete"><I n="trash" s={15} /></button>
              </li>
            ))}
          </ul>
        )}
      </Panel>
      <Modal open={edit !== null} onClose={() => setEdit(null)} title={edit?.id ? 'Edit category' : 'New category'}>
        {edit && (<><SchemaForm fields={catFields} value={edit} onChange={setEdit} /><div className="mt-6 flex justify-end gap-2"><button type="button" className="btn-ghost" onClick={() => setEdit(null)}>Cancel</button><button type="button" className="btn-primary" onClick={save}>Save</button></div></>)}
      </Modal>
    </div>
  );
}

/* ======================= Authors ======================= */
const authorFields: Field[] = [
  { key: 'name', label: 'Name', type: 'text' },
  { key: 'title', label: 'Title / role', type: 'text' },
  { key: 'website', label: 'Website', type: 'url' },
  { key: 'slug', label: 'URL slug', type: 'text' },
  { key: 'bio', label: 'Short bio', type: 'textarea' },
  { key: 'avatar_url', label: 'Photo', type: 'image' },
];

export function BlogAuthors() {
  const toast = useToast();
  const { rows, loading, reload } = useList<Author>('authors', 'name');
  const [edit, setEdit] = useState<Obj | null>(null);

  async function save() {
    if (!edit) return;
    const { id, created_at, ...row } = edit;
    void created_at;
    row.slug = slugify(String(row.slug || row.name || ''));
    if (!String(row.name ?? '').trim()) return toast('Name is required', false);
    const { error } = id ? await sb().from('authors').update(row).eq('id', id) : await sb().from('authors').insert(row);
    if (error) return toast(error.code === '23505' ? 'That slug is already used.' : error.message, false);
    setEdit(null);
    reload();
  }
  async function remove(a: Author) {
    if (!confirm(`Delete author "${a.name}"? Their posts stay but show no author.`)) return;
    const { error } = await sb().from('authors').delete().eq('id', a.id);
    if (error) return toast(error.message, false);
    reload();
  }

  return (
    <div>
      <PageTitle title="Authors" sub="People shown on blog posts." actions={<button type="button" className="btn-primary" onClick={() => setEdit({ name: '', slug: '', title: '', bio: '', avatar_url: '', website: '' })}><I n="plus" s={15} /> Add author</button>} />
      <Panel>
        {loading ? <p className="py-8 text-center text-sm text-muted">Loading…</p> : rows.length === 0 ? <Empty text="No authors yet." icon="user" /> : (
          <ul className="divide-y divide-line">
            {rows.map((a) => (
              <li key={a.id} className="flex items-center gap-3 py-3 text-sm">
                {a.avatar_url ? <img src={a.avatar_url} alt="" className="h-10 w-10 rounded-full object-cover" /> : <span className="grid h-10 w-10 place-items-center rounded-full bg-accent-soft font-bold text-accent">{a.name[0]}</span>}
                <div className="min-w-0 flex-1"><p className="font-semibold">{a.name}</p><p className="truncate text-xs text-muted">{a.title}</p></div>
                <button type="button" className="btn-ghost px-3 py-1.5 text-xs" onClick={() => setEdit({ ...a, title: a.title ?? '', bio: a.bio ?? '', avatar_url: a.avatar_url ?? '', website: a.website ?? '' })}>Edit</button>
                <button type="button" className="text-muted hover:text-red-500" onClick={() => remove(a)} aria-label="Delete"><I n="trash" s={15} /></button>
              </li>
            ))}
          </ul>
        )}
      </Panel>
      <Modal open={edit !== null} onClose={() => setEdit(null)} title={edit?.id ? 'Edit author' : 'New author'}>
        {edit && (<><SchemaForm fields={authorFields} value={edit} onChange={setEdit} /><div className="mt-6 flex justify-end gap-2"><button type="button" className="btn-ghost" onClick={() => setEdit(null)}>Cancel</button><button type="button" className="btn-primary" onClick={save}>Save</button></div></>)}
      </Modal>
    </div>
  );
}

/* ======================= Comments moderation ======================= */
type CommentRow = { id: string; post_id: string; parent_id: string | null; name: string; email: string; body: string; status: 'pending' | 'approved' | 'spam'; is_admin: boolean; created_at: string; post: { title: string; slug: string } | null };

export function BlogComments() {
  const toast = useToast();
  const [rows, setRows] = useState<CommentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'pending' | 'approved' | 'spam' | 'all'>('pending');
  const [reply, setReply] = useState<CommentRow | null>(null);
  const [text, setText] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await sb().from('comments').select('*,post:posts(title,slug)').order('created_at', { ascending: false });
    if (error) toast(error.message, false);
    setRows((data as never) ?? []);
    setLoading(false);
  }, [toast]);
  useEffect(() => {
    load();
  }, [load]);

  async function setStatus(c: CommentRow, status: CommentRow['status']) {
    const { error } = await sb().from('comments').update({ status }).eq('id', c.id);
    if (error) return toast(error.message, false);
    setRows((x) => x.map((r) => (r.id === c.id ? { ...r, status } : r)));
  }
  async function remove(c: CommentRow) {
    if (!confirm('Delete this comment and its replies?')) return;
    const { error } = await sb().from('comments').delete().eq('id', c.id);
    if (error) return toast(error.message, false);
    load();
  }
  async function sendReply() {
    if (!reply || !text.trim()) return;
    const { data } = await sb().auth.getUser();
    const author = (await sb().from('authors').select('name').order('created_at').limit(1)).data?.[0]?.name ?? 'Admin';
    const { error } = await sb().from('comments').insert({
      post_id: reply.post_id,
      parent_id: reply.id,
      name: author,
      email: data.user?.email ?? 'admin',
      body: text.trim(),
      status: 'approved',
      is_admin: true,
    });
    if (error) return toast(error.message, false);
    if (reply.status !== 'approved') await setStatus(reply, 'approved');
    toast('Reply posted');
    setReply(null);
    setText('');
    load();
  }

  const shown = rows.filter((r) => filter === 'all' || r.status === filter);
  const count = (s: string) => rows.filter((r) => r.status === s).length;

  return (
    <div>
      <PageTitle title="Comments" sub="Approve, reply to or remove reader comments." />
      <div className="mb-4 flex flex-wrap gap-2">
        {(['pending', 'approved', 'spam', 'all'] as const).map((s) => (
          <button key={s} type="button" onClick={() => setFilter(s)} className={`rounded-lg px-3 py-1.5 text-xs font-semibold capitalize ${filter === s ? 'bg-accent text-accent-contrast' : 'border border-line bg-surface text-muted'}`}>
            {s} <span className="opacity-70">{s === 'all' ? rows.length : count(s)}</span>
          </button>
        ))}
      </div>
      <Panel>
        {loading ? <p className="py-8 text-center text-sm text-muted">Loading…</p> : shown.length === 0 ? <Empty text={filter === 'pending' ? 'No comments waiting for approval. 🎉' : 'Nothing here.'} icon="mail" /> : (
          <ul className="divide-y divide-line">
            {shown.map((c) => (
              <li key={c.id} className="py-4">
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <span className="font-semibold">{c.name}</span>
                  {c.is_admin && <span className="rounded bg-accent px-1.5 text-[10px] font-bold text-accent-contrast">YOU</span>}
                  <a href={`mailto:${c.email}`} className="text-xs text-muted hover:text-accent">{c.email}</a>
                  <span className="text-xs text-muted">· {new Date(c.created_at).toLocaleString()}</span>
                  {c.parent_id && <span className="text-xs text-muted">· reply</span>}
                  <span className={`ml-auto rounded-md px-2 py-0.5 text-xs font-semibold capitalize ${c.status === 'approved' ? 'bg-accent-soft text-accent' : c.status === 'spam' ? 'bg-red-500/15 text-red-500' : 'bg-yellow-500/15 text-yellow-600 dark:text-yellow-400'}`}>{c.status}</span>
                </div>
                <p className="mt-2 text-sm whitespace-pre-wrap">{c.body}</p>
                <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                  {c.post && <a href={`/blog/${c.post.slug}#comments`} target="_blank" className="text-muted hover:text-accent">on “{c.post.title}”</a>}
                  <span className="ml-auto flex gap-1.5">
                    {c.status !== 'approved' && <button type="button" onClick={() => setStatus(c, 'approved')} className="btn-primary px-2.5 py-1 text-xs">Approve</button>}
                    {c.status === 'approved' && <button type="button" onClick={() => setStatus(c, 'pending')} className="btn-ghost px-2.5 py-1 text-xs">Unapprove</button>}
                    <button type="button" onClick={() => { setReply(c); setText(''); }} className="btn-ghost px-2.5 py-1 text-xs">Reply</button>
                    {c.status !== 'spam' && <button type="button" onClick={() => setStatus(c, 'spam')} className="btn-ghost px-2.5 py-1 text-xs">Spam</button>}
                    <button type="button" onClick={() => remove(c)} className="btn-ghost px-2.5 py-1 text-xs text-red-500">Delete</button>
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Panel>
      <Modal open={reply !== null} onClose={() => setReply(null)} title={`Reply to ${reply?.name ?? ''}`}>
        {reply && (
          <div className="grid gap-3">
            <p className="rounded-xl bg-surface-2 p-3 text-sm text-muted whitespace-pre-wrap">{reply.body}</p>
            <textarea value={text} onChange={(e) => setText(e.target.value)} rows={4} className="input" placeholder="Your reply…" autoFocus />
            <p className="text-xs text-muted">Your reply is published immediately (and approves the original comment).</p>
            <div className="flex justify-end gap-2"><button type="button" className="btn-ghost" onClick={() => setReply(null)}>Cancel</button><button type="button" className="btn-primary" onClick={sendReply}>Post reply</button></div>
          </div>
        )}
      </Modal>
    </div>
  );
}
