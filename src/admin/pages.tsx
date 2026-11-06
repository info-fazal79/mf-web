import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { defaults } from '@/lib/content';
import { fmt12 } from '@/lib/booking';
import { SchemaForm, type Field } from './SchemaForm';
import type { SettingsPage } from './schemas';
import { Empty, I, MediaLibrary, Modal, PageTitle, Panel, Toggle, useToast } from './ui';

type Obj = Record<string, unknown>;
const sb = () => supabase!;

/* ---------------- Settings editor ---------------- */
export function SettingsEditor({ page }: { page: SettingsPage }) {
  const toast = useToast();
  const base = defaults[page.key] as unknown as Obj;
  const [value, setValue] = useState<Obj>(base);
  const [saved, setSaved] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let live = true;
    setLoading(true);
    sb()
      .from('site_settings')
      .select('value')
      .eq('key', page.key)
      .maybeSingle()
      .then(({ data, error }) => {
        if (!live) return;
        if (error) toast(error.message, false);
        const v = { ...structuredClone(base), ...((data?.value as Obj) ?? {}) };
        setValue(v);
        setSaved(JSON.stringify(v));
        setLoading(false);
      });
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page.key]);

  const dirty = JSON.stringify(value) !== saved;

  async function save() {
    setSaving(true);
    const { error } = await sb().from('site_settings').upsert({ key: page.key, value });
    setSaving(false);
    if (error) return toast(error.message, false);
    setSaved(JSON.stringify(value));
    toast('Saved');
  }

  return (
    <div>
      <PageTitle
        title={page.title}
        sub={page.sub}
        actions={
          <>
            <button
              type="button"
              className="btn-ghost"
              onClick={() => confirm('Reset this page to the default content? (Not saved until you click Save.)') && setValue(structuredClone(base))}
            >
              <I n="refresh" s={15} /> Reset to default
            </button>
            <button type="button" className="btn-primary" disabled={!dirty || saving} onClick={save}>
              <I n="check" s={15} /> {saving ? 'Saving…' : dirty ? 'Save changes' : 'Saved'}
            </button>
          </>
        }
      />
      <Panel>{loading ? <p className="py-8 text-center text-sm text-muted">Loading…</p> : <SchemaForm fields={page.fields} value={value} onChange={setValue} />}</Panel>
      {dirty && (
        <div className="sticky bottom-4 mt-4 flex items-center justify-between gap-3 rounded-2xl border border-accent/40 bg-surface px-4 py-3 shadow-lg">
          <span className="text-sm">You have unsaved changes</span>
          <button type="button" className="btn-primary" disabled={saving} onClick={save}>
            {saving ? 'Saving…' : 'Save changes'}
          </button>
        </div>
      )}
    </div>
  );
}

