import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { embedSrc, type PreviewType } from '@/lib/projects';
import { MarkdownEditor, slugify } from './blog';
import { SchemaForm, type Field } from './SchemaForm';
import { Empty, I, ImageField, MediaLibrary, Modal, PageTitle, Panel, TagsField, Toggle, useToast } from './ui';

type Obj = Record<string, unknown>;
type Cat = { id: string; name: string; slug: string; sort_order: number };
type GalleryItem = { url: string; caption?: string };
type FileItem = { name: string; url: string };
type Project = {
  id?: string;
  title: string;
  slug: string;
  summary: string;
  content: string;
  category_id: string | null;
  cover_url: string;
  gallery: GalleryItem[];
  files: FileItem[];
  tools: string[];
  tags: string[];
  client: string;
  project_date: string;
  live_url: string;
  repo_url: string;
  preview_type: PreviewType;
  preview_url: string;
  problem: string;
  solution: string;
  results: string;
  downloads_enabled: boolean;
  featured: boolean;
  status: 'draft' | 'published';
  sort_order: number;
  seo_title: string;
  seo_description: string;
  views?: number;
};

const sb = () => supabase!;
const blank: Project = {
  title: '', slug: '', summary: '', content: '', category_id: null, cover_url: '', gallery: [], files: [], tools: [], tags: [],
  client: '', project_date: '', live_url: '', repo_url: '', preview_type: 'none', preview_url: '', problem: '', solution: '', results: '',
  downloads_enabled: false, featured: false, status: 'draft', sort_order: 0, seo_title: '', seo_description: '',
};
const PREVIEWS: { v: PreviewType; label: string; help: string }[] = [
  { v: 'none', label: 'No live preview', help: 'Only cover, gallery and description.' },
  { v: 'website', label: 'Website (iframe)', help: 'Paste the site URL. Visitors can switch desktop / tablet / mobile.' },
  { v: 'google', label: 'Google Sheets / Docs / Slides', help: 'Share the file as "Anyone with the link can view", then paste its link.' },
  { v: 'office', label: 'Word / Excel / PowerPoint file', help: 'Upload the .docx / .xlsx / .pptx to Media, then paste its link.' },
  { v: 'pdf', label: 'PDF', help: 'Upload the PDF to Media and paste its link.' },
  { v: 'video', label: 'Video (YouTube)', help: 'Paste a YouTube link for a walkthrough video.' },
  { v: 'app', label: 'Mobile app', help: 'Add screenshots to the gallery and the Play Store link as Live URL.' },
];

/* ======================= Router ======================= */
export function Projects({ go, editId }: { go: (r: string) => void; editId?: string }) {
  if (editId) return <ProjectEditor id={editId === 'new' ? null : editId} go={go} />;
  return <ProjectList go={go} />;
}

