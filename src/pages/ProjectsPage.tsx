import React from 'react';
import { Projects } from '../components/sections/Projects';
import { FolderGit2, Sparkles, ArrowRight } from 'lucide-react';
import { useStore } from '../store/useStore';

export const ProjectsPage: React.FC = () => {
  const { setIsConsultationOpen } = useStore();

  return (
    <div className="pt-24 space-y-0">
      {/* Page Header Banner */}
      <section className="py-16 relative bg-dark-950 border-b border-white/5 cyber-grid-bg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-4 relative z-10">
          <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-cyber-dim border border-cyber-accent/30 text-cyber-neon text-xs font-mono font-bold tracking-widest uppercase">
            <FolderGit2 className="w-3.5 h-3.5" />
            <span>Engineering Showcase</span>
          </div>
          <h1 className="text-4xl sm:text-5xl font-extrabold text-white tracking-tight font-sans">
            Client & Enterprise Projects
          </h1>
          <p className="text-gray-400 text-sm sm:text-base max-w-2xl mx-auto leading-relaxed">
            Explore web applications, corporate agency portals, automated reporting engines, and WooCommerce storefronts engineered for high conversions and sub-second load times.
          </p>
        </div>
      </section>

      {/* Main Filterable Projects Section */}
      <Projects />

      {/* Project Custom Build Inquiry CTA */}
      <section className="py-20 relative bg-dark-900/60 border-t border-white/5">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-5">
          <h3 className="text-2xl sm:text-3xl font-bold text-white font-sans">
            Have a Specific Website or Data Project in Mind?
          </h3>
          <p className="text-gray-300 text-sm max-w-xl mx-auto leading-relaxed">
            Let's discuss your design requirements, architecture, and timeline. I provide fixed-price quotes and detailed milestones.
          </p>
          <div className="pt-2">
            <button
              onClick={() => setIsConsultationOpen(true)}
              className="inline-flex items-center gap-2 px-6 py-3.5 rounded-xl bg-cyber-accent text-dark-950 font-bold font-mono text-xs tracking-wider hover:bg-cyber-neon transition-all shadow-neon"
            >
              <span>Request Project Proposal</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </section>
    </div>
  );
};
