/** Tiny Supabase RPC caller for the public page (no supabase-js, keeps the page light). */
const URL_ = import.meta.env.PUBLIC_SUPABASE_URL as string | undefined;
const KEY = import.meta.env.PUBLIC_SUPABASE_ANON_KEY as string | undefined;

export const rpcReady = Boolean(URL_ && KEY);

export async function rpc<T>(fn: string, args: Record<string, unknown> = {}): Promise<T> {
  if (!URL_ || !KEY) throw new Error('Supabase is not configured');
  const res = await fetch(`${URL_}/rest/v1/rpc/${fn}`, {
    method: 'POST',
    headers: { apikey: KEY, Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(args),
  });
  if (!res.ok) throw new Error(`${fn}: ${res.status} ${await res.text()}`);
  return res.json() as Promise<T>;
}

export type CodeRef = { id: number; code: string };
export type Boot = {
  enabled: boolean;
  submissions_enabled?: boolean;
  notice?: string | null;
  logo_url?: string | null;
  content?: Record<string, string>;
  remaining?: number;
  code?: CodeRef | null;
};
export type Claim = { enabled: boolean; counted?: boolean; remaining?: number; code?: CodeRef | null };
export type Submit = { ok: boolean; reason?: 'closed' | 'invalid' | 'exists' | 'busy'; status?: string };
