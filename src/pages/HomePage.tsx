import React from 'react';
import { Link } from 'react-router-dom';
import { Hero } from '../components/sections/Hero';
import { Skills } from '../components/sections/Skills';
import { Testimonials } from '../components/sections/Testimonials';
import { useStore } from '../store/useStore';
import { formatPrice } from '../lib/utils';
import { 
  ArrowRight, 
  Sparkles, 
  ExternalLink, 
  Download, 
  ShoppingBag, 
  Check, 
  GraduationCap, 
  Globe, 
  Cpu, 
  CheckCircle2,
  BookOpen,
  FolderGit2
} from 'lucide-react';
import { Book } from '../types';

export const HomePage: React.FC = () => {
  const { projects, books, cart, addToCart, setCheckoutSuccessOrder, setIsConsultationOpen } = useStore();

  const handleInstantFreeDownload = (book: Book) => {
    setCheckoutSuccessOrder({
      id: 'free-' + Date.now(),
      customer_name: 'Valued Reader',
      customer_email: 'reader@example.com',
      book_id: book.id,
      book: book,
      amount: 0,
      payment_method: 'free_download',
      trx_id: 'FREE_ACCESS',
      status: 'completed',
      created_at: new Date().toISOString(),
    });
  };

  const featuredProjects = projects.slice(0, 2);
  const featuredBooks = books.slice(0, 3);

  return (
    <div className="space-y-0">
      {/* 1. Hero Section */}
      <Hero />

      {/* 2. Brief About Teaser */}
      <section className="py-20 relative bg-dark-900/40 border-t border-white/5">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
            <div className="lg:col-span-5 space-y-5">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyber-dim border border-cyber-accent/30 text-cyber-neon text-xs font-mono font-bold uppercase tracking-widest">
                About Muhammad Fazal
              </div>
              <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight font-sans">
                Make Your Dreams Come True With Me
              </h2>
              <p className="text-gray-300 text-sm sm:text-base leading-relaxed">
                I am a Fiverr Level 1 WordPress Developer, Data Analyst, and Lead Instructor of MS Office at As-Sunnah Skill Development Institute. I bridge the gap between technical web engineering and empowering corporate productivity.
              </p>
              <div className="pt-2">
                <Link
                  to="/about"
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-dark-900 border border-cyber-accent/40 text-cyber-neon hover:bg-cyber-accent hover:text-dark-950 font-mono text-xs font-bold transition-all shadow-neon-sm"
                >
                  <span>Explore Full Bio & Timeline</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            </div>

            {/* 3 Pillars Teaser Cards */}
            <div className="lg:col-span-7 grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="glass-panel p-5 rounded-2xl border border-white/10 space-y-3 hover:border-cyber-accent/40 transition-all">
                <div className="w-10 h-10 rounded-xl bg-dark-900 border border-white/10 flex items-center justify-center text-cyber-neon">
                  <Globe className="w-5 h-5" />
                </div>
                <h3 className="text-base font-bold text-white font-sans">WordPress Architect</h3>
                <p className="text-xs text-gray-400 leading-relaxed">
                  Fiverr Level 1 seller delivering 99+ PageSpeed custom Gutenberg websites for global clients.
                </p>
              </div>

              <div className="glass-panel p-5 rounded-2xl border border-white/10 space-y-3 hover:border-cyber-accent/40 transition-all">
                <div className="w-10 h-10 rounded-xl bg-dark-900 border border-white/10 flex items-center justify-center text-cyan-400">
                  <GraduationCap className="w-5 h-5" />
                </div>
                <h3 className="text-base font-bold text-white font-sans">Lead Instructor</h3>
                <p className="text-xs text-gray-400 leading-relaxed">
                  Mentoring 1,500+ students at As-Sunnah Skill Development Institute in MS Office & productivity.
                </p>
              </div>

              <div className="glass-panel p-5 rounded-2xl border border-white/10 space-y-3 hover:border-cyber-accent/40 transition-all">
                <div className="w-10 h-10 rounded-xl bg-dark-900 border border-white/10 flex items-center justify-center text-purple-400">
                  <Cpu className="w-5 h-5" />
                </div>
                <h3 className="text-base font-bold text-white font-sans">Data & Automation</h3>
                <p className="text-xs text-gray-400 leading-relaxed">
                  Automating cloud business pipelines using Google Sheets, Google Apps Script, and Drive APIs.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 3. Core Software Arsenal Grid */}
      <Skills />

      {/* 4. Featured Projects Preview */}
      <section className="py-24 relative bg-dark-900/40 border-t border-white/5">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-12">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyber-dim border border-cyber-accent/30 text-cyber-neon text-xs font-mono font-bold uppercase tracking-widest">
                Selected Work
              </div>
              <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight font-sans mt-2">
                Featured Projects
              </h2>
            </div>
            <Link
              to="/projects"
              className="inline-flex items-center gap-1.5 text-xs font-mono font-bold text-cyber-neon hover:underline"
            >
              <span>View All Projects</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {featuredProjects.map((project) => (
              <div
                key={project.id}
                className="group glass-panel rounded-2xl border border-white/10 hover:border-cyber-accent/40 transition-all duration-300 overflow-hidden shadow-2xl flex flex-col justify-between"
              >
                {/* Browser Mockup Top Bar */}
                <div className="px-4 py-3 bg-dark-950/80 border-b border-white/10 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full bg-red-500/80" />
                    <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/80" />
                    <div className="w-2.5 h-2.5 rounded-full bg-green-500/80" />
                    <span className="text-[11px] font-mono text-gray-400 ml-2 truncate max-w-[200px]">
                      {project.title.toLowerCase().replace(/\s+/g, '-')}.fazal.dev
                    </span>
                  </div>
                  <span className="text-[10px] font-mono text-cyber-neon">Hover to Scroll</span>
                </div>

                {/* Long Screenshot Container */}
                <div className="relative h-64 w-full overflow-hidden bg-dark-950 cursor-pointer">
                  <img
                    src={project.image_url}
                    alt={project.title}
                    className="w-full object-cover object-top transition-transform duration-[4500ms] ease-in-out group-hover:-translate-y-[calc(100%-16rem)]"
                    style={{ minHeight: '100%' }}
                  />
                </div>

                <div className="p-6 space-y-4 bg-dark-900/60">
                  <h3 className="text-xl font-bold text-white font-sans group-hover:text-cyber-neon transition-colors">
                    {project.title}
                  </h3>
                  <p className="text-gray-300 text-xs sm:text-sm line-clamp-2 leading-relaxed">
                    {project.description}
                  </p>
                  <div className="flex items-center justify-between pt-2 border-t border-white/5">
                    <div className="flex flex-wrap gap-1.5">
                      {project.tags?.slice(0, 3).map((tag, idx) => (
                        <span
                          key={idx}
                          className="text-[10px] font-mono px-2 py-0.5 rounded bg-dark-950 border border-white/10 text-gray-400"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                    {project.live_url && (
                      <a
                        href={project.live_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs font-mono text-cyber-neon hover:underline"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        <span>Live Demo</span>
                      </a>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 5. Featured eBooks Store Preview */}
      <section className="py-24 relative bg-dark-950 border-t border-white/5">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-12">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyber-dim border border-cyber-accent/30 text-cyber-neon text-xs font-mono font-bold uppercase tracking-widest">
                Digital Guides
              </div>
              <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight font-sans mt-2">
                Authoritative e-Books
              </h2>
            </div>
            <Link
              to="/ebooks"
              className="inline-flex items-center gap-1.5 text-xs font-mono font-bold text-cyber-neon hover:underline"
            >
              <span>Visit Digital Store</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {featuredBooks.map((book) => {
              const isItemInCart = cart.some((c) => c.book.id === book.id);
              return (
                <div
                  key={book.id}
                  className="glass-panel rounded-2xl border border-white/10 hover:border-cyber-accent/40 transition-all duration-300 flex flex-col justify-between overflow-hidden group shadow-xl"
                >
                  <div className="relative aspect-[16/10] bg-dark-950 overflow-hidden border-b border-white/10">
                    <img
                      src={book.cover_url}
                      alt={book.title}
                      className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                    />
                    <div className="absolute top-3 right-3">
                      {book.is_free || book.price === 0 ? (
                        <span className="px-3 py-1 rounded-full bg-cyber-accent text-dark-950 text-xs font-mono font-extrabold shadow-neon-sm">
                          FREE PDF
                        </span>
                      ) : (
                        <span className="px-3 py-1 rounded-full bg-dark-900/90 backdrop-blur-md border border-cyber-accent/40 text-cyber-neon text-xs font-mono font-bold">
                          {formatPrice(book.price)}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="p-5 flex-1 flex flex-col justify-between space-y-4">
                    <div>
                      <h3 className="text-base font-bold text-white font-sans group-hover:text-cyber-neon transition-colors line-clamp-2">
                        {book.title}
                      </h3>
                      <p className="text-gray-400 text-xs mt-1.5 line-clamp-2 leading-relaxed">
                        {book.description}
                      </p>
                    </div>

                    <div className="pt-3 border-t border-white/5 flex items-center justify-between gap-3">
                      <span className="text-base font-bold font-mono text-cyber-neon">
                        {formatPrice(book.price)}
                      </span>
                      {book.is_free || book.price === 0 ? (
                        <button
                          onClick={() => handleInstantFreeDownload(book)}
                          className="flex items-center gap-1.5 py-2 px-3 rounded-xl bg-cyber-accent text-dark-950 font-bold font-mono text-xs hover:bg-cyber-neon transition-all"
                        >
                          <Download className="w-3.5 h-3.5" />
                          <span>Instant Download</span>
                        </button>
                      ) : (
                        <button
                          onClick={() => addToCart(book)}
                          className={`flex items-center gap-1.5 py-2 px-3 rounded-xl font-mono text-xs font-bold transition-all ${
                            isItemInCart
                              ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                              : 'bg-dark-900 hover:bg-cyber-accent hover:text-dark-950 text-white border border-white/10'
                          }`}
                        >
                          {isItemInCart ? <Check className="w-3.5 h-3.5" /> : <ShoppingBag className="w-3.5 h-3.5" />}
                          <span>{isItemInCart ? 'In Cart' : 'Add to Cart'}</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* 6. Testimonials Carousel */}
      <Testimonials />

      {/* 7. Consultation CTA Banner */}
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
              className="px-6 py-3.5 rounded-xl bg-cyber-accent text-dark-950 font-bold font-mono text-sm tracking-wider hover:bg-cyber-neon transition-all shadow-neon hover:shadow-neon-lg"
            >
              Get Free Consultation
            </button>
            <Link
              to="/contact"
              className="px-6 py-3.5 rounded-xl bg-dark-900 text-white border border-white/10 hover:border-cyber-accent font-mono text-sm transition-all"
            >
              Contact Information &rarr;
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
};
