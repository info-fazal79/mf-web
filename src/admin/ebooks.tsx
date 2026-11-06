import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { MarkdownEditor, slugify } from './blog';
import { SchemaForm, type Field } from './SchemaForm';
import { Empty, I, ImageField, Modal, PageTitle, Panel, TagsField, Toggle, useToast } from './ui';

type Obj = Record<string, unknown>;
type Access = 'free_read' | 'free_download' | 'email' | 'whatsapp' | 'paid';
type Book = {
  id?: string;
  title: string;
  slug: string;
  subtitle: string;
  description: string;
  cover_url: string;
  category_id: string | null;
  author_name: string;
  language: string;
  pages: number | null;
  format: 'native' | 'pdf' | 'both';
  pdf_path: string | null;
  access_mode: Access;
  allow_download: boolean;
  price: number;
  sale_price: number | null;
  whatsapp_url: string;
  tags: string[];
  featured: boolean;
  status: 'draft' | 'published';
  sort_order: number;
  published_at: string | null;
  seo_title: string;
  seo_description: string;
  views?: number;
};
type Chapter = { id: string; ebook_id: string; title: string; content: string; position: number; is_preview: boolean };
type Cat = { id: string; name: string; slug: string; sort_order: number };

const sb = () => supabase!;
const taka = (n: number) => `৳${n}`;
const blank: Book = {
  title: '', slug: '', subtitle: '', description: '', cover_url: '', category_id: null, author_name: 'Muhammad Fazal', language: 'Bangla', pages: null,
  format: 'native', pdf_path: null, access_mode: 'free_read', allow_download: false, price: 0, sale_price: null, whatsapp_url: '', tags: [],
  featured: false, status: 'draft', sort_order: 0, published_at: null, seo_title: '', seo_description: '',
};
const ACCESS: { v: Access; label: string; help: string }[] = [
  { v: 'free_read', label: 'Free · read online only', help: 'Anyone can read in the online reader. No download button.' },
  { v: 'free_download', label: 'Free · read + download', help: 'Anyone can read online and download the PDF.' },
  { v: 'email', label: 'Free with email', help: 'Visitors leave their email (added to subscribers) to unlock reading and download.' },
  { v: 'whatsapp', label: 'Free via WhatsApp', help: 'Shows a "Join WhatsApp group" button. The book is shared there, not on the site.' },
  { v: 'paid', label: 'Paid', help: 'Buyers unlock it in their library. Chapters marked "Free preview" stay readable for everyone.' },
];

/* ======================= Router ======================= */
export function Ebooks({ go, editId }: { go: (r: string) => void; editId?: string }) {
  if (editId) return <EbookEditor id={editId === 'new' ? null : editId} go={go} />;
  return <EbookList go={go} />;
}

