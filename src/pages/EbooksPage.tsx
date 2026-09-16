import React from 'react';
import { EbookStore } from '../components/sections/EbookStore';
import { BookOpen, ShieldCheck, Zap, DownloadCloud, Sparkles } from 'lucide-react';

export const EbooksPage: React.FC = () => {
  return (
    <div className="pt-24 space-y-0">
      {/* Page Header Banner */}
      <section className="py-16 relative bg-dark-950 border-b border-white/5 cyber-grid-bg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-4 relative z-10">
          <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-cyber-dim border border-cyber-accent/30 text-cyber-neon text-xs font-mono font-bold tracking-widest uppercase">
            <BookOpen className="w-3.5 h-3.5" />
            <span>Official Digital Store</span>
          </div>
          <h1 className="text-4xl sm:text-5xl font-extrabold text-white tracking-tight font-sans">
            e-Books & Practical Guides
          </h1>
          <p className="text-gray-400 text-sm sm:text-base max-w-2xl mx-auto leading-relaxed">
            Written and curated by Muhammad Fazal. Master workplace productivity in Excel, high-speed WordPress architecture, and cloud automation with step-by-step blueprints.
          </p>

          {/* Guarantees Ribbon */}
          <div className="pt-6 flex flex-wrap items-center justify-center gap-6 text-xs font-mono text-gray-400">
            <span className="flex items-center gap-2">
              <DownloadCloud className="w-4 h-4 text-cyber-neon" />
              <span>Instant PDF Downloads</span>
            </span>
            <span className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-cyber-neon" />
              <span>Lifetime Updates Included</span>
            </span>
            <span className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-cyber-neon" />
              <span>Verified Secure Payments (bKash, Nagad, Stripe)</span>
            </span>
          </div>
        </div>
      </section>

      {/* Main eBook Store Grid */}
      <EbookStore />
    </div>
  );
};
