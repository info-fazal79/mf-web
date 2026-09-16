import React from 'react';
import { TIMELINE_EXPERIENCE } from '../../lib/initialData';
import { Briefcase, Calendar, CheckCircle2, Award, Sparkles, MapPin } from 'lucide-react';
import { useStore } from '../../store/useStore';

export const Experience: React.FC = () => {
  const { siteSettings, setIsConsultationOpen } = useStore();

  return (
    <section id="experience" className="py-24 relative bg-dark-900/50 border-t border-white/5">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        {/* Section Heading */}
        <div className="text-center max-w-3xl mx-auto space-y-3 mb-16">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyber-dim border border-cyber-accent/30 text-cyber-neon text-xs font-mono font-bold tracking-widest uppercase">
            Experience
          </div>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight font-sans">
            A Proven Journey of Professional Excellence
          </h2>
          <p className="text-gray-400 text-sm sm:text-base">
            From deep-dive office document architectures to global web development and institute leadership.
          </p>
        </div>

        {/* Split Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-start">
          {/* Left Column: Profile Showcase Card */}
          <div className="lg:col-span-5 space-y-6 lg:sticky lg:top-28">
            <div className="glass-panel p-8 rounded-3xl border border-white/10 shadow-2xl relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-cyber-accent/10 rounded-full blur-2xl pointer-events-none" />

              <div className="space-y-6 relative z-10">
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 rounded-2xl overflow-hidden border border-cyber-accent/40 shadow-neon-sm">
                    <img
                      src="/fazal.jpg"
                      alt="Muhammad Fazal"
                      className="w-full h-full object-cover object-center"
                    />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-white font-sans">Muhammad Fazal</h3>
                    <div className="text-xs text-cyber-neon font-mono mt-0.5">
                      Fiverr Level 1 & Lead Instructor
                    </div>
                    <div className="flex items-center gap-1 text-[11px] text-gray-400 font-mono mt-1">
                      <MapPin className="w-3 h-3 text-gray-500" />
                      <span>Dhaka, Bangladesh • Global Remote</span>
                    </div>
                  </div>
                </div>

                <p className="text-gray-300 text-sm leading-relaxed">
                  "Continuous learning and obsessive attention to user experience define my work. Whether optimizing a client's e-commerce shop or instructing future leaders, my goal is always lasting, measurable impact."
                </p>

                {/* Badges and Highlights */}
                <div className="space-y-3 pt-4 border-t border-white/5">
                  <div className="flex items-center gap-3 text-xs text-gray-300 font-mono">
                    <Award className="w-4 h-4 text-cyber-neon shrink-0" />
                    <span>Fiverr Level 1 Seller Badge (100% 5-Star Feedback)</span>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-gray-300 font-mono">
                    <Briefcase className="w-4 h-4 text-cyber-neon shrink-0" />
                    <span>Instructor at As-Sunnah Skill Development Institute</span>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-gray-300 font-mono">
                    <Sparkles className="w-4 h-4 text-cyber-neon shrink-0" />
                    <span>8+ Years of Practical Technology Execution</span>
                  </div>
                </div>

                <div className="pt-2">
                  <button
                    onClick={() => setIsConsultationOpen(true)}
                    className="w-full py-3 rounded-xl bg-cyber-accent text-dark-950 font-bold font-mono text-xs tracking-wider hover:bg-cyber-neon transition-all shadow-neon"
                  >
                    Discuss a Project with Fazal
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Experience Timeline */}
          <div className="lg:col-span-7 relative pl-4 sm:pl-8 border-l border-white/10 space-y-12 ml-2 sm:ml-4">
            {TIMELINE_EXPERIENCE.map((exp, idx) => (
              <div key={idx} className="relative group">
                {/* Glowing Timeline Marker */}
                <div className="absolute -left-[25px] sm:-left-[41px] top-1.5 w-6 h-6 rounded-full bg-dark-950 border-2 border-cyber-accent flex items-center justify-center group-hover:scale-125 transition-transform shadow-neon-sm">
                  <div className="w-2 h-2 rounded-full bg-cyber-neon" />
                </div>

                {/* Timeline Content Card */}
                <div className="glass-panel p-6 sm:p-7 rounded-2xl border border-white/10 hover:border-cyber-accent/40 transition-all duration-300 space-y-3 group-hover:-translate-y-1">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="inline-flex items-center gap-1.5 text-xs font-mono font-bold text-cyber-neon px-2.5 py-1 rounded-md bg-cyber-dim border border-cyber-accent/20">
                      <Calendar className="w-3.5 h-3.5" />
                      {exp.period}
                    </span>
                    <span className="text-xs font-mono text-gray-400">
                      {exp.organization}
                    </span>
                  </div>

                  <h4 className="text-lg font-bold text-white font-sans group-hover:text-cyber-neon transition-colors">
                    {exp.title}
                  </h4>

                  <p className="text-sm text-gray-300 leading-relaxed">
                    {exp.description}
                  </p>

                  {/* Skills / Tags */}
                  <div className="flex flex-wrap gap-2 pt-2 border-t border-white/5">
                    {exp.tags.map((tag, tIdx) => (
                      <span
                        key={tIdx}
                        className="text-[11px] font-mono px-2 py-0.5 rounded bg-dark-950 border border-white/10 text-gray-300"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};