/* ======================= List ======================= */
function ProjectList({ go }: { go: (r: string) => void }) {
  const toast = useToast();
  const [rows, setRows] = useState<(Project & { category: { name: string } | null })[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('all');

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await sb().from('projects').select('id,title,slug,status,featured,views,sort_order,cover_url,preview_type,project_date,category:project_categories(name)').order('sort_order').order('created_at', { ascending: false });
    if (error) toast(error.message, false);
    setRows((data as never) ?? []);
    setLoading(false);
  }, [toast]);
  useEffect(() => {
    load();
  }, [load]);

  async function patch(p: Project, change: Partial<Project>) {
    const { error } = await sb().from('projects').update(change).eq('id', p.id!);
    if (error) return toast(error.message, false);
    load();
  }
  async function remove(p: Project) {
    if (!confirm(`Delete "${p.title}"? This cannot be undone.`)) return;
    const { error } = await sb().from('projects').delete().eq('id', p.id!);
    if (error) return toast(error.message, false);
    toast('Project deleted');
    load();
  }
  async function move(i: number, d: number) {
    const list = [...shown];
    const j = i + d;
    if (j < 0 || j >= list.length) return;
    [list[i], list[j]] = [list[j], list[i]];
    await Promise.all(list.map((p, k) => sb().from('projects').update({ sort_order: k }).eq('id', p.id!)));
    load();
  }

  const shown = rows.filter((p) => (status === 'all' || p.status === status) && (!q || p.title.toLowerCase().includes(q.toLowerCase())));

  return (
    <div>
      <PageTitle title="Projects" sub="Your portfolio: websites, sheets, Office files, apps and automations." actions={<button type="button" className="btn-primary" onClick={() => go('projects/new')}><I n="plus" s={15} /> New project</button>} />
      <Panel>
        <div className="mb-4 flex flex-wrap items-center gap-2">
          {['all', 'published', 'draft'].map((s) => (
            <button key={s} type="button" onClick={() => setStatus(s)} className={`rounded-lg px-3 py-1.5 text-xs font-semibold capitalize ${status === s ? 'bg-accent text-accent-contrast' : 'border border-line text-muted hover:text-fg'}`}>
              {s} <span className="opacity-70">{s === 'all' ? rows.length : rows.filter((r) => r.status === s).length}</span>
            </button>
          ))}
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search…" className="input ml-auto w-52 py-1.5 text-xs" />
        </div>
        {loading ? <p className="py-8 text-center text-sm text-muted">Loading…</p> : shown.length === 0 ? <Empty text={rows.length ? 'No projects match.' : 'No projects yet. Add your first one!'} icon="layers" /> : (
          <ul className="divide-y divide-line">
            {shown.map((p, i) => (
              <li key={p.id} className="flex items-center gap-3 py-3">
                <div className="grid gap-0.5">
                  <button type="button" onClick={() => move(i, -1)} className="grid h-5 w-6 place-items-center text-muted hover:text-fg" aria-label="Move up"><I n="up" s={14} /></button>
                  <button type="button" onClick={() => move(i, 1)} className="grid h-5 w-6 place-items-center text-muted hover:text-fg" aria-label="Move down"><I n="down" s={14} /></button>
                </div>
                <div className="h-12 w-16 shrink-0 overflow-hidden rounded-lg border border-line bg-surface-2">{p.cover_url && <img src={p.cover_url} alt="" className="h-full w-full object-cover" />}</div>
                <div className="min-w-0 flex-1">
                  <button type="button" onClick={() => go(`projects/${p.id}`)} className="text-left font-semibold hover:text-accent">{p.title}</button>
                  <p className="text-xs text-muted">{p.category?.name ?? 'No category'} · {PREVIEWS.find((x) => x.v === p.preview_type)?.label} · {p.views ?? 0} views</p>
                </div>
                <button type="button" title="Featured on home page" onClick={() => patch(p, { featured: !p.featured })} className={`text-lg ${p.featured ? 'text-accent' : 'text-muted/40 hover:text-muted'}`}>★</button>
                <span className={`rounded-md px-2 py-0.5 text-xs font-semibold capitalize ${p.status === 'published' ? 'bg-accent-soft text-accent' : 'bg-surface-2 text-muted'}`}>{p.status}</span>
                {p.status === 'published' && <a href={`/projects/${p.slug}`} target="_blank" className="grid h-8 w-8 place-items-center rounded-lg text-muted hover:text-fg" title="View"><I n="external" s={15} /></a>}
                <button type="button" onClick={() => remove(p)} className="grid h-8 w-8 place-items-center rounded-lg text-muted hover:text-red-500" title="Delete"><I n="trash" s={15} /></button>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}

/* ======================= Editor ======================= */
function ProjectEditor({ id, go }: { id: string | null; go: (r: string) => void }) {
  const toast = useToast();
  const [p, setP] = useState<Project>(blank);
  const [saved, setSaved] = useState(JSON.stringify(blank));
  const [slugTouched, setSlugTouched] = useState(false);
  const [loading, setLoading] = useState(Boolean(id));
  const [saving, setSaving] = useState(false);
  const [cats, setCats] = useState<Cat[]>([]);
  const [picker, setPicker] = useState<'gallery' | 'files' | null>(null);

  useEffect(() => {
    sb().from('project_categories').select('*').order('sort_order').then(({ data }) => setCats((data as Cat[]) ?? []));
    if (!id) return;
    sb().from('projects').select('*').eq('id', id).single().then(({ data, error }) => {
      if (error) {
        toast(error.message, false);
        return go('projects');
      }
      const clean = Object.fromEntries(Object.entries({ ...blank, ...data }).map(([k, v]) => [k, v === null && typeof (blank as Obj)[k] === 'string' ? '' : v])) as Project;
      setP(clean);
      setSaved(JSON.stringify(clean));
      setSlugTouched(true);
      setLoading(false);
    });
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  const set = <K extends keyof Project>(k: K, v: Project[K]) => setP((x) => ({ ...x, [k]: v }));
  const dirty = JSON.stringify(p) !== saved;

  async function save(status?: 'draft' | 'published') {
    const next = { ...p, status: status ?? p.status };
    if (!next.title.trim()) return toast('Add a title first', false);
    next.slug = slugify(next.slug || next.title);
    setSaving(true);
    const { id: pid, views, ...row } = next;
    void views;
    const nul = (s: string) => (s.trim() ? s.trim() : null);
    const payload = {
      ...row,
      summary: nul(row.summary), client: nul(row.client), project_date: row.project_date || null, live_url: nul(row.live_url), repo_url: nul(row.repo_url),
      preview_url: nul(row.preview_url), problem: nul(row.problem), solution: nul(row.solution), results: nul(row.results),
      cover_url: nul(row.cover_url), seo_title: nul(row.seo_title), seo_description: nul(row.seo_description),
      gallery: row.gallery.filter((g) => g.url), files: row.files.filter((f) => f.url),
    };
    const res = pid ? await sb().from('projects').update(payload).eq('id', pid).select().single() : await sb().from('projects').insert(payload).select().single();
    setSaving(false);
    if (res.error) return toast(res.error.code === '23505' ? 'Another project already uses this URL slug.' : res.error.message, false);
    const done = { ...next, id: res.data.id };
    setP(done);
    setSaved(JSON.stringify(done));
    toast(done.status === 'published' ? 'Published' : 'Draft saved');
    if (!pid) go(`projects/${res.data.id}`);
  }

  if (loading) return <p className="py-10 text-center text-sm text-muted">Loading…</p>;
  const preview = PREVIEWS.find((x) => x.v === p.preview_type)!;
  const src = embedSrc(p.preview_type, p.preview_url || p.live_url);

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <button type="button" onClick={() => (!dirty || confirm('Discard unsaved changes?')) && go('projects')} className="btn-ghost px-3 py-1.5 text-xs">← All projects</button>
        <span className="text-sm text-muted">{id ? 'Edit project' : 'New project'}</span>
        {dirty && <span className="text-xs text-yellow-600 dark:text-yellow-400">● unsaved</span>}
        <span className="ml-auto flex gap-2">
          {p.status === 'published' && p.id && <a href={`/projects/${p.slug}`} target="_blank" className="btn-ghost"><I n="external" s={15} /> View</a>}
          {p.status === 'published' ? (
            <>
              <button type="button" className="btn-ghost" disabled={saving} onClick={() => save('draft')}>Unpublish</button>
              <button type="button" className="btn-primary" disabled={saving || !dirty} onClick={() => save()}><I n="check" s={15} /> {dirty ? 'Update' : 'Saved'}</button>
            </>
          ) : (
            <>
              <button type="button" className="btn-ghost" disabled={saving} onClick={() => save('draft')}>Save draft</button>
              <button type="button" className="btn-primary" disabled={saving} onClick={() => save('published')}><I n="check" s={15} /> Publish</button>
            </>
          )}
        </span>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_320px]">
        <div className="grid min-w-0 content-start gap-5">
          <input value={p.title} onChange={(e) => { set('title', e.target.value); if (!slugTouched) set('slug', slugify(e.target.value)); }} placeholder="Project title" className="w-full bg-transparent text-3xl font-extrabold tracking-tight outline-none placeholder:text-muted/50" />
          <div className="flex items-center gap-1 font-mono text-xs text-muted">
            <span>/projects/</span>
            <input value={p.slug} onChange={(e) => { setSlugTouched(true); set('slug', e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-')); }} className="flex-1 rounded-md border border-transparent bg-transparent px-1 py-0.5 text-fg outline-none hover:border-line focus:border-accent" />
          </div>
          <textarea value={p.summary} onChange={(e) => set('summary', e.target.value)} rows={2} placeholder="One or two sentences shown on cards" className="input resize-y" />

          <Panel title="Live preview">
            <div className="grid gap-4">
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                {PREVIEWS.map((x) => (
                  <button key={x.v} type="button" onClick={() => set('preview_type', x.v)} className={`rounded-xl border px-3 py-2.5 text-left text-xs font-semibold transition ${p.preview_type === x.v ? 'border-accent bg-accent-soft text-accent' : 'border-line text-muted hover:border-accent'}`}>
                    {x.label}
                  </button>
                ))}
              </div>
              <p className="text-xs text-muted">{preview.help}</p>
              {!['none', 'app'].includes(p.preview_type) && (
                <div>
                  <label className="label" htmlFor="pr-url">Preview link</label>
                  <div className="flex gap-2">
                    <input id="pr-url" value={p.preview_url} onChange={(e) => set('preview_url', e.target.value)} placeholder={p.preview_type === 'website' ? 'https://… (defaults to Live URL)' : 'https://…'} className="input" />
                    {['office', 'pdf'].includes(p.preview_type) && <ImagePickButton onPick={(url) => set('preview_url', url)} />}
                  </div>
                </div>
              )}
              {src && !['none', 'app'].includes(p.preview_type) && (
                <div className="overflow-hidden rounded-xl border border-line">
                  <iframe src={src} title="Preview" className={`w-full border-0 bg-white ${p.preview_type === 'video' ? 'aspect-video' : 'h-80'}`} />
                </div>
              )}
            </div>
          </Panel>

          <Panel title="Case study">
            <div className="grid gap-4 md:grid-cols-3">
              {(['problem', 'solution', 'results'] as const).map((k) => (
                <div key={k}>
                  <label className="label" htmlFor={`cs-${k}`}>{k === 'problem' ? 'The challenge' : k === 'solution' ? 'The solution' : 'The results'}</label>
                  <textarea id={`cs-${k}`} value={p[k]} onChange={(e) => set(k, e.target.value)} rows={5} className="input resize-y" />
                </div>
              ))}
            </div>
          </Panel>

          <div>
            <span className="label">Full description (optional, Markdown)</span>
            <MarkdownEditor value={p.content} onChange={(v) => set('content', v)} />
          </div>

          <Panel title={p.preview_type === 'app' ? 'Screenshots' : 'Gallery'}>
            {p.gallery.length === 0 ? <p className="mb-3 text-sm text-muted">No images yet.</p> : (
              <ul className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                {p.gallery.map((g, i) => (
                  <li key={g.url + i} className="overflow-hidden rounded-xl border border-line bg-surface-2">
                    <img src={g.url} alt="" className="aspect-[4/3] w-full object-cover" />
                    <div className="grid gap-1 p-2">
                      <input value={g.caption ?? ''} onChange={(e) => set('gallery', p.gallery.map((x, j) => (j === i ? { ...x, caption: e.target.value } : x)))} placeholder="Caption" className="input py-1 text-xs" />
                      <div className="flex justify-between">
                        <button type="button" onClick={() => i > 0 && set('gallery', p.gallery.map((x, j) => (j === i - 1 ? p.gallery[i] : j === i ? p.gallery[i - 1] : x)))} className="text-muted hover:text-fg" aria-label="Move left">‹</button>
                        <button type="button" onClick={() => set('gallery', p.gallery.filter((_, j) => j !== i))} className="text-muted hover:text-red-500" aria-label="Remove"><I n="trash" s={14} /></button>
                        <button type="button" onClick={() => i < p.gallery.length - 1 && set('gallery', p.gallery.map((x, j) => (j === i + 1 ? p.gallery[i] : j === i ? p.gallery[i + 1] : x)))} className="text-muted hover:text-fg" aria-label="Move right">›</button>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
            <button type="button" onClick={() => setPicker('gallery')} className="btn-ghost px-3 py-1.5 text-xs"><I n="plus" s={14} /> Add images</button>
          </Panel>

          <Panel title="Downloadable files">
            <div className="mb-3"><Toggle checked={p.downloads_enabled} onChange={(v) => set('downloads_enabled', v)} label="Let visitors download these files" /></div>
            {p.files.length > 0 && (
              <ul className="mb-3 grid gap-2">
                {p.files.map((f, i) => (
                  <li key={f.url + i} className="flex items-center gap-2">
                    <I n="file" s={16} className="text-muted" />
                    <input value={f.name} onChange={(e) => set('files', p.files.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} className="input py-1.5 text-sm" />
                    <button type="button" onClick={() => set('files', p.files.filter((_, j) => j !== i))} className="text-muted hover:text-red-500" aria-label="Remove"><I n="trash" s={15} /></button>
                  </li>
                ))}
              </ul>
            )}
            <button type="button" onClick={() => setPicker('files')} className="btn-ghost px-3 py-1.5 text-xs"><I n="plus" s={14} /> Add file</button>
          </Panel>
        </div>

        <aside className="grid content-start gap-4">
          <Panel title="Details">
            <div className="grid gap-4">
              <div>
                <label className="label" htmlFor="pr-cat">Category</label>
                <select id="pr-cat" value={p.category_id ?? ''} onChange={(e) => set('category_id', e.target.value || null)} className="input">
                  <option value="">— None —</option>
                  {cats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div><label className="label" htmlFor="pr-client">Client</label><input id="pr-client" value={p.client} onChange={(e) => set('client', e.target.value)} className="input" /></div>
              <div><label className="label" htmlFor="pr-date">Completed on</label><input id="pr-date" type="date" value={p.project_date ?? ''} onChange={(e) => set('project_date', e.target.value)} className="input" /></div>
              <div><label className="label" htmlFor="pr-live">Live URL / Play Store</label><input id="pr-live" value={p.live_url} onChange={(e) => set('live_url', e.target.value)} placeholder="https://…" className="input" /></div>
              <div><label className="label" htmlFor="pr-repo">Source code URL</label><input id="pr-repo" value={p.repo_url} onChange={(e) => set('repo_url', e.target.value)} placeholder="https://github.com/…" className="input" /></div>
              <div><span className="label">Tools used</span><TagsField value={p.tools} onChange={(v) => set('tools', v)} placeholder="Excel, Apps Script…" /></div>
              <div><span className="label">Tags</span><TagsField value={p.tags} onChange={(v) => set('tags', v)} /></div>
              <Toggle checked={p.featured} onChange={(v) => set('featured', v)} label="Featured on home page" />
            </div>
          </Panel>
          <Panel title="Cover image"><ImageField value={p.cover_url} onChange={(v) => set('cover_url', v)} /></Panel>
          <Panel title="SEO">
            <div className="grid gap-3">
              <input value={p.seo_title} onChange={(e) => set('seo_title', e.target.value)} placeholder={p.title || 'SEO title'} className="input" aria-label="SEO title" />
              <textarea value={p.seo_description} onChange={(e) => set('seo_description', e.target.value)} rows={3} placeholder="Meta description" className="input resize-y" aria-label="Meta description" />
            </div>
          </Panel>
        </aside>
      </div>

      <Modal open={picker !== null} onClose={() => setPicker(null)} title={picker === 'gallery' ? 'Add images' : 'Add a file'} wide>
        <MediaLibrary
          accept={picker === 'gallery' ? 'image/*' : '*'}
          onPick={(m) => {
            if (picker === 'gallery') set('gallery', [...p.gallery, { url: m.url, caption: '' }]);
            else set('files', [...p.files, { name: m.name, url: m.url }]);
            if (picker === 'files') setPicker(null);
            else toast('Image added. Pick more or close.');
          }}
        />
      </Modal>
    </div>
  );
}

function ImagePickButton({ onPick }: { onPick: (url: string) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="btn-ghost shrink-0 px-3 text-xs"><I n="upload" s={14} /> Upload</button>
      <Modal open={open} onClose={() => setOpen(false)} title="Choose a file" wide>
        <MediaLibrary accept="*" onPick={(m) => { onPick(m.url); setOpen(false); }} />
      </Modal>
    </>
  );
}

/* ======================= Categories ======================= */
const catFields: Field[] = [
  { key: 'name', label: 'Name', type: 'text' },
  { key: 'slug', label: 'URL slug', type: 'text', help: 'Leave empty to generate from the name.' },
  { key: 'sort_order', label: 'Order', type: 'number' },
];

export function ProjectCategories() {
  const toast = useToast();
  const [rows, setRows] = useState<Cat[]>([]);
  const [edit, setEdit] = useState<Obj | null>(null);
  const load = useCallback(() => sb().from('project_categories').select('*').order('sort_order').then(({ data, error }) => {
    if (error) toast(error.message, false);
    setRows((data as Cat[]) ?? []);
  }), [toast]);
  useEffect(() => {
    load();
  }, [load]);

  async function save() {
    if (!edit) return;
    const { id, created_at, ...row } = edit;
    void created_at;
    row.slug = slugify(String(row.slug || row.name || ''));
    if (!String(row.name ?? '').trim()) return toast('Name is required', false);
    const { error } = id ? await sb().from('project_categories').update(row).eq('id', id) : await sb().from('project_categories').insert(row);
    if (error) return toast(error.code === '23505' ? 'That slug is already used.' : error.message, false);
    setEdit(null);
    load();
  }
  async function remove(c: Cat) {
    if (!confirm(`Delete "${c.name}"? Projects keep existing without a category.`)) return;
    const { error } = await sb().from('project_categories').delete().eq('id', c.id);
    if (error) return toast(error.message, false);
    load();
  }

  return (
    <div>
      <PageTitle title="Project categories" sub="Filter tabs on the Projects page." actions={<button type="button" className="btn-primary" onClick={() => setEdit({ name: '', slug: '', sort_order: rows.length + 1 })}><I n="plus" s={15} /> Add category</button>} />
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
