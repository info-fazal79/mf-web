import { useEffect, useState, type FormEvent } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';

type LibBook = { ebook_id: string; source: string; granted_at: string; ebook: { title: string; slug: string; cover_url: string | null; author_name: string; access_mode: string; allow_download: boolean; format: string } | null };
type Progress = { ebook_id: string; percent: number; updated_at: string };
type Order = { id: string; order_no: string; total: number; status: string; payment_method: string | null; created_at: string; items: { title: string; slug: string }[]; admin_note: string | null };

export function AuthForm({ onDone, compact = false }: { onDone?: () => void; compact?: boolean }) {
  const [mode, setMode] = useState<'login' | 'signup' | 'magic' | 'forgot'>('login');
  const [msg, setMsg] = useState<{ t: string; ok: boolean } | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!supabase) return;
    const f = Object.fromEntries(new FormData(e.currentTarget)) as Record<string, string>;
    const email = f.email.trim().toLowerCase();
    const redirect = `${location.origin}${location.pathname}${location.search}`;
    setBusy(true);
    setMsg(null);
    let r: { error: { message: string } | null; data?: unknown };
    if (mode === 'login') r = await supabase.auth.signInWithPassword({ email, password: f.password });
    else if (mode === 'signup') r = await supabase.auth.signUp({ email, password: f.password, options: { data: { full_name: f.name?.trim() }, emailRedirectTo: redirect } });
    else if (mode === 'magic') r = await supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: redirect } });
    else r = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${location.origin}/account` });
    setBusy(false);
    if (r.error) return setMsg({ t: r.error.message, ok: false });
    if (mode === 'login' || (mode === 'signup' && (r.data as { session?: Session | null } | undefined)?.session)) return onDone?.();
    setMsg({
      ok: true,
      t: mode === 'signup' ? 'Account created! Check your email to confirm, then sign in.' : mode === 'magic' ? 'Check your email for a sign-in link.' : 'Check your email for a password reset link.',
    });
  }

  return (
    <form onSubmit={submit} className="grid gap-4" noValidate>
      {!compact && (
        <div className="inline-flex rounded-xl border border-line bg-surface-2 p-1 text-sm">
          {(['login', 'signup'] as const).map((m) => (
            <button key={m} type="button" onClick={() => { setMode(m); setMsg(null); }} className={`flex-1 rounded-lg px-4 py-1.5 font-semibold ${mode === m ? 'bg-accent text-accent-contrast' : 'text-muted'}`}>
              {m === 'login' ? 'Sign in' : 'Create account'}
            </button>
          ))}
        </div>
      )}
      {mode === 'signup' && (
        <div><label className="label" htmlFor="au-name">Full name</label><input id="au-name" name="name" required autoComplete="name" className="input" /></div>
      )}
      <div><label className="label" htmlFor="au-email">Email</label><input id="au-email" name="email" type="email" required autoComplete="email" className="input" /></div>
      {(mode === 'login' || mode === 'signup') && (
        <div>
          <label className="label" htmlFor="au-pass">Password</label>
          <input id="au-pass" name="password" type="password" required minLength={mode === 'signup' ? 8 : undefined} autoComplete={mode === 'signup' ? 'new-password' : 'current-password'} className="input" />
          {mode === 'signup' && <p className="mt-1 text-xs text-muted">At least 8 characters.</p>}
        </div>
      )}
      {msg && <p className={`text-sm ${msg.ok ? 'text-accent' : 'text-red-500'}`} role="alert">{msg.t}</p>}
      <button type="submit" disabled={busy} className="btn-primary py-3">
        {busy ? 'Please wait…' : mode === 'login' ? 'Sign in' : mode === 'signup' ? 'Create account' : mode === 'magic' ? 'Email me a sign-in link' : 'Send reset link'}
      </button>
      <div className="flex flex-wrap justify-between gap-2 text-xs">
        {mode !== 'magic' ? <button type="button" className="text-muted hover:text-accent" onClick={() => { setMode('magic'); setMsg(null); }}>Sign in with an email link instead</button> : <button type="button" className="text-muted hover:text-accent" onClick={() => setMode('login')}>← Use password</button>}
        {mode === 'login' && <button type="button" className="text-muted hover:text-accent" onClick={() => { setMode('forgot'); setMsg(null); }}>Forgot password?</button>}
        {compact && mode === 'login' && <button type="button" className="text-muted hover:text-accent" onClick={() => setMode('signup')}>Create an account</button>}
      </div>
    </form>
  );
}

export default function AccountApp() {
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const [recovery, setRecovery] = useState(false);
  const [books, setBooks] = useState<LibBook[] | null>(null);
  const [progress, setProgress] = useState<Record<string, number>>({});
  const [orders, setOrders] = useState<Order[]>([]);
  const [name, setName] = useState('');
  const [saved, setSaved] = useState('');

  useEffect(() => {
    if (!supabase) return setSession(null);
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = supabase.auth.onAuthStateChange((ev, s) => {
      if (ev === 'PASSWORD_RECOVERY') setRecovery(true);
      setSession(s);
    });
    return () => data.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session || !supabase) return;
    setName(String(session.user.user_metadata?.full_name ?? ''));
    supabase
      .from('ebook_library')
      .select('ebook_id,source,granted_at,ebook:ebooks(title,slug,cover_url,author_name,access_mode,allow_download,format)')
      .order('granted_at', { ascending: false })
      .then(({ data }) => setBooks((data as unknown as LibBook[]) ?? []));
    supabase.from('orders').select('id,order_no,total,status,payment_method,created_at,items,admin_note').order('created_at', { ascending: false }).then(({ data }) => setOrders((data as Order[]) ?? []));
    supabase.from('reading_progress').select('ebook_id,percent,updated_at').then(({ data }) => setProgress(Object.fromEntries(((data as Progress[]) ?? []).map((p) => [p.ebook_id, Number(p.percent)]))));
  }, [session]);

  if (session === undefined) return <p className="py-16 text-center text-muted">Loading…</p>;

  if (recovery && session) {
    return (
      <form
        className="card mx-auto grid max-w-md gap-4 p-7"
        onSubmit={async (e) => {
          e.preventDefault();
          const pw = String(new FormData(e.currentTarget).get('pw'));
          const { error } = await supabase!.auth.updateUser({ password: pw });
          setSaved(error ? error.message : 'Password updated.');
          if (!error) setRecovery(false);
        }}
      >
        <h2 className="text-xl font-bold">Set a new password</h2>
        <input name="pw" type="password" minLength={8} required autoComplete="new-password" className="input" />
        <button type="submit" className="btn-primary">Update password</button>
        {saved && <p className="text-sm">{saved}</p>}
      </form>
    );
  }

  if (!session) {
    return (
      <div className="card mx-auto max-w-md p-7">
        <h2 className="text-xl font-bold">Welcome</h2>
        <p className="mt-1 mb-6 text-sm text-muted">Sign in to access your e-book library, highlights and reading progress on every device.</p>
        <AuthForm />
      </div>
    );
  }

  const u = session.user;
  return (
    <div className="grid gap-8 lg:grid-cols-[280px_1fr]">
      <aside className="card h-fit p-6">
        <span className="grid h-14 w-14 place-items-center rounded-2xl bg-accent text-xl font-bold text-accent-contrast">{(name || u.email || '?')[0].toUpperCase()}</span>
        <p className="mt-4 font-bold">{name || 'Reader'}</p>
        <p className="truncate text-sm text-muted">{u.email}</p>
        <form
          className="mt-6 grid gap-2"
          onSubmit={async (e) => {
            e.preventDefault();
            const { error } = await supabase!.auth.updateUser({ data: { full_name: name.trim() } });
            setSaved(error ? error.message : 'Saved');
            setTimeout(() => setSaved(''), 2000);
          }}
        >
          <label className="label" htmlFor="ac-name">Display name</label>
          <input id="ac-name" value={name} onChange={(e) => setName(e.target.value)} className="input" />
          <button type="submit" className="btn-ghost py-2 text-xs">Save name</button>
          {saved && <p className="text-xs text-accent">{saved}</p>}
        </form>
        <button type="button" onClick={() => supabase!.auth.signOut()} className="btn-ghost mt-6 w-full text-sm">Sign out</button>
      </aside>

      <section>
        <div className="flex items-end justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold">My library</h2>
            <p className="text-sm text-muted">Books you've claimed or bought. Your place, highlights and notes sync across devices.</p>
          </div>
          <a href="/ebooks" className="btn-ghost text-sm">Browse e-books</a>
        </div>
        {books === null ? (
          <p className="py-10 text-center text-muted">Loading…</p>
        ) : books.length === 0 ? (
          <div className="card mt-6 p-10 text-center">
            <p className="font-semibold">Your library is empty</p>
            <p className="mt-1 text-sm text-muted">Add a free e-book or buy one, and it will appear here.</p>
          </div>
        ) : (
          <ul className="mt-6 grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
            {books.filter((b) => b.ebook).map((b) => {
              const pct = Math.round(progress[b.ebook_id] ?? 0);
              return (
                <li key={b.ebook_id} className="card flex gap-4 p-4">
                  <a href={`/ebooks/${b.ebook!.slug}`} className="shrink-0">
                    {b.ebook!.cover_url ? <img src={b.ebook!.cover_url} alt="" className="h-28 w-20 rounded-lg object-cover shadow" /> : <span className="grid h-28 w-20 place-items-center rounded-lg bg-accent-soft font-bold text-accent">MF</span>}
                  </a>
                  <div className="flex min-w-0 flex-1 flex-col">
                    <p className="line-clamp-2 font-semibold">{b.ebook!.title}</p>
                    <p className="text-xs text-muted">{b.ebook!.author_name} · {b.source === 'purchase' ? 'Purchased' : b.source === 'admin' ? 'Gifted' : 'Free'}</p>
                    <div className="mt-auto pt-3">
                      <div className="h-1.5 overflow-hidden rounded-full bg-surface-2"><div className="h-full rounded-full bg-accent" style={{ width: `${pct}%` }} /></div>
                      <div className="mt-2 flex items-center justify-between">
                        <span className="text-xs text-muted">{pct ? `${pct}% read` : 'Not started'}</span>
                        <a href={`/read?book=${b.ebook!.slug}`} className="btn-primary px-3 py-1.5 text-xs">{pct ? 'Continue' : 'Read'}</a>
                      </div>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        {orders.length > 0 && (
          <div className="mt-12">
            <h2 className="text-2xl font-bold">My orders</h2>
            <ul className="mt-4 grid gap-3">
              {orders.map((o) => (
                <li key={o.id} className="card flex flex-wrap items-center gap-x-4 gap-y-2 p-4 text-sm">
                  <span className="font-mono font-semibold">{o.order_no}</span>
                  <span className="min-w-0 flex-1 truncate text-muted">{o.items.map((i) => i.title).join(', ')}</span>
                  <span className="font-semibold">৳{Number(o.total)}</span>
                  <span className={`rounded-md px-2 py-0.5 text-xs font-semibold capitalize ${o.status === 'paid' ? 'bg-accent-soft text-accent' : o.status === 'pending' ? 'bg-yellow-500/15 text-yellow-600 dark:text-yellow-400' : 'bg-red-500/15 text-red-500'}`}>
                    {o.status === 'pending' ? 'Verifying payment' : o.status}
                  </span>
                  <span className="font-mono text-xs text-muted">{new Date(o.created_at).toLocaleDateString()}</span>
                  {o.status === 'rejected' && o.admin_note && <p className="w-full text-xs text-red-500">{o.admin_note}</p>}
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>
    </div>
  );
}
