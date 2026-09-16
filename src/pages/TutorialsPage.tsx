import React from 'react';
import { Tutorials } from '../components/sections/Tutorials';
import { YoutubeIcon } from '../components/ui/Icons';
import { ExternalLink, Sparkles } from 'lucide-react';
import { useStore } from '../store/useStore';

export const TutorialsPage: React.FC = () => {
  const { siteSettings } = useStore();

  return (
    <div className="pt-24 space-y-0">
      {/* Page Header Banner */}
      <section className="py-16 relative bg-dark-950 border-b border-white/5 cyber-grid-bg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-4 relative z-10">
          <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-cyber-dim border border-cyber-accent/30 text-cyber-neon text-xs font-mono font-bold tracking-widest uppercase">
            <YoutubeIcon className="w-3.5 h-3.5 text-red-500" />
            <span>Video Learning Hub</span>
          </div>
          <h1 className="text-4xl sm:text-5xl font-extrabold text-white tracking-tight font-sans">
            YouTube Masterclasses & Workshops
          </h1>
          <p className="text-gray-400 text-sm sm:text-base max-w-2xl mx-auto leading-relaxed">
            Free, expert-led training sessions designed to fast-track your office productivity, Excel nested formulas, Google Apps Script automation, and WordPress speed optimization.
          </p>

          {siteSettings.social_links?.youtube && (
            <div className="pt-2">
              <a
                href={siteSettings.social_links.youtube}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-dark-900 border border-white/10 hover:border-red-500/50 text-white text-xs font-mono transition-all"
              >
                <YoutubeIcon className="w-4 h-4 text-red-500" />
                <span>Subscribe on YouTube</span>
                <ExternalLink className="w-3 h-3 text-gray-400" />
              </a>
            </div>
          )}
        </div>
      </section>

      {/* Main Filterable Tutorials Section */}
      <Tutorials />
    </div>
  );
};
