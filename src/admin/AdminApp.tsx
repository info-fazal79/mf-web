import { useEffect, useRef, useState, type FormEvent } from 'react';
import { createPortal } from 'react-dom';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { settingsPages } from './schemas';
import { Dashboard, MediaPage, Messages, SettingsEditor, Subscribers, Testimonials } from './pages';
import { Consultations } from './consultation';
import { BlogAuthors, BlogCategories, BlogComments, BlogPosts } from './blog';
import { ProjectCategories, Projects } from './projects';
import { Tutorials, YouTubeSettings } from './tutorials';
import { Customers, EbookCategories, EbookReviewsAdmin, Ebooks } from './ebooks';
import { Coupons, Orders } from './orders';
import { EmailSettings, Newsletter } from './email';
import { I, ToastProvider } from './ui';

type NavEntry = { route: string; label: string; icon: string };
const navGroups: { title: string; items: NavEntry[] }[] = [
  { title: '', items: [{ route: 'dashboard', label: 'Dashboard', icon: 'dashboard' }] },
  {
    title: 'Inbox',
    items: [
      { route: 'orders', label: 'Orders', icon: 'dashboard' },
      { route: 'consultations', label: 'Consultations', icon: 'calendar' },
      { route: 'messages', label: 'Messages', icon: 'mail' },
      { route: 'subscribers', label: 'Subscribers', icon: 'users' },
      { route: 'newsletter', label: 'Newsletter', icon: 'send' },
    ],
  },
  {
    title: 'Home page',
    items: [
      { route: 's/hero', label: 'Hero', icon: 'home' },
      { route: 's/stats', label: 'Stats', icon: 'dashboard' },
      { route: 's/sections', label: 'Sections', icon: 'eye' },
      { route: 's/services', label: 'Services', icon: 'layers' },
      { route: 's/tools', label: 'Toolkit', icon: 'layers' },
      { route: 's/featured', label: 'Featured projects', icon: 'layers' },
      { route: 'testimonials', label: 'Testimonials', icon: 'quote' },
    ],
  },
  {
    title: 'E-books',
    items: [
      { route: 'ebooks', label: 'E-books', icon: 'file' },
      { route: 'ebook-reviews', label: 'Reviews', icon: 'quote' },
      { route: 'ebook-categories', label: 'Categories', icon: 'layers' },
      { route: 'coupons', label: 'Coupons', icon: 'layers' },
      { route: 'customers', label: 'Customers', icon: 'users' },
    ],
  },
  {
    title: 'Blog',
    items: [
      { route: 'blog', label: 'Posts', icon: 'file' },
      { route: 'blog-comments', label: 'Comments', icon: 'mail' },
      { route: 'blog-categories', label: 'Categories', icon: 'layers' },
      { route: 'blog-authors', label: 'Authors', icon: 'user' },
    ],
  },
  {
    title: 'Portfolio',
    items: [
      { route: 'projects', label: 'Projects', icon: 'layers' },
      { route: 'project-categories', label: 'Categories', icon: 'layers' },
    ],
  },
  {
    title: 'Learning',
    items: [
      { route: 'tutorials', label: 'Tutorials', icon: 'eye' },
      { route: 'youtube-settings', label: 'YouTube API', icon: 'settings' },
    ],
  },
  { title: 'Pages', items: [{ route: 's/about', label: 'About', icon: 'user' }] },
  { title: 'Library', items: [{ route: 'media', label: 'Media', icon: 'image' }] },
  {
    title: 'Settings',
    items: [
      { route: 's/general', label: 'General', icon: 'settings' },
      { route: 's/nav', label: 'Navigation', icon: 'menu' },
      { route: 's/socials', label: 'Social links', icon: 'link' },
      { route: 's/footer', label: 'Footer', icon: 'layers' },
      { route: 's/floating', label: 'Floating contact', icon: 'mail' },
      { route: 's/payments', label: 'Payments', icon: 'dashboard' },
      { route: 'email-settings', label: 'Email', icon: 'mail' },
      { route: 's/consultation', label: 'Consultation', icon: 'calendar' },
    ],
  },
];

