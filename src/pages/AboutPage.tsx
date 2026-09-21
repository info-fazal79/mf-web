import React from 'react';
import { About } from '../components/sections/About';
import { Experience } from '../components/sections/Experience';
import { Sparkles, Download } from 'lucide-react';
import { useStore } from '../store/useStore';

export const AboutPage: React.FC = () => {
  const { siteSettings } = useStore();

  return (
    <div className="pt-24 space-y-0">
      {/* Page Header Banner */}
      <section className="py-16 relative bg-dark-950 border-b border-white/5 cyber-grid-bg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-4 relative z-10">
          <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-cyber-dim border border-cyber-accent/30 text-cyber-neon text-xs font-mono font-bold tracking-widest uppercase">
            <Sparkles className="w-3.5 h-3.5" />
            <span>PROFILE & BACKGROUND</span>
          </div>
          <h1 className="text-4xl sm:text-5xl font-extrabold text-white tracking-tight font-sans">
            About Muhammad Fazal
          </h1>
          <p className="text-gray-400 text-sm sm:text-base max-w-2xl mx-auto leading-relaxed">
            WordPress Developer, Data Analyst & MS Office Instructor
          </p>
          {siteSettings.cv_url && (
            <div className="pt-2">
              <a
                href={siteSettings.cv_url}
                target="_blank"
                rel="noopener noreferrer"
                download="Muhammad_Fazal_Resume.pdf"
                className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-cyber-accent text-dark-950 font-bold font-mono text-xs tracking-wider hover:bg-cyber-neon transition-all shadow-neon hover:shadow-neon-lg transform hover:-translate-y-0.5 active:translate-y-0"
              >
                <Download className="w-4 h-4" />
                <span>Download CV</span>
              </a>
            </div>
          )}
        </div>
      </section>

      {/* 3 Detailed Narrative Cards */}
      <About />

      {/* Experience Timeline */}
      <Experience />
    </div>
  );
};