/* ---------------- Dashboard ---------------- */
export function Dashboard({ go }: { go: (r: string) => void }) {
  const [counts, setCounts] = useState<Record<string, number | null>>({});
  const [recent, setRecent] = useState<Obj[]>([]);
  useEffect(() => {
    const tables = ['orders', 'consultations', 'messages', 'subscribers', 'media'];
    Promise.all(tables.map((t) => (t === 'orders' ? sb().from(t).select('*', { count: 'exact', head: true }).eq('status', 'pending') : sb().from(t).select('*', { count: 'exact', head: true })))).then((rs) =>
      setCounts(Object.fromEntries(rs.map((r, i) => [tables[i], r.count]))),
    );
    sb()
      .from('consultations')
      .select('id,name,topic,preferred_date,preferred_time,status,created_at')
      .order('created_at', { ascending: false })
      .limit(5)
      .then(({ data }) => setRecent(data ?? []));
  }, []);

  const cards = [
    { k: 'orders', label: 'Orders to verify', icon: 'dashboard', route: 'orders' },
    { k: 'consultations', label: 'Consultations', icon: 'calendar', route: 'consultations' },
    { k: 'messages', label: 'Messages', icon: 'mail', route: 'messages' },
    { k: 'subscribers', label: 'Subscribers', icon: 'users', route: 'subscribers' },

    { k: 'media', label: 'Media files', icon: 'image', route: 'media' },
  ];

  return (
    <div>
      <PageTitle title="Dashboard" sub="Overview of your website." actions={<a href="/" target="_blank" className="btn-ghost"><I n="external" s={15} /> View site</a>} />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {cards.map((c) => (
          <button key={c.k} type="button" onClick={() => go(c.route)} className="card card-hover p-5 text-left">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-accent-soft text-accent"><I n={c.icon} /></span>
            <p className="mt-4 text-3xl font-extrabold">{counts[c.k] ?? '…'}</p>
            <p className="text-sm text-muted">{c.label}</p>
          </button>
        ))}
      </div>
      <Panel title="Latest consultation requests" className="mt-6">
        {recent.length === 0 ? (
          <Empty text="No consultation requests yet." icon="calendar" />
        ) : (
          <ul className="divide-y divide-line">
            {recent.map((r) => (
              <li key={String(r.id)} className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm">
                <span className="font-medium">{String(r.name)}</span>
                <span className="text-muted">{String(r.topic ?? '')}</span>
                <span className="font-mono text-xs text-muted">{r.preferred_date ? `${r.preferred_date} · ${fmt12(String(r.preferred_time))}` : 'No slot'}</span>
                <StatusBadge s={String(r.status)} />
              </li>
            ))}
          </ul>
        )}
      </Panel>
      <Panel title="Getting started" className="mt-6">
        <ol className="grid gap-2 text-sm text-muted">
          <li>1. <button type="button" className="text-accent underline" onClick={() => go('media')}>Upload</button> your photo and logo to the media library.</li>
          <li>2. Set them in <button type="button" className="text-accent underline" onClick={() => go('s/hero')}>Hero</button> and <button type="button" className="text-accent underline" onClick={() => go('s/general')}>General</button>.</li>
          <li>3. Add real reviews in <button type="button" className="text-accent underline" onClick={() => go('testimonials')}>Testimonials</button>.</li>
          <li>4. Add your Facebook / YouTube links in <button type="button" className="text-accent underline" onClick={() => go('s/socials')}>Social links</button>.</li>
        </ol>
      </Panel>
    </div>
  );
}

export function StatusBadge({ s }: { s: string }) {
  const map: Record<string, string> = {
    pending: 'bg-yellow-500/15 text-yellow-600 dark:text-yellow-400',
    confirmed: 'bg-accent-soft text-accent',
    completed: 'bg-blue-500/15 text-blue-600 dark:text-blue-400',
    cancelled: 'bg-red-500/15 text-red-500',
  };
  return <span className={`rounded-md px-2 py-0.5 text-xs font-semibold capitalize ${map[s] ?? 'bg-surface-2'}`}>{s}</span>;
}

/* ---------------- Generic table CRUD ---------------- */
function useRows(table: string, order: string, ascending = false) {
  const toast = useToast();
  const [rows, setRows] = useState<Obj[]>([]);
  const [loading, setLoading] = useState(true);
  const reload = useCallback(async () => {
    setLoading(true);
    const { data, error } = await sb().from(table).select('*').order(order, { ascending });
    if (error) toast(error.message, false);
    setRows(data ?? []);
    setLoading(false);
  }, [table, order, ascending, toast]);
  useEffect(() => {
    reload();
  }, [reload]);
  return { rows, setRows, loading, reload };
}

/* ---------------- Testimonials ---------------- */
const testimonialFields: Field[] = [
  { key: 'name', label: 'Name', type: 'text' },
  { key: 'role', label: 'Role / company', type: 'text' },
  { key: 'quote', label: 'Review', type: 'textarea' },
  { key: 'rating', label: 'Rating (1–5)', type: 'number' },
  { key: 'sort_order', label: 'Order', type: 'number' },
  { key: 'avatar_url', label: 'Photo', type: 'image' },
  { key: 'published', label: 'Published', type: 'toggle', wide: true },
];

