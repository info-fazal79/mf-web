-- =====================================================================
-- Tutorial playlists: Ms Excel Lecture & Ms PowerPoint Lecture (@info.fazal79)
-- Paste into Supabase → SQL Editor → Run. Safe to run more than once.
-- If a Row Level Security warning appears, choose "Run without RLS".
-- =====================================================================

-- Microsoft Excel Full Course: Basic to Advanced (20 lessons, 620 min)
insert into public.tutorial_playlists (title, slug, description, cover_url, topic, level, language, youtube_playlist_id, featured, status, sort_order)
values ('Microsoft Excel Full Course: Basic to Advanced', 'ms-excel-full-course', 'Master Microsoft Excel from the ground up: workbook basics, data entry, formatting, formulas and functions in the Basic lectures, then advanced functions, data analysis, charts and productivity techniques in the Advanced lectures.', 'https://i.ytimg.com/vi/J1sCbI_OUQk/maxresdefault.jpg', 'Excel', 'all', 'Bangla', 'PLBF1DG19_4xuQRk0IHUfE3vQgDycz2Fqc', true, 'published', 1)
on conflict (slug) do nothing;

insert into public.tutorial_videos (playlist_id, position, youtube_id, title, duration_seconds, thumbnail_url)
select p.id, v.position, v.youtube_id, v.title, v.duration_seconds, v.thumbnail_url
from public.tutorial_playlists p
cross join (values
  (0, 'J1sCbI_OUQk', 'Lecture 01: Basic Microsoft Excel', 2157, 'https://i.ytimg.com/vi/J1sCbI_OUQk/mqdefault.jpg'),
  (1, 'XMfyzHuZ8aM', 'Lecture 02: Basic Microsoft Excel', 2322, 'https://i.ytimg.com/vi/XMfyzHuZ8aM/mqdefault.jpg'),
  (2, 'GECPlXSvZ8U', 'Lecture 03: Basic Microsoft Excel', 1167, 'https://i.ytimg.com/vi/GECPlXSvZ8U/mqdefault.jpg'),
  (3, 'T0cKQIqjUkY', 'Lecture 04: Basic Microsoft Excel', 2084, 'https://i.ytimg.com/vi/T0cKQIqjUkY/mqdefault.jpg'),
  (4, '4w2KdISqO8k', 'Lecture 05: Basic Microsoft Excel', 1416, 'https://i.ytimg.com/vi/4w2KdISqO8k/mqdefault.jpg'),
  (5, '6sCzM79YmJU', 'Lecture 06: Basic Microsoft Excel', 1425, 'https://i.ytimg.com/vi/6sCzM79YmJU/mqdefault.jpg'),
  (6, 'MtDxLe4gS_g', 'Lecture 07: Basic Microsoft Excel', 951, 'https://i.ytimg.com/vi/MtDxLe4gS_g/mqdefault.jpg'),
  (7, 'zeaBnYLJpLk', 'Lecture 08: Basic Microsoft Excel', 788, 'https://i.ytimg.com/vi/zeaBnYLJpLk/mqdefault.jpg'),
  (8, 'qLdPCXxIE2k', 'Lecture 09: Basic Microsoft Excel', 1274, 'https://i.ytimg.com/vi/qLdPCXxIE2k/mqdefault.jpg'),
  (9, 'iWUCj5oX5oU', 'Lecture 11: Advanced Microsoft Excel', 2860, 'https://i.ytimg.com/vi/iWUCj5oX5oU/mqdefault.jpg'),
  (10, 'tfjaoK3VqIU', 'Lecture 12: Advanced Microsoft Excel', 1673, 'https://i.ytimg.com/vi/tfjaoK3VqIU/mqdefault.jpg'),
  (11, '9Hv3t4ue8tY', 'Lecture 13: Advanced Microsoft Excel', 2397, 'https://i.ytimg.com/vi/9Hv3t4ue8tY/mqdefault.jpg'),
  (12, 'Fwngy9PwAzY', 'Lecture 14: Advanced Microsoft Excel', 1731, 'https://i.ytimg.com/vi/Fwngy9PwAzY/mqdefault.jpg'),
  (13, 'uM1_dHSqJgA', 'Lecture 15: Advanced Microsoft Excel', 1784, 'https://i.ytimg.com/vi/uM1_dHSqJgA/mqdefault.jpg'),
  (14, 'tYZryVgtn7A', 'Lecture 16: Advanced Microsoft Excel', 1438, 'https://i.ytimg.com/vi/tYZryVgtn7A/mqdefault.jpg'),
  (15, 'QVDXNJq6ouE', 'Lecture 17: Advanced Microsoft Excel', 1852, 'https://i.ytimg.com/vi/QVDXNJq6ouE/mqdefault.jpg'),
  (16, 'DdCWMvADWCc', 'Lecture 18: Advanced Microsoft Excel', 2646, 'https://i.ytimg.com/vi/DdCWMvADWCc/mqdefault.jpg'),
  (17, 'hlVliVlAfYg', 'Lecture 19: Advanced Microsoft Excel', 2936, 'https://i.ytimg.com/vi/hlVliVlAfYg/mqdefault.jpg'),
  (18, '7sl9PexIRdo', 'Lecture 20: Advanced Microsoft Excel', 2147, 'https://i.ytimg.com/vi/7sl9PexIRdo/mqdefault.jpg'),
  (19, 'V9g4k97ANVQ', 'Lecture 21: Advanced Microsoft Excel', 2190, 'https://i.ytimg.com/vi/V9g4k97ANVQ/mqdefault.jpg')
) as v(position, youtube_id, title, duration_seconds, thumbnail_url)
where p.slug = 'ms-excel-full-course'
  and not exists (select 1 from public.tutorial_videos t where t.playlist_id = p.id and t.youtube_id = v.youtube_id);

