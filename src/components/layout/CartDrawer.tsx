import React, { useState } from 'react';
import { X, Trash2, Plus, Minus, ShieldCheck, ShoppingBag, ArrowRight, Download, CreditCard, Smartphone } from 'lucide-react';
import { useStore } from '../../store/useStore';
import { formatPrice } from '../../lib/utils';
import { supabase, isSupabaseConfigured } from '../../lib/supabase';
import confetti from 'canvas-confetti';
import { Order } from '../../types';

export const CartDrawer: React.FC = () => {
  const {
    isCartOpen,
    setIsCartOpen,
    cart,
    removeFromCart,
    updateCartQuantity,
    clearCart,
    addToast,
    addOrder,
    setCheckoutSuccessOrder,
  } = useStore();

  const [checkoutStep, setCheckoutStep] = useState<'cart' | 'checkout'>('cart');
  const [customerName, setCustomerName] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'bkash' | 'nagad' | 'stripe_test'>('bkash');
  const [trxId, setTrxId] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  if (!isCartOpen) return null;

  const subtotal = cart.reduce(
    (acc, item) => acc + (item.book.price || 0) * item.quantity,
    0
  );
  const isFreeOrder = subtotal === 0;

  const handleCheckoutSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerName || !customerEmail) {
      addToast({
        title: 'Missing Details',
        message: 'Please provide your name and email to receive book downloads.',
        type: 'warning',
      });
      return;
    }

    if (!isFreeOrder && paymentMethod !== 'stripe_test' && !trxId) {
      addToast({
        title: 'Transaction ID Required',
        message: `Please enter your ${paymentMethod.toUpperCase()} Transaction ID.`,
        type: 'warning',
      });
      return;
    }

    setIsProcessing(true);

    try {
      // Pick first book as primary, or process cart items
      const primaryBook = cart[0]?.book;
      const orderId = 'ord-' + Date.now();
      const newOrder: Order = {
        id: orderId,
        customer_name: customerName,
        customer_email: customerEmail,
        book_id: primaryBook?.id || 'book-1',
        book: primaryBook,
        amount: subtotal,
        payment_method: isFreeOrder ? 'free_download' : paymentMethod,
        trx_id: isFreeOrder ? 'FREE_ACCESS' : trxId || 'STRIPE_TEST_' + Date.now(),
        status: isFreeOrder || paymentMethod === 'stripe_test' ? 'completed' : 'pending',
        created_at: new Date().toISOString(),
      };

      if (isSupabaseConfigured()) {
        const { error } = await supabase.from('orders').insert([
          {
            customer_name: newOrder.customer_name,
            customer_email: newOrder.customer_email,
            book_id: newOrder.book_id,
            amount: newOrder.amount,
            payment_method: newOrder.payment_method,
            trx_id: newOrder.trx_id,
            status: newOrder.status,
          },
        ]);
        if (error) console.error('Supabase order insert error:', error);
      }

      addOrder(newOrder);
      setCheckoutSuccessOrder(newOrder);

      // Trigger Confetti Celebration!
      confetti({
        particleCount: 80,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#00FF87', '#00E599', '#ffffff', '#10B981'],
      });

      addToast({
        title: isFreeOrder ? 'Instant Download Ready!' : 'Order Placed Successfully!',
        message: `Thank you ${customerName}. You can now download your digital eBooks.`,
        type: 'success',
      });

      clearCart();
      setIsCartOpen(false);
      setCheckoutStep('cart');
      setCustomerName('');
      setCustomerEmail('');
      setTrxId('');
    } catch (err) {
      console.error('Checkout failed:', err);
      addToast({
        title: 'Checkout Issue',
        message: 'Could not complete order, please try again.',
        type: 'error',
      });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      {/* Backdrop */}
      <div
        onClick={() => setIsCartOpen(false)}
        className="absolute inset-0 bg-dark-950/80 backdrop-blur-md transition-opacity"
      />

      <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
        <div className="w-screen max-w-md bg-dark-900 border-l border-white/10 shadow-2xl flex flex-col justify-between">
          {/* Header */}
          <div className="p-6 border-b border-white/10 bg-dark-950/50 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShoppingBag className="w-5 h-5 text-cyber-neon" />
              <h2 className="text-lg font-bold text-white font-mono">
                {checkoutStep === 'cart' ? 'Digital Store Cart' : 'Secure Checkout'}
              </h2>
            </div>
            <button
              onClick={() => setIsCartOpen(false)}
              className="p-2 rounded-lg text-gray-400 hover:text-white hover:bg-dark-800 transition-colors"
              aria-label="Close cart drawer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Body */}
          <div className="p-6 flex-1 overflow-y-auto">
            {cart.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center space-y-4 py-16">
                <div className="w-16 h-16 rounded-full bg-dark-800 border border-white/10 flex items-center justify-center text-gray-500">
                  <ShoppingBag className="w-8 h-8" />
                </div>
                <h3 className="text-lg font-bold text-white font-mono">Your Cart is Empty</h3>
                <p className="text-sm text-gray-400 max-w-xs">
                  Explore Muhammad Fazal’s digital eBooks on MS Office, WordPress, and Data Analytics.
                </p>
                <button
                  onClick={() => setIsCartOpen(false)}
                  className="px-5 py-2.5 rounded-xl bg-cyber-accent text-dark-950 font-bold text-sm hover:bg-cyber-neon transition-all"
                >
                  Browse eBooks
                </button>
              </div>
            ) : checkoutStep === 'cart' ? (
              // STEP 1: CART ITEMS
              <div className="space-y-4">
                <div className="divide-y divide-white/5">
                  {cart.map((item) => (
                    <div key={item.book.id} className="py-4 flex gap-4 items-center">
                      <img
                        src={item.book.cover_url}
                        alt={item.book.title}
                        className="w-16 h-20 object-cover rounded-lg border border-white/10 shrink-0"
                      />
                      <div className="flex-1 min-w-0">
                        <h4 className="text-sm font-semibold text-white truncate font-mono">
                          {item.book.title}
                        </h4>
                        <div className="text-xs text-cyber-neon font-mono mt-1">
                          {formatPrice(item.book.price)}
                        </div>

                        {/* Quantity Controls */}
                        <div className="flex items-center gap-2 mt-2">
                          <button
                            onClick={() =>
                              updateCartQuantity(item.book.id, item.quantity - 1)
                            }
                            className="p-1 rounded bg-dark-800 text-gray-400 hover:text-white"
                          >
                            <Minus className="w-3 h-3" />
                          </button>
                          <span className="text-xs font-mono text-gray-200 px-1">
                            {item.quantity}
                          </span>
                          <button
                            onClick={() =>
                              updateCartQuantity(item.book.id, item.quantity + 1)
                            }
                            className="p-1 rounded bg-dark-800 text-gray-400 hover:text-white"
                          >
                            <Plus className="w-3 h-3" />
                          </button>
                        </div>
                      </div>

                      <button
                        onClick={() => removeFromCart(item.book.id)}
                        className="p-2 text-gray-500 hover:text-red-400 transition-colors"
                        aria-label="Remove item"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              // STEP 2: CHECKOUT FORM
              <form id="checkout-form" onSubmit={handleCheckoutSubmit} className="space-y-5">
                <div>
                  <label className="block text-xs font-mono text-gray-300 uppercase mb-1">
                    Your Full Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    placeholder="Muhammad Ali"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-dark-950 border border-white/10 text-white placeholder-gray-500 text-sm focus:border-cyber-accent focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-mono text-gray-300 uppercase mb-1">
                    Email for eBook Delivery *
                  </label>
                  <input
                    type="email"
                    required
                    value={customerEmail}
                    onChange={(e) => setCustomerEmail(e.target.value)}
                    placeholder="you@company.com"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-dark-950 border border-white/10 text-white placeholder-gray-500 text-sm focus:border-cyber-accent focus:outline-none"
                  />
                </div>

                {!isFreeOrder && (
                  <div>
                    <label className="block text-xs font-mono text-gray-300 uppercase mb-2">
                      Payment Method *
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                      <button
                        type="button"
                        onClick={() => setPaymentMethod('bkash')}
                        className={`p-3 rounded-xl border text-left flex flex-col gap-1 transition-all ${
                          paymentMethod === 'bkash'
                            ? 'border-cyber-accent bg-cyber-dim text-white'
                            : 'border-white/10 bg-dark-950 text-gray-400'
                        }`}
                      >
                        <Smartphone className="w-4 h-4 text-pink-500" />
                        <span className="text-xs font-bold font-mono">bKash</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setPaymentMethod('nagad')}
                        className={`p-3 rounded-xl border text-left flex flex-col gap-1 transition-all ${
                          paymentMethod === 'nagad'
                            ? 'border-cyber-accent bg-cyber-dim text-white'
                            : 'border-white/10 bg-dark-950 text-gray-400'
                        }`}
                      >
                        <Smartphone className="w-4 h-4 text-orange-500" />
                        <span className="text-xs font-bold font-mono">Nagad</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setPaymentMethod('stripe_test')}
                        className={`p-3 rounded-xl border text-left flex flex-col gap-1 transition-all ${
                          paymentMethod === 'stripe_test'
                            ? 'border-cyber-accent bg-cyber-dim text-white'
                            : 'border-white/10 bg-dark-950 text-gray-400'
                        }`}
                      >
                        <CreditCard className="w-4 h-4 text-cyan-400" />
                        <span className="text-xs font-bold font-mono">Stripe Test</span>
                      </button>
                    </div>

                    {/* Payment Instruction */}
                    {paymentMethod !== 'stripe_test' ? (
                      <div className="mt-3 p-3 rounded-xl bg-dark-950 border border-white/10 space-y-2 text-xs">
                        <div className="flex justify-between text-gray-400">
                          <span>Send Money to:</span>
                          <span className="font-mono text-cyber-neon font-bold">01700-000000 (Personal)</span>
                        </div>
                        <div>
                          <label className="block text-[11px] font-mono text-gray-300 uppercase mb-1">
                            Transaction ID (TrxID) *
                          </label>
                          <input
                            type="text"
                            required
                            value={trxId}
                            onChange={(e) => setTrxId(e.target.value)}
                            placeholder="e.g. 9H4J8K2L1M"
                            className="w-full px-3 py-2 rounded-lg bg-dark-900 border border-white/10 text-white placeholder-gray-500 text-xs font-mono uppercase focus:border-cyber-accent focus:outline-none"
                          />
                        </div>
                      </div>
                    ) : (
                      <div className="mt-3 p-3 rounded-xl bg-dark-950 border border-cyan-500/20 text-xs text-gray-300">
                        <span className="text-cyan-400 font-mono font-bold">Stripe Test Mode active:</span> Click Complete Checkout to simulate instant charge & instant PDF authorization.
                      </div>
                    )}
                  </div>
                )}
              </form>
            )}
          </div>

          {/* Footer Subtotal & Action */}
          {cart.length > 0 && (
            <div className="p-6 border-t border-white/10 bg-dark-950/80 space-y-4">
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-400 font-mono">Subtotal</span>
                <span className="text-xl font-bold font-mono text-white">
                  {formatPrice(subtotal)}
                </span>
              </div>

              {checkoutStep === 'cart' ? (
                <button
                  onClick={() => setCheckoutStep('checkout')}
                  className="w-full py-3.5 rounded-xl bg-cyber-accent text-dark-950 font-bold font-mono tracking-wider flex items-center justify-center gap-2 hover:bg-cyber-neon transition-all shadow-neon hover:shadow-neon-lg"
                >
                  <span>{isFreeOrder ? 'Proceed to Instant Download' : 'Proceed to Checkout'}</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              ) : (
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setCheckoutStep('cart')}
                    className="px-4 py-3.5 rounded-xl bg-dark-800 text-gray-300 hover:text-white font-mono text-xs border border-white/10"
                  >
                    Back
                  </button>
                  <button
                    type="submit"
                    form="checkout-form"
                    disabled={isProcessing}
                    className="flex-1 py-3.5 rounded-xl bg-cyber-accent text-dark-950 font-bold font-mono tracking-wider flex items-center justify-center gap-2 hover:bg-cyber-neon transition-all shadow-neon disabled:opacity-50"
                  >
                    {isProcessing ? (
                      <span>Processing...</span>
                    ) : (
                      <>
                        <Download className="w-4 h-4" />
                        <span>{isFreeOrder ? 'Download Free eBook' : 'Complete Checkout'}</span>
                      </>
                    )}
                  </button>
                </div>
              )}

              <div className="flex items-center justify-center gap-2 text-[11px] text-gray-500 font-mono pt-1">
                <ShieldCheck className="w-3.5 h-3.5 text-cyber-neon" />
                <span>Instant High-Speed PDF Access & Lifetime Updates</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
