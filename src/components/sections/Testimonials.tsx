import React, { useState, useEffect, useCallback } from 'react';
import { TESTIMONIALS } from '../../lib/initialData';
import { Star, ChevronLeft, ChevronRight, Quote, CheckCircle2, ShieldCheck } from 'lucide-react';

export const Testimonials: React.FC = () => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);

  const total = TESTIMONIALS.length;

  const goToSlide = useCallback((index: number) => {
    setIsAnimating(true);
    setTimeout(() => {
      setCurrentIndex(index);
      setIsAnimating(false);
    }, 250);
  }, []);

  const prevSlide = useCallback(() => {
    goToSlide(currentIndex === 0 ? total - 1 : currentIndex - 1);
  }, [currentIndex, total, goToSlide]);

  const nextSlide = useCallback(() => {
    goToSlide(currentIndex === total - 1 ? 0 : currentIndex + 1);
  }, [currentIndex, total, goToSlide]);

  // Auto-play interval: every 4.5 seconds, pauses when hovered
  useEffect(() => {
    if (isPaused) return;

    const timer = setInterval(() => {
      nextSlide();
    }, 4500);

    return () => clearInterval(timer);
  }, [isPaused, nextSlide]);

  const current = TESTIMONIALS[currentIndex];

  return (
    <section id="testimonials" className="py-24 relative bg-dark-900/60 border-t border-white/5 overflow-hidden">
      {/* Background Ambient Glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-emerald-500/5 rounded-full blur-[140px] pointer-events-none" />

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        {/* Section Heading */}
        <div className="text-center max-w-3xl mx-auto space-y-3 mb-16">
          <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-cyber-dim border border-cyber-accent/30 text-cyber-neon text-xs font-mono font-bold tracking-widest uppercase">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Client Endorsements</span>
          </div>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight font-sans">
            Trusted by Global Clients & Partners
          </h2>
          <p className="text-gray-400 text-sm sm:text-base">
            Verified feedback from international Fiverr clientele, corporate teams, and academic institutions.
          </p>
        </div>

        {/* Carousel Card with Pause-on-Hover */}
        <div
          onMouseEnter={() => setIsPaused(true)}
          onMouseLeave={() => setIsPaused(false)}
          className="relative bg-slate-900/60 backdrop-blur-md border border-slate-800 hover:border-emerald-500/40 transition-all duration-300 p-8 sm:p-12 rounded-3xl shadow-cyber-card overflow-hidden group"
        >
          {/* Subtle Cyber Quotation Watermark */}
          <Quote className="absolute top-6 right-8 w-20 h-20 sm:w-28 sm:h-28 text-emerald-500/10 pointer-events-none transition-transform duration-500 group-hover:scale-110" />

          {/* Testimonial Content Transition Container */}
          <div
            className={`transition-all duration-300 ease-out transform ${
              isAnimating ? 'opacity-0 translate-y-3 scale-[0.99]' : 'opacity-100 translate-y-0 scale-100'
            }`}
          >
            <div className="relative z-10 flex flex-col md:flex-row items-center md:items-start gap-8 text-center md:text-left">
              {/* Male Client Avatar */}
              <div className="relative shrink-0">
                <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-2xl overflow-hidden border-2 border-emerald-500/50 shadow-neon-sm p-0.5 bg-dark-950">
                  <img
                    src={current.avatar}
                    alt={current.name}
                    className="w-full h-full object-cover rounded-[14px]"
                  />
                </div>
              </div>

              {/* Testimonial Details */}
              <div className="flex-1 space-y-4">
                <div className="flex flex-wrap items-center justify-center md:justify-between gap-3">
                  {/* Glowing 5-Star Rating */}
                  <div className="flex items-center gap-1">
                    {[...Array(current.rating)].map((_, i) => (
                      <Star
                        key={i}
                        className="w-4 h-4 text-amber-400 fill-amber-400 drop-shadow-[0_0_8px_rgba(251,191,36,0.6)]"
                      />
                    ))}
                  </div>

                  {/* Verified Client Badge */}
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-mono font-medium shadow-neon-sm">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Verified Client</span>
                  </div>
                </div>

                {/* Testimonial Quote */}
                <p className="text-base sm:text-lg text-gray-200 italic leading-relaxed font-sans">
                  "{current.text}"
                </p>

                {/* Client Name & Designation */}
                <div className="pt-2">
                  <h4 className="text-lg font-bold text-white font-sans">{current.name}</h4>
                  <p className="text-xs text-cyber-neon font-mono mt-0.5">{current.role}</p>
                  {current.designation && (
                    <p className="text-[11px] text-gray-400 font-mono mt-0.5">
                      {current.designation}
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Carousel Footer: Dots & Navigation Controls */}
          <div className="flex items-center justify-between gap-4 mt-10 pt-6 border-t border-white/5">
            {/* Pagination Dots */}
            <div className="flex items-center gap-2">
              {TESTIMONIALS.map((_, idx) => (
                <button
                  key={idx}
                  onClick={() => goToSlide(idx)}
                  className={`h-2 rounded-full transition-all duration-300 ${
                    currentIndex === idx
                      ? 'w-7 bg-cyber-accent shadow-neon-sm'
                      : 'w-2 bg-gray-700 hover:bg-gray-500'
                  }`}
                  aria-label={`Go to slide ${idx + 1}`}
                />
              ))}
              <span className="text-xs font-mono text-gray-400 ml-2 hidden sm:inline">
                {currentIndex + 1} / {total}
              </span>
            </div>

            {/* Previous & Next Slide Controls */}
            <div className="flex items-center gap-2">
              <button
                onClick={prevSlide}
                className="p-2.5 rounded-xl bg-dark-900 border border-white/10 text-gray-300 hover:text-cyber-neon hover:border-cyber-accent/40 transition-all active:scale-95"
                aria-label="Previous review"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                onClick={nextSlide}
                className="p-2.5 rounded-xl bg-dark-900 border border-white/10 text-gray-300 hover:text-cyber-neon hover:border-cyber-accent/40 transition-all active:scale-95"
                aria-label="Next review"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
