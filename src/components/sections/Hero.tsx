import React from 'react';
import { Link } from 'react-router-dom';
import { Download, Sparkles, Terminal, Code2, ArrowRight, ShieldCheck } from 'lucide-react';
import { useStore } from '../../store/useStore';
import { useTypingEffect } from '../../hooks/useTypingEffect';

export const Hero: React.FC = () => {
  const { siteSettings, setIsConsultationOpen } = useStore();

  const roles = [
    'Data Analyst',
    'WordPress Developer',
    'MS Office Instructor',
  ];

  const currentRole = useTypingEffect(roles, 85, 45, 1800);

  return (
    <section
      id="home"
      className="relative min-h-screen pt-32 pb-20 flex items-center justify-center overflow-hidden cyber-grid-bg"
    >
      {/* Background Ambient Glows */}
      <div className="absolute top-1/4 left-1/4 -translate-x-1/2 w-96 h-96 bg-cyber-accent/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-emerald-500/10 rounded-full blur-[140px] pointer-events-none" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 w-full">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-8 items-center">
          {/* Left Column: Heading, Typist, Bio, CTAs */}
          <div className="lg:col-span-7 space-y-7 text-center lg:text-left">
            {/* Developer Status Badge */}
            <div className="inline-flex items-center gap-2.5 px-3.5 py-1.5 rounded-full bg-dark-900/90 border border-cyber-accent/30 shadow-neon-sm text-xs font-mono text-gray-300">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyber-neon opacity-75" />
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-cyber-accent" />
              </span>
              <span>Available for Freelance & Corporate Training</span>
            </div>

            {/* Main Heading */}
            <div className="space-y-3">
              <h1 className="text-4xl sm:text-5xl xl:text-6xl font-extrabold tracking-tight text-white leading-tight font-sans">
                {siteSettings.hero_title || "Hi, I'm Muhammad Fazal"}
              </h1>

              {/* Dynamic Typist Tagline */}
              <div className="text-xl sm:text-2xl xl:text-3xl font-mono text-cyber-neon font-bold flex items-center justify-center lg:justify-start gap-2 h-10">
                <Terminal className="w-6 h-6 text-cyber-accent shrink-0 hidden sm:inline" />
                <span>I am a </span>
                <span className="underline decoration-cyber-accent decoration-2 underline-offset-4 text-glow">
                  {currentRole}
                </span>
                <span className="animate-pulse text-white">|</span>
              </div>
            </div>

            {/* Bio Text */}
            <p className="text-gray-300 text-base sm:text-lg leading-relaxed max-w-2xl font-sans">
              {siteSettings.hero_bio}
            </p>

            {/* Action Buttons */}
            <div className="flex flex-wrap items-center justify-center lg:justify-start gap-4 pt-2">
              {/* Download CV CTA */}
              <a
                href={siteSettings.cv_url || '#'}
                target="_blank"
                rel="noopener noreferrer"
                download="Muhammad_Fazal_Resume.pdf"
                className="inline-flex items-center gap-2 px-6 py-3.5 rounded-xl bg-cyber-accent text-dark-950 font-bold font-mono text-sm tracking-wider hover:bg-cyber-neon transition-all shadow-neon hover:shadow-neon-lg transform hover:-translate-y-0.5 active:translate-y-0"
              >
                <Download className="w-4 h-4" />
                <span>Download CV</span>
              </a>

              {/* Consultation CTA */}
              <button
                onClick={() => setIsConsultationOpen(true)}
                className="inline-flex items-center gap-2 px-6 py-3.5 rounded-xl bg-dark-900 hover:bg-dark-800 text-white font-mono text-sm border border-white/10 hover:border-cyber-accent/50 transition-all transform hover:-translate-y-0.5"
              >
                <Sparkles className="w-4 h-4 text-cyber-neon" />
                <span>Get Consultation</span>
              </button>

              {/* e-Book Store CTA */}
              <Link
                to="/ebooks"
                className="inline-flex items-center gap-1.5 px-4 py-3.5 text-gray-400 hover:text-cyber-neon font-mono text-sm transition-colors group"
              >
                <span>Digital eBooks</span>
                <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
              </Link>
            </div>

            {/* Quick Metrics */}
            <div className="pt-6 grid grid-cols-3 gap-4 border-t border-white/5 max-w-lg mx-auto lg:mx-0">
              <div>
                <div className="text-2xl sm:text-3xl font-extrabold font-mono text-white">50+</div>
                <div className="text-xs text-gray-400 font-mono mt-0.5">Projects Delivered</div>
              </div>
              <div>
                <div className="text-2xl sm:text-3xl font-extrabold font-mono text-cyber-neon">4+ Yrs</div>
                <div className="text-xs text-gray-400 font-mono mt-0.5">MS Office Mastery</div>
              </div>
              <div>
                <div className="text-2xl sm:text-3xl font-extrabold font-mono text-white">1.2k+</div>
                <div className="text-xs text-gray-400 font-mono mt-0.5">Students Trained</div>
              </div>
            </div>
          </div>

          {/* Right Column: Hero Image inside Developer Badge Frame */}
          <div className="lg:col-span-5 flex justify-center">
            <div className="relative w-72 sm:w-80 md:w-96">
              {/* Outer Glowing Cyber Border */}
              <div className="absolute -inset-2 rounded-3xl bg-gradient-to-tr from-cyber-accent/40 via-emerald-400/20 to-cyber-neon/60 blur-xl opacity-75 animate-pulse-glow" />

              {/* Developer Badge Card Container */}
              <div className="relative rounded-3xl bg-dark-900 border border-cyber-accent/40 p-3 shadow-2xl overflow-hidden">
                {/* Window Controls Bar */}
                <div className="flex items-center justify-between px-3 py-2 border-b border-white/5 bg-dark-950/60 rounded-t-2xl mb-3">
                  <div className="flex items-center gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-full bg-red-500/80" />
                    <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/80" />
                    <div className="w-2.5 h-2.5 rounded-full bg-green-500/80" />
                  </div>
                  <span className="text-[11px] font-mono text-gray-400 flex items-center gap-1">
                    <Code2 className="w-3 h-3 text-cyber-neon" />
                    fazal.dev/hero.tsx
                  </span>
                </div>

                {/* Developer Avatar / Photo */}
                <div className="relative rounded-2xl overflow-hidden aspect-[4/5] bg-dark-950 group">
                  <img
                    src="/fazal.jpg"
                    alt="Muhammad Fazal"
                    className="w-full h-full object-cover object-center transition-transform duration-700 group-hover:scale-105"
                  />
                  {/* Subtle Gradient Overlay */}
                  <div className="absolute inset-0 bg-gradient-to-t from-dark-950 via-transparent to-transparent opacity-80" />

                  {/* Floating Verified Badge */}
                  <div className="absolute bottom-4 left-4 right-4 p-3 rounded-xl bg-dark-900/90 backdrop-blur-md border border-white/10 flex items-center justify-between">
                    <div>
                      <div className="text-sm font-bold text-white font-mono flex items-center gap-1.5">
                        <span>Muhammad Fazal</span>
                        <ShieldCheck className="w-4 h-4 text-cyber-neon shrink-0" />
                      </div>
                      <div className="text-[11px] text-gray-400 font-mono">
                        Lead Instructor & WP Developer
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="inline-block px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 text-[10px] font-mono font-bold">
                        LEVEL 1 SELLER
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
