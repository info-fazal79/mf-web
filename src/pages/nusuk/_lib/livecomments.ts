/**
 * Facebook live comments for Nusuk Manager → Live screen.
 * Comments are read from the Facebook Graph API straight into Nusuk Manager (nothing is stored);
 * the connection (App ID / secret, Page token) is kept in nusuk_fb_conn, which only admins can read
 * (update_52_live_comments.sql). The filter below hides code shares, links and very short comments.
 */
import { NG_RE } from './extract';
import type { Cmt } from './livecfg';

// no version in the path: Facebook then uses the app's own version, so this never goes out of date
const GRAPH = 'https://graph.facebook.com';

export type FbConn = { app_id: string; app_secret: string; page_id: string; page_name: string; page_token: string };
export type FbComment = { id: string; name: string; text: string; time: number };
export type FbPage = { id: string; name: string; access_token: string };
export type FbLive = { id: string; title: string; videoId: string };

export class FbError extends Error {
  constructor(msg: string, public code = 0) { super(msg); }
}

async function get<T>(path: string, params: Record<string, string>): Promise<T> {
  const q = new URLSearchParams(params).toString();
  let r: Response;
  try { r = await fetch(`${GRAPH}/${path}?${q}`); } catch { throw new FbError('Could not reach Facebook (internet?)'); }
  const j = (await r.json().catch(() => ({}))) as { error?: { message?: string; code?: number } } & T;
  if (!r.ok || j.error) {
    const code = j.error?.code ?? 0;
    const msg = j.error?.message ?? `Facebook error ${r.status}`;
    throw new FbError(code === 190 ? `The token is no longer valid: connect again in Settings. (${msg})` : msg, code);
  }
  return j;
}

/**
 * Turn the short token from Graph API Explorer into a long one, then list the Pages it manages.
 * A Page token taken from a long user token does not expire (until the password changes or access is removed).
 */
export async function fbConnect(appId: string, appSecret: string, userToken: string) {
  const long = await get<{ access_token: string }>('oauth/access_token', {
    grant_type: 'fb_exchange_token', client_id: appId.trim(), client_secret: appSecret.trim(), fb_exchange_token: userToken.trim(),
  });
  const perms = await get<{ data: { permission: string; status: string }[] }>('me/permissions', { access_token: long.access_token }).catch(() => ({ data: [] }));
  const granted = perms.data.filter((p) => p.status === 'granted').map((p) => p.permission);
  const pages = await get<{ data: FbPage[] }>('me/accounts', { fields: 'id,name,access_token', limit: '100', access_token: long.access_token });
  return { pages: pages.data, granted };
}
export const NEEDED_PERMS = ['pages_show_list', 'pages_read_engagement', 'pages_read_user_content'];

/** the live video the Page is broadcasting now (null = none) */
export async function fbCurrentLive(c: FbConn): Promise<FbLive | null> {
  const r = await get<{ data: { id: string; title?: string; description?: string; video?: { id: string } }[] }>(`${c.page_id}/live_videos`, {
    broadcast_status: '["LIVE"]', fields: 'id,title,description,video{id}', limit: '5', access_token: c.page_token,
  });
  const v = r.data[0];
  return v ? { id: v.id, title: v.title || v.description || 'Live video', videoId: v.video?.id ?? '' } : null;
}

/** a video ID from a Facebook link (…/videos/123…, ?v=123…, /reel/123…) or a bare number */
export function fbVideoId(s: string) {
  const t = s.trim();
  const m = t.match(/(?:videos\/(?:[^/]+\/)?|[?&]v=|reel\/|live_videos\/)(\d{6,})/) ?? t.match(/^(\d{6,})$/);
  return m ? m[1] : '';
}

type RawComment = { id: string; message?: string; created_time?: string; from?: { id?: string; name?: string } };
/** newest comments (up to 100) of a live video or a video */
export async function fbComments(objectId: string, token: string): Promise<FbComment[]> {
  const r = await get<{ data: RawComment[] }>(`${objectId}/comments`, {
    fields: 'id,message,created_time,from{id,name}', order: 'reverse_chronological', filter: 'stream', limit: '100', access_token: token,
  });
  return r.data
    .filter((x) => (x.message ?? '').trim())
    .map((x) => ({ id: x.id, name: x.from?.name ?? '', text: (x.message ?? '').trim(), time: x.created_time ? Date.parse(x.created_time) : Date.now() }));
}

// ---------------------------------------------------------------- filter
const BN = /[ঀ-৿]/;
const LINK = /(https?:\/\/|www\.|\b[\w-]+\.(com|net|org|me|ly|io|xyz|bd|link)\b|wa\.me|t\.me)/i;
// a word that mixes letters and digits, 6+ long: a Nusuk code pasted without "NG-", a referral key…
const CODEISH = /(?<![\p{L}\p{N}])(?=[\p{L}\p{N}]*\d)(?=[\p{L}\p{N}]*[A-Za-z])[A-Za-z0-9]{6,}(?![\p{L}\p{N}])/u;

/** why a comment is hidden by the filter, or '' when it may be shown */
export function hideReason(text: string, c: Cmt): string {
  const t = text.trim();
  if (!t) return 'empty';
  const low = t.toLowerCase();
  const word = c.block.find((w) => low.includes(w.toLowerCase()));
  if (word) return `word “${word}”`;
  if (!c.filter) return '';
  if (new RegExp(NG_RE.source).test(t) || /\bNG-\w+/i.test(t) || CODEISH.test(t)) return 'code';
  if (LINK.test(t)) return 'link';
  if ((t.match(/\d/g) ?? []).length >= 6) return 'numbers';
  // words made of letters (Bangla or any other script), emoji and marks left out
  const words = t.split(/\s+/).filter((w) => /[\p{L}]/u.test(w));
  if (!words.length) return 'emoji only';
  if (words.length < c.min_words || (t.match(/[\p{L}]/gu) ?? []).length < 5) return 'too short';
  if (c.bangla && !BN.test(t)) return 'not Bangla';
  return '';
}

/** first letter for the round avatar, and a steady colour from the name */
export function initial(name: string) { return (name.trim()[0] ?? '?').toUpperCase(); }
export function nameHue(name: string) { let h = 0; for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) % 360; return h; }
