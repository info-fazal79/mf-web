/**
 * The Nusuk Manager admin session on the public pages (same site): lets the quiz show
 * hidden / preview content to the admin. (Moved here from the old campaign module.)
 */
const URL_ = import.meta.env.PUBLIC_SUPABASE_URL as string | undefined;
const KEY = import.meta.env.PUBLIC_SUPABASE_ANON_KEY as string | undefined;

/** The admin's Supabase session (same site, saved by Nusuk Manager), refreshed if it ran out. */
export async function adminToken(): Promise<string | null> {
  if (!URL_ || !KEY) return null;
  const key = `sb-${new URL(URL_).hostname.split('.')[0]}-auth-token`;
  let s: { access_token?: string; refresh_token?: string; expires_at?: number } | null = null;
  try { s = JSON.parse(localStorage.getItem(key) ?? 'null'); } catch { return null; }
  if (!s?.access_token) return null;
  if ((s.expires_at ?? 0) * 1000 > Date.now() + 60_000) return s.access_token;
  if (!s.refresh_token) return null;
  try {
    const r = await fetch(`${URL_}/auth/v1/token?grant_type=refresh_token`, {
      method: 'POST',
      headers: { apikey: KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: s.refresh_token }),
    });
    if (!r.ok) return null;
    const n = await r.json();
    if (!n.expires_at && n.expires_in) n.expires_at = Math.floor(Date.now() / 1000) + n.expires_in;
    localStorage.setItem(key, JSON.stringify({ ...s, ...n }));
    return n.access_token ?? null;
  } catch {
    return null;
  }
}