/* ======================= List ======================= */
function EbookList({ go }: { go: (r: string) => void }) {
  const toast = useToast();
  const [rows, setRows] = useState<(Book & { chapters: { count: number }[]; library: { count: number }[] })[]>([]);
  const [loading, setLoading] = useState(true);
  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await sb().from('ebooks').select('*,chapters:ebook_chapters(count),library:ebook_library(count)').order('sort_order').order('created_at', { ascending: false });
    if (error) toast(error.message, false);
    setRows((data as never) ?? []);
    setLoading(false);
  }, [toast]);
  useEffect(() => {
    load();
  }, [load]);

  async function move(i: number, d: number) {
    const list = [...rows];
    const j = i + d;
    if (j < 0 || j >= list.length) return;
    [list[i], list[j]] = [list[j], list[i]];
    await Promise.all(list.map((b, k) => sb().from('ebooks').update({ sort_order: k }).eq('id', b.id!)));
    load();
  }
  async function remove(b: Book) {
    if (!confirm(`Delete "${b.title}", its chapters, reviews and reader data? This cannot be undone.`)) return;
    if (b.pdf_path) await sb().storage.from('ebooks').remove([b.pdf_path]);
    const { error } = await sb().from('ebooks').delete().eq('id', b.id!);
    if (error) return toast(error.message, false);
    load();
  }

  return (
    <div>
      <PageTitle title="E-books" sub="Write, upload and sell your e-books." actions={<button type="button" className="btn-primary" onClick={() => go('ebooks/new')}><I n="plus" s={15} /> New e-book</button>} />
      <Panel>
        {loading ? <p className="py-8 text-center text-sm text-muted">Loading…</p> : rows.length === 0 ? <Empty text="No e-books yet. Create your first one!" icon="file" /> : (
          <ul className="divide-y divide-line">
            {rows.map((b, i) => (
              <li key={b.id} className="flex items-center gap-3 py-3">
                <div className="grid gap-0.5">
                  <button type="button" onClick={() => move(i, -1)} className="grid h-5 w-6 place-items-center text-muted hover:text-fg" aria-label="Move up"><I n="up" s={14} /></button>
                  <button type="button" onClick={() => move(i, 1)} className="grid h-5 w-6 place-items-center text-muted hover:text-fg" aria-label="Move down"><I n="down" s={14} /></button>
                </div>
                <div className="h-14 w-10 shrink-0 overflow-hidden rounded border border-line bg-surface-2">{b.cover_url && <img src={b.cover_url} alt="" className="h-full w-full object-cover" />}</div>
                <div className="min-w-0 flex-1">
                  <button type="button" onClick={() => go(`ebooks/${b.id}`)} className="text-left font-semibold hover:text-accent">{b.title}</button>
                  <p className="text-xs text-muted">
                    {ACCESS.find((a) => a.v === b.access_mode)?.label}{b.access_mode === 'paid' ? ` · ${taka(Number(b.sale_price ?? b.price))}` : ''} · {b.chapters?.[0]?.count ?? 0} chapters{b.pdf_path ? ' · PDF' : ''} · {b.library?.[0]?.count ?? 0} readers · {b.views ?? 0} views
                  </p>
                </div>
                {b.featured && <span className="text-accent">★</span>}
                <span className={`rounded-md px-2 py-0.5 text-xs font-semibold capitalize ${b.status === 'published' ? 'bg-accent-soft text-accent' : 'bg-surface-2 text-muted'}`}>{b.status}</span>
                {b.status === 'published' && <a href={`/ebooks/${b.slug}`} target="_blank" className="grid h-8 w-8 place-items-center rounded-lg text-muted hover:text-fg" title="View"><I n="external" s={15} /></a>}
                <button type="button" onClick={() => remove(b)} className="grid h-8 w-8 place-items-center rounded-lg text-muted hover:text-red-500" title="Delete"><I n="trash" s={15} /></button>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}

/* ======================= Editor ======================= */
function EbookEditor({ id, go }: { id: string | null; go: (r: string) => void }) {
  const toast = useToast();
  const [b, setB] = useState<Book>(blank);
  const [saved, setSaved] = useState(JSON.stringify(blank));
  const [slugTouched, setSlugTouched] = useState(false);
  const [cats, setCats] = useState<Cat[]>([]);
  const [tab, setTab] = useState<'details' | 'chapters' | 'pdf' | 'access'>('details');

  useEffect(() => {
    sb().from('ebook_categories').select('*').order('sort_order').then(({ data }) => setCats((data as Cat[]) ?? []));
    if (!id) return;
    sb().from('ebooks').select('*').eq('id', id).single().then(({ data, error }) => {
      if (error) {
        toast(error.message, false);
        return go('ebooks');
      }
      const clean = Object.fromEntries(Object.entries({ ...blank, ...data }).map(([k, v]) => [k, v === null && typeof (blank as Obj)[k] === 'string' ? '' : v])) as Book;
      clean.price = Number(clean.price);
      clean.sale_price = clean.sale_price == null ? null : Number(clean.sale_price);
      setB(clean);
      setSaved(JSON.stringify(clean));
      setSlugTouched(true);
    });
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  const set = <K extends keyof Book>(k: K, v: Book[K]) => setB((x) => ({ ...x, [k]: v }));
  const dirty = JSON.stringify(b) !== saved;

  async function save(status?: 'draft' | 'published') {
    const next = { ...b, status: status ?? b.status, slug: slugify(b.slug || b.title) };
    if (!next.title.trim()) return toast('Add a title first', false);
    if (next.access_mode === 'paid' && !(next.price > 0)) return toast('Set a price for a paid e-book', false);
    if (next.status === 'published') next.published_at ??= new Date().toISOString();
    const { id: bid, views, ...row } = next;
    void views;
    const nul = (s: string) => (s.trim() ? s.trim() : null);
    const payload = { ...row, subtitle: nul(row.subtitle), cover_url: nul(row.cover_url), whatsapp_url: nul(row.whatsapp_url), seo_title: nul(row.seo_title), seo_description: nul(row.seo_description), sale_price: row.sale_price || null };
    const res = bid ? await sb().from('ebooks').update(payload).eq('id', bid).select().single() : await sb().from('ebooks').insert(payload).select().single();
    if (res.error) return toast(res.error.code === '23505' ? 'Another e-book already uses this URL slug.' : res.error.message, false);
    const done = { ...next, id: res.data.id };
    setB(done);
    setSaved(JSON.stringify(done));
    toast(done.status === 'published' ? 'Published' : 'Saved');
    if (!bid) go(`ebooks/${res.data.id}`);
  }

  const access = ACCESS.find((a) => a.v === b.access_mode)!;

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <button type="button" onClick={() => (!dirty || confirm('Discard unsaved changes?')) && go('ebooks')} className="btn-ghost px-3 py-1.5 text-xs">← All e-books</button>
        <span className="text-sm text-muted">{id ? 'Edit e-book' : 'New e-book'}</span>
        {dirty && <span className="text-xs text-yellow-600 dark:text-yellow-400">● unsaved</span>}
        <span className="ml-auto flex gap-2">
          {b.id && <a href={`/read?book=${b.slug}`} target="_blank" className="btn-ghost"><I n="eye" s={15} /> Open reader</a>}
          {b.status === 'published' ? (
            <>
              <button type="button" className="btn-ghost" onClick={() => save('draft')}>Unpublish</button>
              <button type="button" className="btn-primary" disabled={!dirty} onClick={() => save()}><I n="check" s={15} /> {dirty ? 'Update' : 'Saved'}</button>
            </>
          ) : (
            <>
              <button type="button" className="btn-ghost" onClick={() => save('draft')}>{b.id ? 'Save draft' : 'Create e-book'}</button>
              {b.id && <button type="button" className="btn-primary" onClick={() => save('published')}><I n="check" s={15} /> Publish</button>}
            </>
          )}
        </span>
      </div>

      <input value={b.title} onChange={(e) => { set('title', e.target.value); if (!slugTouched) set('slug', slugify(e.target.value)); }} placeholder="E-book title" className="w-full bg-transparent text-3xl font-extrabold tracking-tight outline-none placeholder:text-muted/50" />
      <div className="mt-2 flex items-center gap-1 font-mono text-xs text-muted">
        <span>/ebooks/</span>
        <input value={b.slug} onChange={(e) => { setSlugTouched(true); set('slug', e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-')); }} className="flex-1 rounded-md border border-transparent bg-transparent px-1 py-0.5 text-fg outline-none hover:border-line focus:border-accent" />
      </div>

      <div className="mt-5 mb-5 inline-flex flex-wrap rounded-xl border border-line bg-surface p-1">
        {(
          [
            ['details', 'Details & pricing'],
            ['chapters', 'Chapters'],
            ['pdf', 'PDF file'],
            ['access', 'Readers & leads'],
          ] as const
        ).map(([k, l]) => (
          <button key={k} type="button" disabled={!b.id && k !== 'details'} onClick={() => setTab(k)} className={`rounded-lg px-4 py-1.5 text-sm font-semibold transition disabled:opacity-40 ${tab === k ? 'bg-accent text-accent-contrast' : 'text-muted hover:text-fg'}`}>
            {l}
          </button>
        ))}
      </div>
      {!b.id && <p className="mb-4 text-sm text-muted">Fill in the details and click <strong>Create e-book</strong> to unlock chapters, PDF upload and readers.</p>}

      {tab === 'details' && (
        <div className="grid gap-6 xl:grid-cols-[1fr_340px]">
          <div className="grid min-w-0 content-start gap-5">
            <input value={b.subtitle} onChange={(e) => set('subtitle', e.target.value)} placeholder="Subtitle (one line)" className="input" />
            <Panel title="How readers get this e-book">
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {ACCESS.map((a) => (
                  <button key={a.v} type="button" onClick={() => set('access_mode', a.v)} className={`rounded-xl border px-3 py-3 text-left text-sm font-semibold transition ${b.access_mode === a.v ? 'border-accent bg-accent-soft text-accent' : 'border-line text-muted hover:border-accent'}`}>
                    {a.label}
                  </button>
                ))}
              </div>
              <p className="mt-3 text-xs text-muted">{access.help}</p>
              {b.access_mode === 'paid' && (
                <div className="mt-4 grid gap-4 sm:grid-cols-3">
                  <div><label className="label" htmlFor="eb-price">Price (৳)</label><input id="eb-price" type="number" min={0} value={b.price} onChange={(e) => set('price', e.target.valueAsNumber || 0)} className="input" /></div>
                  <div><label className="label" htmlFor="eb-sale">Sale price (৳, optional)</label><input id="eb-sale" type="number" min={0} value={b.sale_price ?? ''} onChange={(e) => set('sale_price', e.target.value === '' ? null : e.target.valueAsNumber)} className="input" /></div>
                  <div className="pt-6"><Toggle checked={b.allow_download} onChange={(v) => set('allow_download', v)} label="Buyers can download PDF" /></div>
                </div>
              )}
              {b.access_mode === 'whatsapp' && (
                <div className="mt-4"><label className="label" htmlFor="eb-wa">WhatsApp group link</label><input id="eb-wa" value={b.whatsapp_url} onChange={(e) => set('whatsapp_url', e.target.value)} placeholder="https://chat.whatsapp.com/…" className="input" /></div>
              )}
            </Panel>
            <div>
              <span className="label">Description (shown on the e-book page, Markdown)</span>
              <MarkdownEditor value={b.description} onChange={(v) => set('description', v)} />
            </div>
          </div>
          <aside className="grid content-start gap-4">
            <Panel title="Cover"><ImageField value={b.cover_url} onChange={(v) => set('cover_url', v)} /><p className="mt-2 text-xs text-muted">Portrait 3:4, e.g. 900×1200 px.</p></Panel>
            <Panel title="Details">
              <div className="grid gap-4">
                <div>
                  <label className="label" htmlFor="eb-cat">Category</label>
                  <select id="eb-cat" value={b.category_id ?? ''} onChange={(e) => set('category_id', e.target.value || null)} className="input">
                    <option value="">— None —</option>
                    {cats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label" htmlFor="eb-format">Format</label>
                  <select id="eb-format" value={b.format} onChange={(e) => set('format', e.target.value as Book['format'])} className="input">
                    <option value="native">Online book (chapters)</option>
                    <option value="pdf">PDF</option>
                    <option value="both">Both</option>
                  </select>
                </div>
                <div><label className="label" htmlFor="eb-author">Author</label><input id="eb-author" value={b.author_name} onChange={(e) => set('author_name', e.target.value)} className="input" /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="label" htmlFor="eb-lang">Language</label>
                    <select id="eb-lang" value={b.language} onChange={(e) => set('language', e.target.value)} className="input"><option>Bangla</option><option>English</option><option>Bangla & English</option></select>
                  </div>
                  <div><label className="label" htmlFor="eb-pages">Pages</label><input id="eb-pages" type="number" min={0} value={b.pages ?? ''} onChange={(e) => set('pages', e.target.value === '' ? null : e.target.valueAsNumber)} className="input" /></div>
                </div>
                <div><span className="label">Tags</span><TagsField value={b.tags} onChange={(v) => set('tags', v)} /></div>
                <Toggle checked={b.featured} onChange={(v) => set('featured', v)} label="Featured" />
              </div>
            </Panel>
            <Panel title="SEO">
              <div className="grid gap-3">
                <input value={b.seo_title} onChange={(e) => set('seo_title', e.target.value)} placeholder={b.title || 'SEO title'} className="input" aria-label="SEO title" />
                <textarea value={b.seo_description} onChange={(e) => set('seo_description', e.target.value)} rows={3} placeholder="Meta description" className="input resize-y" aria-label="Meta description" />
              </div>
            </Panel>
          </aside>
        </div>
      )}

      {tab === 'chapters' && b.id && <ChaptersTab ebookId={b.id} paid={b.access_mode === 'paid'} />}
      {tab === 'pdf' && b.id && <PdfTab book={b} onChange={(path) => { set('pdf_path', path); setSaved((s) => JSON.stringify({ ...JSON.parse(s), pdf_path: path })); }} />}
      {tab === 'access' && b.id && <AccessTab ebookId={b.id} />}
    </div>
  );
}

/* ---------------- Chapters ---------------- */
function ChaptersTab({ ebookId, paid }: { ebookId: string; paid: boolean }) {
  const toast = useToast();
  const [rows, setRows] = useState<Chapter[]>([]);
  const [edit, setEdit] = useState<Chapter | null>(null);
  const [importing, setImporting] = useState(false);
  const [bulk, setBulk] = useState('');

  const load = useCallback(async () => {
    const { data, error } = await sb().from('ebook_chapters').select('*').eq('ebook_id', ebookId).order('position');
    if (error) toast(error.message, false);
    setRows((data as Chapter[]) ?? []);
  }, [ebookId, toast]);
  useEffect(() => {
    load();
  }, [load]);

  async function add() {
    const { data, error } = await sb().from('ebook_chapters').insert({ ebook_id: ebookId, title: `Chapter ${rows.length + 1}`, content: '', position: rows.length, is_preview: rows.length === 0 }).select().single();
    if (error) return toast(error.message, false);
    setRows((x) => [...x, data as Chapter]);
    setEdit(data as Chapter);
  }
  async function saveChapter(c: Chapter) {
    const { error } = await sb().from('ebook_chapters').update({ title: c.title, content: c.content, is_preview: c.is_preview }).eq('id', c.id);
    if (error) return toast(error.message, false);
    setRows((x) => x.map((r) => (r.id === c.id ? c : r)));
    toast('Chapter saved');
  }
  async function move(i: number, d: number) {
    const list = [...rows];
    const j = i + d;
    if (j < 0 || j >= list.length) return;
    [list[i], list[j]] = [list[j], list[i]];
    setRows(list.map((c, k) => ({ ...c, position: k })));
    await Promise.all(list.map((c, k) => sb().from('ebook_chapters').update({ position: k }).eq('id', c.id)));
  }
  async function remove(c: Chapter) {
    if (!confirm(`Delete "${c.title}"?`)) return;
    await sb().from('ebook_chapters').delete().eq('id', c.id);
    const rest = rows.filter((r) => r.id !== c.id);
    setRows(rest);
    await Promise.all(rest.map((r, k) => (r.position !== k ? sb().from('ebook_chapters').update({ position: k }).eq('id', r.id) : null)));
  }
  async function togglePreview(c: Chapter) {
    await sb().from('ebook_chapters').update({ is_preview: !c.is_preview }).eq('id', c.id);
    setRows((x) => x.map((r) => (r.id === c.id ? { ...r, is_preview: !c.is_preview } : r)));
  }
  async function importBook() {
    const parts = bulk.split(/^#\s+/m).map((s) => s.trim()).filter(Boolean);
    if (!parts.length) return toast('Nothing to import. Start each chapter with "# Chapter title".', false);
    const start = rows.length;
    const items = parts.map((p, i) => {
      const [first, ...rest] = p.split('\n');
      return { ebook_id: ebookId, title: first.trim(), content: rest.join('\n').trim(), position: start + i, is_preview: start + i === 0 };
    });
    const { error } = await sb().from('ebook_chapters').insert(items);
    if (error) return toast(error.message, false);
    toast(`Imported ${items.length} chapters`);
    setBulk('');
    setImporting(false);
    load();
  }

  const words = rows.reduce((a, c) => a + c.content.split(/\s+/).filter(Boolean).length, 0);
  return (
    <div>
      <Panel>
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <p className="text-sm text-muted">{rows.length} chapters · {words.toLocaleString()} words · ~{Math.max(1, Math.round(words / 230))} min read</p>
          <span className="ml-auto flex gap-2">
            <button type="button" className="btn-ghost px-3 py-1.5 text-xs" onClick={() => setImporting(true)}><I n="upload" s={14} /> Import from Markdown</button>
            <button type="button" className="btn-primary px-3 py-1.5 text-xs" onClick={add}><I n="plus" s={14} /> Add chapter</button>
          </span>
        </div>
        {paid && <p className="mb-3 rounded-lg bg-accent-soft px-3 py-2 text-xs text-accent">Chapters marked <strong>Free preview</strong> can be read by everyone as a sample. The rest unlock after purchase.</p>}
        {rows.length === 0 ? <Empty text="No chapters yet. Add one or import a whole book." icon="file" /> : (
          <ol className="divide-y divide-line">
            {rows.map((c, i) => (
              <li key={c.id} className="flex items-center gap-3 py-2.5">
                <span className="w-6 text-center font-mono text-xs text-muted">{i + 1}</span>
                <div className="grid gap-0.5">
                  <button type="button" onClick={() => move(i, -1)} className="grid h-4 w-5 place-items-center text-muted hover:text-fg" aria-label="Move up"><I n="up" s={13} /></button>
                  <button type="button" onClick={() => move(i, 1)} className="grid h-4 w-5 place-items-center text-muted hover:text-fg" aria-label="Move down"><I n="down" s={13} /></button>
                </div>
                <button type="button" onClick={() => setEdit(c)} className="min-w-0 flex-1 text-left">
                  <p className="truncate text-sm font-semibold hover:text-accent">{c.title}</p>
                  <p className="text-xs text-muted">{c.content.split(/\s+/).filter(Boolean).length} words</p>
                </button>
                <button type="button" onClick={() => togglePreview(c)} className={`rounded-md px-2 py-0.5 text-xs font-semibold ${c.is_preview ? 'bg-accent-soft text-accent' : 'border border-line text-muted'}`}>{c.is_preview ? 'Free preview' : 'Set as preview'}</button>
                <button type="button" onClick={() => remove(c)} className="text-muted hover:text-red-500" aria-label="Delete"><I n="trash" s={15} /></button>
              </li>
            ))}
          </ol>
        )}
      </Panel>

      <Modal open={edit !== null} onClose={() => setEdit(null)} title="Edit chapter" wide>
        {edit && (
          <div className="grid gap-4">
            <div className="flex flex-wrap items-center gap-3">
              <input value={edit.title} onChange={(e) => setEdit({ ...edit, title: e.target.value })} className="input flex-1 text-lg font-semibold" aria-label="Chapter title" />
              <Toggle checked={edit.is_preview} onChange={(v) => setEdit({ ...edit, is_preview: v })} label="Free preview" />
            </div>
            <MarkdownEditor value={edit.content} onChange={(v) => setEdit({ ...edit, content: v })} />
            <div className="flex justify-end gap-2">
              <button type="button" className="btn-ghost" onClick={() => setEdit(null)}>Close</button>
              <button type="button" className="btn-primary" onClick={() => saveChapter(edit)}><I n="check" s={15} /> Save chapter</button>
            </div>
          </div>
        )}
      </Modal>

      <Modal open={importing} onClose={() => setImporting(false)} title="Import chapters from Markdown" wide>
        <p className="mb-3 text-sm text-muted">Paste your whole book. Every line starting with <code className="rounded bg-surface-2 px-1">#&nbsp;</code> begins a new chapter (the rest of that line is its title). Use <code className="rounded bg-surface-2 px-1">##</code> for headings inside a chapter.</p>
        <textarea value={bulk} onChange={(e) => setBulk(e.target.value)} rows={16} className="input font-mono text-xs" placeholder={'# Introduction\nWelcome to the book…\n\n# Chapter 1: Getting started\n## Opening Excel\n…'} />
        <div className="mt-4 flex items-center justify-between">
          <span className="text-xs text-muted">{bulk.split(/^#\s+/m).filter((s) => s.trim()).length} chapters detected</span>
          <button type="button" className="btn-primary" onClick={importBook}>Import chapters</button>
        </div>
      </Modal>
    </div>
  );
}

/* ---------------- PDF ---------------- */
function PdfTab({ book, onChange }: { book: Book; onChange: (path: string | null) => void }) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  async function upload(file: File) {
    if (file.type !== 'application/pdf') return toast('Please choose a PDF file', false);
    if (file.size > 50 * 1024 * 1024) return toast('PDF must be under 50 MB on the free plan', false);
    setBusy(true);
    const path = `${book.id}/${slugify(book.slug || book.title) || 'book'}-${Date.now()}.pdf`;
    const up = await sb().storage.from('ebooks').upload(path, file, { contentType: 'application/pdf', upsert: false });
    if (up.error) {
      setBusy(false);
      return toast(up.error.message, false);
    }
    if (book.pdf_path) await sb().storage.from('ebooks').remove([book.pdf_path]);
    const { error } = await sb().from('ebooks').update({ pdf_path: path }).eq('id', book.id!);
    setBusy(false);
    if (error) return toast(error.message, false);
    onChange(path);
    toast('PDF uploaded');
  }
  async function removePdf() {
    if (!book.pdf_path || !confirm('Remove the PDF file?')) return;
    await sb().storage.from('ebooks').remove([book.pdf_path]);
    await sb().from('ebooks').update({ pdf_path: null }).eq('id', book.id!);
    onChange(null);
  }
  async function preview() {
    const { data, error } = await sb().storage.from('ebooks').createSignedUrl(book.pdf_path!, 300);
    if (error || !data) return toast(error?.message ?? 'Could not open the file', false);
    window.open(data.signedUrl, '_blank');
  }

  return (
    <Panel>
      <p className="mb-4 text-sm text-muted">PDFs are stored privately. Readers only get a short-lived link when they are allowed to read ({ACCESS.find((a) => a.v === book.access_mode)?.label}).</p>
      {book.pdf_path ? (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-line bg-surface-2 p-4">
          <I n="file" s={22} className="text-accent" />
          <span className="min-w-0 flex-1 truncate font-mono text-xs">{book.pdf_path.split('/').pop()}</span>
          <button type="button" className="btn-ghost px-3 py-1.5 text-xs" onClick={preview}>Preview</button>
          <button type="button" className="btn-ghost px-3 py-1.5 text-xs" onClick={() => input.current?.click()} disabled={busy}>Replace</button>
          <button type="button" className="btn-ghost px-3 py-1.5 text-xs text-red-500" onClick={removePdf}>Remove</button>
        </div>
      ) : (
        <button type="button" onClick={() => input.current?.click()} disabled={busy} className="grid w-full place-items-center gap-2 rounded-2xl border-2 border-dashed border-line px-4 py-12 text-center transition hover:border-accent">
          <I n="upload" s={26} className="text-accent" />
          <span className="text-sm font-semibold">{busy ? 'Uploading…' : 'Upload PDF'}</span>
          <span className="text-xs text-muted">Max 50 MB</span>
        </button>
      )}
      <input ref={input} type="file" accept="application/pdf" className="hidden" onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
      {book.format === 'native' && <p className="mt-3 text-xs text-yellow-600 dark:text-yellow-400">Format is set to "Online book". Switch to "PDF" or "Both" in Details so readers can open the PDF.</p>}
    </Panel>
  );
}

/* ---------------- Readers (library) & email leads ---------------- */
function AccessTab({ ebookId }: { ebookId: string }) {
  const toast = useToast();
  const [readers, setReaders] = useState<{ user_id: string; source: string; granted_at: string; email?: string }[]>([]);
  const [leads, setLeads] = useState<{ id: string; name: string | null; email: string; created_at: string }[]>([]);
  const [email, setEmail] = useState('');

  const load = useCallback(async () => {
    const [{ data: lib }, { data: ld }] = await Promise.all([
      sb().from('ebook_library').select('user_id,source,granted_at').eq('ebook_id', ebookId).order('granted_at', { ascending: false }),
      sb().from('ebook_leads').select('id,name,email,created_at').eq('ebook_id', ebookId).order('created_at', { ascending: false }),
    ]);
    const rows = (lib as { user_id: string; source: string; granted_at: string }[]) ?? [];
    if (rows.length) {
      const { data: profs } = await sb().from('profiles').select('id,email').in('id', rows.map((r) => r.user_id));
      const map = new Map(((profs as { id: string; email: string }[]) ?? []).map((p) => [p.id, p.email]));
      setReaders(rows.map((r) => ({ ...r, email: map.get(r.user_id) })));
    } else setReaders([]);
    setLeads((ld as never) ?? []);
  }, [ebookId]);
  useEffect(() => {
    load();
  }, [load]);

  async function grant() {
    const e = email.trim().toLowerCase();
    if (!e) return;
    const { data: prof } = await sb().from('profiles').select('id').eq('email', e).maybeSingle();
    if (!prof) return toast('No account with that email. Ask the reader to create an account first.', false);
    const { error } = await sb().from('ebook_library').upsert({ user_id: prof.id, ebook_id: ebookId, source: 'admin' });
    if (error) return toast(error.message, false);
    toast('Access granted');
    setEmail('');
    load();
  }
  async function revoke(uid: string) {
    if (!confirm('Remove this reader’s access?')) return;
    await sb().from('ebook_library').delete().eq('user_id', uid).eq('ebook_id', ebookId);
    load();
  }
  function exportLeads() {
    const csv = ['name,email,date', ...leads.map((l) => [l.name ?? '', l.email, l.created_at].join(','))].join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    a.download = 'ebook-leads.csv';
    a.click();
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Panel title={`Readers with access (${readers.length})`}>
        <div className="mb-4 flex gap-2">
          <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="reader@email.com" type="email" className="input" />
          <button type="button" className="btn-primary shrink-0" onClick={grant}>Grant access</button>
        </div>
        <p className="mb-3 text-xs text-muted">Use this for manual bKash/Nagad payments or gifts. The reader must have an account.</p>
        {readers.length === 0 ? <Empty text="No readers yet." icon="users" /> : (
          <ul className="divide-y divide-line text-sm">
            {readers.map((r) => (
              <li key={r.user_id} className="flex items-center gap-3 py-2.5">
                <span className="min-w-0 flex-1 truncate">{r.email ?? r.user_id}</span>
                <span className="rounded bg-surface-2 px-1.5 py-0.5 text-xs capitalize">{r.source}</span>
                <span className="font-mono text-xs text-muted">{new Date(r.granted_at).toLocaleDateString()}</span>
                <button type="button" onClick={() => revoke(r.user_id)} className="text-muted hover:text-red-500" aria-label="Revoke"><I n="trash" s={14} /></button>
              </li>
            ))}
          </ul>
        )}
      </Panel>
      <Panel title={`Email leads (${leads.length})`}>
        {leads.length > 0 && <button type="button" className="btn-ghost mb-3 px-3 py-1.5 text-xs" onClick={exportLeads}><I n="file" s={14} /> Export CSV</button>}
        {leads.length === 0 ? <Empty text="No email sign-ups for this book yet." icon="mail" /> : (
          <ul className="divide-y divide-line text-sm">
            {leads.map((l) => (
              <li key={l.id} className="flex items-center gap-3 py-2.5">
                <span className="min-w-0 flex-1 truncate">{l.name ? `${l.name} · ` : ''}{l.email}</span>
                <span className="font-mono text-xs text-muted">{new Date(l.created_at).toLocaleDateString()}</span>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}

/* ======================= Reviews moderation ======================= */
export function EbookReviewsAdmin() {
  const toast = useToast();
  const [rows, setRows] = useState<{ id: string; name: string; rating: number; body: string | null; status: string; created_at: string; ebook: { title: string; slug: string } | null }[]>([]);
  const [filter, setFilter] = useState('pending');
  const load = useCallback(async () => {
    const { data, error } = await sb().from('ebook_reviews').select('id,name,rating,body,status,created_at,ebook:ebooks(title,slug)').order('created_at', { ascending: false });
    if (error) toast(error.message, false);
    setRows((data as never) ?? []);
  }, [toast]);
  useEffect(() => {
    load();
  }, [load]);
  async function setStatus(id: string, status: string) {
    await sb().from('ebook_reviews').update({ status }).eq('id', id);
    setRows((x) => x.map((r) => (r.id === id ? { ...r, status } : r)));
  }
  async function remove(id: string) {
    if (!confirm('Delete this review?')) return;
    await sb().from('ebook_reviews').delete().eq('id', id);
    setRows((x) => x.filter((r) => r.id !== id));
  }
  const shown = rows.filter((r) => filter === 'all' || r.status === filter);
  return (
    <div>
      <PageTitle title="E-book reviews" sub="Approve reader reviews before they appear." />
      <div className="mb-4 flex gap-2">
        {['pending', 'approved', 'rejected', 'all'].map((s) => (
          <button key={s} type="button" onClick={() => setFilter(s)} className={`rounded-lg px-3 py-1.5 text-xs font-semibold capitalize ${filter === s ? 'bg-accent text-accent-contrast' : 'border border-line bg-surface text-muted'}`}>
            {s} <span className="opacity-70">{s === 'all' ? rows.length : rows.filter((r) => r.status === s).length}</span>
          </button>
        ))}
      </div>
      <Panel>
        {shown.length === 0 ? <Empty text="Nothing here." icon="quote" /> : (
          <ul className="divide-y divide-line">
            {shown.map((r) => (
              <li key={r.id} className="py-4">
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <span className="font-semibold">{r.name}</span>
                  <span className="text-yellow-500">{'★'.repeat(r.rating)}{'☆'.repeat(5 - r.rating)}</span>
                  {r.ebook && <a href={`/ebooks/${r.ebook.slug}`} target="_blank" className="text-xs text-muted hover:text-accent">on “{r.ebook.title}”</a>}
                  <span className="ml-auto text-xs text-muted">{new Date(r.created_at).toLocaleDateString()}</span>
                </div>
                {r.body && <p className="mt-2 text-sm whitespace-pre-line">{r.body}</p>}
                <div className="mt-2 flex gap-1.5">
                  {r.status !== 'approved' && <button type="button" className="btn-primary px-2.5 py-1 text-xs" onClick={() => setStatus(r.id, 'approved')}>Approve</button>}
                  {r.status !== 'rejected' && <button type="button" className="btn-ghost px-2.5 py-1 text-xs" onClick={() => setStatus(r.id, 'rejected')}>Reject</button>}
                  <button type="button" className="btn-ghost px-2.5 py-1 text-xs text-red-500" onClick={() => remove(r.id)}>Delete</button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}

/* ======================= Categories ======================= */
const catFields: Field[] = [
  { key: 'name', label: 'Name', type: 'text' },
  { key: 'slug', label: 'URL slug', type: 'text', help: 'Leave empty to generate from the name.' },
  { key: 'sort_order', label: 'Order', type: 'number' },
];
export function EbookCategories() {
  const toast = useToast();
  const [rows, setRows] = useState<Cat[]>([]);
  const [edit, setEdit] = useState<Obj | null>(null);
  const load = useCallback(() => sb().from('ebook_categories').select('*').order('sort_order').then(({ data }) => setRows((data as Cat[]) ?? [])), []);
  useEffect(() => {
    load();
  }, [load]);
  async function save() {
    if (!edit) return;
    const { id, created_at, ...row } = edit;
    void created_at;
    row.slug = slugify(String(row.slug || row.name || ''));
    if (!String(row.name ?? '').trim()) return toast('Name is required', false);
    const { error } = id ? await sb().from('ebook_categories').update(row).eq('id', id) : await sb().from('ebook_categories').insert(row);
    if (error) return toast(error.code === '23505' ? 'That slug is already used.' : error.message, false);
    setEdit(null);
    load();
  }
  async function remove(c: Cat) {
    if (!confirm(`Delete "${c.name}"?`)) return;
    await sb().from('ebook_categories').delete().eq('id', c.id);
    load();
  }
  return (
    <div>
      <PageTitle title="E-book categories" sub="Shown as a filter on the E-books page." actions={<button type="button" className="btn-primary" onClick={() => setEdit({ name: '', slug: '', sort_order: rows.length + 1 })}><I n="plus" s={15} /> Add category</button>} />
      <Panel>
        {rows.length === 0 ? <Empty text="No categories yet." /> : (
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

/* ======================= Customers ======================= */
export function Customers() {
  const [rows, setRows] = useState<{ id: string; email: string; full_name: string | null; role: string; created_at: string; books: number }[]>([]);
  const [q, setQ] = useState('');
  useEffect(() => {
    (async () => {
      const [{ data: profs }, { data: lib }] = await Promise.all([
        sb().from('profiles').select('id,email,full_name,role,created_at').order('created_at', { ascending: false }),
        sb().from('ebook_library').select('user_id'),
      ]);
      const count = new Map<string, number>();
      for (const l of (lib as { user_id: string }[]) ?? []) count.set(l.user_id, (count.get(l.user_id) ?? 0) + 1);
      setRows(((profs as never[]) ?? []).map((p: { id: string }) => ({ ...(p as object), books: count.get(p.id) ?? 0 })) as never);
    })();
  }, []);
  const shown = rows.filter((r) => !q || `${r.email} ${r.full_name ?? ''}`.toLowerCase().includes(q.toLowerCase()));
  return (
    <div>
      <PageTitle title="Customers" sub="Everyone with an account on your site." actions={<input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search…" className="input w-56" />} />
      <Panel>
        {shown.length === 0 ? <Empty text="No accounts yet." icon="users" /> : (
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-muted uppercase"><tr><th className="pb-2">Email</th><th className="pb-2">Role</th><th className="pb-2">Books</th><th className="pb-2">Joined</th></tr></thead>
            <tbody className="divide-y divide-line">
              {shown.map((r) => (
                <tr key={r.id}>
                  <td className="py-2.5">{r.email}</td>
                  <td className="capitalize">{r.role}</td>
                  <td className="font-mono">{r.books}</td>
                  <td className="font-mono text-xs text-muted">{new Date(r.created_at).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Panel>
    </div>
  );
}
