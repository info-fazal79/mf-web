/** Tiny browser cart for e-books. Checkout and payment arrive in Phase 8. */
export type CartItem = { id: string; slug: string; title: string; cover: string; price: number };
const KEY = 'cart:v1';

export function readCart(): CartItem[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '[]');
  } catch {
    return [];
  }
}
function save(items: CartItem[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(items));
  } catch {}
  window.dispatchEvent(new CustomEvent('cart:change', { detail: items }));
}
export function addToCart(item: CartItem) {
  const items = readCart();
  if (!items.some((i) => i.id === item.id)) save([...items, item]);
}
export function removeFromCart(id: string) {
  save(readCart().filter((i) => i.id !== id));
}
export function clearCart() {
  save([]);
}
export const inCart = (id: string) => readCart().some((i) => i.id === id);
