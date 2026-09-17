import React, { useEffect } from 'react';
import { useStore } from '../../store/useStore';
import { formatPrice } from '../../lib/utils';
import { BookOpen, ShoppingBag, Download, Sparkles, Check, FileText } from 'lucide-react';
import { Book } from '../../types';
import { supabase, isSupabaseConfigured } from '../../lib/supabase';

export const EbookStore: React.FC = () => {
  const {
    books,
    setBooks,
    addToCart,
    cart,
    setCheckoutSuccessOrder,
  } = useStore();

  useEffect(() => {
    async function fetchLiveBooks() {
      if (!isSupabaseConfigured()) return;
      try {
        const { data } = await supabase.from('books').select('*').order('created_at', { ascending: false });
        if (data) setBooks(data as Book[]);
      } catch (err) {
        console.warn('Live fetch for books error:', err);
      }
    }
    fetchLiveBooks();
  }, [setBooks]);

  const handleInstantFreeDownload = (book: Book) => {
    // Directly open checkout success modal with this free book
    setCheckoutSuccessOrder({
      id: 'free-' + Date.now(),
      customer_name: 'Valued Reader',
      customer_email: 'reader@example.com',
      book_id: book.id,
      book: book,
      amount: 0,
      payment_method: 'free_download',
      trx_id: 'FREE_ACCESS',
      status: 'completed',
      created_at: new Date().toISOString(),
    });
  };

  return (
    <section id="ebooks" className="py-16 relative bg-dark-900/60">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">

        {/* Books Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {books.map((book) => {
            const isItemInCart = cart.some((c) => c.book.id === book.id);

            return (
              <div
                key={book.id}
                className="glass-panel rounded-2xl border border-white/10 hover:border-cyber-accent/40 transition-all duration-300 flex flex-col justify-between overflow-hidden group hover:-translate-y-1.5 shadow-2xl"
              >
                {/* Book Cover Container */}
                <div className="relative aspect-[16/10] bg-dark-950 overflow-hidden border-b border-white/10">
                  <img
                    src={book.cover_url}
                    alt={book.title}
                    className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                  />
                  {/* Badge */}
                  <div className="absolute top-3 right-3">
                    {book.is_free || book.price === 0 ? (
                      <span className="px-3 py-1 rounded-full bg-cyber-accent text-dark-950 text-xs font-mono font-extrabold shadow-neon-sm">
                        FREE PDF
                      </span>
                    ) : (
                      <span className="px-3 py-1 rounded-full bg-dark-900/90 backdrop-blur-md border border-cyber-accent/40 text-cyber-neon text-xs font-mono font-bold">
                        {formatPrice(book.price)}
                      </span>
                    )}
                  </div>

                  {book.pages && (
                    <div className="absolute bottom-3 left-3 px-2.5 py-1 rounded-md bg-dark-950/80 backdrop-blur-md text-[11px] font-mono text-gray-300 flex items-center gap-1.5">
                      <FileText className="w-3.5 h-3.5 text-cyber-neon" />
                      <span>{book.pages} Pages</span>
                    </div>
                  )}
                </div>

                {/* Book Details */}
                <div className="p-6 flex-1 flex flex-col justify-between space-y-6">
                  <div className="space-y-3">
                    <h3 className="text-lg font-bold text-white font-sans group-hover:text-cyber-neon transition-colors line-clamp-2">
                      {book.title}
                    </h3>
                    <p className="text-gray-400 text-xs sm:text-sm leading-relaxed line-clamp-3">
                      {book.description}
                    </p>
                  </div>

                  {/* Actions */}
                  <div className="pt-4 border-t border-white/5 flex items-center justify-between gap-4">
                    <div className="font-mono">
                      <span className="text-xs text-gray-400 block">Price</span>
                      <span className="text-lg font-bold text-cyber-neon">
                        {formatPrice(book.price)}
                      </span>
                    </div>

                    {book.is_free || book.price === 0 ? (
                      <button
                        onClick={() => handleInstantFreeDownload(book)}
                        className="flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-cyber-accent text-dark-950 font-bold font-mono text-xs hover:bg-cyber-neon transition-all shadow-neon hover:shadow-neon-lg"
                      >
                        <Download className="w-4 h-4" />
                        <span>Instant Download</span>
                      </button>
                    ) : (
                      <button
                        onClick={() => addToCart(book)}
                        className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl font-mono text-xs font-bold transition-all ${
                          isItemInCart
                            ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                            : 'bg-dark-900 hover:bg-cyber-accent hover:text-dark-950 text-white border border-white/10 hover:border-cyber-accent'
                        }`}
                      >
                        {isItemInCart ? (
                          <>
                            <Check className="w-4 h-4" />
                            <span>In Cart</span>
                          </>
                        ) : (
                          <>
                            <ShoppingBag className="w-4 h-4" />
                            <span>Add to Cart</span>
                          </>
                        )}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};
