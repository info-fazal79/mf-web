/** Prize cards of a quiz campaign (account page and /nusuk home page): picture, place, prize. */
import type { CqPrize } from './cq';

const BN = '০১২৩৪৫৬৭৮৯';
const bn = (n: number) => String(n).replace(/\d/g, (d) => BN[Number(d)]);
const ORD: Record<number, string> = { 1: '১ম', 2: '২য়', 3: '৩য়', 4: '৪র্থ', 5: '৫ম', 6: '৬ষ্ঠ', 7: '৭ম', 8: '৮ম', 9: '৯ম', 10: '১০ম' };
export const placeName = (p: number) => `${ORD[p] ?? `${bn(p)}তম`} পুরস্কার`;
export const MEDAL = (p: number) => (p === 1 ? '🥇' : p === 2 ? '🥈' : p === 3 ? '🥉' : '🎁');
export const shownPrizes = (list: CqPrize[] | null | undefined) => (Array.isArray(list) ? list.filter((p) => p.prize?.trim()) : []).slice(0, 12);

const esc = (t: string) => t.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
/** Plain HTML for pages without React */
export function prizeCardsHtml(list: CqPrize[] | null | undefined) {
  const p = shownPrizes(list);
  if (!p.length) return '';
  return `<div class="grid gap-3 ${p.length === 1 ? '' : p.length === 2 ? 'grid-cols-2' : 'grid-cols-2 sm:grid-cols-3'}">${p.map((x) => `
    <div class="nk-prize ${x.place === 1 ? 'nk-prize-first' : ''}">
      <span class="nk-prize-place">${MEDAL(x.place)} ${placeName(x.place)}</span>
      <div class="nk-prize-img">${x.img ? `<img src="${esc(x.img)}" alt="" loading="lazy" />` : '<span aria-hidden="true">🎁</span>'}</div>
      <div class="nk-prize-name">${esc(x.prize)}</div>
    </div>`).join('')}</div>`;
}
