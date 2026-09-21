import React, { useState } from 'react';
import { X, Send, Sparkles, CheckCircle, Clock, ShieldCheck } from 'lucide-react';
import { useStore } from '../../store/useStore';
import { supabase, isSupabaseConfigured } from '../../lib/supabase';
import { Consultation } from '../../types';

export const ConsultationDrawer: React.FC = () => {
  const {
    isConsultationOpen,
    setIsConsultationOpen,
    addConsultation,
    addToast,
  } = useStore();

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    service: 'WordPress Development',
    message: '',
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);

  if (!isConsultationOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.email || !formData.message) {
      addToast({
        title: 'Missing Fields',
        message: 'Please complete all required fields.',
        type: 'warning',
      });
      return;
    }

    setIsSubmitting(true);
    const newConsultation: Consultation = {
      id: 'cons-' + Date.now(),
      name: formData.name,
      email: formData.email,
      service: formData.service,
      message: formData.message,
      status: 'new',
      created_at: new Date().toISOString(),
    };

    try {
      if (isSupabaseConfigured()) {
        const { error } = await supabase.from('consultations').insert([
          {
            name: formData.name,
            email: formData.email,
            service: formData.service,
            message: formData.message,
            status: 'new',
          },
        ]);
        if (error) throw error;
      }

      // Always update local store
      addConsultation(newConsultation);

      setIsSubmitted(true);
      addToast({
        title: 'Consultation Requested!',
        message: `Thank you ${formData.name}. Muhammad Fazal will review your project details and reach out from muhammadfazal.com within 24 hours.`,
        type: 'success',
      });

      // Reset form after short delay
      setTimeout(() => {
        setIsSubmitted(false);
        setIsConsultationOpen(false);
        setFormData({
          name: '',
          email: '',
          service: 'WordPress Development',
          message: '',
        });
      }, 2500);
    } catch (err) {
      console.error('Error submitting consultation:', err);
      // Even if network fails, preserve locally
      addConsultation(newConsultation);
      setIsSubmitted(true);
      addToast({
        title: 'Consultation Recorded',
        message: 'Saved to local queue. Fazal will follow up soon!',
        type: 'success',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      {/* Backdrop */}
      <div
        onClick={() => setIsConsultationOpen(false)}
        className="absolute inset-0 bg-dark-950/80 backdrop-blur-md transition-opacity animate-fade-in"
      />

      <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
        <div className="w-screen max-w-md bg-dark-900 border-l border-white/10 shadow-2xl flex flex-col justify-between overflow-y-auto">
          {/* Header */}
          <div className="p-6 border-b border-white/10 bg-dark-950/40">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-cyber-dim border border-cyber-accent/30 flex items-center justify-center text-cyber-neon">
                  <Sparkles className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-white font-mono">Book a Consultation</h2>
                  <p className="text-xs text-cyber-neon font-mono">Transform Your Vision into Reality</p>
                </div>
              </div>
              <button
                onClick={() => setIsConsultationOpen(false)}
                className="p-2 rounded-lg text-gray-400 hover:text-white hover:bg-dark-800 transition-colors"
                aria-label="Close consultation drawer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Form Content */}
          <div className="p-6 flex-1">
            {isSubmitted ? (
              <div className="h-full flex flex-col items-center justify-center text-center space-y-4 py-12">
                <div className="w-16 h-16 rounded-full bg-cyber-dim border border-cyber-accent flex items-center justify-center text-cyber-neon shadow-neon">
                  <CheckCircle className="w-8 h-8" />
                </div>
                <h3 className="text-xl font-bold text-white font-mono">Request Received!</h3>
                <p className="text-sm text-gray-300 max-w-xs leading-relaxed">
                  Fazal has received your details and will review your specifications promptly.
                </p>
                <div className="flex items-center gap-2 text-xs text-cyber-neon font-mono pt-4">
                  <Clock className="w-4 h-4" />
                  <span>Expected response: &lt; 24 business hours</span>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                  <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-1.5 font-mono">
                    Full Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="e.g. John Doe"
                    className="w-full px-4 py-2.5 rounded-xl bg-dark-950 border border-white/10 text-white placeholder-gray-500 focus:outline-none focus:border-cyber-accent focus:ring-1 focus:ring-cyber-accent text-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-1.5 font-mono">
                    Email Address *
                  </label>
                  <input
                    type="email"
                    required
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="john@example.com"
                    className="w-full px-4 py-2.5 rounded-xl bg-dark-950 border border-white/10 text-white placeholder-gray-500 focus:outline-none focus:border-cyber-accent focus:ring-1 focus:ring-cyber-accent text-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-1.5 font-mono">
                    Service / Topic *
                  </label>
                  <select
                    value={formData.service}
                    onChange={(e) => setFormData({ ...formData, service: e.target.value })}
                    className="w-full px-4 py-2.5 rounded-xl bg-dark-950 border border-white/10 text-white focus:outline-none focus:border-cyber-accent focus:ring-1 focus:ring-cyber-accent text-sm"
                  >
                    <option value="WordPress Development">WordPress Custom Website / WooCommerce</option>
                    <option value="Data Analysis & Dashboards">Data Analytics & Interactive Dashboards</option>
                    <option value="Workflow Automation">Google Sheets & Google Apps Script Automation</option>
                    <option value="MS Office Corporate Training">MS Office Corporate Masterclass / Training</option>
                    <option value="Digital Consultation">General Strategic Tech Consultation</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-1.5 font-mono">
                    Project Scope / Message *
                  </label>
                  <textarea
                    rows={4}
                    required
                    value={formData.message}
                    onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                    placeholder="Tell me about your goals, current bottlenecks, or timeline..."
                    className="w-full px-4 py-2.5 rounded-xl bg-dark-950 border border-white/10 text-white placeholder-gray-500 focus:outline-none focus:border-cyber-accent focus:ring-1 focus:ring-cyber-accent text-sm resize-none"
                  />
                </div>

                {/* Trust Badges */}
                <div className="p-3.5 rounded-xl bg-dark-950/60 border border-white/5 space-y-2">
                  <div className="flex items-center gap-2 text-xs text-gray-400">
                    <ShieldCheck className="w-4 h-4 text-cyber-neon shrink-0" />
                    <span>100% Confidentiality & Fast Response</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-gray-400">
                    <Clock className="w-4 h-4 text-cyber-neon shrink-0" />
                    <span>Free 30-minute initial discovery assessment</span>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-cyber-accent text-dark-950 font-bold font-mono tracking-wider hover:bg-cyber-neon transition-all shadow-neon hover:shadow-neon-lg disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <span>Submitting Request...</span>
                  ) : (
                    <>
                      <Send className="w-4 h-4" />
                      <span>Send Consultation Request</span>
                    </>
                  )}
                </button>
              </form>
            )}
          </div>

          {/* Footer Note */}
          <div className="p-6 border-t border-white/10 bg-dark-950/30 text-center text-xs text-gray-500 font-mono">
            Direct Inquiries: {useStore.getState().siteSettings.contact_email}
          </div>
        </div>
      </div>
    </div>
  );
};