-- Microsoft PowerPoint Full Course: Basic to Advanced (5 lessons, 171 min)
insert into public.tutorial_playlists (title, slug, description, cover_url, topic, level, language, youtube_playlist_id, featured, status, sort_order)
values ('Microsoft PowerPoint Full Course: Basic to Advanced', 'ms-powerpoint-full-course', 'Design clean, professional presentations in Microsoft PowerPoint: the interface, font and paragraph formatting, tables, pictures and screenshots, shapes and shape arrangement. New lectures are added regularly.', 'https://i.ytimg.com/vi/6NahSI9nBtE/maxresdefault.jpg', 'PowerPoint', 'beginner', 'Bangla', 'PLWWjWoqTP6eY', true, 'published', 2)
on conflict (slug) do nothing;

insert into public.tutorial_videos (playlist_id, position, youtube_id, title, duration_seconds, thumbnail_url)
select p.id, v.position, v.youtube_id, v.title, v.duration_seconds, v.thumbnail_url
from public.tutorial_playlists p
cross join (values
  (0, '6NahSI9nBtE', 'Lecture 01: Getting Started & UI Overview', 2187, 'https://i.ytimg.com/vi/6NahSI9nBtE/mqdefault.jpg'),
  (1, 'WI1uTtYl1kA', 'Lecture 02: Font & Paragraph Formatting', 1725, 'https://i.ytimg.com/vi/WI1uTtYl1kA/mqdefault.jpg'),
  (2, 'Gj54XCxV02c', 'Lecture 03: Tables, Pictures & Screenshots', 2826, 'https://i.ytimg.com/vi/Gj54XCxV02c/mqdefault.jpg'),
  (3, 'Ur0H-M24us0', 'Lecture 04: All About Shapes', 2235, 'https://i.ytimg.com/vi/Ur0H-M24us0/mqdefault.jpg'),
  (4, '43zNM5tWdOk', 'Lecture 05: Mastering Shape Arrangement', 1313, 'https://i.ytimg.com/vi/43zNM5tWdOk/mqdefault.jpg')
) as v(position, youtube_id, title, duration_seconds, thumbnail_url)
where p.slug = 'ms-powerpoint-full-course'
  and not exists (select 1 from public.tutorial_videos t where t.playlist_id = p.id and t.youtube_id = v.youtube_id);
