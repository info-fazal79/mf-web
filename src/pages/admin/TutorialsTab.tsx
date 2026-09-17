import React, { useState } from 'react';
import { useStore } from '../../store/useStore';
import { Playlist, PlaylistVideo } from '../../types';
import { 
  Plus, 
  Edit2, 
  Trash2, 
  ExternalLink, 
  X, 
  Play, 
  Layers, 
  ArrowLeft, 
  Video, 
  Clock, 
  FolderGit2,
  CheckCircle2
} from 'lucide-react';
import { YoutubeIcon } from '../../components/ui/Icons';
import { supabase, isSupabaseConfigured } from '../../lib/supabase';
import { extractYouTubeId } from '../../lib/utils';

export const TutorialsTab: React.FC = () => {
  const { 
    playlists, 
    addPlaylist, 
    updatePlaylist, 
    deletePlaylist, 
    playlistVideos,
    addPlaylistVideo,
    updatePlaylistVideo,
    deletePlaylistVideo,
    addToast 
  } = useStore();

  // Selected playlist for managing nested lectures/videos
  const [selectedPlaylist, setSelectedPlaylist] = useState<Playlist | null>(null);

  // Playlist Modal State
  const [isPlaylistModalOpen, setIsPlaylistModalOpen] = useState(false);
  const [editingPlaylist, setEditingPlaylist] = useState<Playlist | null>(null);
  const [playlistForm, setPlaylistForm] = useState({
    title: '',
    slug: '',
    category: 'MS Office',
    description: '',
    thumbnail_url: '',
    youtube_playlist_url: '',
  });

  // Video / Lecture Modal State
  const [isVideoModalOpen, setIsVideoModalOpen] = useState(false);
  const [editingVideo, setEditingVideo] = useState<PlaylistVideo | null>(null);
  const [videoForm, setVideoForm] = useState({
    title: '',
    youtube_url: '',
    youtube_video_id: '',
    duration: '20:00',
    order_index: 1,
  });

  // Handle Playlist Title change to auto-generate slug if new
  const handlePlaylistTitleChange = (title: string) => {
    const generatedSlug = title
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');

    setPlaylistForm((prev) => ({
      ...prev,
      title,
      slug: editingPlaylist ? prev.slug : generatedSlug,
    }));
  };

  const openAddPlaylistModal = () => {
    setEditingPlaylist(null);
    setPlaylistForm({
      title: '',
      slug: '',
      category: 'MS Office',
      description: '',
      thumbnail_url: '',
      youtube_playlist_url: '',
    });
    setIsPlaylistModalOpen(true);
  };

  const openEditPlaylistModal = (pl: Playlist) => {
    setEditingPlaylist(pl);
    setPlaylistForm({
      title: pl.title,
      slug: pl.slug,
      category: pl.category,
      description: pl.description,
      thumbnail_url: pl.thumbnail_url || '',
      youtube_playlist_url: pl.youtube_playlist_url || '',
    });
    setIsPlaylistModalOpen(true);
  };

  const handleSavePlaylist = async (e: React.FormEvent) => {
    e.preventDefault();

    const slug = playlistForm.slug || playlistForm.title.toLowerCase().replace(/[^a-z0-9]+/g, '-');

    if (editingPlaylist) {
      const updated: Partial<Playlist> = {
        title: playlistForm.title,
        slug,
        category: playlistForm.category,
        description: playlistForm.description,
        thumbnail_url: playlistForm.thumbnail_url,
        youtube_playlist_url: playlistForm.youtube_playlist_url,
      };

      updatePlaylist(editingPlaylist.id, updated);

      if (isSupabaseConfigured()) {
        await supabase.from('playlists').update(updated).eq('id', editingPlaylist.id);
      }

      // If selected playlist is the one being edited, update local state
      if (selectedPlaylist && selectedPlaylist.id === editingPlaylist.id) {
        setSelectedPlaylist((prev) => prev ? { ...prev, ...updated } : null);
      }

      addToast({
        title: 'Playlist Updated',
        message: `"${playlistForm.title}" was successfully updated.`,
        type: 'success',
      });
    } else {
      let createdPlaylist: Playlist = {
        id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : 'pl-' + Date.now(),
        title: playlistForm.title,
        slug,
        category: playlistForm.category,
        description: playlistForm.description,
        thumbnail_url: playlistForm.thumbnail_url || 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?q=80&w=800&auto=format&fit=crop',
        youtube_playlist_url: playlistForm.youtube_playlist_url,
        video_count: 0,
        created_at: new Date().toISOString(),
      };

      if (isSupabaseConfigured()) {
        const insertPayload: any = {
          title: playlistForm.title,
          slug,
          category: playlistForm.category,
          description: playlistForm.description,
          thumbnail_url: playlistForm.thumbnail_url || 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?q=80&w=800&auto=format&fit=crop',
          youtube_playlist_url: playlistForm.youtube_playlist_url,
          video_count: 0,
        };
        const { data, error } = await supabase.from('playlists').insert([insertPayload]).select().single();
        if (error) {
          console.error('Supabase playlist insert error:', error);
        } else if (data) {
          createdPlaylist = data as Playlist;
        }
      }

      addPlaylist(createdPlaylist);

      addToast({
        title: 'Playlist Created',
        message: `"${playlistForm.title}" course playlist added.`,
        type: 'success',
      });
    }

    setIsPlaylistModalOpen(false);
  };

  const handleDeletePlaylist = async (id: string, title: string) => {
    if (!window.confirm(`Are you sure you want to delete "${title}" and all its videos?`)) return;

    deletePlaylist(id);

    if (isSupabaseConfigured()) {
      const { error } = await supabase.from('playlists').delete().eq('id', id);
      if (error) console.error('Supabase playlist delete error:', error);
    }

    if (selectedPlaylist?.id === id) {
      setSelectedPlaylist(null);
    }

    addToast({
      title: 'Playlist Deleted',
      message: `"${title}" has been deleted.`,
      type: 'info',
    });
  };

  // Lecture / Video Modal Actions
  const openAddVideoModal = () => {
    if (!selectedPlaylist) return;
    const currentVideos = playlistVideos.filter((v) => v.playlist_id === selectedPlaylist.id);
    const nextOrder = currentVideos.length + 1;

    setEditingVideo(null);
    setVideoForm({
      title: '',
      youtube_url: '',
      youtube_video_id: '',
      duration: '20:00',
      order_index: nextOrder,
    });
    setIsVideoModalOpen(true);
  };

  const openEditVideoModal = (video: PlaylistVideo) => {
    setEditingVideo(video);
    setVideoForm({
      title: video.title,
      youtube_url: video.youtube_url,
      youtube_video_id: video.youtube_video_id,
      duration: video.duration || '20:00',
      order_index: video.order_index,
    });
    setIsVideoModalOpen(true);
  };

  const handleVideoUrlChange = (url: string) => {
    const extractedId = extractYouTubeId(url);
    setVideoForm((prev) => ({
      ...prev,
      youtube_url: url,
      youtube_video_id: extractedId || prev.youtube_video_id,
    }));
  };

  const handleSaveVideo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPlaylist) return;

    const parsedVideoId = videoForm.youtube_video_id || extractYouTubeId(videoForm.youtube_url);

    if (editingVideo) {
      const updated: Partial<PlaylistVideo> = {
        title: videoForm.title,
        youtube_url: videoForm.youtube_url,
        youtube_video_id: parsedVideoId,
        duration: videoForm.duration,
        order_index: Number(videoForm.order_index),
      };

      updatePlaylistVideo(editingVideo.id, updated);

      if (isSupabaseConfigured()) {
        const { error } = await supabase.from('playlist_videos').update(updated).eq('id', editingVideo.id);
        if (error) console.error('Supabase video update error:', error);
      }

      addToast({
        title: 'Lecture Updated',
        message: `"${videoForm.title}" was updated.`,
        type: 'success',
      });
    } else {
      let createdVideo: PlaylistVideo = {
        id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : 'pv-' + Date.now(),
        playlist_id: selectedPlaylist.id,
        title: videoForm.title,
        youtube_url: videoForm.youtube_url,
        youtube_video_id: parsedVideoId,
        duration: videoForm.duration,
        order_index: Number(videoForm.order_index),
        created_at: new Date().toISOString(),
      };

      if (isSupabaseConfigured()) {
        const insertPayload: any = {
          playlist_id: selectedPlaylist.id,
          title: videoForm.title,
          youtube_url: videoForm.youtube_url,
          youtube_video_id: parsedVideoId,
          duration: videoForm.duration,
          order_index: Number(videoForm.order_index),
        };
        const { data, error } = await supabase.from('playlist_videos').insert([insertPayload]).select().single();
        if (error) {
          console.error('Supabase video insert error:', error);
        } else if (data) {
          createdVideo = data as PlaylistVideo;
        }

        const currentCount = playlistVideos.filter((v) => v.playlist_id === selectedPlaylist.id).length + 1;
        await supabase.from('playlists').update({ video_count: currentCount }).eq('id', selectedPlaylist.id);
      }

      addPlaylistVideo(createdVideo);

      addToast({
        title: 'Lecture Added',
        message: `"${videoForm.title}" added to playlist.`,
        type: 'success',
      });
    }

    setIsVideoModalOpen(false);
  };

  const handleDeleteVideo = async (id: string, title: string) => {
    if (!window.confirm(`Delete lecture "${title}"?`)) return;

    deletePlaylistVideo(id);

    if (isSupabaseConfigured() && selectedPlaylist) {
      await supabase.from('playlist_videos').delete().eq('id', id);
      const currentCount = Math.max(0, playlistVideos.filter((v) => v.playlist_id === selectedPlaylist.id && v.id !== id).length);
      await supabase.from('playlists').update({ video_count: currentCount }).eq('id', selectedPlaylist.id);
    }

    addToast({
      title: 'Lecture Deleted',
      message: `"${title}" has been removed.`,
      type: 'info',
    });
  };

  const selectedPlaylistVideos = selectedPlaylist 
    ? playlistVideos
        .filter((v) => v.playlist_id === selectedPlaylist.id)
        .sort((a, b) => a.order_index - b.order_index)
    : [];

  return (
    <div className="space-y-6">
      {/* Top Header & Breadcrumb */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            {selectedPlaylist ? (
              <button
                onClick={() => setSelectedPlaylist(null)}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-dark-900 border border-white/10 text-xs font-mono text-gray-400 hover:text-cyber-neon hover:border-cyber-accent/40 transition-all mr-2"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>All Playlists</span>
              </button>
            ) : null}
            <h2 className="text-xl font-bold text-white font-mono flex items-center gap-2">
              <YoutubeIcon className="w-5 h-5 text-red-500" />
              <span>
                {selectedPlaylist ? `${selectedPlaylist.title} — Lectures` : 'YouTube Courses & Playlist Manager'}
              </span>
            </h2>
          </div>
          <p className="text-xs text-gray-400 mt-1">
            {selectedPlaylist
              ? `Manage individual video lessons, playback order, and YouTube URLs for this course playlist.`
              : `Create structured video course playlists and organize multi-part YouTube workshops.`}
          </p>
        </div>

        <div>
          {selectedPlaylist ? (
            <button
              onClick={openAddVideoModal}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-cyber-accent text-dark-950 font-bold font-mono text-xs hover:bg-cyber-neon transition-all shadow-neon"
            >
              <Plus className="w-4 h-4" />
              <span>Add Lecture Video</span>
            </button>
          ) : (
            <button
              onClick={openAddPlaylistModal}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-cyber-accent text-dark-950 font-bold font-mono text-xs hover:bg-cyber-neon transition-all shadow-neon"
            >
              <Plus className="w-4 h-4" />
              <span>Create New Playlist</span>
            </button>
          )}
        </div>
      </div>

      {/* VIEW 1: All Playlists Grid */}
      {!selectedPlaylist && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {playlists.map((pl) => {
            const currentCount = playlistVideos.filter((v) => v.playlist_id === pl.id).length || pl.video_count || 0;

            return (
              <div
                key={pl.id}
                className="glass-panel p-5 rounded-2xl border border-white/10 hover:border-cyber-accent/40 transition-all space-y-4 flex flex-col justify-between group shadow-xl"
              >
                <div className="space-y-3">
                  {/* Thumbnail Container */}
                  <div className="relative aspect-video rounded-xl overflow-hidden bg-dark-950 border border-white/10">
                    <img
                      src={pl.thumbnail_url || 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?q=80&w=800&auto=format&fit=crop'}
                      alt={pl.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                    <div className="absolute inset-0 bg-dark-950/40" />

                    {/* Category Badge */}
                    <div className="absolute top-2.5 left-2.5 px-2 py-0.5 rounded bg-dark-950/90 backdrop-blur-md border border-cyber-accent/30 text-[10px] font-mono font-bold text-cyber-neon">
                      {pl.category}
                    </div>

                    {/* Lecture Count Pill */}
                    <div className="absolute bottom-2.5 right-2.5 px-2.5 py-0.5 rounded-full bg-dark-950/90 backdrop-blur-md border border-white/10 text-[11px] font-mono text-white flex items-center gap-1.5 shadow-neon-sm">
                      <Video className="w-3 h-3 text-cyber-neon" />
                      <span>{currentCount} Lectures</span>
                    </div>
                  </div>

                  {/* Playlist Info */}
                  <div className="space-y-1.5">
                    <h3 className="text-base font-bold text-white font-sans line-clamp-1 group-hover:text-cyber-neon transition-colors">
                      {pl.title}
                    </h3>
                    <p className="text-xs text-gray-400 line-clamp-2 leading-relaxed">
                      {pl.description}
                    </p>
                  </div>
                </div>

                {/* Card Actions Footer */}
                <div className="pt-4 border-t border-white/5 flex items-center justify-between gap-2">
                  <button
                    onClick={() => setSelectedPlaylist(pl)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-cyber-dim border border-cyber-accent/30 text-cyber-neon text-xs font-mono font-medium hover:bg-cyber-accent/20 transition-all"
                  >
                    <Layers className="w-3.5 h-3.5" />
                    <span>Manage Lectures ({currentCount})</span>
                  </button>

                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => openEditPlaylistModal(pl)}
                      className="p-1.5 rounded-lg bg-dark-950 text-gray-400 hover:text-cyber-neon transition-colors"
                      title="Edit Playlist Settings"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleDeletePlaylist(pl.id, pl.title)}
                      className="p-1.5 rounded-lg bg-dark-950 text-gray-400 hover:text-red-400 transition-colors"
                      title="Delete Playlist"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* VIEW 2: Nested Lectures of Selected Playlist */}
      {selectedPlaylist && (
        <div className="space-y-6">
          {/* Playlist Summary Banner */}
          <div className="glass-panel p-6 rounded-2xl border border-white/10 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="space-y-1 max-w-2xl">
              <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-full bg-cyber-dim border border-cyber-accent/30 text-cyber-neon text-xs font-mono">
                <span>{selectedPlaylist.category}</span>
                <span>•</span>
                <span>Slug: /tutorials/{selectedPlaylist.slug}</span>
              </div>
              <h3 className="text-xl font-bold text-white font-sans">
                {selectedPlaylist.title}
              </h3>
              <p className="text-xs text-gray-400 leading-relaxed">
                {selectedPlaylist.description}
              </p>
            </div>

            <div className="flex items-center gap-3">
              {selectedPlaylist.youtube_playlist_url && (
                <a
                  href={selectedPlaylist.youtube_playlist_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-dark-950 border border-white/10 text-gray-300 hover:text-cyber-neon text-xs font-mono transition-all"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>YouTube Playlist</span>
                </a>
              )}
              <button
                onClick={openAddVideoModal}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-cyber-accent text-dark-950 font-bold font-mono text-xs hover:bg-cyber-neon transition-all shadow-neon"
              >
                <Plus className="w-4 h-4" />
                <span>Add Lecture</span>
              </button>
            </div>
          </div>

          {/* Videos Table / List */}
          {selectedPlaylistVideos.length === 0 ? (
            <div className="glass-panel p-12 text-center rounded-2xl border border-white/10 space-y-3">
              <Video className="w-10 h-10 text-gray-500 mx-auto" />
              <h4 className="text-base font-bold text-white font-mono">No lectures added yet</h4>
              <p className="text-xs text-gray-400 max-w-md mx-auto">
                Add your first YouTube lecture video to this course playlist to build the curriculum.
              </p>
              <button
                onClick={openAddVideoModal}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-cyber-accent text-dark-950 font-bold font-mono text-xs"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add First Lecture</span>
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {selectedPlaylistVideos.map((video) => (
                <div
                  key={video.id}
                  className="glass-panel p-4 rounded-xl border border-white/10 hover:border-cyber-accent/30 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                >
                  {/* Left: Thumbnail & Details */}
                  <div className="flex items-center gap-4">
                    <div className="w-8 h-8 rounded-lg bg-dark-950 border border-cyber-accent/30 flex items-center justify-center text-xs font-mono font-bold text-cyber-neon shrink-0">
                      #{video.order_index}
                    </div>

                    <div className="relative w-28 aspect-video rounded-lg overflow-hidden bg-dark-950 shrink-0 border border-white/10">
                      <img
                        src={`https://img.youtube.com/vi/${video.youtube_video_id}/hqdefault.jpg`}
                        alt={video.title}
                        className="w-full h-full object-cover"
                      />
                    </div>

                    <div className="space-y-1">
                      <h4 className="text-sm font-semibold text-white font-sans line-clamp-1">
                        {video.title}
                      </h4>
                      <div className="flex items-center gap-4 text-xs font-mono text-gray-400">
                        {video.duration && (
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3 text-cyber-neon" />
                            {video.duration}
                          </span>
                        )}
                        <span>ID: {video.youtube_video_id}</span>
                      </div>
                    </div>
                  </div>

                  {/* Right: Actions */}
                  <div className="flex items-center gap-3 self-end sm:self-center">
                    <a
                      href={video.youtube_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-2 rounded-lg bg-dark-950 text-gray-400 hover:text-cyber-neon transition-colors"
                      title="Watch on YouTube"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </a>
                    <button
                      onClick={() => openEditVideoModal(video)}
                      className="p-2 rounded-lg bg-dark-950 text-gray-400 hover:text-cyber-neon transition-colors"
                      title="Edit Lecture"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDeleteVideo(video.id, video.title)}
                      className="p-2 rounded-lg bg-dark-950 text-gray-400 hover:text-red-400 transition-colors"
                      title="Delete Lecture"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* MODAL 1: Create / Edit Playlist Modal */}
      {isPlaylistModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-dark-950/80 backdrop-blur-md">
          <div className="bg-dark-900 border border-white/10 rounded-2xl w-full max-w-xl p-6 sm:p-8 space-y-5 shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <h3 className="text-lg font-bold text-white font-mono">
                {editingPlaylist ? 'Edit Playlist Course' : 'Create New Playlist Course'}
              </h3>
              <button
                onClick={() => setIsPlaylistModalOpen(false)}
                className="p-1 rounded-lg text-gray-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSavePlaylist} className="space-y-4">
              <div>
                <label className="block text-xs font-mono text-gray-300 uppercase mb-1">
                  Playlist Course Title *
                </label>
                <input
                  type="text"
                  required
                  value={playlistForm.title}
                  onChange={(e) => handlePlaylistTitleChange(e.target.value)}
                  placeholder="Complete MS Office 365 & Excel Mastery Course"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-dark-950 border border-white/10 text-white text-xs focus:border-cyber-accent focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-mono text-gray-300 uppercase mb-1">
                    URL Slug *
                  </label>
                  <input
                    type="text"
                    required
                    value={playlistForm.slug}
                    onChange={(e) => setPlaylistForm({ ...playlistForm, slug: e.target.value })}
                    placeholder="complete-ms-office-excel-mastery"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-dark-950 border border-white/10 text-white text-xs font-mono focus:border-cyber-accent focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-mono text-gray-300 uppercase mb-1">
                    Category *
                  </label>
                  <select
                    value={playlistForm.category}
                    onChange={(e) => setPlaylistForm({ ...playlistForm, category: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-dark-950 border border-white/10 text-white text-xs focus:border-cyber-accent focus:outline-none"
                  >
                    <option value="MS Office">MS Office</option>
                    <option value="WordPress">WordPress</option>
                    <option value="Automation">Automation</option>
                    <option value="Data Analysis">Data Analysis</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-mono text-gray-300 uppercase mb-1">
                  Description *
                </label>
                <textarea
                  required
                  rows={3}
                  value={playlistForm.description}
                  onChange={(e) => setPlaylistForm({ ...playlistForm, description: e.target.value })}
                  placeholder="Master high-impact Excel formulas, dynamic arrays, executive dashboard modeling, and Word document automation..."
                  className="w-full px-3.5 py-2.5 rounded-xl bg-dark-950 border border-white/10 text-white text-xs focus:border-cyber-accent focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-mono text-gray-300 uppercase mb-1">
                  Thumbnail Image URL (Unsplash or custom CDN)
                </label>
                <input
                  type="text"
                  value={playlistForm.thumbnail_url}
                  onChange={(e) => setPlaylistForm({ ...playlistForm, thumbnail_url: e.target.value })}
                  placeholder="https://images.unsplash.com/photo-..."
                  className="w-full px-3.5 py-2.5 rounded-xl bg-dark-950 border border-white/10 text-white text-xs focus:border-cyber-accent focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-mono text-gray-300 uppercase mb-1">
                  YouTube Playlist URL (Optional)
                </label>
                <input
                  type="text"
                  value={playlistForm.youtube_playlist_url}
                  onChange={(e) => setPlaylistForm({ ...playlistForm, youtube_playlist_url: e.target.value })}
                  placeholder="https://www.youtube.com/playlist?list=PL..."
                  className="w-full px-3.5 py-2.5 rounded-xl bg-dark-950 border border-white/10 text-white text-xs focus:border-cyber-accent focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setIsPlaylistModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-dark-950 text-gray-400 hover:text-white text-xs font-mono"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-cyber-accent text-dark-950 font-bold font-mono text-xs hover:bg-cyber-neon transition-all"
                >
                  {editingPlaylist ? 'Save Changes' : 'Create Playlist'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: Add / Edit Lecture Video Modal */}
      {isVideoModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-dark-950/80 backdrop-blur-md">
          <div className="bg-dark-900 border border-white/10 rounded-2xl w-full max-w-xl p-6 sm:p-8 space-y-5 shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <h3 className="text-lg font-bold text-white font-mono">
                {editingVideo ? 'Edit Lecture Video' : `Add Lecture to "${selectedPlaylist?.title}"`}
              </h3>
              <button
                onClick={() => setIsVideoModalOpen(false)}
                className="p-1 rounded-lg text-gray-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveVideo} className="space-y-4">
              <div>
                <label className="block text-xs font-mono text-gray-300 uppercase mb-1">
                  Lecture Title *
                </label>
                <input
                  type="text"
                  required
                  value={videoForm.title}
                  onChange={(e) => setVideoForm({ ...videoForm, title: e.target.value })}
                  placeholder="Lesson 1: Advanced Excel Formulas & Nested Arrays..."
                  className="w-full px-3.5 py-2.5 rounded-xl bg-dark-950 border border-white/10 text-white text-xs focus:border-cyber-accent focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-mono text-gray-300 uppercase mb-1">
                  YouTube Video URL (or youtu.be / ID) *
                </label>
                <input
                  type="text"
                  required
                  value={videoForm.youtube_url}
                  onChange={(e) => handleVideoUrlChange(e.target.value)}
                  placeholder="https://www.youtube.com/watch?v=0kPspP8z908"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-dark-950 border border-white/10 text-white text-xs focus:border-cyber-accent focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-mono text-gray-300 uppercase mb-1">
                    Auto-Detected ID
                  </label>
                  <input
                    type="text"
                    value={videoForm.youtube_video_id}
                    onChange={(e) => setVideoForm({ ...videoForm, youtube_video_id: e.target.value })}
                    placeholder="0kPspP8z908"
                    className="w-full px-3 py-2 rounded-xl bg-dark-950 border border-white/10 text-white text-xs font-mono focus:border-cyber-accent focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-mono text-gray-300 uppercase mb-1">
                    Duration (e.g. 24:15)
                  </label>
                  <input
                    type="text"
                    value={videoForm.duration}
                    onChange={(e) => setVideoForm({ ...videoForm, duration: e.target.value })}
                    placeholder="24:15"
                    className="w-full px-3 py-2 rounded-xl bg-dark-950 border border-white/10 text-white text-xs focus:border-cyber-accent focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-mono text-gray-300 uppercase mb-1">
                    Order Index #
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={videoForm.order_index}
                    onChange={(e) => setVideoForm({ ...videoForm, order_index: Number(e.target.value) })}
                    className="w-full px-3 py-2 rounded-xl bg-dark-950 border border-white/10 text-white text-xs font-mono focus:border-cyber-accent focus:outline-none"
                  />
                </div>
              </div>

              {/* Realtime Thumbnail Preview */}
              {videoForm.youtube_video_id && (
                <div className="p-3 rounded-xl bg-dark-950 border border-white/5 flex items-center gap-3">
                  <img
                    src={`https://img.youtube.com/vi/${videoForm.youtube_video_id}/hqdefault.jpg`}
                    alt="Preview"
                    className="w-20 aspect-video object-cover rounded-lg"
                  />
                  <div className="text-xs font-mono text-gray-400">
                    <span className="text-emerald-400 font-bold flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" /> Valid YouTube Video Connected
                    </span>
                    <span className="block text-[11px] mt-0.5 text-gray-500">ID: {videoForm.youtube_video_id}</span>
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-3 pt-4 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setIsVideoModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-dark-950 text-gray-400 hover:text-white text-xs font-mono"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-cyber-accent text-dark-950 font-bold font-mono text-xs hover:bg-cyber-neon transition-all"
                >
                  {editingVideo ? 'Save Lecture' : 'Add Lecture'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
