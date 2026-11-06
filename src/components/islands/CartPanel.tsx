import { useEffect, useState } from 'react';
import { readCart, removeFromCart, type CartItem } from '@/lib/cart';

const taka = (n: number) => `৳${Number.isInteger(n) ? n : n.toFixed(2)}`;

function syncBadge(items: CartItem[]) {
  document.querySelectorAll<HTMLElement>('[data-cart-count]').forEach((el) => {
    el.textContent = String(items.length);
    el.classList.toggle('hidden', items.length === 0);
    el.classList.toggle('grid', items.length > 0);
  });
}

export default function CartPanel() {
  const [items, setItems] = useState<CartItem[]>([]);
  useEffect(() => {
    const update = () => {
      const c = readCart();
      setItems(c);
      syncBadge(c);
    };
    update();
    window.addEventListener('cart:change', update);
    window.addEventListener('storage', update);
    return () => {
      window.removeEventListener('cart:change', update);
      window.removeEventListener('storage', update);
    };
  }, []);

  if (!items.length) {
    return (
      <div className="flex flex-col items-center py-16 text-center">
        <span className="grid h-16 w-16 place-items-center rounded-2xl bg-accent-soft text-accent">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="9" cy="20" r="1.5" /><circle cx="18" cy="20" r="1.5" /><path d="M2 3h3l2.7 12.4a2 2 0 0 0 2 1.6h7.7a2 2 0 0 0 2-1.6L21 7H6" /></svg>
        </span>
        <p className="mt-5 font-semibold">Your cart is empty</p>
        <p className="mt-1 text-sm text-muted">Browse e-books and add them to your cart.</p>
        <a href="/ebooks" className="btn-primary mt-6">Browse E-books →</a>
      </div>
    );
  }

  const total = items.reduce((a, i) => a + i.price, 0);
  return (
    <div className="flex h-full flex-col">
      <ul className="grid gap-3">
        {items.map((i) => (
          <li key={i.id} className="flex items-center gap-3 rounded-xl border border-line p-3">
            {i.cover ? <img src={i.cover} alt="" className="h-16 w-12 rounded object-cover" /> : <span className="grid h-16 w-12 place-items-center rounded bg-accent-soft text-xs font-bold text-accent">MF</span>}
            <div className="min-w-0 flex-1">
              <a href={`/ebooks/${i.slug}`} className="line-clamp-2 text-sm font-semibold hover:text-accent">{i.title}</a>
              <p className="text-sm text-accent">{taka(i.price)}</p>
            </div>
            <button type="button" onClick={() => removeFromCart(i.id)} className="text-xs text-muted hover:text-red-500" aria-label={`Remove ${i.title}`}>Remove</button>
          </li>
        ))}
      </ul>
      <div className="mt-6 border-t border-line pt-4">
        <div className="flex items-center justify-between text-lg font-bold">
          <span>Total</span>
          <span>{taka(total)}</span>
        </div>
        <a href="/checkout" className="btn-primary mt-4 w-full py-3">Proceed to checkout</a>
        <p className="mt-2 text-center text-xs text-muted">Pay with bKash or Nagad · instant access after payment</p>
      </div>
    </div>
  );
}
