import React from 'react';
import { Tutorials } from '../components/sections/Tutorials';
import { YoutubeIcon } from '../components/ui/Icons';

export const TutorialsPage: React.FC = () => {
  return (
    <div className="pt-24 space-y-0">
      {/* Page Header Banner */}
      <section className="py-16 relative bg-dark-950 border-b border-white/5 cyber-grid-bg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-4 relative z-10">
          <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-cyber-dim border border-cyber-accent/30 text-cyber-neon text-xs font-mono font-bold tracking-widest uppercase">
            <YoutubeIcon className="w-3.5 h-3.5 text-red-500" />
            <span>VIDEO LEARNING HUB</span>
          </div>
          <h1 className="text-4xl sm:text-5xl font-extrabold text-white tracking-tight font-sans">
            YouTube Masterclasses & Workshops
          </h1>
          <p className="text-gray-400 text-sm sm:text-base max-w-2xl mx-auto leading-relaxed">
            Free, expert-led training sessions designed to fast-track your office productivity and web skills.
          </p>
        </div>
      </section>

      {/* Main Filterable Tutorials Section */}
      <Tutorials />
    </div>
  );
};