function useHashRoute() {
  const read = () => location.hash.replace(/^#\/?/, '') || 'dashboard';
  const [route, setRoute] = useState(read);
  useEffect(() => {
    const on = () => setRoute(read());
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  return [route, (r: string) => (location.hash = `/${r}`)] as const;
}

/* ---------------- Login ---------------- */
function Login({ recovery }: { recovery: boolean }) {
  const [mode, setMode] = useState<'login' | 'forgot' | 'reset'>(recovery ? 'reset' : 'login');
  const [msg, setMsg] = useState<{ t: string; ok: boolean } | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = Object.fromEntries(new FormData(e.currentTarget)) as Record<string, string>;
    setBusy(true);
    setMsg(null);
    const sb = supabase!;
    if (mode === 'login') {
      const { error } = await sb.auth.signInWithPassword({ email: f.email, password: f.password });
      if (error) setMsg({ t: error.message, ok: false });
    } else if (mode === 'forgot') {
      const { error } = await sb.auth.resetPasswordForEmail(f.email, { redirectTo: `${location.origin}/admin` });
      setMsg(error ? { t: error.message, ok: false } : { t: 'Check your email for a reset link.', ok: true });
    } else {
      const { error } = await sb.auth.updateUser({ password: f.password });
      setMsg(error ? { t: error.message, ok: false } : { t: 'Password updated. You are signed in.', ok: true });
      if (!error) setTimeout(() => location.replace('/admin'), 800);
    }
    setBusy(false);
  }

  return (
    <div className="relative grid min-h-screen place-items-center p-4">
      <div className="bg-grid pointer-events-none absolute inset-0" />
      <form onSubmit={submit} className="card relative w-full max-w-sm p-7">
        <span className="grid h-11 w-11 place-items-center rounded-xl bg-accent font-mono text-sm font-bold text-accent-contrast">MF</span>
        <h1 className="mt-5 text-xl font-bold">{mode === 'login' ? 'Admin sign in' : mode === 'forgot' ? 'Reset password' : 'Set a new password'}</h1>
        <p className="mt-1 text-sm text-muted">{mode === 'reset' ? 'Choose a strong password.' : 'MF Website control panel'}</p>
        <div className="mt-6 grid gap-4">
          {mode !== 'reset' && (
            <div>
              <label className="label" htmlFor="a-email">Email</label>
              <input id="a-email" name="email" type="email" required autoComplete="username" className="input" />
            </div>
          )}
          {mode !== 'forgot' && (
            <div>
              <label className="label" htmlFor="a-pass">{mode === 'reset' ? 'New password' : 'Password'}</label>
              <input id="a-pass" name="password" type="password" required minLength={mode === 'reset' ? 8 : undefined} autoComplete={mode === 'reset' ? 'new-password' : 'current-password'} className="input" />
            </div>
          )}
          {msg && <p className={`text-sm ${msg.ok ? 'text-accent' : 'text-red-500'}`} role="alert">{msg.t}</p>}
          <button type="submit" className="btn-primary py-3" disabled={busy}>
            {busy ? 'Please wait…' : mode === 'login' ? 'Sign in' : mode === 'forgot' ? 'Send reset link' : 'Update password'}
          </button>
          {mode !== 'reset' && (
            <button type="button" className="text-xs text-muted hover:text-accent" onClick={() => { setMode(mode === 'login' ? 'forgot' : 'login'); setMsg(null); }}>
              {mode === 'login' ? 'Forgot password?' : '← Back to sign in'}
            </button>
          )}
        </div>
      </form>
    </div>
  );
}

/* ---------------- Sidebar: collapsible groups + hover flyout ---------------- */
const isActive = (route: string, r: string) => route === r || route.startsWith(`${r}/`);

function SideNav({ route }: { route: string }) {
  const activeGroup = navGroups.find((g) => g.items.some((it) => isActive(route, it.route)))?.title ?? '';
  const [open, setOpen] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem('admin:navOpen') ?? '[]');
    } catch {
      return [];
    }
  });
  const [fly, setFly] = useState<{ title: string; top: number; left: number } | null>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const canHover = typeof window !== 'undefined' && matchMedia('(hover: hover) and (min-width: 1024px)').matches;

  // Always show the group that holds the current page
  useEffect(() => {
    if (activeGroup && !open.includes(activeGroup)) setOpen((o) => [...o, activeGroup]);
  }, [activeGroup]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    try { localStorage.setItem('admin:navOpen', JSON.stringify(open)); } catch {}
  }, [open]);
  useEffect(() => setFly(null), [route]);

  const toggle = (t: string) => {
    setFly(null);
    setOpen((o) => (o.includes(t) ? o.filter((x) => x !== t) : [...o, t]));
  };
  const showFly = (t: string, el: HTMLElement) => {
    if (!canHover || open.includes(t)) return;
    clearTimeout(closeTimer.current);
    const r = el.getBoundingClientRect();
    setFly({ title: t, top: Math.min(r.top, window.innerHeight - 60 - (navGroups.find((g) => g.title === t)?.items.length ?? 1) * 38), left: r.right + 6 });
  };
  const hideFly = () => {
    clearTimeout(closeTimer.current);
    closeTimer.current = setTimeout(() => setFly(null), 160);
  };

  const link = (it: NavEntry) => {
    const active = isActive(route, it.route);
    return (
      <a href={`#/${it.route}`} className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition ${active ? 'bg-accent-soft font-semibold text-accent' : 'text-muted hover:bg-surface-2 hover:text-fg'}`}>
        <I n={it.icon} s={16} />
        {it.label}
      </a>
    );
  };
  const flyGroup = navGroups.find((g) => g.title === fly?.title);

  return (
    <nav className="grid gap-1 p-3" aria-label="Admin">
      {navGroups.map((g) => {
        if (!g.title) return <ul key="top" className="mb-2 grid gap-0.5">{g.items.map((it) => <li key={it.route}>{link(it)}</li>)}</ul>;
        const isOpen = open.includes(g.title);
        const hasActive = g.title === activeGroup;
        return (
          <div key={g.title} onMouseEnter={(e) => showFly(g.title, e.currentTarget)} onMouseLeave={hideFly}>
            <button
              type="button"
              onClick={() => toggle(g.title)}
              aria-expanded={isOpen}
              className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 font-mono text-[11px] font-semibold tracking-widest uppercase transition hover:bg-surface-2 ${hasActive ? 'text-accent' : 'text-muted hover:text-fg'}`}
            >
              <span className="flex-1 text-left">{g.title}</span>
              {!isOpen && <span className="rounded bg-surface-2 px-1.5 text-[10px] tracking-normal">{g.items.length}</span>}
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={`transition-transform ${isOpen ? 'rotate-90' : ''}`} aria-hidden="true"><path d="m9 18 6-6-6-6" /></svg>
            </button>
            {isOpen && <ul className="mt-0.5 mb-2 grid gap-0.5 border-l border-line pl-2 ml-3">{g.items.map((it) => <li key={it.route}>{link(it)}</li>)}</ul>}
          </div>
        );
      })}

      {fly && flyGroup && createPortal(
        // Portal: the sidebar's transform would otherwise clip a fixed panel
        <div
          className="card fixed z-50 w-56 p-2 shadow-2xl"
          style={{ top: Math.max(8, fly.top), left: fly.left }}
          onMouseEnter={() => clearTimeout(closeTimer.current)}
          onMouseLeave={hideFly}
          role="menu"
        >
          <p className="px-3 pt-1 pb-1.5 font-mono text-[10px] font-semibold tracking-widest text-muted uppercase">{flyGroup.title}</p>
          <ul className="grid gap-0.5">{flyGroup.items.map((it) => <li key={it.route}>{link(it)}</li>)}</ul>
        </div>,
        document.body,
      )}
    </nav>
  );
}

