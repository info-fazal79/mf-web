import React, { useState } from 'react';
import { useStore } from '../../store/useStore';
import { BlogPost } from '../../types';
import { Plus, Edit2, Trash2, FileText, Calendar, Clock, X, Eye, EyeOff } from 'lucide-react';
import { supabase, isSupabaseConfigured } from '../../lib/supabase';
import { formatDate } from '../../lib/utils';

export const BlogTab: React.FC = () => {
  const { posts, addPost, updatePost, deletePost, addToast } = useStore();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPost, setEditingPost] = useState<BlogPost | null>(null);

  const [form, setForm] = useState({
    title: '',
    slug: '',
    summary: '',
    content: '',
    category: 'WordPress',
    tagsString: '',
    featured_image: '',
    published: true,
    read_time: '5 min read',
  });

  const openAddModal = () => {
    setEditingPost(null);
    setForm({
      title: '',
      slug: '',
      summary: '',
      content: '### Section Heading\n\nWrite insightful content here...',
      category: 'WordPress',
      tagsString: 'WordPress, Optimization, Web Development',
      featured_image: 'https://images.unsplash.com/photo-1507238691740-187a5b1d37b8?q=80&w=1200&auto=format&fit=crop',
      published: true,
      read_time: '5 min read',
    });
    setIsModalOpen(true);
  };

  const openEditModal = (post: BlogPost) => {
    setEditingPost(post);
    setForm({
      title: post.title,
      slug: post.slug,
      summary: post.summary || '',
      content: post.content,
      category: post.category,
      tagsString: post.tags ? post.tags.join(', ') : '',
      featured_image: post.featured_image,
      published: post.published,
      read_time: post.read_time,
    });
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const tags = form.tagsString
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);
    const slug = form.slug || form.title.toLowerCase().replace(/[^a-z0-9]+/g, '-');

    if (editingPost) {
      const updated = {
        title: form.title,
        slug,
        summary: form.summary,
        content: form.content,
        category: form.category,
        tags,
        featured_image: form.featured_image,
        published: form.published,
        read_time: form.read_time,
      };
      updatePost(editingPost.id, updated);

      if (isSupabaseConfigured()) {
        const { error } = await supabase.from('posts').update(updated).eq('id', editingPost.id);
        if (error) console.error('Supabase post update error:', error);
      }

      addToast({
        title: 'Article Updated',
        message: `"${form.title}" updated successfully.`,
        type: 'success',
      });
    } else {
      let createdPost: BlogPost = {
        id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : 'post-' + Date.now(),
        title: form.title,
        slug,
        summary: form.summary,
        content: form.content,
        category: form.category,
        tags,
        featured_image: form.featured_image,
        published: form.published,
        read_time: form.read_time,
        created_at: new Date().toISOString(),
      };

      if (isSupabaseConfigured()) {
        const insertPayload: any = {
          title: form.title,
          slug,
          summary: form.summary,
          content: form.content,
          category: form.category,
          tags,
          featured_image: form.featured_image,
          published: form.published,
          read_time: form.read_time,
        };
        const { data, error } = await supabase.from('posts').insert([insertPayload]).select().single();
        if (error) {
          console.error('Supabase post insert error:', error);
        } else if (data) {
          createdPost = data as BlogPost;
        }
      }

      addPost(createdPost);

      addToast({
        title: 'Article Published',
        message: `"${form.title}" is now live.`,
        type: 'success',
      });
    }

    setIsModalOpen(false);
  };

  const handleDelete = async (id: string, title: string) => {
    if (!window.confirm(`Delete article "${title}"?`)) return;

    deletePost(id);
    if (isSupabaseConfigured()) {
      const { error } = await supabase.from('posts').delete().eq('id', id);
      if (error) console.error('Supabase post delete error:', error);
    }

    addToast({
      title: 'Article Deleted',
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
            <FileText className="w-5 h-5 text-cyber-neon" />
            <span>Blog & Article Manager</span>
          </h2>
          <p className="text-xs text-gray-400">
            Write technical articles, manage publishing states, tags, and featured images.
          </p>
        </div>

        <button
          onClick={openAddModal}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-cyber-accent text-dark-950 font-bold font-mono text-xs hover:bg-cyber-neon transition-all shadow-neon"
        >
          <Plus className="w-4 h-4" />
          <span>Write New Article</span>
        </button>
      </div>

      {/* Articles Table */}
      <div className="glass-panel rounded-2xl border border-white/10 overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-mono">
            <thead className="bg-dark-950 border-b border-white/10 text-gray-400 uppercase">
              <tr>
                <th className="py-3 px-4">Article</th>
                <th className="py-3 px-4">Category</th>
                <th className="py-3 px-4">Read Time</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Date</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 text-gray-300">
              {posts.map((post) => (
                <tr key={post.id} className="hover:bg-dark-950/40 transition-colors">
                  <td className="py-3 px-4 flex items-center gap-3">
                    <img
                      src={post.featured_image}
                      alt={post.title}
                      className="w-12 h-10 object-cover rounded border border-white/10 shrink-0"
                    />
                    <div className="max-w-xs truncate font-bold text-white">
                      {post.title}
                    </div>
                  </td>
                  <td className="py-3 px-4 text-cyber-neon">{post.category}</td>
                  <td className="py-3 px-4 text-gray-400">{post.read_time}</td>
                  <td className="py-3 px-4">
                    {post.published ? (
                      <span className="inline-flex items-center gap-1 text-[10px] text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20 font-bold">
                        <Eye className="w-3 h-3" />
                        <span>LIVE</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[10px] text-gray-400 bg-dark-950 px-2 py-0.5 rounded border border-white/10">
                        <EyeOff className="w-3 h-3" />
                        <span>DRAFT</span>
                      </span>
                    )}
                  </td>
                  <td className="py-3 px-4 text-gray-400">{formatDate(post.created_at)}</td>
                  <td className="py-3 px-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => openEditModal(post)}
                        className="p-1.5 rounded-lg bg-dark-950 text-gray-400 hover:text-cyber-neon"
                        title="Edit Article"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDelete(post.id, post.title)}
                        className="p-1.5 rounded-lg bg-dark-950 text-gray-400 hover:text-red-400"
                        title="Delete Article"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add / Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-dark-950/80 backdrop-blur-md">
          <div className="bg-dark-900 border border-white/10 rounded-2xl w-full max-w-2xl p-6 sm:p-8 space-y-5 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <h3 className="text-lg font-bold text-white font-mono">
                {editingPost ? 'Edit Blog Article' : 'Draft New Article'}
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
                  Article Title *
                </label>
                <input
                  type="text"
                  required
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  placeholder="How I Built a 99/100 PageSpeed..."
                  className="w-full px-3 py-2 rounded-xl bg-dark-950 border border-white/10 text-white text-xs focus:border-cyber-accent focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-mono text-gray-300 uppercase mb-1">
                    Category *
                  </label>
                  <input
                    type="text"
                    required
                    value={form.category}
                    onChange={(e) => setForm({ ...form, category: e.target.value })}
                    placeholder="WordPress / MS Office / Automation"
                    className="w-full px-3 py-2 rounded-xl bg-dark-950 border border-white/10 text-white text-xs focus:border-cyber-accent focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-mono text-gray-300 uppercase mb-1">
                    Estimated Read Time
                  </label>
                  <input
                    type="text"
                    value={form.read_time}
                    onChange={(e) => setForm({ ...form, read_time: e.target.value })}
                    placeholder="5 min read"
                    className="w-full px-3 py-2 rounded-xl bg-dark-950 border border-white/10 text-white text-xs focus:border-cyber-accent focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-mono text-gray-300 uppercase mb-1">
                  Short Summary / Excerpt
                </label>
                <input
                  type="text"
                  value={form.summary}
                  onChange={(e) => setForm({ ...form, summary: e.target.value })}
                  placeholder="A quick summary for search engines and cards..."
                  className="w-full px-3 py-2 rounded-xl bg-dark-950 border border-white/10 text-white text-xs focus:border-cyber-accent focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-mono text-gray-300 uppercase mb-1">
                  Featured Image URL *
                </label>
                <input
                  type="url"
                  required
                  value={form.featured_image}
                  onChange={(e) => setForm({ ...form, featured_image: e.target.value })}
                  placeholder="https://..."
                  className="w-full px-3 py-2 rounded-xl bg-dark-950 border border-white/10 text-white text-xs focus:border-cyber-accent focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-mono text-gray-300 uppercase mb-1">
                  Article Body (Supports Markdown headings ###, ####, bullet lists) *
                </label>
                <textarea
                  rows={8}
                  required
                  value={form.content}
                  onChange={(e) => setForm({ ...form, content: e.target.value })}
                  placeholder="### Introduction&#10;&#10;Content paragraphs..."
                  className="w-full p-3 rounded-xl bg-dark-950 border border-white/10 text-white text-xs font-mono focus:border-cyber-accent focus:outline-none leading-relaxed"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-mono text-gray-300 uppercase mb-1">
                    Tags (comma separated)
                  </label>
                  <input
                    type="text"
                    value={form.tagsString}
                    onChange={(e) => setForm({ ...form, tagsString: e.target.value })}
                    placeholder="WordPress, Gutenberg, Performance"
                    className="w-full px-3 py-2 rounded-xl bg-dark-950 border border-white/10 text-white text-xs focus:border-cyber-accent focus:outline-none"
                  />
                </div>

                <div className="flex items-center pt-5">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={form.published}
                      onChange={(e) => setForm({ ...form, published: e.target.checked })}
                      className="w-4 h-4 rounded text-cyber-accent focus:ring-cyber-accent bg-dark-950"
                    />
                    <span className="text-xs font-mono text-cyber-neon font-bold">
                      Publish to Live Site
                    </span>
                  </label>
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
                  {editingPost ? 'Save Updates' : 'Publish Article'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
