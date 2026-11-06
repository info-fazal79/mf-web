import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { fmtDuration, isoDuration, thumb, youtubeId, youtubePlaylistId } from '@/lib/tutorials';
import { slugify } from './blog';
import { Empty, I, ImageField, MediaLibrary, Modal, PageTitle, Panel, Toggle, useToast } from './ui';

type Level = 'beginner' | 'intermediate' | 'advanced' | 'all';
type PlaylistRow = {
  id?: string;
  title: string;
  slug: string;
  description: string;
  cover_url: string;
  topic: string;
  level: Level;
  language: string;
  youtube_playlist_id: string;
  featured: boolean;
  status: 'draft' | 'published';
  sort_order: number;
};
type LessonRow = {
  id: string;
  playlist_id: string;
  youtube_id: string;
  title: string;
  description: string | null;
  duration_seconds: number | null;
  thumbnail_url: string | null;
  position: number;
  resources: { name: string; url: string }[];
  published: boolean;
};
type YtVideo = { id: string; title: string; description: string; duration: number; thumbnail: string };

const sb = () => supabase!;
const TOPICS = ['Excel', 'Word', 'PowerPoint', 'Google Sheets', 'Apps Script', 'AI Tools', 'Other'];
const blank: PlaylistRow = { title: '', slug: '', description: '', cover_url: '', topic: 'Excel', level: 'beginner', language: 'Bangla', youtube_playlist_id: '', featured: false, status: 'draft', sort_order: 0 };

/* ---------------- YouTube API ---------------- */
async function getApiKey(): Promise<string> {
  const { data } = await sb().from('private_settings').select('value').eq('key', 'youtube').maybeSingle();
  return String((data?.value as { apiKey?: string } | undefined)?.apiKey ?? '');
}