/* ---------------- Shell ---------------- */
export function Shell({ session }: { session: Session }) {
  const [route, go] = useHashRoute();
  const [menu, setMenu] = useState(false);
  const [theme, setTheme] = useState(() => document.documentElement.dataset.theme ?? 'dark');

  useEffect(() => setMenu(false), [route]);

  function toggleTheme() {
    const t = theme === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = t;
    try { localStorage.setItem('theme', t); } catch {}
    setTheme(t);
  }

  let page;
  if (route === 'dashboard') page = <Dashboard go={go} />;
  else if (route === 'testimonials') page = <Testimonials />;
  else if (route === 'media') page = <MediaPage />;
  else if (route === 'messages') page = <Messages />;
  else if (route === 'subscribers') page = <Subscribers />;
  else if (route === 'consultations') page = <Consultations go={go} />;
  else if (route === 'blog') page = <BlogPosts go={go} />;
  else if (route.startsWith('blog/')) page = <BlogPosts key={route} go={go} editId={route.slice(5)} />;
  else if (route === 'projects') page = <Projects go={go} />;
  else if (route.startsWith('projects/')) page = <Projects key={route} go={go} editId={route.slice(9)} />;
  else if (route === 'newsletter') page = <Newsletter />;
  else if (route === 'email-settings') page = <EmailSettings />;
  else if (route === 'orders') page = <Orders />;
  else if (route === 'coupons') page = <Coupons />;
  else if (route === 'ebooks') page = <Ebooks go={go} />;
  else if (route.startsWith('ebooks/')) page = <Ebooks key={route} go={go} editId={route.slice(7)} />;
  else if (route === 'ebook-reviews') page = <EbookReviewsAdmin />;
  else if (route === 'ebook-categories') page = <EbookCategories />;
  else if (route === 'customers') page = <Customers />;
  else if (route === 'tutorials') page = <Tutorials go={go} />;
  else if (route.startsWith('tutorials/')) page = <Tutorials key={route} go={go} editId={route.slice(10)} />;
  else if (route === 'youtube-settings') page = <YouTubeSettings />;
  else if (route === 'project-categories') page = <ProjectCategories />;
  else if (route === 'blog-comments') page = <BlogComments />;
  else if (route === 'blog-categories') page = <BlogCategories />;
  else if (route === 'blog-authors') page = <BlogAuthors />;
  else if (route.startsWith('s/')) {
    const p = settingsPages.find((x) => x.key === route.slice(2));
    page = p ? <SettingsEditor key={p.key} page={p} /> : null;
  } else if (route.startsWith('soon/')) {
    page = (
      <div className="card grid place-items-center gap-3 p-16 text-center">
        <span className="grid h-14 w-14 place-items-center rounded-2xl bg-accent-soft text-accent"><I n="layers" s={24} /></span>
        <h1 className="text-xl font-bold">{decodeURIComponent(route.slice(5))}</h1>
        <p className="max-w-sm text-sm text-muted">This module is planned for a later phase. See PLAN.md for the full feature list.</p>
      </div>
    );
  }
  page ??= <p className="text-muted">Page not found.</p>;

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[260px_1fr]">
      <aside className={`fixed inset-y-0 left-0 z-40 w-[260px] overflow-y-auto border-r border-line bg-surface transition-[translate] lg:static lg:translate-x-0 ${menu ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="flex items-center gap-2.5 border-b border-line px-5 py-4">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-accent font-mono text-xs font-bold text-accent-contrast">MF</span>
          <div className="leading-tight">
            <p className="text-sm font-bold">MF Admin</p>
            <p className="font-mono text-[10px] text-muted">control panel</p>
          </div>
        </div>
        <SideNav route={route} />
      </aside>
      {menu && <div className="fixed inset-0 z-30 bg-black/50 lg:hidden" onClick={() => setMenu(false)} />}

      <div className="min-w-0">
        <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-line bg-bg/80 px-4 py-3 backdrop-blur sm:px-6">
          <button type="button" className="grid h-9 w-9 place-items-center rounded-lg hover:bg-surface-2 lg:hidden" onClick={() => setMenu(true)} aria-label="Open menu"><I n="menu" /></button>
          <div className="flex-1" />
          <a href="/" target="_blank" className="hidden items-center gap-1.5 text-sm text-muted hover:text-fg sm:flex"><I n="external" s={15} /> View site</a>
          <button type="button" onClick={toggleTheme} className="grid h-9 w-9 place-items-center rounded-lg text-muted hover:bg-surface-2" aria-label="Toggle theme"><I n="eye" s={16} /></button>
          <span className="hidden text-sm text-muted md:inline">{session.user.email}</span>
          <button type="button" onClick={() => supabase!.auth.signOut()} className="btn-ghost px-3 py-1.5 text-xs"><I n="logout" s={14} /> Sign out</button>
        </header>
        <main className="mx-auto max-w-6xl p-4 sm:p-6 lg:p-8">{page}</main>
      </div>
    </div>
  );
}

/* ---------------- Root ---------------- */
export default function AdminApp() {
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const [role, setRole] = useState<string | null | undefined>(undefined);
  const [recovery, setRecovery] = useState(false);

  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = supabase.auth.onAuthStateChange((event, s) => {
      if (event === 'PASSWORD_RECOVERY') setRecovery(true);
      setSession(s);
    });
    return () => data.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session || !supabase) {
      setRole(session === null ? null : undefined);
      return;
    }
    setRole(undefined);
    supabase
      .from('profiles')
      .select('role')
      .eq('id', session.user.id)
      .maybeSingle()
      .then(({ data, error }) => setRole(error ? `error:${error.message}` : (data?.role ?? 'none')));
  }, [session]);

  if (!supabase) {
    return <Center>Supabase keys are missing. Add them to <code>.env.local</code> and restart the dev server.</Center>;
  }
  if (session === undefined) return <Center>Loading…</Center>;
  if (!session || recovery) return <ToastProvider><Login recovery={recovery} /></ToastProvider>;
  if (role === undefined) return <Center>Checking access…</Center>;
  if (role !== 'admin' && role !== 'editor') {
    return (
      <Center>
        <p className="font-semibold">This account is not an admin.</p>
        <p className="mt-2 max-w-md text-sm text-muted">
          {String(role).startsWith('error:')
            ? `Database error: ${String(role).slice(6)}. Has migration 0001_core.sql been run in the Supabase SQL Editor?`
            : `Signed in as ${session.user.email}. Run the "make admin" SQL from the setup guide for this email, then reload.`}
        </p>
        <button type="button" className="btn-ghost mt-5" onClick={() => supabase!.auth.signOut()}>Sign out</button>
      </Center>
    );
  }
  return (
    <ToastProvider>
      <Shell session={session} />
    </ToastProvider>
  );
}

function Center({ children }: { children: React.ReactNode }) {
  return <div className="grid min-h-screen place-items-center p-6 text-center"><div>{children}</div></div>;
}
