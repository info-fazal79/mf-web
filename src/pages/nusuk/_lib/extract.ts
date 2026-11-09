/**
 * Pull Nusuk codes out of any pasted text (Facebook comments, chats…).
 * A Nusuk referral code is always "NG-" + exactly 8 letters/digits, e.g. NG-y3JkB7lU.
 * The lookbehind stops matches inside a longer word; the lookahead rejects a 9th character
 * and codes Facebook cut short with "..." / "…" (from "See more").
 */
export const NG_RE = /(?<![A-Za-z0-9_-])NG-[A-Za-z0-9]{8}(?![A-Za-z0-9_-]|\.\.\.|…)/g;

export function extractCodes(text: string) {
  const all = text.match(NG_RE) ?? [];
  const seen = new Map<string, string>(); // lower-case key -> first spelling seen
  for (const c of all) if (!seen.has(c.toLowerCase())) seen.set(c.toLowerCase(), c);
  return { found: all.length, unique: [...seen.values()], repeats: all.length - seen.size };
}
