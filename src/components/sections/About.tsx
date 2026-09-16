import React from 'react';
import { Globe, GraduationCap, Cpu, CheckCircle2, ArrowRight } from 'lucide-react';
import { useStore } from '../../store/useStore';

export const About: React.FC = () => {
  const { setIsConsultationOpen } = useStore();

  const narrativeCards = [
    {
      id: 'wp',
      title: 'WordPress Developer & Architect',
      badge: 'Fiverr Level 1 Seller',
      badgeColor: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30',
      icon: <Globe className="w-6 h-6 text-cyber-neon" />,
      description:
        'With a proven track record as a Fiverr Level 1 seller, I build dynamic, responsive, and blazing-fast web solutions for forward-thinking clients across the UK, USA, Canada, Germany, and beyond. Specializing in custom Gutenberg systems, headless WordPress, and conversion-focused WooCommerce architectures.',
      bullets: [
        'Over 120+ international projects delivered with 5-star ratings',
        'Sub-second page load times and 95+ Google PageSpeed benchmarks',
        'Modern component architecture with seamless mobile responsiveness',
      ],
    },
    {
      id: 'instructor',
      title: 'Lead Instructor of MS Office',
      badge: 'As-Sunnah Skill Development Institute',
      badgeColor: 'text-cyan-400 bg-cyan-500/10 border-cyan-500/30',
      icon: <GraduationCap className="w-6 h-6 text-cyan-400" />,
      description:
        'At As-Sunnah Skill Development Institute, I lead corporate and student training programs designed to demystify office technology. I bridge the gap between theoretical knowledge and practical workplace efficiency, guiding learners through advanced Excel modeling, PowerPoint visual storytelling, and automated documentation.',
      bullets: [
        '1,500+ professionals and university students personally mentored',
        'Practical, scenario-driven curriculum focusing on immediate ROI',
        'Author of best-selling digital guides and workbook templates',
      ],
    },
    {
      id: 'analyst',
      title: 'Data Analyst & Workflow Automation',
      badge: 'Google Apps Script & BI Specialist',
      badgeColor: 'text-purple-400 bg-purple-500/10 border-purple-500/30',
      icon: <Cpu className="w-6 h-6 text-purple-400" />,
      description:
        'Data without action is noise. I transform raw, fragmented company data into intuitive executive dashboards and automated workflows. Utilizing Google Sheets, Google Apps Script, and cloud pipelines, I eliminate hours of manual data entry, empowering businesses to make sound, data-informed decisions.',
      bullets: [
        'Automated reporting scripts saving up to 15+ manual hours weekly',
        'Interactive financial models and KPI tracking dashboards',
        'End-to-end integration between Gmail, Google Drive, and Google Sheets',
      ],
    },
  ];

  return (
    <section id="about" className="py-24 relative bg-dark-950/60 border-t border-white/5">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto space-y-3 mb-16">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyber-dim border border-cyber-accent/30 text-cyber-neon text-xs font-mono font-bold tracking-widest uppercase">
            About Me
          </div>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight font-sans">
            Make Your Dreams Come True With Me
          </h2>
          <p className="text-gray-400 text-sm sm:text-base leading-relaxed">
            Combining technical engineering with educator clarity. Discover how my multi-disciplinary expertise helps individuals level up and businesses scale seamlessly.
          </p>
        </div>

        {/* 3 Detailed Narrative Cards */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {narrativeCards.map((card) => (
            <div
              key={card.id}
              className="glass-panel p-8 rounded-2xl border border-white/10 hover:border-cyber-accent/40 transition-all duration-300 flex flex-col justify-between group hover:-translate-y-1 shadow-cyber-card"
            >
              <div className="space-y-6">
                {/* Header with Icon and Badge */}
                <div className="flex items-start justify-between gap-4">
                  <div className="w-12 h-12 rounded-xl bg-dark-900 border border-white/10 flex items-center justify-center group-hover:border-cyber-accent/50 transition-colors shadow-inner">
                    {card.icon}
                  </div>
                  <span
                    className={`px-3 py-1 rounded-full text-[11px] font-mono font-bold border ${card.badgeColor}`}
                  >
                    {card.badge}
                  </span>
                </div>

                {/* Title & Description */}
                <div className="space-y-3">
                  <h3 className="text-xl font-bold text-white font-sans group-hover:text-cyber-neon transition-colors">
                    {card.title}
                  </h3>
                  <p className="text-gray-300 text-sm leading-relaxed">
                    {card.description}
                  </p>
                </div>

                {/* Key Bullet Highlights */}
                <div className="pt-4 border-t border-white/5 space-y-2.5">
                  {card.bullets.map((bullet, idx) => (
                    <div key={idx} className="flex items-start gap-2.5 text-xs text-gray-400">
                      <CheckCircle2 className="w-4 h-4 text-cyber-neon shrink-0 mt-0.5" />
                      <span>{bullet}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Card Footer CTA */}
              <div className="pt-8">
                <button
                  onClick={() => setIsConsultationOpen(true)}
                  className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-dark-900 hover:bg-cyber-accent hover:text-dark-950 text-gray-300 font-mono text-xs font-semibold border border-white/10 hover:border-cyber-accent transition-all group/btn"
                >
                  <span>Inquire About This Service</span>
                  <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover/btn:translate-x-1" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};