export function Testimonials() {
  const toast = useToast();
  const { rows, loading, reload } = useRows('testimonials', 'sort_order', true);
  const [edit, setEdit] = useState<Obj | null>(null);

  async function save() {
    if (!edit) return;
    const { id, created_at, ...rest } = edit;
    void created_at;
    rest.rating = Math.min(5, Math.max(1, Math.round(Number(rest.rating) || 5)));
    if (!String(rest.name ?? '').trim() || !String(rest.quote ?? '').trim()) return toast('Name and review are required', false);
    const q = id ? sb().from('testimonials').update(rest).eq('id', id) : sb().from('testimonials').insert(rest);
    const { error } = await q;
    if (error) return toast(error.message, false);
    toast('Saved');
    setEdit(null);
    reload();
  }

  async function remove(r: Obj) {
    if (!confirm(`Delete review from ${r.name}?`)) return;
    const { error } = await sb().from('testimonials').delete().eq('id', r.id);
    if (error) return toast(error.message, false);
    reload();
  }

  async function togglePublish(r: Obj) {
    const { error } = await sb().from('testimonials').update({ published: !r.published }).eq('id', r.id);
    if (error) return toast(error.message, false);
    reload();
  }

  return (
    <div>
      <PageTitle
        title="Testimonials"
        sub="Client and student reviews shown on the home page."
        actions={
          <button type="button" className="btn-primary" onClick={() => setEdit({ name: '', role: '', quote: '', rating: 5, sort_order: rows.length, avatar_url: '', published: true })}>
            <I n="plus" s={15} /> Add testimonial
          </button>
        }
      />
      <Panel>
        {loading ? (
          <p className="py-8 text-center text-sm text-muted">Loading…</p>
        ) : rows.length === 0 ? (
          <Empty text="No testimonials yet. The home page hides this section until you add one." icon="quote" />
        ) : (
          <ul className="divide-y divide-line">
            {rows.map((r) => (
              <li key={String(r.id)} className="flex items-center gap-4 py-3">
                {r.avatar_url ? (
                  <img src={String(r.avatar_url)} alt="" className="h-10 w-10 rounded-full object-cover" />
                ) : (
                  <span className="grid h-10 w-10 place-items-center rounded-full bg-accent-soft font-bold text-accent">{String(r.name)[0]}</span>
                )}
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">{String(r.name)} <span className="text-sm font-normal text-muted">· {String(r.role ?? '')}</span></p>
                  <p className="truncate text-sm text-muted">{String(r.quote)}</p>
                </div>
                <Toggle checked={Boolean(r.published)} onChange={() => togglePublish(r)} />
                <button type="button" className="btn-ghost px-3 py-1.5 text-xs" onClick={() => setEdit({ ...r })}>Edit</button>
                <button type="button" className="grid h-8 w-8 place-items-center rounded-lg text-muted hover:text-red-500" onClick={() => remove(r)} aria-label="Delete"><I n="trash" s={16} /></button>
              </li>
            ))}
          </ul>
        )}
      </Panel>
      <Modal open={edit !== null} onClose={() => setEdit(null)} title={edit?.id ? 'Edit testimonial' : 'New testimonial'}>
        {edit && (
          <>
            <SchemaForm fields={testimonialFields} value={edit} onChange={setEdit} />
            <div className="mt-6 flex justify-end gap-2">
              <button type="button" className="btn-ghost" onClick={() => setEdit(null)}>Cancel</button>
              <button type="button" className="btn-primary" onClick={save}>Save</button>
            </div>
          </>
        )}
      </Modal>
    </div>
  );
}

/* ---------------- Media page ---------------- */
export function MediaPage() {
  return (
    <div>
      <PageTitle title="Media library" sub="Every image and file you upload. Click the copy icon to grab a link." />
      <Panel>
        <MediaLibrary accept="*" />
      </Panel>
    </div>
  );
}

