import React from 'react';
import { CheckCircle2, Download, ExternalLink, X, BookOpen, Sparkles } from 'lucide-react';
import { useStore } from '../../store/useStore';
import { formatPrice } from '../../lib/utils';

export const CheckoutSuccessModal: React.FC = () => {
  const { checkoutSuccessOrder, setCheckoutSuccessOrder } = useStore();

  if (!checkoutSuccessOrder) return null;

  const book = checkoutSuccessOrder.book;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
      {/* Backdrop */}
      <div
        onClick={() => setCheckoutSuccessOrder(null)}
        className="fixed inset-0 bg-dark-950/85 backdrop-blur-md transition-opacity"
      />

      {/* Modal Card */}
      <div className="relative w-full max-w-lg bg-dark-900 border border-cyber-accent/40 rounded-2xl shadow-neon-lg overflow-hidden z-10 p-6 sm:p-8 space-y-6 text-center animate-fade-in">
        <button
          onClick={() => setCheckoutSuccessOrder(null)}
          className="absolute top-4 right-4 p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-dark-800 transition-colors"
          aria-label="Close modal"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Icon */}
        <div className="mx-auto w-16 h-16 rounded-full bg-cyber-dim border border-cyber-accent flex items-center justify-center text-cyber-neon shadow-neon">
          <Sparkles className="w-8 h-8" />
        </div>

        <div className="space-y-2">
          <span className="inline-block px-3 py-1 rounded-full bg-cyber-dim border border-cyber-accent/40 text-cyber-neon text-xs font-mono font-bold uppercase tracking-wider">
            Order Confirmed #{checkoutSuccessOrder.id.slice(-6).toUpperCase()}
          </span>
          <h3 className="text-2xl font-bold text-white font-mono">Thank You, {checkoutSuccessOrder.customer_name}!</h3>
          <p className="text-xs text-gray-400">
            A confirmation has been sent to <span className="text-white font-mono">{checkoutSuccessOrder.customer_email}</span>
          </p>
        </div>

        {/* Book Preview Card */}
        {book && (
          <div className="p-4 rounded-xl bg-dark-950 border border-white/10 flex items-center gap-4 text-left">
            <img
              src={book.cover_url}
              alt={book.title}
              className="w-16 h-20 object-cover rounded-lg border border-white/10 shrink-0"
            />
            <div className="flex-1 min-w-0">
              <h4 className="text-sm font-bold text-white truncate font-mono">{book.title}</h4>
              <p className="text-xs text-gray-400 mt-0.5 line-clamp-2">{book.description}</p>
              <div className="mt-2 text-xs font-mono text-cyber-neon font-semibold">
                Amount Paid: {formatPrice(checkoutSuccessOrder.amount)}
              </div>
            </div>
          </div>
        )}

        {/* Instant Download Action */}
        <div className="space-y-3 pt-2">
          {book?.file_url ? (
            <a
              href={book.file_url}
              target="_blank"
              rel="noopener noreferrer"
              download
              className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl bg-cyber-accent text-dark-950 font-bold font-mono tracking-wider hover:bg-cyber-neon transition-all shadow-neon hover:shadow-neon-lg transform hover:-translate-y-0.5"
            >
              <Download className="w-5 h-5" />
              <span>Download Your eBook (PDF)</span>
            </a>
          ) : (
            <div className="text-xs text-amber-400 font-mono">
              Download link will be dispatched to your inbox shortly.
            </div>
          )}

          <button
            onClick={() => setCheckoutSuccessOrder(null)}
            className="w-full py-2.5 rounded-xl bg-dark-800 text-gray-400 hover:text-white text-xs font-mono transition-colors"
          >
            Continue Browsing
          </button>
        </div>
      </div>
    </div>
  );
};
