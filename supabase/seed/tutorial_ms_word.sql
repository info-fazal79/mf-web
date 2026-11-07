-- =====================================================================
-- Tutorial playlist: Ms Word Lecture (Basic to Advance)
-- Source: https://www.youtube.com/playlist?list=PLeGpCu76FSKQ (@info.fazal79)
-- 12 lessons, ordered Lecture 01 → 12. Paste into SQL Editor → Run.
-- If a Row Level Security warning appears, choose "Run without RLS".
-- Safe to run more than once.
-- =====================================================================
insert into public.tutorial_playlists (title, slug, description, cover_url, topic, level, language, youtube_playlist_id, featured, status, sort_order)
values (
  'Microsoft Word Full Course: Basic to Advanced',
  'ms-word-full-course',
  'Learn Microsoft Word step by step, from the interface and basic editing to fonts, paragraphs, pictures, shapes, SmartArt, charts, page layout and tables. 12 practical lectures for complete beginners.',
  'https://i.ytimg.com/vi/gVF7mKii6cQ/maxresdefault.jpg',
  'Word', 'beginner', 'Bangla', 'PLeGpCu76FSKQ', true, 'published', 0
)
on conflict (slug) do nothing;

insert into public.tutorial_videos (playlist_id, position, youtube_id, title, duration_seconds, thumbnail_url)
select p.id, v.position, v.youtube_id, v.title, v.duration_seconds, v.thumbnail_url
from public.tutorial_playlists p
cross join (values
  (0, 'gVF7mKii6cQ', 'Lecture 01: Getting Started & UI Overview', 987, 'https://i.ytimg.com/vi/gVF7mKii6cQ/mqdefault.jpg'),
  (1, 'BFDtDy6pBpU', 'Lecture 02: Save, Save As, Clipboard & Basic Editing', 1174, 'https://i.ytimg.com/vi/BFDtDy6pBpU/mqdefault.jpg'),
  (2, '3xihSak-jBY', 'Lecture 03: Text & Font Formatting', 1485, 'https://i.ytimg.com/vi/3xihSak-jBY/mqdefault.jpg'),
  (3, 'BMR9gxXmYp8', 'Lecture 04: Advanced Font Formatting & Text Effects', 1530, 'https://i.ytimg.com/vi/BMR9gxXmYp8/mqdefault.jpg'),
  (4, 'ixVdIZRqvqg', 'Lecture 05: Bullets, Numbering, Lists & Paragraph Tools', 2032, 'https://i.ytimg.com/vi/ixVdIZRqvqg/mqdefault.jpg'),
  (5, 'GcLvxs-q6Rw', 'Lecture 06: Alignment, Spacing & Indentation', 1175, 'https://i.ytimg.com/vi/GcLvxs-q6Rw/mqdefault.jpg'),
  (6, 'sXS4LWPgwaA', 'Lecture 07: Select Text, Find, Replace & Navigation Pane', 767, 'https://i.ytimg.com/vi/sXS4LWPgwaA/mqdefault.jpg'),
  (7, 'CJteEq9qnjk', 'Lecture 08: Insert Picture & Picture Formatting', 2012, 'https://i.ytimg.com/vi/CJteEq9qnjk/mqdefault.jpg'),
  (8, '9gjV8gNsf5E', 'Lecture 09: Shape and Creative Design', 2785, 'https://i.ytimg.com/vi/9gjV8gNsf5E/mqdefault.jpg'),
  (9, 'YS_QXlPp254', 'Lecture 10: SmartArt, Icons, 3D Models & Charts', 1349, 'https://i.ytimg.com/vi/YS_QXlPp254/mqdefault.jpg'),
  (10, '5i2jVBjRbfY', 'Lecture 11: Page & Document Elements and Tab Settings', 1958, 'https://i.ytimg.com/vi/5i2jVBjRbfY/mqdefault.jpg'),
  (11, 'rS6_pCeQhPA', 'Lecture 12: Table - Basic & Design', 1260, 'https://i.ytimg.com/vi/rS6_pCeQhPA/mqdefault.jpg')
) as v(position, youtube_id, title, duration_seconds, thumbnail_url)
where p.slug = 'ms-word-full-course'
  and not exists (select 1 from public.tutorial_videos t where t.playlist_id = p.id and t.youtube_id = v.youtube_id);
