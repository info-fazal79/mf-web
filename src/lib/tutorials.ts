/** Build-time tutorials data + YouTube helpers (shared with the admin). */
import { createClient } from '@supabase/supabase-js';

export type Lesson = {
  id: string;
  youtube_id: string;
  title: string;
  description: string | null;
  duration_seconds: number | null;
  thumbnail_url: string | null;
  position: number;
  resources: { name: string; url: string }[];
};
export type Playlist = {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  cover_url: string | null;
  topic: string | null;
  level: 'beginner' | 'intermediate' | 'advanced' | 'all';
  language: string;
  featured: boolean;
  sort_order: number;
  updated_at: string;
  lessons: Lesson[];
};

let cache: { at: number; promise: Promise<Playlist[]> } | null = null;
const TTL = import.meta.env.DEV ? 1500 : Infinity;

async function load(): Promise<Playlist[]> {
  const url = import.meta.env.PUBLIC_SUPABASE_URL as string | undefined;
  const key = import.meta.env.PUBLIC_SUPABASE_ANON_KEY as string | undefined;
  if (!url || !key) return [];
  const sb = createClient(url, key, { auth: { persistSession: false } });
  const { data, error } = await sb
    .from('tutorial_playlists')
    .select('id,title,slug,description,cover_url,topic,level,language,featured,sort_order,updated_at,lessons:tutorial_videos(id,youtube_id,title,description,duration_seconds,thumbnail_url,position,resources)')
    .eq('status', 'published')
    .order('sort_order');
  if (error) {
    console.warn('[tutorials] unavailable:', error.message);
    return [];
  }
  return (data as unknown as Playlist[]).map((p) => ({ ...p, lessons: [...p.lessons].sort((a, b) => a.position - b.position) }));
}

export function getTutorials() {
  if (!cache || Date.now() - cache.at > TTL) cache = { at: Date.now(), promise: load() };
  return cache.promise;
}

/* ---------------- YouTube helpers ---------------- */
export function youtubeId(input: string): string | null {
  const s = input.trim();
  if (/^[\w-]{11}$/.test(s)) return s;
  const m = s.match(/(?:youtu\.be\/|[?&]v=|embed\/|shorts\/|live\/)([\w-]{11})/);
  return m ? m[1] : null;
}
export function youtubePlaylistId(input: string): string | null {
  const m = input.match(/[?&]list=([\w-]+)/);
  if (m) return m[1];
  return /^(PL|UU|OL|FL)[\w-]{10,}$/.test(input.trim()) ? input.trim() : null;
}
export const thumb = (id: string, q: 'mq' | 'hq' | 'maxres' = 'hq') => `https://i.ytimg.com/vi/${id}/${q}default.jpg`;

/** "PT1H2M3S" → seconds */
export function isoDuration(iso: string): number {
  const m = iso.match(/P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!m) return 0;
  const [, d, h, mi, s] = m.map((x) => Number(x) || 0);
  return d * 86400 + h * 3600 + mi * 60 + s;
}

export function fmtDuration(sec: number | null | undefined, long = false): string {
  if (!sec) return long ? '' : '–:–';
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  if (long) return h ? `${h}h ${m}m` : m ? `${m} min` : `${s}s`;
  return h ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}` : `${m}:${String(s).padStart(2, '0')}`;
}

export const totalSeconds = (p: Pick<Playlist, 'lessons'>) => p.lessons.reduce((a, l) => a + (l.duration_seconds ?? 0), 0);
export const levelLabel: Record<Playlist['level'], string> = { beginner: 'Beginner', intermediate: 'Intermediate', advanced: 'Advanced', all: 'All levels' };
