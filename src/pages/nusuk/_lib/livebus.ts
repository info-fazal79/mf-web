/**
 * Instant link between Nusuk Manager → Live screen and /nusuk/live (Supabase Realtime "broadcast").
 * The admin sends each change the moment it is made; every open live page (OBS and the preview)
 * applies it at once. Nothing is stored here: the database is still the source of truth, and the
 * live page keeps checking it every few seconds in case a message is missed.
 */
import { createClient, type RealtimeChannel, type SupabaseClient } from '@supabase/supabase-js';

export const LIVE_CHANNEL = 'nusuk-live';
export type LiveMsg = { type: 'cfg'; cfg: unknown } | { type: 'draw' };

/** live page: listen (anonymous) */
export function listenLive(onMsg: (m: LiveMsg) => void) {
  const url = import.meta.env.PUBLIC_SUPABASE_URL as string | undefined;
  const key = import.meta.env.PUBLIC_SUPABASE_ANON_KEY as string | undefined;
  if (!url || !key) return;
  try {
    const c = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false, storageKey: 'nusuk-live-bus' } });
    c.channel(LIVE_CHANNEL, { config: { broadcast: { self: false } } })
      .on('broadcast', { event: 'live' }, ({ payload }) => onMsg(payload as LiveMsg))
      .subscribe();
  } catch { /* realtime not available: the live page still checks every few seconds */ }
}

/** admin: one channel for the page, messages go out at once */
export function liveSender(sb: SupabaseClient | null) {
  let ch: RealtimeChannel | null = null;
  let ready = false;
  if (sb) {
    ch = sb.channel(LIVE_CHANNEL, { config: { broadcast: { self: false, ack: false } } });
    ch.subscribe((status) => { ready = status === 'SUBSCRIBED'; });
  }
  return {
    send(m: LiveMsg) {
      if (!ch || !ready) return;
      ch.send({ type: 'broadcast', event: 'live', payload: m }).catch(() => {});
    },
    close() { if (ch && sb) sb.removeChannel(ch); },
  };
}
