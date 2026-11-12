/**
 * Reward Club raffle wheel, shared by Nusuk Manager (Reward Club → Raffle draw) and the live screen.
 * Every ticket is one slice; one person's slices are spread around the wheel (never side by side
 * when it can be avoided). Big draws show a fair sample of slices: the real pick is made on the
 * server over ALL tickets (nusuk_admin_club_spin), the wheel only lands on the winner.
 */
export type WheelPerson = { k: number; name: string; t: number }; // k = member SL, t = tickets
export type Slot = { k: number; name: string };

export const MAX_SLOTS = 120;
const PALETTES: Record<string, string[]> = {
  green: ['#075e45', '#c9a227', '#0b7a5a', '#e0b93a', '#05503b', '#d4ab2c'],
  mint: ['#0b5a43', '#2bb38a', '#0e7a5c', '#7fd6b5', '#06473a', '#4cc39c'],
  cream: ['#0a7a59', '#c9a227', '#0d5c46', '#e3b94a', '#14805f', '#b98f1f'],
  navy: ['#1d3b7a', '#4fe3d0', '#2b4f9a', '#2fb8a8', '#16306a', '#7fe8dc'],
};

/** Small seeded random (same seed → same wheel on every screen) */
function rng(seed: number) {
  let s = seed >>> 0 || 1;
  return () => { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; return (s >>> 0) / 4294967296; };
}

/** One slot per ticket (sampled down to MAX_SLOTS by ticket weight), shuffled, same person not side by side. */
export function buildSlots(people: WheelPerson[], seed = 1, max = MAX_SLOTS): Slot[] {
  const rand = rng(seed);
  const total = people.reduce((a, p) => a + Math.max(0, p.t), 0);
  if (!total) return [];
  let slots: Slot[] = [];
  if (total <= max) {
    for (const p of people) for (let i = 0; i < p.t; i++) slots.push({ k: p.k, name: p.name });
  } else {
    // proportional share of the visible slices (at least one each while there is room)
    const share = people.map((p) => ({ p, n: Math.max(people.length <= max ? 1 : 0, Math.round((p.t / total) * max)) }));
    for (const { p, n } of share) for (let i = 0; i < n && slots.length < max * 1.2; i++) slots.push({ k: p.k, name: p.name });
    if (!slots.length) slots = people.slice(0, max).map((p) => ({ k: p.k, name: p.name }));
  }
  // shuffle
  for (let i = slots.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [slots[i], slots[j]] = [slots[j], slots[i]]; }
  // spread: swap a slot that sits next to the same person with a later one that does not
  for (let pass = 0; pass < 3; pass++) {
    for (let i = 0; i < slots.length; i++) {
      const next = (i + 1) % slots.length;
      if (slots.length > 2 && slots[i].k === slots[next].k) {
        for (let j = 0; j < slots.length; j++) {
          const jp = (j - 1 + slots.length) % slots.length, jn = (j + 1) % slots.length;
          if (slots[j].k !== slots[i].k && slots[jp].k !== slots[i].k && slots[jn].k !== slots[i].k && j !== i && j !== next) {
            [slots[next], slots[j]] = [slots[j], slots[next]];
            break;
          }
        }
      }
    }
  }
  return slots;
}

/** Make sure the winner has a slice to land on (big draws are sampled) and return the slice index. */
export function landingIndex(slots: Slot[], winner: Slot, seed = 7): { slots: Slot[]; index: number } {
  const mine = slots.map((s, i) => (s.k === winner.k ? i : -1)).filter((i) => i >= 0);
  if (mine.length) return { slots, index: mine[Math.floor(rng(seed)() * mine.length)] };
  const copy = slots.slice();
  const i = Math.floor(rng(seed)() * copy.length);
  copy[i] = winner;
  return { slots: copy, index: i };
}

/** The rotation (deg) that puts slice `index` under the pointer at the top, after `turns` full turns. */
export function spinTo(current: number, index: number, count: number, turns = 8) {
  const a = 360 / count;
  const jitter = (Math.random() - 0.5) * a * 0.5;
  const target = -(index * a + a / 2 + jitter);
  const base = current - (current % 360);
  return base + 360 * turns + (((target % 360) + 360) % 360);
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

/** SVG of the wheel (slices + names), without the pointer. Rotate the returned group's parent to spin. */
export function wheelSvg(slots: Slot[], theme = 'green') {
  const colors = PALETTES[theme] ?? PALETTES.green;
  const n = Math.max(slots.length, 1);
  const a = 360 / n;
  const R = 200;
  const pt = (deg: number, r = R) => { const t = ((deg - 90) * Math.PI) / 180; return [R + r * Math.cos(t), R + r * Math.sin(t)]; };
  const font = n > 90 ? 7 : n > 60 ? 8.5 : n > 30 ? 10.5 : n > 14 ? 13 : 15;
  let body = slots.length ? '' : `<circle cx="200" cy="200" r="${R}" fill="#e7e1cf"/>`;
  slots.forEach((s, i) => {
    const [x1, y1] = pt(i * a), [x2, y2] = pt((i + 1) * a);
    const mid = i * a + a / 2;
    const [tx, ty] = pt(mid, R * 0.62);
    const path = n === 1 ? `M ${R} 0 A ${R} ${R} 0 1 1 ${R - 0.01} 0 Z` : `M ${R} ${R} L ${x1} ${y1} A ${R} ${R} 0 ${a > 180 ? 1 : 0} 1 ${x2} ${y2} Z`;
    const label = s.name.length > 12 ? `${s.name.slice(0, 11)}…` : s.name;
    body += `<path d="${path}" fill="${colors[i % colors.length]}" stroke="#fff" stroke-width="${n > 80 ? 0.4 : 1.2}"/>`;
    body += `<text x="${tx}" y="${ty}" fill="#fff" font-size="${font}" font-weight="700" font-family="Hind Siliguri, sans-serif" text-anchor="middle" dominant-baseline="middle" transform="rotate(${mid - 90} ${tx} ${ty})">${esc(label)}</text>`;
  });
  body += `<circle cx="200" cy="200" r="28" fill="#063d2d" stroke="#ffe08a" stroke-width="4"/>`;
  return `<svg viewBox="0 0 400 400" class="h-full w-full" aria-hidden="true">${body}</svg>`;
}

/** The pointer at the top of the wheel */
export const POINTER_SVG = '<svg viewBox="0 0 30 34" class="h-full w-full" aria-hidden="true"><path d="M15 34 L1 4 Q15 -4 29 4 Z" fill="#b91c1c" stroke="#fff" stroke-width="2"/></svg>';

/** Bengali ordinal for places: ১ম, ২য়, ৩য়, ৪র্থ, ৫ম… */
export function bnPlace(n: number) {
  const d = String(n).replace(/\d/g, (x) => '০১২৩৪৫৬৭৮৯'[Number(x)]);
  return n === 1 ? '১ম' : n === 2 ? '২য়' : n === 3 ? '৩য়' : n === 4 ? '৪র্থ' : n === 6 ? '৬ষ্ঠ' : n <= 10 ? `${d}ম` : `${d}তম`;
}

/** Seed from a draw (competition + scope) so every screen builds the same wheel */
export function drawSeed(contest: number, scope: string) {
  let h = contest * 2654435761;
  for (const ch of scope) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return h >>> 0;
}

export const SPIN_MS = 9000;
