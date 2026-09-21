import React, { useState } from 'react';
import { useStore } from '../store/useStore';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { Consultation } from '../types';
import { 
  Mail, 
  MapPin, 
  Clock, 
  ShieldCheck, 
  Send, 
  Sparkles, 
  CheckCircle,
  Phone,
  MessageSquare
} from 'lucide-react';
import { GithubIcon, LinkedinIcon, YoutubeIcon, FacebookIcon } from '../components/ui/Icons';

export const ContactPage: React.FC = () => {
  const { siteSettings, addConsultation, addToast } = useStore();

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    service: 'WordPress Development',
    message: '',
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.email || !formData.message) {
      addToast({
        title: 'Required Information Missing',
        message: 'Please complete your name, email, and message.',
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

      addConsultation(newConsultation);
      setIsSubmitted(true);
      addToast({
        title: 'Message Dispatched!',
        message: `Thank you ${formData.name}. Muhammad Fazal will reply within 24 hours.`,
        type: 'success',
      });

      setFormData({
        name: '',
        email: '',
        service: 'WordPress Development',
        message: '',
      });
    } catch (err) {
      console.error('Contact submit error:', err);
      addConsultation(newConsultation);
      setIsSubmitted(true);
      addToast({
        title: 'Inquiry Recorded',
        message: 'Your message has been captured. Fazal will reach out promptly.',
        type: 'success',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="pt-24 space-y-0">
      {/* Page Header Banner */}
      <section className="py-16 relative bg-dark-950 border-b border-white/5 cyber-grid-bg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-4 relative z-10">
          <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-cyber-dim border border-cyber-accent/30 text-cyber-neon text-xs font-mono font-bold tracking-widest uppercase">
            <MessageSquare className="w-3.5 h-3.5" />
            <span>Let's Connect</span>
          </div>
          <h1 className="text-4xl sm:text-5xl font-extrabold text-white tracking-tight font-sans">
            Get In Touch & Book Consultation
          </h1>
          <p className="text-gray-400 text-sm sm:text-base max-w-2xl mx-auto leading-relaxed">
            Have a project, corporate training inquiry, or custom automation requirement? Send me a message below or reach out directly.
          </p>
        </div>
      </section>

      {/* Main Contact Content */}
      <section className="py-20 relative bg-dark-950">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-start">
            {/* Left Column: Direct Info & Social Profiles */}
            <div className="lg:col-span-5 space-y-6">
              <div className="glass-panel p-8 rounded-3xl border border-white/10 space-y-6 shadow-2xl">
                <div>
                  <h3 className="text-2xl font-bold text-white font-sans">
                    Contact Details
                  </h3>
                  <p className="text-xs text-gray-400 mt-1 font-mono">
                    Direct communication channels
                  </p>
                </div>

                <div className="space-y-4 text-sm">
                  <div className="flex items-start gap-4 p-4 rounded-2xl bg-dark-950 border border-white/5">
                    <div className="w-10 h-10 rounded-xl bg-cyber-dim border border-cyber-accent/30 flex items-center justify-center text-cyber-neon shrink-0">
                      <Mail className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="text-xs text-gray-400 font-mono">Direct Email</div>
                      <a
                        href={`mailto:${siteSettings.contact_email || 'contact@muhammadfazal.com'}`}
                        className="font-bold text-white hover:text-cyber-neon transition-colors font-mono"
                      >
                        {siteSettings.contact_email || 'contact@muhammadfazal.com'}
                      </a>
                    </div>
                  </div>

                  <div className="flex items-start gap-4 p-4 rounded-2xl bg-dark-950 border border-white/5">
                    <div className="w-10 h-10 rounded-xl bg-cyber-dim border border-cyber-accent/30 flex items-center justify-center text-cyber-neon shrink-0">
                      <MapPin className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="text-xs text-gray-400 font-mono">Location & Base</div>
                      <div className="font-bold text-white font-mono">
                        Dhaka, Bangladesh
                      </div>
                      <div className="text-xs text-cyber-neon font-mono mt-0.5">
                        Working Worldwide (Remote)
                      </div>
                    </div>
                  </div>

                  <div className="flex items-start gap-4 p-4 rounded-2xl bg-dark-950 border border-white/5">
                    <div className="w-10 h-10 rounded-xl bg-cyber-dim border border-cyber-accent/30 flex items-center justify-center text-cyber-neon shrink-0">
                      <Clock className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="text-xs text-gray-400 font-mono">Response Turnaround</div>
                      <div className="font-bold text-white font-mono">
                        Within 24 Business Hours
                      </div>
                      <div className="text-xs text-gray-400 font-mono mt-0.5">
                        Free 30-min discovery call included
                      </div>
                    </div>
                  </div>
                </div>

                {/* Social Channels */}
                <div className="pt-4 border-t border-white/5 space-y-3">
                  <h4 className="text-xs font-mono uppercase tracking-wider text-gray-400">
                    Connect on Social Profiles
                  </h4>
                  <div className="flex items-center gap-3">
                    {siteSettings.social_links?.github && (
                      <a
                        href={siteSettings.social_links.github}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="w-10 h-10 rounded-xl bg-dark-950 border border-white/10 flex items-center justify-center text-gray-400 hover:text-cyber-neon hover:border-cyber-accent/40 transition-all hover:scale-105"
                        aria-label="GitHub Profile"
                      >
                        <GithubIcon className="w-4 h-4" />
                      </a>
                    )}
                    {siteSettings.social_links?.linkedin && (
                      <a
                        href={siteSettings.social_links.linkedin}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="w-10 h-10 rounded-xl bg-dark-950 border border-white/10 flex items-center justify-center text-gray-400 hover:text-cyber-neon hover:border-cyber-accent/40 transition-all hover:scale-105"
                        aria-label="LinkedIn Profile"
                      >
                        <LinkedinIcon className="w-4 h-4" />
                      </a>
                    )}
                    {siteSettings.social_links?.youtube && (
                      <a
                        href={siteSettings.social_links.youtube}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="w-10 h-10 rounded-xl bg-dark-950 border border-white/10 flex items-center justify-center text-gray-400 hover:text-cyber-neon hover:border-cyber-accent/40 transition-all hover:scale-105"
                        aria-label="YouTube Channel"
                      >
                        <YoutubeIcon className="w-4 h-4" />
                      </a>
                    )}
                    {siteSettings.social_links?.facebook && (
                      <a
                        href={siteSettings.social_links.facebook}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="w-10 h-10 rounded-xl bg-dark-950 border border-white/10 flex items-center justify-center text-gray-400 hover:text-cyber-neon hover:border-cyber-accent/40 transition-all hover:scale-105"
                        aria-label="Facebook Profile"
                      >
                        <FacebookIcon className="w-4 h-4" />
                      </a>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Right Column: Lead Submission Form */}
            <div className="lg:col-span-7">
              <div className="glass-panel p-8 sm:p-10 rounded-3xl border border-white/10 shadow-2xl space-y-6">
                <div className="space-y-2">
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyber-dim border border-cyber-accent/30 text-cyber-neon text-xs font-mono font-bold">
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Project Brief & Inquiry</span>
                  </div>
                  <h3 className="text-2xl sm:text-3xl font-bold text-white font-sans">
                    Send a Message
                  </h3>
                  <p className="text-gray-400 text-xs sm:text-sm">
                    Fill out the scope below, and I will evaluate your requirements with an action plan.
                  </p>
                </div>

                {isSubmitted ? (
                  <div className="py-12 text-center space-y-4 bg-dark-950/70 p-8 rounded-2xl border border-cyber-accent/30">
                    <div className="w-16 h-16 rounded-full bg-cyber-dim border border-cyber-accent flex items-center justify-center text-cyber-neon shadow-neon mx-auto">
                      <CheckCircle className="w-8 h-8" />
                    </div>
                    <h4 className="text-xl font-bold text-white font-mono">
                      Inquiry Received Successfully!
                    </h4>
                    <p className="text-sm text-gray-300 max-w-md mx-auto leading-relaxed">
                      Thank you. Muhammad Fazal has received your details and will get back to you within 24 hours.
                    </p>
                    <button
                      onClick={() => setIsSubmitted(false)}
                      className="px-5 py-2.5 rounded-xl bg-dark-900 border border-white/10 text-cyber-neon text-xs font-mono hover:bg-cyber-accent hover:text-dark-950 transition-all"
                    >
                      Send Another Message
                    </button>
                  </div>
                ) : (
                  <form onSubmit={handleSubmit} className="space-y-5">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-mono text-gray-300 uppercase mb-1.5">
                          Full Name *
                        </label>
                        <input
                          type="text"
                          required
                          value={formData.name}
                          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                          placeholder="e.g. David Miller"
                          className="w-full px-4 py-3 rounded-xl bg-dark-950 border border-white/10 text-white placeholder-gray-500 text-sm focus:border-cyber-accent focus:outline-none"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-mono text-gray-300 uppercase mb-1.5">
                          Email Address *
                        </label>
                        <input
                          type="email"
                          required
                          value={formData.email}
                          onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                          placeholder="david@company.com"
                          className="w-full px-4 py-3 rounded-xl bg-dark-950 border border-white/10 text-white placeholder-gray-500 text-sm focus:border-cyber-accent focus:outline-none"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-mono text-gray-300 uppercase mb-1.5">
                        Service or Subject *
                      </label>
                      <select
                        value={formData.service}
                        onChange={(e) => setFormData({ ...formData, service: e.target.value })}
                        className="w-full px-4 py-3 rounded-xl bg-dark-950 border border-white/10 text-white text-sm focus:border-cyber-accent focus:outline-none"
                      >
                        <option value="WordPress Development">WordPress Custom Website / WooCommerce Architecture</option>
                        <option value="Data Analysis & Dashboards">Data Analysis & Interactive Business Dashboards</option>
                        <option value="Workflow Automation">Google Sheets & Google Apps Script Automation</option>
                        <option value="MS Office Corporate Training">MS Office Corporate Training / Masterclass</option>
                        <option value="Digital Consultation">General Technology & Architecture Consultation</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-mono text-gray-300 uppercase mb-1.5">
                        Project Details & Message *
                      </label>
                      <textarea
                        rows={5}
                        required
                        value={formData.message}
                        onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                        placeholder="Please share details regarding your goals, budget, current challenges, or target launch date..."
                        className="w-full p-4 rounded-xl bg-dark-950 border border-white/10 text-white placeholder-gray-500 text-sm focus:border-cyber-accent focus:outline-none resize-none"
                      />
                    </div>

                    {/* Trust Badges */}
                    <div className="p-4 rounded-xl bg-dark-950/60 border border-white/5 flex flex-wrap items-center justify-between gap-3 text-xs text-gray-400">
                      <span className="flex items-center gap-1.5">
                        <ShieldCheck className="w-4 h-4 text-cyber-neon" />
                        <span>100% Privacy Guaranteed</span>
                      </span>
                      <span className="flex items-center gap-1.5">
                        <Clock className="w-4 h-4 text-cyber-neon" />
                        <span>Prompt 24-Hour Response</span>
                      </span>
                    </div>

                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl bg-cyber-accent text-dark-950 font-bold font-mono text-sm tracking-wider hover:bg-cyber-neon transition-all shadow-neon hover:shadow-neon-lg disabled:opacity-50"
                    >
                      {isSubmitting ? (
                        <span>Sending Message...</span>
                      ) : (
                        <>
                          <Send className="w-4 h-4" />
                          <span>Submit Consultation Inquiry</span>
                        </>
                      )}
                    </button>
                  </form>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};
