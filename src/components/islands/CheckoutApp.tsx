import { useEffect, useMemo, useState, type FormEvent } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { clearCart, readCart, removeFromCart, type CartItem } from '@/lib/cart';
import { AuthForm } from './AccountApp';

type Payments = { bkashEnabled: boolean; bkashNumber: string; bkashType: string; nagadEnabled: boolean; nagadNumber: string; nagadType: string; note: string; verifyHours: number };
type Quote = { subtotal: number; discount: number; total: number; coupon_ok: boolean | null; coupon_message: string | null; items: { ebook_id: string; title: string; slug: string; price: number }[] };
type Placed = { order_no: string; total: number; status: string };

const taka = (n: number) => `৳${Number.isInteger(Number(n)) ? Number(n) : Number(n).toFixed(2)}`;
const BRAND = {
  bkash: { name: 'bKash', color: '#e2136e', app: 'bKash app → Send Money' },
  nagad: { name: 'Nagad', color: '#f6921e', app: 'Nagad app → Send Money' },
} as const;

export default function CheckoutApp({ defaults, whatsapp }: { defaults: Payments; whatsapp: string }) {
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [pay, setPay] = useState<Payments>(defaults);
  const [quote, setQuote] = useState<Quote | null>(null);
  const [coupon, setCoupon] = useState('');
  const [applied, setApplied] = useState('');
  const [method, setMethod] = useState<'bkash' | 'nagad'>(defaults.bkashEnabled ? 'bkash' : 'nagad');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [placed, setPlaced] = useState<Placed | null>(null);
  const [copied, setCopied] = useState('');

  useEffect(() => {
    const sync = () => setCart(readCart());
    sync();
    window.addEventListener('cart:change', sync);
    if (!supabase) return setSession(null);
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    // Live payment numbers (so changes in admin apply without a rebuild)
    supabase.from('site_settings').select('value').eq('key', 'payments').maybeSingle().then(({ data: row }) => row?.value && setPay((p) => ({ ...p, ...(row.value as Payments) })));
    return () => {
      data.subscription.unsubscribe();
      window.removeEventListener('cart:change', sync);
    };
  }, []);

  useEffect(() => {
    if (!pay.bkashEnabled && pay.nagadEnabled) setMethod('nagad');
    if (!pay.nagadEnabled && pay.bkashEnabled) setMethod('bkash');
  }, [pay.bkashEnabled, pay.nagadEnabled]);

  const ids = useMemo(() => cart.map((c) => c.id), [cart]);
  async function refreshQuote(code = applied) {
    if (!session || !supabase || !ids.length) return setQuote(null);
    const { data, error } = await supabase.rpc('quote_order', { p_items: ids, p_coupon: code || null });
    if (error) return setErr(error.message);
    const q = (data as Quote[])[0];
    setQuote({ ...q, subtotal: Number(q.subtotal), discount: Number(q.discount), total: Number(q.total) });
  }
  useEffect(() => {
    refreshQuote();
  }, [session, ids.join(',')]); // eslint-disable-line react-hooks/exhaustive-deps

  async function applyCoupon() {
    const code = coupon.trim().toUpperCase();
    setApplied(code);
    await refreshQuote(code);
  }

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!quote || !supabase) return;
    const form = e.currentTarget;
    if (!form.reportValidity()) return;
    const f = Object.fromEntries(new FormData(form)) as Record<string, string>;
    setBusy(true);
    setErr('');
    const { data, error } = await supabase.rpc('place_order', {
      p_items: ids,
      p_coupon: quote.coupon_ok ? applied : null,
      p_method: method,
      p_payer: f.payer ?? '',
      p_trx: f.trx ?? '',
      p_name: f.name ?? '',
      p_phone: f.phone ?? '',
    });
    setBusy(false);
    if (error) return setErr(error.message.replace(/^.*?ERROR:\s*/, ''));
    const row = (data as Placed[])[0];
    setPlaced(row);
    clearCart();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function copy(text: string, label: string) {
    navigator.clipboard.writeText(text);
    setCopied(label);
    setTimeout(() => setCopied(''), 1500);
  }

  /* ---------- Success ---------- */
  if (placed) {
    const paid = placed.status === 'paid';
    const msg = `Hi! I placed order ${placed.order_no} (${taka(placed.total)}) on muhammadfazal.com. Please verify my payment.`;
    return (
      <div className="card mx-auto max-w-xl p-8 text-center">
        <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-accent-soft text-3xl text-accent">✓</div>
        <h2 className="mt-5 text-2xl font-bold">{paid ? 'Your e-books are ready!' : 'Order received!'}</h2>
        <p className="mt-2 text-muted">
          Order <strong className="font-mono text-fg">{placed.order_no}</strong> · {taka(placed.total)}
        </p>
        {paid ? (
          <p className="mt-4 text-sm text-muted">Everything has been added to your library.</p>
        ) : (
          <p className="mt-4 text-sm text-muted">
            I'm verifying your {BRAND[method].name} payment. This usually takes less than <strong>{pay.verifyHours} hours</strong>. Your e-books will unlock in your library automatically, and you can track the status under <em>My account → Orders</em>.
          </p>
        )}
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <a href="/account" className="btn-primary">{paid ? 'Open my library' : 'View my orders'}</a>
          {!paid && (
            <a href={`https://wa.me/${whatsapp}?text=${encodeURIComponent(msg)}`} target="_blank" rel="noopener" className="btn-ghost">
              Speed it up on WhatsApp
            </a>
          )}
        </div>
      </div>
    );
  }

  if (session === undefined) return <p className="py-16 text-center text-muted">Loading…</p>;

  /* ---------- Empty cart ---------- */
  if (!cart.length) {
    return (
      <div className="card mx-auto max-w-md p-10 text-center">
        <p className="text-lg font-semibold">Your cart is empty</p>
        <p className="mt-1 text-sm text-muted">Add a premium e-book to check out.</p>
        <a href="/ebooks" className="btn-primary mt-6">Browse e-books</a>
      </div>
    );
  }

  const number = method === 'bkash' ? pay.bkashNumber : pay.nagadNumber;
  const type = method === 'bkash' ? pay.bkashType : pay.nagadType;
  const owned = quote ? cart.filter((c) => !quote.items.some((i) => i.ebook_id === c.id)) : [];
  const total = quote?.total ?? cart.reduce((a, c) => a + c.price, 0);
  const free = quote !== null && quote.total === 0 && quote.items.length > 0;

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_400px]">
      {/* Left: account + payment */}
      <div className="grid content-start gap-6">
        <section className="card p-6">
          <h2 className="flex items-center gap-3 text-lg font-bold"><Step n={1} /> Your account</h2>
          {session ? (
            <p className="mt-3 text-sm text-muted">
              Signed in as <strong className="text-fg">{session.user.email}</strong>. Your e-books will be added to this account.{' '}
              <button type="button" className="text-accent hover:underline" onClick={() => supabase!.auth.signOut()}>Switch account</button>
            </p>
          ) : (
            <div className="mt-4">
              <p className="mb-4 text-sm text-muted">Sign in or create a free account. That's where your purchased e-books will live.</p>
              <AuthForm />
            </div>
          )}
        </section>

        <section className={`card p-6 ${session ? '' : 'pointer-events-none opacity-50'}`} aria-disabled={!session}>
          <h2 className="flex items-center gap-3 text-lg font-bold"><Step n={2} /> {free ? 'Confirm' : 'Pay & confirm'}</h2>

          {free ? (
            <form onSubmit={submit} className="mt-4 grid gap-4">
              <p className="text-sm text-muted">Your coupon covers the full price. No payment needed.</p>
              {err && <p className="text-sm text-red-500" role="alert">{err}</p>}
              <button type="submit" disabled={busy} className="btn-primary py-3">{busy ? 'Processing…' : 'Get my e-books'}</button>
            </form>
          ) : (
            <>
              <div className="mt-4 grid grid-cols-2 gap-3" role="radiogroup" aria-label="Payment method">
                {(['bkash', 'nagad'] as const).map((m) => {
                  const enabled = m === 'bkash' ? pay.bkashEnabled : pay.nagadEnabled;
                  if (!enabled) return null;
                  return (
                    <button key={m} type="button" role="radio" aria-checked={method === m} onClick={() => setMethod(m)} className="rounded-xl border-2 px-4 py-3 text-left transition" style={{ borderColor: method === m ? BRAND[m].color : 'var(--border)' }}>
                      <span className="block text-lg font-extrabold" style={{ color: BRAND[m].color }}>{BRAND[m].name}</span>
                      <span className="text-xs text-muted">Mobile banking</span>
                    </button>
                  );
                })}
              </div>

              {!number ? (
                <p className="mt-4 rounded-xl bg-yellow-500/15 p-4 text-sm text-yellow-700 dark:text-yellow-300">
                  {BRAND[method].name} payments are being set up. Please <a className="underline" href={`https://wa.me/${whatsapp}`} target="_blank" rel="noopener">message me on WhatsApp</a> to order.
                </p>
              ) : (
                <>
                  <ol className="mt-5 grid gap-3 text-sm">
                    <li className="flex gap-3">
                      <Num>1</Num>
                      <span>Open the <strong>{BRAND[method].app.replace('Send Money', type === 'Merchant' ? 'Payment' : type === 'Agent' ? 'Cash Out' : 'Send Money')}</strong>.</span>
                    </li>
                    <li className="flex gap-3">
                      <Num>2</Num>
                      <span className="flex-1">
                        Send <strong className="text-base">{taka(total)}</strong> to this {type.toLowerCase()} number:
                        <span className="mt-2 flex items-center gap-2">
                          <span className="rounded-lg border-2 border-dashed px-3 py-1.5 font-mono text-lg font-bold tracking-wider" style={{ borderColor: BRAND[method].color }}>{number}</span>
                          <button type="button" className="btn-ghost px-3 py-1.5 text-xs" onClick={() => copy(number, 'number')}>{copied === 'number' ? 'Copied ✓' : 'Copy'}</button>
                          <button type="button" className="btn-ghost px-3 py-1.5 text-xs" onClick={() => copy(String(total), 'amount')}>{copied === 'amount' ? 'Copied ✓' : 'Copy amount'}</button>
                        </span>
                      </span>
                    </li>
                    <li className="flex gap-3">
                      <Num>3</Num>
                      <span>Copy the <strong>Transaction ID (TrxID)</strong> from the confirmation SMS and enter it below.</span>
                    </li>
                  </ol>
                  {pay.note && <p className="mt-3 rounded-lg bg-surface-2 px-3 py-2 text-xs text-muted">{pay.note}</p>}

                  <form onSubmit={submit} className="mt-5 grid gap-4" noValidate>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div>
                        <label className="label" htmlFor="co-payer">{BRAND[method].name} number you paid from *</label>
                        <input id="co-payer" name="payer" required inputMode="tel" placeholder="01XXXXXXXXX" pattern="(\+?88)?01[3-9][0-9]{8}" className="input font-mono" />
                      </div>
                      <div>
                        <label className="label" htmlFor="co-trx">Transaction ID *</label>
                        <input id="co-trx" name="trx" required placeholder="e.g. 9AB3CD7XYZ" minLength={6} maxLength={20} autoCapitalize="characters" className="input font-mono uppercase" />
                      </div>
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div>
                        <label className="label" htmlFor="co-name">Your name</label>
                        <input id="co-name" name="name" defaultValue={String(session?.user.user_metadata?.full_name ?? '')} autoComplete="name" className="input" />
                      </div>
                      <div>
                        <label className="label" htmlFor="co-phone">Contact phone (optional)</label>
                        <input id="co-phone" name="phone" inputMode="tel" autoComplete="tel" className="input" />
                      </div>
                    </div>
                    {err && <p className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-500" role="alert">{err}</p>}
                    <button type="submit" disabled={busy || !quote || !quote.items.length} className="btn-primary py-3 text-base">
                      {busy ? 'Submitting…' : `I've paid ${taka(total)}, confirm order`}
                    </button>
                    <p className="text-center text-xs text-muted">Your e-books unlock as soon as the payment is verified (usually within {pay.verifyHours} hours).</p>
                  </form>
                </>
              )}
            </>
          )}
        </section>
      </div>

      {/* Right: summary */}
      <aside className="lg:sticky lg:top-28 lg:self-start">
        <div className="card p-6">
          <h2 className="text-lg font-bold">Order summary</h2>
          <ul className="mt-4 grid gap-3">
            {cart.map((c) => {
              const isOwned = owned.some((o) => o.id === c.id);
              const line = quote?.items.find((i) => i.ebook_id === c.id);
              return (
                <li key={c.id} className={`flex items-center gap-3 ${isOwned ? 'opacity-50' : ''}`}>
                  {c.cover ? <img src={c.cover} alt="" className="h-14 w-10 rounded object-cover" /> : <span className="grid h-14 w-10 place-items-center rounded bg-accent-soft text-[10px] font-bold text-accent">MF</span>}
                  <div className="min-w-0 flex-1">
                    <p className="line-clamp-2 text-sm font-semibold">{c.title}</p>
                    {isOwned ? <p className="text-xs text-accent">Already in your library</p> : <button type="button" className="text-xs text-muted hover:text-red-500" onClick={() => removeFromCart(c.id)}>Remove</button>}
                  </div>
                  <span className="text-sm font-semibold">{isOwned ? '—' : taka(line?.price ?? c.price)}</span>
                </li>
              );
            })}
          </ul>

          <div className="mt-5 flex gap-2 border-t border-line pt-5">
            <input value={coupon} onChange={(e) => setCoupon(e.target.value.toUpperCase())} placeholder="Coupon code" disabled={!session} className="input font-mono uppercase" aria-label="Coupon code" />
            <button type="button" onClick={applyCoupon} disabled={!session || !coupon.trim()} className="btn-ghost shrink-0 px-4">Apply</button>
          </div>
          {!session && <p className="mt-1 text-xs text-muted">Sign in to use a coupon.</p>}
          {quote?.coupon_message && <p className={`mt-2 text-sm ${quote.coupon_ok ? 'text-accent' : 'text-red-500'}`}>{quote.coupon_message}</p>}

          <dl className="mt-5 grid gap-2 text-sm">
            <div className="flex justify-between"><dt className="text-muted">Subtotal</dt><dd>{taka(quote?.subtotal ?? total)}</dd></div>
            {quote && quote.discount > 0 && <div className="flex justify-between text-accent"><dt>Discount</dt><dd>−{taka(quote.discount)}</dd></div>}
            <div className="flex justify-between border-t border-line pt-3 text-lg font-bold"><dt>Total</dt><dd>{taka(total)}</dd></div>
          </dl>
          <ul className="mt-5 grid gap-1.5 text-xs text-muted">
            <li>✓ Lifetime access in your online library</li>
            <li>✓ Highlights, notes and progress sync on all devices</li>
            <li>✓ Help on WhatsApp if anything goes wrong</li>
          </ul>
        </div>
      </aside>
    </div>
  );
}

const Step = ({ n }: { n: number }) => <span className="grid h-7 w-7 place-items-center rounded-full bg-accent text-sm font-bold text-accent-contrast">{n}</span>;
const Num = ({ children }: { children: React.ReactNode }) => <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full border border-line font-mono text-xs">{children}</span>;
