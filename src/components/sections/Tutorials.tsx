import React, { useState } from 'react';
import { useStore } from '../../store/useStore';
import { Play, Eye, Clock, Sparkles } from 'lucide-react';
import { YoutubeIcon } from '../ui/Icons';

export const Tutorials: React.FC = () => {
  const { tutorials, setActiveVideoId } = useStore();
  const [activeCategory, setActiveCategory] = useState<string>('All');

  const categories = ['All', 'MS Office', 'WordPress', 'Automation', 'Data Analysis'];

  const filteredTutorials = activeCategory === 'All'
    ? tutorials
    : tutorials.filter((t) => t.category === activeCategory);

  return (
    <section id="tutorials" className="py-24 relative bg-dark-900/50 border-t border-white/5">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        {/* Section Heading */}
        <div className="text-center max-w-3xl mx-auto space-y-3 mb-12">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyber-dim border border-cyber-accent/30 text-cyber-neon text-xs font-mono font-bold tracking-widest uppercase">
            Free Video Education
          </div>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight font-sans">
            YouTube Masterclasses & Tutorials
          </h2>
          <p className="text-gray-400 text-sm sm:text-base">
            Watch free, high-impact tutorials designed to fast-track your office productivity, coding, and analytics proficiency.
          </p>
        </div>

        {/* Category Filter */}
        <div className="flex flex-wrap items-center justify-center gap-2 mb-14">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`px-4 py-2 rounded-xl text-xs font-mono transition-all ${
                activeCategory === cat
                  ? 'bg-cyber-accent text-dark-950 font-bold shadow-neon-sm'
                  : 'bg-dark-900 text-gray-400 border border-white/10 hover:border-cyber-accent/40 hover:text-white'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Video Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {filteredTutorials.map((tutorial) => (
            <div
              key={tutorial.id}
              onClick={() => setActiveVideoId(tutorial.video_id)}
              className="group glass-panel rounded-2xl border border-white/10 hover:border-cyber-accent/40 transition-all duration-300 overflow-hidden cursor-pointer flex flex-col justify-between hover:-translate-y-1 shadow-xl"
            >
              {/* Thumbnail Container with YouTube Play Badge */}
              <div className="relative aspect-video bg-dark-950 overflow-hidden">
                <img
                  src={`https://img.youtube.com/vi/${tutorial.video_id}/hqdefault.jpg`}
                  alt={tutorial.title}
                  className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                  loading="lazy"
                />

                {/* Overlay Darkener */}
                <div className="absolute inset-0 bg-dark-950/40 group-hover:bg-dark-950/20 transition-colors" />

                {/* Play Icon Badge */}
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-12 h-12 rounded-full bg-cyber-accent text-dark-950 flex items-center justify-center shadow-neon group-hover:scale-110 transition-transform">
                    <Play className="w-5 h-5 fill-dark-950 ml-0.5" />
                  </div>
                </div>

                {/* Duration Badge */}
                {tutorial.duration && (
                  <div className="absolute bottom-2.5 right-2.5 px-2 py-0.5 rounded bg-dark-950/80 backdrop-blur-md text-[10px] font-mono text-gray-200 flex items-center gap-1">
                    <Clock className="w-3 h-3 text-cyber-neon" />
                    <span>{tutorial.duration}</span>
                  </div>
                )}
              </div>

              {/* Video Info */}
              <div className="p-5 flex-1 flex flex-col justify-between space-y-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-cyber-dim border border-cyber-accent/30 text-cyber-neon">
                      {tutorial.category}
                    </span>
                    {tutorial.views_count && (
                      <span className="text-[11px] font-mono text-gray-500 flex items-center gap-1">
                        <Eye className="w-3 h-3" />
                        {(tutorial.views_count / 1000).toFixed(1)}k views
                      </span>
                    )}
                  </div>
                  <h3 className="text-sm font-bold text-white font-sans group-hover:text-cyber-neon transition-colors line-clamp-2">
                    {tutorial.title}
                  </h3>
                </div>

                <div className="pt-2 border-t border-white/5 flex items-center justify-between text-xs font-mono text-cyber-neon">
                  <span>Watch Masterclass</span>
                  <YoutubeIcon className="w-4 h-4 text-red-500" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};
