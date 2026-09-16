import React from 'react';
import { Link } from 'react-router-dom';
import { Hero } from '../components/sections/Hero';
import { Skills } from '../components/sections/Skills';
import { Testimonials } from '../components/sections/Testimonials';
import { useStore } from '../store/useStore';
import { 
  ArrowRight, 
  Sparkles, 
  User, 
  FolderGit2, 
  BookOpen, 
  FileText, 
  MessageSquare
} from 'lucide-react';
import { YoutubeIcon } from '../components/ui/Icons';

export const HomePage: React.FC = () => {
  const { setIsConsultationOpen } = useStore();

  const exploreCards = [
    {
      title: 'About Muhammad',
      badge: 'Bio & Journey',
      description: 'Fiverr Level 1 seller, Lead Instructor at As-Sunnah Institute, and 8+ years career timeline.',
      link: '/about',
      icon: <User className="w-5 h-5 text-cyber-neon" />,
    },
    {
      title: 'Project Showcase',
      badge: 'Portfolio',
      description: 'High-converting WordPress websites, interactive dashboards, and cloud automation engines.',
      link: '/projects',
      icon: <FolderGit2 className="w-5 h-5 text-blue-400" />,
    },
    {
      title: 'Digital Store',
      badge: 'e-Books & Guides',
      description: 'Practical Excel handbooks, sub-second WordPress blueprints, and instant PDF downloads.',
      link: '/ebooks',
      icon: <BookOpen className="w-5 h-5 text-emerald-400" />,
    },
    {
      title: 'Video Masterclasses',
      badge: 'YouTube Hub',
      description: 'Free, expert-led video tutorials covering Excel dynamic formulas, automation, and web design.',
      link: '/tutorials',
      icon: <YoutubeIcon className="w-5 h-5 text-red-500" />,
    },
    {
      title: 'Tech Blog',
      badge: 'Articles & Insights',
      description: 'Deep-dive case studies on 99+ PageSpeed optimization, Google Apps Script, and data productivity.',
      link: '/blog',
      icon: <FileText className="w-5 h-5 text-purple-400" />,
    },
    {
      title: 'Get in Touch',
      badge: 'Consultation',
      description: 'Direct contact info, turnaround times, and custom project inquiry proposal submission.',
      link: '/contact',
      icon: <MessageSquare className="w-5 h-5 text-amber-400" />,
    },
  ];

  return (
    <div className="space-y-0">
      {/* 1. Hero Section */}
      <Hero />

      {/* 2. Core Software Stack & Skills */}
      <Skills />

      {/* 3. Streamlined Quick Jump Hub */}
      <section className="py-20 relative bg-dark-900/40 border-t border-white/5">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto space-y-3 mb-14">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyber-dim border border-cyber-accent/30 text-cyber-neon text-xs font-mono font-bold uppercase tracking-widest">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Explore The Platform</span>
            </div>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight font-sans">
              Discover Everything in One Place
            </h2>
            <p className="text-gray-400 text-sm sm:text-base">
              Dive into dedicated pages for detailed case studies, digital store downloads, and learning materials.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {exploreCards.map((card, idx) => (
              <Link
                key={idx}
                to={card.link}
                className="group glass-panel p-6 rounded-2xl border border-white/10 hover:border-cyber-accent/40 transition-all duration-300 flex flex-col justify-between hover:-translate-y-1.5 shadow-xl"
              >
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="w-12 h-12 rounded-xl bg-dark-900 border border-white/10 flex items-center justify-center group-hover:border-cyber-accent/40 group-hover:shadow-neon-sm transition-all">
                      {card.icon}
                    </div>
                    <span className="text-[10px] font-mono font-bold px-2.5 py-1 rounded-full bg-dark-950 border border-white/10 text-gray-300 group-hover:border-cyber-accent/30 group-hover:text-cyber-neon transition-colors">
                      {card.badge}
                    </span>
                  </div>

                  <div className="space-y-1.5">
                    <h3 className="text-lg font-bold text-white font-sans group-hover:text-cyber-neon transition-colors">
                      {card.title}
                    </h3>
                    <p className="text-xs text-gray-400 leading-relaxed">
                      {card.description}
                    </p>
                  </div>
                </div>

                <div className="pt-5 border-t border-white/5 flex items-center justify-between text-xs font-mono text-gray-400 group-hover:text-cyber-neon transition-colors">
                  <span>Explore Section</span>
                  <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-1" />
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* 4. Testimonials Carousel */}
      <Testimonials />

      {/* 5. Streamlined Consultation CTA Banner */}
      <section className="py-20 relative bg-dark-900/60 border-t border-white/5">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-6">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyber-dim border border-cyber-accent/30 text-cyber-neon text-xs font-mono font-bold uppercase tracking-widest">
            Let's Collaborate
          </div>
          <h2 className="text-3xl sm:text-5xl font-extrabold text-white tracking-tight font-sans">
            Ready to Build Something Exceptional?
          </h2>
          <p className="text-gray-300 text-sm sm:text-base max-w-xl mx-auto leading-relaxed">
            Whether you need a high-converting WordPress platform, business data analytics pipeline, or corporate MS Office training, I am here to help.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-4 pt-2">
            <button
              onClick={() => setIsConsultationOpen(true)}
              className="px-6 py-3.5 rounded-xl bg-cyber-accent text-dark-950 font-bold font-mono text-sm tracking-wider hover:bg-cyber-neon transition-all shadow-neon hover:shadow-neon-lg transform hover:-translate-y-0.5"
            >
              Get Free Consultation
            </button>
            <Link
              to="/contact"
              className="px-6 py-3.5 rounded-xl bg-dark-900 text-white border border-white/10 hover:border-cyber-accent font-mono text-sm transition-all hover:-translate-y-0.5"
            >
              Contact Information &rarr;
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
};
