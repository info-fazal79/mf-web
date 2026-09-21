import React, { useState } from 'react';
import { useStore } from '../../store/useStore';
import { Book } from '../../types';
import { formatPrice } from '../../lib/utils';
import { Plus, Edit2, Trash2, BookOpen, ExternalLink, X, Check, UploadCloud } from 'lucide-react';
import { supabase, isSupabaseConfigured } from '../../lib/supabase';
import { ImageUpload } from '../../components/admin/ImageUpload';

export const EbooksTab: React.FC = () => {
  const { books, addBook, updateBook, deleteBook, addToast } = useStore();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingBook, setEditingBook] = useState<Book | null>(null);

  const [form, setForm] = useState({
    title: '',
    slug: '',
    description: '',
    price: 0,
    is_free: false,
    cover_url: '',
    file_url: '',
    pages: 120,
  });

  const openAddModal = () => {
    setEditingBook(null);
    setForm({
      title: '',
      slug: '',
      description: '',
      price: 0,
      is_free: false,
      cover_url: 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?q=80&w=800&auto=format&fit=crop',
      file_url: 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf',
      pages: 120,
    });
    setIsModalOpen(true);
  };

  const openEditModal = (book: Book) => {
    setEditingBook(book);
    setForm({
      title: book.title,
      slug: book.slug,
      description: book.description,
      price: book.price,
      is_free: book.is_free,
      cover_url: book.cover_url,
      file_url: book.file_url,
      pages: book.pages || 100,
    });
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const slug = form.slug || form.title.toLowerCase().replace(/[^a-z0-9]+/g, '-');

    if (editingBook) {
      // Update
      const updated = {
        ...form,
        slug,
        price: form.is_free ? 0 : Number(form.price),
      };
      updateBook(editingBook.id, updated);

      if (isSupabaseConfigured()) {
        const { error } = await supabase.from('books').update(updated).eq('id', editingBook.id);
        if (error) console.error('Supabase book update error:', error);
      }

      addToast({
        title: 'Book Updated',
        message: `"${form.title}" was updated successfully.`,
        type: 'success',
      });
    } else {
      // Add
      let createdBook: Book = {
        id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : 'book-' + Date.now(),
        ...form,
        slug,
        price: form.is_free ? 0 : Number(form.price),
        downloads_count: 0,
        featured: true,
        created_at: new Date().toISOString(),
      };

      if (isSupabaseConfigured()) {
        const insertPayload: any = {
          title: form.title,
          slug,
          description: form.description,
          price: form.is_free ? 0 : Number(form.price),
          is_free: form.is_free,
          cover_url: form.cover_url,
          file_url: form.file_url,
          pages: form.pages,
          featured: true,
        };
        const { data, error } = await supabase.from('books').insert([insertPayload]).select().single();
        if (error) {
          console.error('Supabase book insert error:', error);
        } else if (data) {
          createdBook = data as Book;
        }
      }

      addBook(createdBook);

      addToast({
        title: 'Book Created',
        message: `"${form.title}" added to digital store.`,
        type: 'success',
      });
    }

    setIsModalOpen(false);
  };

  const handleDelete = async (id: string, title: string) => {
    if (!window.confirm(`Are you sure you want to delete "${title}"?`)) return;

    deleteBook(id);
    if (isSupabaseConfigured()) {
      const { error } = await supabase.from('books').delete().eq('id', id);
      if (error) console.error('Supabase book delete error:', error);
    }

    addToast({
      title: 'Book Deleted',
      message: `"${title}" has been removed.`,
      type: 'info',
    });
  };

  return (
    <div className="space-y-6">
      {/* Header with Add Button */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white font-mono flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-cyber-neon" />
            <span>eBook & Digital Store Manager</span>
          </h2>
          <p className="text-xs text-gray-400">
            Publish guides, set pricing, upload covers, and configure direct PDF download links.
          </p>
        </div>

        <button
          onClick={openAddModal}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-cyber-accent text-dark-950 font-bold font-mono text-xs hover:bg-cyber-neon transition-all shadow-neon"
        >
          <Plus className="w-4 h-4" />
          <span>Add New eBook</span>
        </button>
      </div>

      {/* Books Table / Grid */}
      <div className="glass-panel rounded-2xl border border-white/10 overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-mono">
            <thead className="bg-dark-950 border-b border-white/10 text-gray-400 uppercase">
              <tr>
                <th className="py-3 px-4">Book</th>
                <th className="py-3 px-4">Price</th>
                <th className="py-3 px-4">Pages</th>
                <th className="py-3 px-4">Type</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 text-gray-300">
              {books.map((book) => (
                <tr key={book.id} className="hover:bg-dark-950/40 transition-colors">
                  <td className="py-3 px-4 flex items-center gap-3">
                    <img
                      src={book.cover_url}
                      alt={book.title}
                      className="w-10 h-14 object-cover rounded border border-white/10 shrink-0"
                    />
                    <div>
                      <div className="font-bold text-white max-w-xs truncate">{book.title}</div>
                      <div className="text-[11px] text-gray-500 font-sans line-clamp-1">
                        {book.description}
                      </div>
                    </div>
                  </td>
                  <td className="py-3 px-4 text-cyber-neon font-bold">
                    {formatPrice(book.price)}
                  </td>
                  <td className="py-3 px-4">{book.pages || 'N/A'}</td>
                  <td className="py-3 px-4">
                    {book.is_free ? (
                      <span className="px-2 py-0.5 rounded bg-cyber-dim text-cyber-neon text-[10px] font-bold">
                        FREE
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded bg-dark-950 border border-white/10 text-gray-300 text-[10px]">
                        PAID
                      </span>
                    )}
                  </td>
                  <td className="py-3 px-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <a
                        href={book.file_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-1.5 rounded-lg bg-dark-950 text-gray-400 hover:text-white"
                        title="Preview PDF"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                      <button
                        onClick={() => openEditModal(book)}
                        className="p-1.5 rounded-lg bg-dark-950 text-gray-400 hover:text-cyber-neon"
                        title="Edit Book"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDelete(book.id, book.title)}
                        className="p-1.5 rounded-lg bg-dark-950 text-gray-400 hover:text-red-400"
                        title="Delete Book"
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
          <div className="bg-dark-900 border border-white/10 rounded-2xl w-full max-w-xl p-6 sm:p-8 space-y-5 shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <h3 className="text-lg font-bold text-white font-mono">
                {editingBook ? 'Edit eBook Details' : 'Add New Digital eBook'}
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
                  eBook Title *
                </label>
                <input
                  type="text"
                  required
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  placeholder="Mastering Modern WordPress..."
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
                  placeholder="Summary of chapters, takeaways, and target audience..."
                  className="w-full px-3 py-2 rounded-xl bg-dark-950 border border-white/10 text-white text-xs focus:border-cyber-accent focus:outline-none resize-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-mono text-gray-300 uppercase mb-1">
                    Free / Paid Toggle
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer pt-2">
                    <input
                      type="checkbox"
                      checked={form.is_free}
                      onChange={(e) => setForm({ ...form, is_free: e.target.checked })}
                      className="w-4 h-4 rounded text-cyber-accent focus:ring-cyber-accent bg-dark-950"
                    />
                    <span className="text-xs font-mono text-cyber-neon font-bold">
                      {form.is_free ? 'Is Free eBook' : 'Paid Product'}
                    </span>
                  </label>
                </div>

                {!form.is_free && (
                  <div>
                    <label className="block text-xs font-mono text-gray-300 uppercase mb-1">
                      Price ($ USD) *
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      required
                      value={form.price}
                      onChange={(e) => setForm({ ...form, price: parseFloat(e.target.value) || 0 })}
                      className="w-full px-3 py-2 rounded-xl bg-dark-950 border border-white/10 text-white text-xs focus:border-cyber-accent focus:outline-none"
                    />
                  </div>
                )}
              </div>

              {/* Cover Image Upload (WebP) */}
              <ImageUpload
                label="Cover Image (WebP Auto-Compression)"
                value={form.cover_url}
                onChange={(url) => setForm({ ...form, cover_url: url })}
                folder="ebooks"
                required
                helperText="Upload book cover JPG/PNG — auto-compressed to WebP or paste external URL."
              />

              <div>
                <label className="block text-xs font-mono text-gray-300 uppercase mb-1">
                  PDF File Download URL *
                </label>
                <input
                  type="url"
                  required
                  value={form.file_url}
                  onChange={(e) => setForm({ ...form, file_url: e.target.value })}
                  placeholder="https://..."
                  className="w-full px-3 py-2 rounded-xl bg-dark-950 border border-white/10 text-white text-xs focus:border-cyber-accent focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-mono text-gray-300 uppercase mb-1">
                  Number of Pages
                </label>
                <input
                  type="number"
                  value={form.pages}
                  onChange={(e) => setForm({ ...form, pages: parseInt(e.target.value) || 0 })}
                  className="w-full px-3 py-2 rounded-xl bg-dark-950 border border-white/10 text-white text-xs focus:border-cyber-accent focus:outline-none"
                />
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
                  {editingBook ? 'Save Changes' : 'Create eBook'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
