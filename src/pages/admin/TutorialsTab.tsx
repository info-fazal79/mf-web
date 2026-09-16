import React, { useState } from 'react';
import { useStore } from '../../store/useStore';
import { Tutorial } from '../../types';
import { Plus, Edit2, Trash2, ExternalLink, X, Eye } from 'lucide-react';
import { YoutubeIcon } from '../../components/ui/Icons';
import { supabase, isSupabaseConfigured } from '../../lib/supabase';
import { extractYouTubeId } from '../../lib/utils';

export const TutorialsTab: React.FC = () => {
  const { tutorials, addTutorial, updateTutorial, deleteTutorial, addToast } = useStore();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTutorial, setEditingTutorial] = useState<Tutorial | null>(null);

  const [form, setForm] = useState({
    title: '',
    youtube_url: '',
    video_id: '',
    playlist_id: '',
    category: 'MS Office',
    duration: '20:00',
  });

  const openAddModal = () => {
    setEditingTutorial(null);
    setForm({
      title: '',
      youtube_url: '',
      video_id: '',
      playlist_id: '',
      category: 'MS Office',
      duration: '20:00',
    });
    setIsModalOpen(true);
  };

  const openEditModal = (tut: Tutorial) => {
    setEditingTutorial(tut);
    setForm({
      title: tut.title,
      youtube_url: tut.youtube_url,
      video_id: tut.video_id,
      playlist_id: tut.playlist_id || '',
      category: tut.category,
      duration: tut.duration || '15:00',
    });
    setIsModalOpen(true);
  };

  const handleUrlChange = (url: string) => {
    const extracted = extractYouTubeId(url);
    setForm((prev) => ({
      ...prev,
      youtube_url: url,
      video_id: extracted || prev.video_id,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const videoId = form.video_id || extractYouTubeId(form.youtube_url);

    if (editingTutorial) {
      const updated = {
        title: form.title,
        youtube_url: form.youtube_url,
        video_id: videoId,
        playlist_id: form.playlist_id,
        category: form.category,
        duration: form.duration,
      };
      updateTutorial(editingTutorial.id, updated);

      if (isSupabaseConfigured()) {
        await supabase.from('tutorials').update(updated).eq('id', editingTutorial.id);
      }

      addToast({
        title: 'Tutorial Updated',
        message: `"${form.title}" was updated.`,
        type: 'success',
      });
    } else {
      const newTut: Tutorial = {
        id: 'tut-' + Date.now(),
        title: form.title,
        youtube_url: form.youtube_url,
        video_id: videoId,
        playlist_id: form.playlist_id,
        category: form.category,
        duration: form.duration,
        views_count: 500,
        created_at: new Date().toISOString(),
      };

      addTutorial(newTut);

      if (isSupabaseConfigured()) {
        await supabase.from('tutorials').insert([newTut]);
      }

      addToast({
        title: 'Tutorial Added',
        message: `"${form.title}" added to tutorials list.`,
        type: 'success',
      });
    }

    setIsModalOpen(false);
  };

  const handleDelete = async (id: string, title: string) => {
    if (!window.confirm(`Delete tutorial "${title}"?`)) return;

    deleteTutorial(id);
    if (isSupabaseConfigured()) {
      await supabase.from('tutorials').delete().eq('id', id);
    }

    addToast({
      title: 'Tutorial Deleted',
      message: `"${title}" has been deleted.`,
      type: 'info',
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white font-mono flex items-center gap-2">
            <YoutubeIcon className="w-5 h-5 text-red-500" />
            <span>YouTube Tutorials & Playlist Manager</span>
          </h2>
          <p className="text-xs text-gray-400">
            Add YouTube video URLs or Playlist IDs to organize your free video classes.
          </p>
        </div>

        <button
          onClick={openAddModal}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-cyber-accent text-dark-950 font-bold font-mono text-xs hover:bg-cyber-neon transition-all shadow-neon"
        >
          <Plus className="w-4 h-4" />
          <span>Add New Tutorial</span>
        </button>
      </div>

      {/* Tutorials Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {tutorials.map((tut) => (
          <div
            key={tut.id}
            className="glass-panel p-5 rounded-2xl border border-white/10 space-y-4 flex flex-col justify-between"
          >
            <div className="space-y-3">
              <div className="relative aspect-video rounded-xl overflow-hidden bg-dark-950 border border-white/10">
                <img
                  src={`https://img.youtube.com/vi/${tut.video_id}/hqdefault.jpg`}
                  alt={tut.title}
                  className="w-full h-full object-cover"
                />
                <div className="absolute top-2 right-2 px-2 py-0.5 rounded bg-dark-950/80 backdrop-blur-md text-[10px] font-mono text-cyber-neon">
                  {tut.category}
                </div>
              </div>

              <h3 className="text-sm font-bold text-white font-mono line-clamp-2">
                {tut.title}
              </h3>

              <div className="flex items-center justify-between text-xs text-gray-400 font-mono">
                <span>Duration: {tut.duration || 'N/A'}</span>
                <span>ID: {tut.video_id}</span>
              </div>
            </div>

            <div className="pt-3 border-t border-white/5 flex items-center justify-between">
              <a
                href={tut.youtube_url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs font-mono text-cyber-neon hover:underline flex items-center gap-1"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>Watch Video</span>
              </a>

              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => openEditModal(tut)}
                  className="p-1.5 rounded-lg bg-dark-950 text-gray-400 hover:text-cyber-neon"
                  title="Edit Tutorial"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => handleDelete(tut.id, tut.title)}
                  className="p-1.5 rounded-lg bg-dark-950 text-gray-400 hover:text-red-400"
                  title="Delete Tutorial"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Add / Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-dark-950/80 backdrop-blur-md">
          <div className="bg-dark-900 border border-white/10 rounded-2xl w-full max-w-xl p-6 sm:p-8 space-y-5 shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <h3 className="text-lg font-bold text-white font-mono">
                {editingTutorial ? 'Edit Tutorial' : 'Add YouTube Tutorial'}
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1 rounded-lg text-gray-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-mono text-gray-300 uppercase mb-1">
                  Tutorial Title *
                </label>
                <input
                  type="text"
                  required
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  placeholder="Advanced Excel Formulas & Nested Arrays..."
                  className="w-full px-3 py-2 rounded-xl bg-dark-950 border border-white/10 text-white text-xs focus:border-cyber-accent focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-mono text-gray-300 uppercase mb-1">
                  YouTube URL (or Video ID) *
                </label>
                <input
                  type="text"
                  required
                  value={form.youtube_url}
                  onChange={(e) => handleUrlChange(e.target.value)}
                  placeholder="https://www.youtube.com/watch?v=..."
                  className="w-full px-3 py-2 rounded-xl bg-dark-950 border border-white/10 text-white text-xs focus:border-cyber-accent focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-mono text-gray-300 uppercase mb-1">
                    Detected Video ID
                  </label>
                  <input
                    type="text"
                    value={form.video_id}
                    onChange={(e) => setForm({ ...form, video_id: e.target.value })}
                    placeholder="0kPspP8z908"
                    className="w-full px-3 py-2 rounded-xl bg-dark-950 border border-white/10 text-white text-xs font-mono focus:border-cyber-accent focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-mono text-gray-300 uppercase mb-1">
                    Category *
                  </label>
                  <select
                    value={form.category}
                    onChange={(e) => setForm({ ...form, category: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-dark-950 border border-white/10 text-white text-xs focus:border-cyber-accent focus:outline-none"
                  >
                    <option value="MS Office">MS Office</option>
                    <option value="WordPress">WordPress</option>
                    <option value="Automation">Automation</option>
                    <option value="Data Analysis">Data Analysis</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-mono text-gray-300 uppercase mb-1">
                    Duration (e.g. 24:15)
                  </label>
                  <input
                    type="text"
                    value={form.duration}
                    onChange={(e) => setForm({ ...form, duration: e.target.value })}
                    placeholder="24:15"
                    className="w-full px-3 py-2 rounded-xl bg-dark-950 border border-white/10 text-white text-xs focus:border-cyber-accent focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-mono text-gray-300 uppercase mb-1">
                    Playlist ID (Optional)
                  </label>
                  <input
                    type="text"
                    value={form.playlist_id}
                    onChange={(e) => setForm({ ...form, playlist_id: e.target.value })}
                    placeholder="PLxxxxxx"
                    className="w-full px-3 py-2 rounded-xl bg-dark-950 border border-white/10 text-white text-xs focus:border-cyber-accent focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-dark-950 text-gray-400 hover:text-white text-xs font-mono"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-cyber-accent text-dark-950 font-bold font-mono text-xs hover:bg-cyber-neon transition-all"
                >
                  {editingTutorial ? 'Save Changes' : 'Add Tutorial'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
