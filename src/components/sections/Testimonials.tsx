import React, { useState } from 'react';
import { TESTIMONIALS } from '../../lib/initialData';
import { Star, ChevronLeft, ChevronRight, Quote } from 'lucide-react';

export const Testimonials: React.FC = () => {
  const [currentIndex, setCurrentIndex] = useState(0);

  const prevSlide = () => {
    setCurrentIndex((prev) => (prev === 0 ? TESTIMONIALS.length - 1 : prev - 1));
  };

  const nextSlide = () => {
    setCurrentIndex((prev) => (prev === TESTIMONIALS.length - 1 ? 0 : prev + 1));
  };

  const current = TESTIMONIALS[currentIndex];

  return (
    <section id="testimonials" className="py-24 relative bg-dark-900/60 border-t border-white/5 overflow-hidden">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        {/* Section Heading */}
        <div className="text-center max-w-3xl mx-auto space-y-3 mb-16">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyber-dim border border-cyber-accent/30 text-cyber-neon text-xs font-mono font-bold tracking-widest uppercase">
            Client Endorsements
          </div>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight font-sans">
            Trusted by Global Clients & Students
          </h2>
          <p className="text-gray-400 text-sm sm:text-base">
            Verified feedback from international Fiverr clientele and institute partners.
          </p>
        </div>

        {/* Carousel Card */}
        <div className="relative glass-panel p-8 sm:p-12 rounded-3xl border border-white/10 shadow-2xl overflow-hidden">
          <Quote className="absolute top-6 right-8 w-20 h-20 text-white/5 pointer-events-none" />

          <div className="relative z-10 flex flex-col md:flex-row items-center gap-8 text-center md:text-left">
            {/* Avatar */}
            <div className="relative shrink-0">
              <div className="w-24 h-24 rounded-2xl overflow-hidden border-2 border-cyber-accent/50 shadow-neon-sm">
                <img
                  src={current.avatar}
                  alt={current.name}
                  className="w-full h-full object-cover"
                />
              </div>
            </div>

            {/* Testimonial Quote & Info */}
            <div className="flex-1 space-y-4">
              {/* Star Rating */}
              <div className="flex items-center justify-center md:justify-start gap-1">
                {[...Array(current.rating)].map((_, i) => (
                  <Star key={i} className="w-4 h-4 text-amber-400 fill-amber-400" />
                ))}
              </div>

              <p className="text-base sm:text-lg text-gray-200 italic leading-relaxed">
                "{current.text}"
              </p>

              <div>
                <h4 className="text-lg font-bold text-white font-sans">{current.name}</h4>
                <p className="text-xs text-cyber-neon font-mono mt-0.5">{current.role}</p>
              </div>
            </div>
          </div>

          {/* Carousel Navigation Buttons */}
          <div className="flex items-center justify-center md:justify-end gap-3 mt-8 pt-6 border-t border-white/5">
            <button
              onClick={prevSlide}
              className="p-2.5 rounded-xl bg-dark-900 border border-white/10 text-gray-300 hover:text-cyber-neon hover:border-cyber-accent/40 transition-all"
              aria-label="Previous review"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <div className="text-xs font-mono text-gray-400">
              {currentIndex + 1} / {TESTIMONIALS.length}
            </div>
            <button
              onClick={nextSlide}
              className="p-2.5 rounded-xl bg-dark-900 border border-white/10 text-gray-300 hover:text-cyber-neon hover:border-cyber-accent/40 transition-all"
              aria-label="Next review"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </section>
  );
};
