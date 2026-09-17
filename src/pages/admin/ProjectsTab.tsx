import React, { useState } from 'react';
import { useStore } from '../../store/useStore';
import { Project } from '../../types';
import { Plus, Edit2, Trash2, FolderGit2, ExternalLink, X, Sparkles } from 'lucide-react';
import { GithubIcon } from '../../components/ui/Icons';
import { supabase, isSupabaseConfigured } from '../../lib/supabase';

export const ProjectsTab: React.FC = () => {
  const { projects, addProject, updateProject, deleteProject, addToast } = useStore();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);

  const [form, setForm] = useState({
    title: '',
    description: '',
    image_url: '',
    live_url: '',
    github_url: '',
    tagsString: '',
    sort_order: 1,
  });

  const openAddModal = () => {
    setEditingProject(null);
    setForm({
      title: '',
      description: '',
      image_url: 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?q=80&w=1200&auto=format&fit=crop',
      live_url: '',
      github_url: '',
      tagsString: 'WordPress, TailwindCSS, Gutenberg',
      sort_order: projects.length + 1,
    });
    setIsModalOpen(true);
  };

  const openEditModal = (proj: Project) => {
    setEditingProject(proj);
    setForm({
      title: proj.title,
      description: proj.description,
      image_url: proj.image_url,
      live_url: proj.live_url || '',
      github_url: proj.github_url || '',
      tagsString: proj.tags ? proj.tags.join(', ') : '',
      sort_order: proj.sort_order || 1,
    });
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const tags = form.tagsString
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);

    if (editingProject) {
      const updated = {
        title: form.title,
        description: form.description,
        image_url: form.image_url,
        live_url: form.live_url,
        github_url: form.github_url,
        tags,
        sort_order: Number(form.sort_order),
      };

      updateProject(editingProject.id, updated);

      if (isSupabaseConfigured()) {
        const { error } = await supabase.from('projects').update(updated).eq('id', editingProject.id);
        if (error) console.error('Supabase project update error:', error);
      }

      addToast({
        title: 'Project Updated',
        message: `"${form.title}" was updated successfully.`,
        type: 'success',
      });
    } else {
      let createdProj: Project = {
        id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : 'proj-' + Date.now(),
        title: form.title,
        description: form.description,
        image_url: form.image_url,
        live_url: form.live_url,
        github_url: form.github_url,
        tags,
        featured: true,
        sort_order: Number(form.sort_order),
        created_at: new Date().toISOString(),
      };

      if (isSupabaseConfigured()) {
        const insertPayload: any = {
          title: form.title,
          description: form.description,
          image_url: form.image_url,
          live_url: form.live_url,
          github_url: form.github_url,
          tags,
          featured: true,
          sort_order: Number(form.sort_order),
        };
        const { data, error } = await supabase.from('projects').insert([insertPayload]).select().single();
        if (error) {
          console.error('Supabase project insert error:', error);
        } else if (data) {
          createdProj = data as Project;
        }
      }

      addProject(createdProj);

      addToast({
        title: 'Project Created',
        message: `"${form.title}" added to showcase.`,
        type: 'success',
      });
    }

    setIsModalOpen(false);
  };

  const handleDelete = async (id: string, title: string) => {
    if (!window.confirm(`Delete project "${title}"?`)) return;

    deleteProject(id);

    if (isSupabaseConfigured()) {
      const { error } = await supabase.from('projects').delete().eq('id', id);
      if (error) console.error('Supabase project delete error:', error);
    }

    addToast({
      title: 'Project Deleted',
      message: `"${title}" has been deleted.`,
      type: 'info',
    });
  };

  return (
    <div className="space-y-6">
      {/* Header with Add Button */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white font-mono flex items-center gap-2">
            <FolderGit2 className="w-5 h-5 text-cyber-neon" />
            <span>Project Showcase Manager</span>
          </h2>
          <p className="text-xs text-gray-400">
            Control portfolio projects, tags, live URLs, and long-screenshot preview images.
          </p>
        </div>

        <button
          onClick={openAddModal}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-cyber-accent text-dark-950 font-bold font-mono text-xs hover:bg-cyber-neon transition-all shadow-neon"
        >
          <Plus className="w-4 h-4" />
          <span>Add New Project</span>
        </button>
      </div>

      {/* Projects Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {projects.map((proj) => (
          <div
            key={proj.id}
            className="glass-panel p-5 rounded-2xl border border-white/10 space-y-4 flex flex-col justify-between"
          >
            <div className="space-y-3">
              <div className="flex items-start justify-between gap-2">
                <h3 className="text-base font-bold text-white font-mono">{proj.title}</h3>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => openEditModal(proj)}
                    className="p-1.5 rounded-lg bg-dark-950 text-gray-400 hover:text-cyber-neon"
                    title="Edit"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => handleDelete(proj.id, proj.title)}
                    className="p-1.5 rounded-lg bg-dark-950 text-gray-400 hover:text-red-400"
                    title="Delete"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              <div className="h-32 rounded-xl overflow-hidden bg-dark-950 border border-white/10">
                <img
                  src={proj.image_url}
                  alt={proj.title}
                  className="w-full h-full object-cover object-top"
                />
              </div>

              <p className="text-xs text-gray-300 line-clamp-2 leading-relaxed">
                {proj.description}
              </p>

              <div className="flex flex-wrap gap-1.5 pt-1">
                {proj.tags?.map((tag, idx) => (
                  <span
                    key={idx}
                    className="text-[10px] font-mono px-2 py-0.5 rounded bg-dark-950 border border-white/10 text-gray-400"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>

            <div className="pt-3 border-t border-white/5 flex items-center justify-between text-xs font-mono">
              <div className="flex items-center gap-3">
                {proj.live_url && (
                  <a
                    href={proj.live_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-cyber-neon hover:underline flex items-center gap-1"
                  >
                    <ExternalLink className="w-3 h-3" />
                    <span>Live</span>
                  </a>
                )}
                {proj.github_url && (
                  <a
                    href={proj.github_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-gray-400 hover:text-white flex items-center gap-1"
                  >
                    <GithubIcon className="w-3 h-3" />
                    <span>Repo</span>
                  </a>
                )}
              </div>
              <span className="text-gray-500">Order: #{proj.sort_order || 1}</span>
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
                {editingProject ? 'Edit Project' : 'Add New Showcase Project'}
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
                  Project Title *
                </label>
                <input
                  type="text"
                  required
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  placeholder="Enterprise Financial Insights..."
                  className="w-full px-3 py-2 rounded-xl bg-dark-950 border border-white/10 text-white text-xs focus:border-cyber-accent focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-mono text-gray-300 uppercase mb-1">
                  Description *
                </label>
                <textarea
                  rows={3}
                  required
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="Summary of tech stack, architectural decisions, and outcomes..."
                  className="w-full px-3 py-2 rounded-xl bg-dark-950 border border-white/10 text-white text-xs focus:border-cyber-accent focus:outline-none resize-none"
                />
              </div>

              <div>
                <label className="block text-xs font-mono text-gray-300 uppercase mb-1">
                  Long Webpage Screenshot URL *
                </label>
                <input
                  type="url"
                  required
                  value={form.image_url}
                  onChange={(e) => setForm({ ...form, image_url: e.target.value })}
                  placeholder="https://..."
                  className="w-full px-3 py-2 rounded-xl bg-dark-950 border border-white/10 text-white text-xs focus:border-cyber-accent focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-mono text-gray-300 uppercase mb-1">
                    Live Demo URL
                  </label>
                  <input
                    type="url"
                    value={form.live_url}
                    onChange={(e) => setForm({ ...form, live_url: e.target.value })}
                    placeholder="https://..."
                    className="w-full px-3 py-2 rounded-xl bg-dark-950 border border-white/10 text-white text-xs focus:border-cyber-accent focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-mono text-gray-300 uppercase mb-1">
                    GitHub Repo URL
                  </label>
                  <input
                    type="url"
                    value={form.github_url}
                    onChange={(e) => setForm({ ...form, github_url: e.target.value })}
                    placeholder="https://github.com/..."
                    className="w-full px-3 py-2 rounded-xl bg-dark-950 border border-white/10 text-white text-xs focus:border-cyber-accent focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="col-span-2">
                  <label className="block text-xs font-mono text-gray-300 uppercase mb-1">
                    Tags (comma separated) *
                  </label>
                  <input
                    type="text"
                    required
                    value={form.tagsString}
                    onChange={(e) => setForm({ ...form, tagsString: e.target.value })}
                    placeholder="WordPress, WooCommerce, PHP"
                    className="w-full px-3 py-2 rounded-xl bg-dark-950 border border-white/10 text-white text-xs focus:border-cyber-accent focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-mono text-gray-300 uppercase mb-1">
                    Sort Order
                  </label>
                  <input
                    type="number"
                    value={form.sort_order}
                    onChange={(e) => setForm({ ...form, sort_order: parseInt(e.target.value) || 1 })}
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
                  {editingProject ? 'Save Changes' : 'Create Project'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