/* ---------------- Messages ---------------- */
export function Messages() {
  const toast = useToast();
  const { rows, setRows, loading } = useRows('messages', 'created_at');
  const [open, setOpen] = useState<Obj | null>(null);

  async function view(r: Obj) {
    setOpen(r);
    if (!r.is_read) {
      await sb().from('messages').update({ is_read: true }).eq('id', r.id);
      setRows((x) => x.map((m) => (m.id === r.id ? { ...m, is_read: true } : m)));
    }
  }
  async function remove(r: Obj) {
    if (!confirm('Delete this message?')) return;
    const { error } = await sb().from('messages').delete().eq('id', r.id);
    if (error) return toast(error.message, false);
    setRows((x) => x.filter((m) => m.id !== r.id));
    setOpen(null);
  }

  return (
    <div>
      <PageTitle title="Messages" sub="Contact form submissions." />
      <Panel>
        {loading ? (
          <p className="py-8 text-center text-sm text-muted">Loading…</p>
        ) : rows.length === 0 ? (
          <Empty text="No messages yet." icon="mail" />
        ) : (
          <ul className="divide-y divide-line">
            {rows.map((r) => (
              <li key={String(r.id)}>
                <button type="button" onClick={() => view(r)} className="flex w-full items-center gap-3 py-3 text-left">
                  <span className={`h-2 w-2 shrink-0 rounded-full ${r.is_read ? 'bg-transparent' : 'bg-accent'}`} />
                  <span className={`w-40 shrink-0 truncate text-sm ${r.is_read ? '' : 'font-bold'}`}>{String(r.name)}</span>
                  <span className="min-w-0 flex-1 truncate text-sm text-muted">
                    <span className="text-fg">{String(r.subject || '(no subject)')}</span> · {String(r.message)}
                  </span>
                  <span className="shrink-0 font-mono text-xs text-muted">{new Date(String(r.created_at)).toLocaleDateString()}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </Panel>
      <Modal open={open !== null} onClose={() => setOpen(null)} title={String(open?.subject || 'Message')}>
        {open && (
          <div className="grid gap-4 text-sm">
            <p>
              <strong>{String(open.name)}</strong> · <a className="text-accent" href={`mailto:${open.email}`}>{String(open.email)}</a>
            </p>
            <p className="whitespace-pre-wrap text-muted">{String(open.message)}</p>
            <div className="flex justify-end gap-2">
              <button type="button" className="btn-ghost" onClick={() => remove(open)}><I n="trash" s={15} /> Delete</button>
              <a className="btn-primary" href={`mailto:${open.email}?subject=Re: ${encodeURIComponent(String(open.subject || ''))}`}><I n="mail" s={15} /> Reply</a>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

/* ---------------- Subscribers ---------------- */
export function Subscribers() {
  const toast = useToast();
  const { rows, setRows, loading } = useRows('subscribers', 'created_at');

  function exportCsv() {
    const csv = ['email,status,source,created_at', ...rows.map((r) => [r.email, r.status, r.source, r.created_at].join(','))].join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    a.download = `subscribers-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
  }
  async function remove(r: Obj) {
    if (!confirm(`Remove ${r.email}?`)) return;
    const { error } = await sb().from('subscribers').delete().eq('id', r.id);
    if (error) return toast(error.message, false);
    setRows((x) => x.filter((m) => m.id !== r.id));
  }

  return (
    <div>
      <PageTitle
        title="Subscribers"
        sub="Newsletter sign-ups. Sending campaigns arrives in Phase 9."
        actions={<button type="button" className="btn-ghost" disabled={!rows.length} onClick={exportCsv}><I n="file" s={15} /> Export CSV</button>}
      />
      <Panel>
        {loading ? (
          <p className="py-8 text-center text-sm text-muted">Loading…</p>
        ) : rows.length === 0 ? (
          <Empty text="No subscribers yet." icon="users" />
        ) : (
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-muted uppercase">
              <tr><th className="pb-2">Email</th><th className="pb-2">Status</th><th className="pb-2">Joined</th><th /></tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rows.map((r) => (
                <tr key={String(r.id)}>
                  <td className="py-2.5">{String(r.email)}</td>
                  <td className="capitalize">{String(r.status)}</td>
                  <td className="font-mono text-xs text-muted">{new Date(String(r.created_at)).toLocaleDateString()}</td>
                  <td className="text-right"><button type="button" onClick={() => remove(r)} className="text-muted hover:text-red-500" aria-label="Remove"><I n="trash" s={15} /></button></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Panel>
    </div>
  );
}

