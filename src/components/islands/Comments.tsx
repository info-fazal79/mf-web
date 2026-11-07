import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { supabase } from '@/lib/supabase';

type C = { id: string; parent_id: string | null; name: string; body: string; is_admin: boolean; created_at: string };

const ago = (iso: string) => {
  const s = (Date.now() - Date.parse(iso)) / 1000;
  if (s < 60) return 'just now';
  const units: [number, string][] = [[31536000, 'year'], [2592000, 'month'], [86400, 'day'], [3600, 'hour'], [60, 'minute']];
  for (const [sec, u] of units) if (s >= sec) { const n = Math.floor(s / sec); return `${n} ${u}${n > 1 ? 's' : ''} ago`; }
  return '';
};

function remembered() {
  try {
    return JSON.parse(localStorage.getItem('commenter') ?? '{}') as { name?: string; email?: string };
  } catch {
    return {};
  }
}

function CommentForm({ postId, parentId, onDone, onCancel }: { postId: string; parentId: string | null; onDone: () => void; onCancel?: () => void }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const me = useMemo(remembered, []);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    if (!form.reportValidity()) return;
    const f = Object.fromEntries(new FormData(form)) as Record<string, string>;
    if (f.website) return onDone(); // honeypot: bots fill hidden fields
    setBusy(true);
    setErr('');
    const row = { post_id: postId, parent_id: parentId, name: f.name.trim(), email: f.email.trim().toLowerCase(), body: f.body.trim() };
    const { error } = supabase ? await supabase.from('comments').insert(row) : { error: { message: 'offline' } };
    setBusy(false);
    if (error) return setErr('Could not post your comment. Please try again.');
    try { localStorage.setItem('commenter', JSON.stringify({ name: row.name, email: row.email })); } catch {}
    form.reset();
    onDone();
  }

  return (
    <form onSubmit={submit} className="grid gap-3" noValidate>
      <textarea name="body" required maxLength={5000} rows={parentId ? 3 : 4} placeholder={parentId ? 'Write a reply…' : 'Share your thoughts or ask a question…'} className="input resize-y" />
      <div className="grid gap-3 sm:grid-cols-2">
        <input name="name" required maxLength={100} defaultValue={me.name} placeholder="Name *" autoComplete="name" className="input" />
        <input name="email" type="email" required maxLength={320} defaultValue={me.email} placeholder="Email * (never shown)" autoComplete="email" className="input" />
      </div>
      <input name="website" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden="true" />
      {err && <p className="text-sm text-red-500" role="alert">{err}</p>}
      <div className="flex items-center gap-2">
        <button type="submit" disabled={busy} className="btn-primary">{busy ? 'Posting…' : parentId ? 'Reply' : 'Post comment'}</button>
        {onCancel && <button type="button" onClick={onCancel} className="btn-ghost">Cancel</button>}
        <span className="ml-auto text-xs text-muted">Comments appear after approval.</span>
      </div>
    </form>
  );
}

export default function Comments({ postId }: { postId: string }) {
  const [list, setList] = useState<C[] | null>(null);
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [notice, setNotice] = useState('');

  useEffect(() => {
    if (!supabase) return setList([]);
    supabase.rpc('approved_comments', { p_post_id: postId }).then(({ data }) => setList((data as C[]) ?? []));
  }, [postId]);

  const children = useMemo(() => {
    const m = new Map<string | null, C[]>();
    for (const c of list ?? []) m.set(c.parent_id, [...(m.get(c.parent_id) ?? []), c]);
    return m;
  }, [list]);

  const done = () => {
    setReplyTo(null);
    setNotice('Thanks! Your comment is awaiting approval and will appear soon.');
  };

  const render = (c: C, depth: number) => (
    <li key={c.id} className={depth ? 'mt-4 border-l-2 border-line pl-4 sm:pl-6' : ''}>
      <div className={`rounded-2xl border p-4 ${c.is_admin ? 'border-accent/40 bg-accent-soft' : 'border-line bg-surface'}`}>
        <div className="flex items-center gap-2.5">
          <span className={`grid h-8 w-8 place-items-center rounded-full text-sm font-bold ${c.is_admin ? 'bg-accent text-accent-contrast' : 'bg-surface-2 text-accent'}`}>{c.name[0]?.toUpperCase()}</span>
          <span className="text-sm font-semibold">{c.name}</span>
          {c.is_admin && <span className="rounded bg-accent px-1.5 py-0.5 text-[10px] font-bold text-accent-contrast">AUTHOR</span>}
          <span className="text-xs text-muted">· {ago(c.created_at)}</span>
        </div>
        <p className="mt-2.5 text-sm leading-relaxed whitespace-pre-wrap">{c.body}</p>
        {depth < 3 && (
          <button type="button" onClick={() => setReplyTo(replyTo === c.id ? null : c.id)} className="mt-2 text-xs font-semibold text-accent hover:underline">
            Reply
          </button>
        )}
      </div>
      {replyTo === c.id && (
        <div className="mt-3">
          <CommentForm postId={postId} parentId={c.id} onDone={done} onCancel={() => setReplyTo(null)} />
        </div>
      )}
      {(children.get(c.id) ?? []).length > 0 && <ul>{children.get(c.id)!.map((r) => render(r, depth + 1))}</ul>}
    </li>
  );

  const roots = children.get(null) ?? [];
  return (
    <div>
      <h2 className="text-2xl font-bold">
        Comments {list && list.length > 0 && <span className="text-muted">({list.length})</span>}
      </h2>
      <div className="card mt-5 p-5">
        <CommentForm postId={postId} parentId={null} onDone={done} />
      </div>
      {notice && <p className="mt-4 rounded-xl bg-accent-soft px-4 py-3 text-sm text-accent" role="status">{notice}</p>}
      {list === null ? (
        <p className="mt-6 text-sm text-muted">Loading comments…</p>
      ) : roots.length === 0 ? (
        <p className="mt-6 text-sm text-muted">No comments yet. Be the first to share your thoughts!</p>
      ) : (
        <ul className="mt-6 grid gap-4">{roots.map((c) => render(c, 0))}</ul>
      )}
    </div>
  );
}
