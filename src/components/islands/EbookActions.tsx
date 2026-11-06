import { useEffect, useState, type FormEvent } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { addToCart, readCart } from '@/lib/cart';
import { AuthForm } from './AccountApp';

type Props = {
  id: string;
  slug: string;
  title: string;
  cover: string;
  accessMode: 'free_read' | 'free_download' | 'email' | 'whatsapp' | 'paid';
  allowDownload: boolean;
  hasPdf: boolean;
  hasPreview: boolean;
  price: number;
  whatsappUrl: string | null;
};

const taka = (n: number) => `৳${Number.isInteger(n) ? n : n.toFixed(2)}`;
const Btn = ({ href, children, primary = true, onClick }: { href?: string; children: React.ReactNode; primary?: boolean; onClick?: () => void }) =>
  href ? (
    <a href={href} className={`${primary ? 'btn-primary' : 'btn-ghost'} w-full py-3`} target={href.startsWith('http') ? '_blank' : undefined} rel="noopener">
      {children}
    </a>
  ) : (
    <button type="button" onClick={onClick} className={`${primary ? 'btn-primary' : 'btn-ghost'} w-full py-3`}>
      {children}
    </button>
  );

export default function EbookActions(p: Props) {
  const [session, setSession] = useState<Session | null>(null);
  const [owned, setOwned] = useState(false);
  const [cart, setCart] = useState(false);
  const [unlocked, setUnlocked] = useState(false);
  const [msg, setMsg] = useState('');
  const [showLogin, setShowLogin] = useState(false);
  const [busy, setBusy] = useState(false);
  const readUrl = `/read?book=${p.slug}`;

  useEffect(() => {
    setCart(readCart().some((i) => i.id === p.id));
    const onCart = () => setCart(readCart().some((i) => i.id === p.id));
    window.addEventListener('cart:change', onCart);
    try { setUnlocked(localStorage.getItem(`ebook:unlocked:${p.id}`) === '1'); } catch {}
    if (!supabase) return () => window.removeEventListener('cart:change', onCart);
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    supabase.rpc('increment_ebook_views', { book_slug: p.slug }).then(() => {});
    return () => {
      data.subscription.unsubscribe();
      window.removeEventListener('cart:change', onCart);
    };
  }, [p.id, p.slug]);

  useEffect(() => {
    if (!session || !supabase) return setOwned(false);
    setShowLogin(false);
    supabase.from('ebook_library').select('ebook_id').eq('ebook_id', p.id).maybeSingle().then(({ data }) => setOwned(Boolean(data)));
  }, [session, p.id]);

  async function download() {
    if (!supabase) return;
    setBusy(true);
    const { data: book } = await supabase.from('ebooks').select('pdf_path').eq('id', p.id).single();
    const path = book?.pdf_path;
    if (!path) {
      setBusy(false);
      return setMsg('The download file is not available yet.');
    }
    const { data, error } = await supabase.storage.from('ebooks').createSignedUrl(path, 120, { download: `${p.slug}.pdf` });
    setBusy(false);
    if (error || !data) return setMsg('Could not prepare the download. Please sign in or try again.');
    location.href = data.signedUrl;
  }

  async function claim() {
    if (!session) return setShowLogin(true);
    setBusy(true);
    const { error } = await supabase!.from('ebook_library').insert({ user_id: session.user.id, ebook_id: p.id, source: 'free' });
    setBusy(false);
    if (error && error.code !== '23505') return setMsg(error.message);
    setOwned(true);
    setMsg('Added to your library ✓');
  }

  async function emailUnlock(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    if (!form.reportValidity()) return;
    const f = Object.fromEntries(new FormData(form)) as Record<string, string>;
    const email = f.email.trim().toLowerCase();
    setBusy(true);
    await supabase?.from('ebook_leads').insert({ ebook_id: p.id, name: f.name?.trim() || null, email });
    await supabase?.from('subscribers').insert({ email, source: `ebook:${p.slug}` });
    setBusy(false);
    try { localStorage.setItem(`ebook:unlocked:${p.id}`, '1'); } catch {}
    setUnlocked(true);
  }

  const canDownload = p.hasPdf && (p.accessMode === 'free_download' || (p.accessMode === 'email' && unlocked) || (p.accessMode === 'paid' && owned && p.allowDownload));
  const extras = (
    <>
      {canDownload && <Btn primary={false} onClick={download}>{busy ? 'Preparing…' : '⬇ Download PDF'}</Btn>}
      {p.accessMode !== 'paid' && p.accessMode !== 'whatsapp' && !owned && (
        <button type="button" onClick={claim} className="text-sm text-muted hover:text-accent">{session ? '+ Save to my library' : '+ Sign in to save it to your library'}</button>
      )}
    </>
  );

  let main: React.ReactNode;
  if (p.accessMode === 'paid') {
    main = owned ? (
      <>
        <div className="rounded-xl bg-accent-soft px-4 py-3 text-sm font-semibold text-accent">✓ You own this e-book</div>
        <Btn href={readUrl}>📖 Read now</Btn>
      </>
    ) : (
      <>
        <p className="text-3xl font-extrabold">{taka(p.price)}</p>
        {cart ? (
          <Btn onClick={() => document.querySelector<HTMLElement>('[data-open="cart"]')?.click()}>✓ In cart · View cart</Btn>
        ) : (
          <Btn onClick={() => addToCart({ id: p.id, slug: p.slug, title: p.title, cover: p.cover, price: p.price })}>🛒 Add to cart</Btn>
        )}
        {p.hasPreview && <Btn href={readUrl} primary={false}>Read a free sample</Btn>}
        {!session && <button type="button" onClick={() => setShowLogin(true)} className="text-sm text-muted hover:text-accent">Already bought it? Sign in</button>}
      </>
    );
  } else if (p.accessMode === 'whatsapp') {
    main = (
      <>
        <p className="text-sm text-muted">This free e-book is shared in my WhatsApp group. Join to get it instantly.</p>
        {p.whatsappUrl ? <Btn href={p.whatsappUrl}>Join WhatsApp group</Btn> : <p className="text-sm text-red-500">WhatsApp link coming soon.</p>}
        {p.hasPreview && <Btn href={readUrl} primary={false}>Read a free sample</Btn>}
      </>
    );
  } else if (p.accessMode === 'email' && !unlocked && !owned) {
    main = (
      <form onSubmit={emailUnlock} className="grid gap-3" noValidate>
        <p className="text-sm text-muted">Enter your email to get this e-book free. You'll also receive new e-books and tips (unsubscribe anytime).</p>
        <input name="name" placeholder="Your name" autoComplete="name" className="input" />
        <input name="email" type="email" required placeholder="you@example.com" autoComplete="email" className="input" />
        <button type="submit" disabled={busy} className="btn-primary py-3">{busy ? 'Unlocking…' : 'Get the free e-book'}</button>
      </form>
    );
  } else {
    main = <Btn href={readUrl}>📖 Read online, free</Btn>;
  }

  return (
    <div className="grid gap-3">
      {main}
      {extras}
      {msg && <p className="text-center text-sm text-accent" role="status">{msg}</p>}
      {showLogin && !session && (
        <div className="card mt-2 p-5">
          <AuthForm compact />
        </div>
      )}
    </div>
  );
}
