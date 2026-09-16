import React from 'react';
import { About } from '../components/sections/About';
import { Experience } from '../components/sections/Experience';
import { Skills } from '../components/sections/Skills';
import { Testimonials } from '../components/sections/Testimonials';
import { Sparkles, Download, ArrowRight } from 'lucide-react';
import { useStore } from '../store/useStore';
import { Link } from 'react-router-dom';

export const AboutPage: React.FC = () => {
  const { siteSettings, setIsConsultationOpen } = useStore();

  return (
    <div className="pt-24 space-y-0">
      {/* Page Header Banner */}
      <section className="py-16 relative bg-dark-950 border-b border-white/5 cyber-grid-bg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-4 relative z-10">
          <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-cyber-dim border border-cyber-accent/30 text-cyber-neon text-xs font-mono font-bold tracking-widest uppercase">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Profile & Professional Background</span>
          </div>
          <h1 className="text-4xl sm:text-5xl font-extrabold text-white tracking-tight font-sans">
            Muhammad Fazal
          </h1>
          <p className="text-gray-400 text-sm sm:text-base max-w-2xl mx-auto leading-relaxed">
            Fiverr Level 1 WordPress Developer, Data Analyst, and Lead Instructor of MS Office at As-Sunnah Skill Development Institute.
          </p>

          <div className="flex flex-wrap items-center justify-center gap-4 pt-4">
            <a
              href={siteSettings.cv_url || '#'}
              target="_blank"
              rel="noopener noreferrer"
              download="Muhammad_Fazal_Resume.pdf"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-cyber-accent text-dark-950 font-mono text-xs font-bold hover:bg-cyber-neon transition-all shadow-neon"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download Full CV</span>
            </a>
            <button
              onClick={() => setIsConsultationOpen(true)}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-dark-900 border border-white/10 hover:border-cyber-accent text-white font-mono text-xs transition-all"
            >
              <span>Book Consultation</span>
              <ArrowRight className="w-3.5 h-3.5 text-cyber-neon" />
            </button>
          </div>
        </div>
      </section>

      {/* 3 Detailed Narrative Cards */}
      <About />

      {/* Experience Timeline */}
      <Experience />

      {/* Skills & Tools Grid */}
      <Skills />

      {/* Client Testimonials */}
      <Testimonials />
    </div>
  );
};