async function oembed(id: string): Promise<Partial<YtVideo>> {
  try {
    const r = await fetch(`https://www.youtube.com/oembed?url=${encodeURIComponent(`https://www.youtube.com/watch?v=${id}`)}&format=json`);
    if (!r.ok) return {};
    const j = await r.json();
    return { title: j.title, thumbnail: thumb(id, 'mq') };
  } catch {
    return {};
  }
}

async function videoDetails(ids: string[], key: string): Promise<Map<string, YtVideo>> {
  const out = new Map<string, YtVideo>();
  for (let i = 0; i < ids.length; i += 50) {
    const chunk = ids.slice(i, i + 50);
    const r = await fetch(`https://www.googleapis.com/youtube/v3/videos?part=snippet,contentDetails&id=${chunk.join(',')}&key=${encodeURIComponent(key)}`);
    const j = await r.json();
    if (j.error) throw new Error(`YouTube API: ${j.error.message}`);
    for (const v of j.items ?? []) {
      out.set(v.id, {
        id: v.id,
        title: v.snippet.title,
        description: v.snippet.description ?? '',
        duration: isoDuration(v.contentDetails.duration),
        thumbnail: v.snippet.thumbnails?.medium?.url ?? thumb(v.id, 'mq'),
      });
    }
  }
  return out;
}

async function playlistVideoIds(listId: string, key: string): Promise<string[]> {
  const ids: string[] = [];
  let page = '';
  do {
    const r = await fetch(`https://www.googleapis.com/youtube/v3/playlistItems?part=contentDetails&maxResults=50&playlistId=${listId}&key=${encodeURIComponent(key)}${page ? `&pageToken=${page}` : ''}`);
    const j = await r.json();
    if (j.error) throw new Error(`YouTube API: ${j.error.message}`);
    for (const it of j.items ?? []) ids.push(it.contentDetails.videoId);
    page = j.nextPageToken ?? '';
  } while (page && ids.length < 500);
  return ids;
}

/** Look up videos: full details with an API key, title + thumbnail without. */
async function lookup(ids: string[]): Promise<YtVideo[]> {
  const key = await getApiKey();
  if (key) {
    const map = await videoDetails(ids, key);
    return ids.map((id) => map.get(id) ?? { id, title: `Video ${id}`, description: '', duration: 0, thumbnail: thumb(id, 'mq') });
  }
  return Promise.all(ids.map(async (id) => ({ id, description: '', duration: 0, thumbnail: thumb(id, 'mq'), title: `Video ${id}`, ...(await oembed(id)) }) as YtVideo));
}

/* ======================= Router ======================= */
export function Tutorials({ go, editId }: { go: (r: string) => void; editId?: string }) {
  if (editId) return <PlaylistEditor id={editId === 'new' ? null : editId} go={go} />;
  return <PlaylistList go={go} />;
}

/* ======================= List ======================= */
function PlaylistList({ go }: { go: (r: string) => void }) {
  const toast = useToast();
  const [rows, setRows] = useState<(PlaylistRow & { lessons: { count: number }[] })[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await sb().from('tutorial_playlists').select('*,lessons:tutorial_videos(count)').order('sort_order').order('created_at');
    if (error) toast(error.message, false);
    setRows((data as never) ?? []);
    setLoading(false);
  }, [toast]);
  useEffect(() => {
    load();
  }, [load]);

  async function move(i: number, d: number) {
    const list = [...rows];
    const j = i + d;
    if (j < 0 || j >= list.length) return;
    [list[i], list[j]] = [list[j], list[i]];
    await Promise.all(list.map((p, k) => sb().from('tutorial_playlists').update({ sort_order: k }).eq('id', p.id!)));
    load();
  }
  async function remove(p: PlaylistRow) {
    if (!confirm(`Delete "${p.title}" and all its lessons?`)) return;
    const { error } = await sb().from('tutorial_playlists').delete().eq('id', p.id!);
    if (error) return toast(error.message, false);
    load();
  }

  return (
    <div>
      <PageTitle
        title="Tutorials"
        sub="Course playlists built from YouTube videos."
        actions={
          <>
            <button type="button" className="btn-ghost" onClick={() => go('youtube-settings')}><I n="settings" s={15} /> YouTube API</button>
            <button type="button" className="btn-primary" onClick={() => go('tutorials/new')}><I n="plus" s={15} /> New playlist</button>
          </>
        }
      />
      <Panel>
        {loading ? <p className="py-8 text-center text-sm text-muted">Loading…</p> : rows.length === 0 ? <Empty text="No playlists yet. Create your first course!" icon="eye" /> : (
          <ul className="divide-y divide-line">
            {rows.map((p, i) => (
              <li key={p.id} className="flex items-center gap-3 py-3">
                <div className="grid gap-0.5">
                  <button type="button" onClick={() => move(i, -1)} className="grid h-5 w-6 place-items-center text-muted hover:text-fg" aria-label="Move up"><I n="up" s={14} /></button>
                  <button type="button" onClick={() => move(i, 1)} className="grid h-5 w-6 place-items-center text-muted hover:text-fg" aria-label="Move down"><I n="down" s={14} /></button>
                </div>
                <div className="h-12 w-20 shrink-0 overflow-hidden rounded-lg border border-line bg-surface-2">{p.cover_url && <img src={p.cover_url} alt="" className="h-full w-full object-cover" />}</div>
                <div className="min-w-0 flex-1">
                  <button type="button" onClick={() => go(`tutorials/${p.id}`)} className="text-left font-semibold hover:text-accent">{p.title}</button>
                  <p className="text-xs text-muted">{p.topic} · {p.lessons?.[0]?.count ?? 0} lessons · {p.level}</p>
                </div>
                {p.featured && <span className="text-accent">★</span>}
                <span className={`rounded-md px-2 py-0.5 text-xs font-semibold capitalize ${p.status === 'published' ? 'bg-accent-soft text-accent' : 'bg-surface-2 text-muted'}`}>{p.status}</span>
                {p.status === 'published' && <a href={`/tutorials/${p.slug}`} target="_blank" className="grid h-8 w-8 place-items-center rounded-lg text-muted hover:text-fg" title="View"><I n="external" s={15} /></a>}
                <button type="button" onClick={() => remove(p)} className="grid h-8 w-8 place-items-center rounded-lg text-muted hover:text-red-500" title="Delete"><I n="trash" s={15} /></button>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}

/* ======================= Editor ======================= */
function PlaylistEditor({ id, go }: { id: string | null; go: (r: string) => void }) {
  const toast = useToast();
  const [p, setP] = useState<PlaylistRow>(blank);
  const [saved, setSaved] = useState(JSON.stringify(blank));
  const [slugTouched, setSlugTouched] = useState(false);
  const [lessons, setLessons] = useState<LessonRow[]>([]);
  const [hasKey, setHasKey] = useState(false);
  const [busy, setBusy] = useState('');
  const [urls, setUrls] = useState('');
  const [editLesson, setEditLesson] = useState<LessonRow | null>(null);

  const loadLessons = useCallback(async (pid: string) => {
    const { data, error } = await sb().from('tutorial_videos').select('*').eq('playlist_id', pid).order('position');
    if (error) toast(error.message, false);
    setLessons((data as LessonRow[]) ?? []);
  }, [toast]);

  useEffect(() => {
    getApiKey().then((k) => setHasKey(Boolean(k)));
    if (!id) return;
    sb().from('tutorial_playlists').select('*').eq('id', id).single().then(({ data, error }) => {
      if (error) {
        toast(error.message, false);
        return go('tutorials');
      }
      const clean = Object.fromEntries(Object.entries({ ...blank, ...data }).map(([k, v]) => [k, v === null ? '' : v])) as unknown as PlaylistRow;
      setP(clean);
      setSaved(JSON.stringify(clean));
      setSlugTouched(true);
    });
    loadLessons(id);
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  const set = <K extends keyof PlaylistRow>(k: K, v: PlaylistRow[K]) => setP((x) => ({ ...x, [k]: v }));
  const dirty = JSON.stringify(p) !== saved;

  async function save(status?: 'draft' | 'published') {
    const next = { ...p, status: status ?? p.status, slug: slugify(p.slug || p.title) };
    if (!next.title.trim()) return toast('Add a title first', false);
    if (status === 'published' && !lessons.length) return toast('Add at least one lesson before publishing', false);
    const { id: pid, ...row } = next;
    const payload = { ...row, description: row.description || null, cover_url: row.cover_url || null, topic: row.topic || null, youtube_playlist_id: row.youtube_playlist_id || null };
    const res = pid ? await sb().from('tutorial_playlists').update(payload).eq('id', pid).select().single() : await sb().from('tutorial_playlists').insert(payload).select().single();
    if (res.error) return toast(res.error.code === '23505' ? 'Another playlist already uses this URL slug.' : res.error.message, false);
    const done = { ...next, id: res.data.id };
    setP(done);
    setSaved(JSON.stringify(done));
    toast(done.status === 'published' ? 'Published' : 'Saved');
    if (!pid) go(`tutorials/${res.data.id}`);
  }

  async function addVideos(ids: string[]) {
    if (!p.id) return toast('Save the playlist first', false);
    const fresh = [...new Set(ids)].filter((v) => !lessons.some((l) => l.youtube_id === v));
    if (!fresh.length) return toast('Those videos are already in this playlist', false);
    setBusy(`Fetching ${fresh.length} video(s) from YouTube…`);
    try {
      const vids = await lookup(fresh);
      const start = lessons.length;
      const rows = vids.map((v, i) => ({
        playlist_id: p.id!,
        youtube_id: v.id,
        title: v.title,
        description: v.description || null,
        duration_seconds: v.duration || null,
        thumbnail_url: v.thumbnail,
        position: start + i,
      }));
      const { error } = await sb().from('tutorial_videos').insert(rows);
      if (error) throw error;
      toast(`Added ${rows.length} lesson(s)`);
      setUrls('');
      if (!p.cover_url && vids[0]) set('cover_url', thumb(vids[0].id, 'maxres'));
      loadLessons(p.id!);
    } catch (e) {
      toast((e as Error).message, false);
    } finally {
      setBusy('');
    }
  }

  async function addFromText() {
    const lines = urls.split(/[\s,]+/).filter(Boolean);
    const list = lines.map(youtubePlaylistId).find(Boolean);
    const ids = lines.map(youtubeId).filter((x): x is string => Boolean(x));
    if (list && !ids.length) return importPlaylist(list);
    if (!ids.length) return toast('No YouTube video links found', false);
    addVideos(ids);
  }

  async function importPlaylist(listId = youtubePlaylistId(p.youtube_playlist_id) ?? p.youtube_playlist_id) {
    if (!listId) return toast('Paste a YouTube playlist link or ID first', false);
    const key = await getApiKey();
    if (!key) return toast('Importing a whole playlist needs a YouTube API key (see YouTube API settings)', false);
    setBusy('Reading playlist from YouTube…');
    try {
      const ids = await playlistVideoIds(listId, key);
      if (p.youtube_playlist_id !== listId) set('youtube_playlist_id', listId);
      setBusy('');
      await addVideos(ids);
    } catch (e) {
      toast((e as Error).message, false);
      setBusy('');
    }
  }

  async function refreshAll() {
    if (!lessons.length) return;
    setBusy('Refreshing details from YouTube…');
    try {
      const vids = await lookup(lessons.map((l) => l.youtube_id));
      await Promise.all(
        vids.map((v) => {
          const l = lessons.find((x) => x.youtube_id === v.id)!;
          const patch: Partial<LessonRow> = { thumbnail_url: v.thumbnail };
          if (v.duration) patch.duration_seconds = v.duration;
          if (!l.description && v.description) patch.description = v.description;
          return sb().from('tutorial_videos').update(patch).eq('id', l.id);
        }),
      );
      toast(hasKey ? 'Durations and thumbnails updated' : 'Thumbnails updated (add an API key to fetch durations)');
      loadLessons(p.id!);
    } catch (e) {
      toast((e as Error).message, false);
    } finally {
      setBusy('');
    }
  }

  async function patchLesson(l: LessonRow, patch: Partial<LessonRow>) {
    const { error } = await sb().from('tutorial_videos').update(patch).eq('id', l.id);
    if (error) return toast(error.message, false);
    setLessons((x) => x.map((y) => (y.id === l.id ? { ...y, ...patch } : y)));
  }
  async function moveLesson(i: number, d: number) {
    const list = [...lessons];
    const j = i + d;
    if (j < 0 || j >= list.length) return;
    [list[i], list[j]] = [list[j], list[i]];
    setLessons(list.map((l, k) => ({ ...l, position: k })));
    await Promise.all(list.map((l, k) => sb().from('tutorial_videos').update({ position: k }).eq('id', l.id)));
  }
  async function removeLesson(l: LessonRow) {
    if (!confirm(`Remove "${l.title}"?`)) return;
    const { error } = await sb().from('tutorial_videos').delete().eq('id', l.id);
    if (error) return toast(error.message, false);
    const rest = lessons.filter((x) => x.id !== l.id);
    setLessons(rest);
    await Promise.all(rest.map((x, k) => (x.position !== k ? sb().from('tutorial_videos').update({ position: k }).eq('id', x.id) : null)));
  }

  const total = lessons.reduce((a, l) => a + (l.duration_seconds ?? 0), 0);

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <button type="button" onClick={() => (!dirty || confirm('Discard unsaved changes?')) && go('tutorials')} className="btn-ghost px-3 py-1.5 text-xs">← All playlists</button>
        <span className="text-sm text-muted">{id ? 'Edit playlist' : 'New playlist'}</span>
        {dirty && <span className="text-xs text-yellow-600 dark:text-yellow-400">● unsaved</span>}
        <span className="ml-auto flex gap-2">
          {p.status === 'published' && p.id && <a href={`/tutorials/${p.slug}`} target="_blank" className="btn-ghost"><I n="external" s={15} /> View</a>}
          {p.status === 'published' ? (
            <>
              <button type="button" className="btn-ghost" onClick={() => save('draft')}>Unpublish</button>
              <button type="button" className="btn-primary" disabled={!dirty} onClick={() => save()}><I n="check" s={15} /> {dirty ? 'Update' : 'Saved'}</button>
            </>
          ) : (
            <>
              <button type="button" className="btn-ghost" onClick={() => save('draft')}>{p.id ? 'Save' : 'Create playlist'}</button>
              {p.id && <button type="button" className="btn-primary" onClick={() => save('published')}><I n="check" s={15} /> Publish</button>}
            </>
          )}
        </span>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_320px]">
        <div className="grid min-w-0 content-start gap-5">
          <input value={p.title} onChange={(e) => { set('title', e.target.value); if (!slugTouched) set('slug', slugify(e.target.value)); }} placeholder="Course title, e.g. Excel for Beginners" className="w-full bg-transparent text-3xl font-extrabold tracking-tight outline-none placeholder:text-muted/50" />
          <div className="flex items-center gap-1 font-mono text-xs text-muted">
            <span>/tutorials/</span>
            <input value={p.slug} onChange={(e) => { setSlugTouched(true); set('slug', e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-')); }} className="flex-1 rounded-md border border-transparent bg-transparent px-1 py-0.5 text-fg outline-none hover:border-line focus:border-accent" />
          </div>
          <textarea value={p.description} onChange={(e) => set('description', e.target.value)} rows={3} placeholder="What will learners be able to do after this course?" className="input resize-y" />

          <Panel title={`Lessons (${lessons.length}${total ? ` · ${fmtDuration(total, true)}` : ''})`}>
            {!p.id ? (
              <p className="text-sm text-muted">Create the playlist first (button at the top), then add lessons here.</p>
            ) : (
              <>
                <div className="rounded-xl border border-dashed border-line p-4">
                  <label className="label" htmlFor="yt-urls">Add YouTube videos</label>
                  <textarea id="yt-urls" value={urls} onChange={(e) => setUrls(e.target.value)} rows={3} placeholder={'Paste one or more YouTube links (one per line)\nhttps://youtu.be/…\nhttps://www.youtube.com/watch?v=…'} className="input resize-y font-mono text-xs" />
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <button type="button" className="btn-primary px-3 py-1.5 text-xs" disabled={!!busy || !urls.trim()} onClick={addFromText}><I n="plus" s={14} /> Add videos</button>
                    <button type="button" className="btn-ghost px-3 py-1.5 text-xs" disabled={!!busy || !lessons.length} onClick={refreshAll}><I n="refresh" s={14} /> Refresh details</button>
                    <span className="text-xs text-muted">{hasKey ? '✓ API key set: titles, durations & descriptions load automatically' : 'Titles & thumbnails load automatically. Add a YouTube API key for durations.'}</span>
                  </div>
                  {busy && <p className="mt-2 text-xs text-accent">{busy}</p>}
                </div>

                {lessons.length === 0 ? <Empty text="No lessons yet." icon="eye" /> : (
                  <ol className="mt-4 divide-y divide-line">
                    {lessons.map((l, i) => (
                      <li key={l.id} className={`flex items-center gap-3 py-2.5 ${l.published ? '' : 'opacity-50'}`}>
                        <span className="w-6 text-center font-mono text-xs text-muted">{i + 1}</span>
                        <div className="grid gap-0.5">
                          <button type="button" onClick={() => moveLesson(i, -1)} className="grid h-4 w-5 place-items-center text-muted hover:text-fg" aria-label="Move up"><I n="up" s={13} /></button>
                          <button type="button" onClick={() => moveLesson(i, 1)} className="grid h-4 w-5 place-items-center text-muted hover:text-fg" aria-label="Move down"><I n="down" s={13} /></button>
                        </div>
                        <a href={`https://youtu.be/${l.youtube_id}`} target="_blank" rel="noopener" className="shrink-0"><img src={l.thumbnail_url || thumb(l.youtube_id, 'mq')} alt="" className="h-11 w-20 rounded object-cover" /></a>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">{l.title}</p>
                          <p className="font-mono text-[11px] text-muted">
                            {fmtDuration(l.duration_seconds)} {l.resources?.length ? `· ${l.resources.length} file(s)` : ''} {l.published ? '' : '· hidden'}
                          </p>
                        </div>
                        <button type="button" className="btn-ghost px-2.5 py-1 text-xs" onClick={() => setEditLesson({ ...l, resources: l.resources ?? [] })}>Edit</button>
                        <button type="button" onClick={() => removeLesson(l)} className="text-muted hover:text-red-500" aria-label="Remove"><I n="trash" s={15} /></button>
                      </li>
                    ))}
                  </ol>
                )}
              </>
            )}
          </Panel>
        </div>

        <aside className="grid content-start gap-4">
          <Panel title="Details">
            <div className="grid gap-4">
              <div>
                <label className="label" htmlFor="tp-topic">Topic</label>
                <input id="tp-topic" list="tp-topics" value={p.topic} onChange={(e) => set('topic', e.target.value)} className="input" />
                <datalist id="tp-topics">{TOPICS.map((t) => <option key={t} value={t} />)}</datalist>
              </div>
              <div>
                <label className="label" htmlFor="tp-level">Level</label>
                <select id="tp-level" value={p.level} onChange={(e) => set('level', e.target.value as Level)} className="input">
                  <option value="beginner">Beginner</option><option value="intermediate">Intermediate</option><option value="advanced">Advanced</option><option value="all">All levels</option>
                </select>
              </div>
              <div>
                <label className="label" htmlFor="tp-lang">Language</label>
                <select id="tp-lang" value={p.language} onChange={(e) => set('language', e.target.value)} className="input">
                  <option>Bangla</option><option>English</option><option>Bangla & English</option>
                </select>
              </div>
              <Toggle checked={p.featured} onChange={(v) => set('featured', v)} label="Featured" />
            </div>
          </Panel>
          <Panel title="Cover image">
            <ImageField value={p.cover_url} onChange={(v) => set('cover_url', v)} />
            <p className="mt-2 text-xs text-muted">Empty = first video's thumbnail.</p>
          </Panel>
          <Panel title="Import a YouTube playlist">
            <div className="grid gap-2">
              <input value={p.youtube_playlist_id} onChange={(e) => set('youtube_playlist_id', e.target.value)} placeholder="Playlist link or ID (PL…)" className="input text-xs" />
              <button type="button" className="btn-ghost text-xs" disabled={!p.id || !!busy} onClick={() => importPlaylist()}>
                <I n="upload" s={14} /> Import all videos
              </button>
              <p className="text-xs text-muted">{hasKey ? 'Adds every video in order, skipping ones already added.' : 'Needs a YouTube API key.'}</p>
            </div>
          </Panel>
        </aside>
      </div>

      <LessonModal lesson={editLesson} onClose={() => setEditLesson(null)} onSave={async (l) => { await patchLesson(l, { title: l.title, description: l.description || null, duration_seconds: l.duration_seconds, resources: l.resources, published: l.published }); setEditLesson(null); toast('Lesson saved'); }} />
    </div>
  );
}

function LessonModal({ lesson, onClose, onSave }: { lesson: LessonRow | null; onClose: () => void; onSave: (l: LessonRow) => void }) {
  const [l, setL] = useState<LessonRow | null>(lesson);
  const [pick, setPick] = useState(false);
  const [dur, setDur] = useState('');
  useEffect(() => {
    setL(lesson);
    setDur(lesson?.duration_seconds ? fmtDuration(lesson.duration_seconds) : '');
  }, [lesson]);
  if (!l) return null;
  const parseDur = (s: string) => s.split(':').map(Number).reduce((a, n) => a * 60 + (n || 0), 0) || null;

  return (
    <Modal open onClose={onClose} title="Edit lesson">
      <div className="grid gap-4">
        <img src={l.thumbnail_url || thumb(l.youtube_id, 'mq')} alt="" className="aspect-video w-full rounded-xl object-cover" />
        <div><label className="label" htmlFor="ls-title">Title</label><input id="ls-title" value={l.title} onChange={(e) => setL({ ...l, title: e.target.value })} className="input" /></div>
        <div className="grid grid-cols-2 gap-3">
          <div><label className="label" htmlFor="ls-dur">Duration (m:ss)</label><input id="ls-dur" value={dur} onChange={(e) => setDur(e.target.value)} placeholder="12:34" className="input font-mono" /></div>
          <div className="pt-6"><Toggle checked={l.published} onChange={(v) => setL({ ...l, published: v })} label="Visible" /></div>
        </div>
        <div><label className="label" htmlFor="ls-desc">Description / notes</label><textarea id="ls-desc" value={l.description ?? ''} onChange={(e) => setL({ ...l, description: e.target.value })} rows={4} className="input resize-y" /></div>
        <div>
          <span className="label">Practice files & resources</span>
          {l.resources.map((r, i) => (
            <div key={r.url + i} className="mb-2 flex items-center gap-2">
              <input value={r.name} onChange={(e) => setL({ ...l, resources: l.resources.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)) })} className="input py-1.5 text-sm" />
              <button type="button" onClick={() => setL({ ...l, resources: l.resources.filter((_, j) => j !== i) })} className="text-muted hover:text-red-500" aria-label="Remove"><I n="trash" s={15} /></button>
            </div>
          ))}
          <button type="button" onClick={() => setPick(true)} className="btn-ghost px-3 py-1.5 text-xs"><I n="plus" s={14} /> Add file</button>
        </div>
        <div className="flex justify-end gap-2">
          <button type="button" className="btn-ghost" onClick={onClose}>Cancel</button>
          <button type="button" className="btn-primary" onClick={() => onSave({ ...l, duration_seconds: parseDur(dur) })}>Save lesson</button>
        </div>
      </div>
      <Modal open={pick} onClose={() => setPick(false)} title="Add a file" wide>
        <MediaLibrary accept="*" onPick={(m) => { setL({ ...l, resources: [...l.resources, { name: m.name, url: m.url }] }); setPick(false); }} />
      </Modal>
    </Modal>
  );
}

/* ======================= YouTube API settings ======================= */
export function YouTubeSettings() {
  const toast = useToast();
  const [key, setKey] = useState('');
  const [show, setShow] = useState(false);
  const [status, setStatus] = useState('');

  useEffect(() => {
    getApiKey().then(setKey);
  }, []);

  async function save() {
    const { error } = await sb().from('private_settings').upsert({ key: 'youtube', value: { apiKey: key.trim() } });
    if (error) return toast(error.message, false);
    toast('Saved');
  }
  async function test() {
    setStatus('Testing…');
    try {
      const m = await videoDetails(['dQw4w9WgXcQ'], key.trim());
      setStatus(m.size ? '✓ Key works' : 'Key accepted but returned no data');
    } catch (e) {
      setStatus(`✗ ${(e as Error).message}`);
    }
  }

  return (
    <div>
      <PageTitle title="YouTube API" sub="Optional: lets the admin fetch video durations and import whole playlists." />
      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title="API key">
          <div className="grid gap-3">
            <div className="flex gap-2">
              <input type={show ? 'text' : 'password'} value={key} onChange={(e) => setKey(e.target.value)} placeholder="AIza…" className="input font-mono" autoComplete="off" />
              <button type="button" className="btn-ghost px-3 text-xs" onClick={() => setShow(!show)}>{show ? 'Hide' : 'Show'}</button>
            </div>
            <div className="flex items-center gap-2">
              <button type="button" className="btn-primary" onClick={save}><I n="check" s={15} /> Save</button>
              <button type="button" className="btn-ghost" disabled={!key.trim()} onClick={test}>Test key</button>
              <span className="text-sm">{status}</span>
            </div>
            <p className="text-xs text-muted">Stored in an admin-only table. Visitors never see it.</p>
          </div>
        </Panel>
        <Panel title="How to get a free key (5 minutes)">
          <ol className="grid list-decimal gap-2 pl-5 text-sm text-muted">
            <li>Open <a className="text-accent underline" href="https://console.cloud.google.com/" target="_blank" rel="noopener">Google Cloud Console</a> and sign in.</li>
            <li>Create a project (top bar → <em>New project</em>), e.g. "MF Website".</li>
            <li>Go to <em>APIs & Services → Library</em>, search <strong>YouTube Data API v3</strong> and click <em>Enable</em>.</li>
            <li>Go to <em>APIs & Services → Credentials → Create credentials → API key</em>.</li>
            <li>Click the new key → <em>API restrictions</em> → restrict to <strong>YouTube Data API v3</strong> → Save.</li>
            <li>Copy the key, paste it here and click <em>Save</em>, then <em>Test key</em>.</li>
          </ol>
          <p className="mt-3 text-xs text-muted">Free quota: 10,000 units/day, enough for thousands of video lookups.</p>
        </Panel>
      </div>
    </div>
  );
}
