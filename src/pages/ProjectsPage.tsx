import React from 'react';
import { Projects } from '../components/sections/Projects';
import { ArrowRight } from 'lucide-react';
import { useStore } from '../store/useStore';

export const ProjectsPage: React.FC = () => {
  const { setIsConsultationOpen } = useStore();

  return (
    <div className="pt-24 space-y-0">
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
