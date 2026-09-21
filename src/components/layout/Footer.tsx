import React, { useState } from 'react';
import { ArrowUp, Mail, CheckCircle2 } from 'lucide-react';
import { GithubIcon, LinkedinIcon, YoutubeIcon, FacebookIcon } from '../ui/Icons';
import { useStore } from '../../store/useStore';
import { Link } from 'react-router-dom';

export const Footer: React.FC = () => {
  const { siteSettings, addToast } = useStore();
  const [newsletterEmail, setNewsletterEmail] = useState('');
  const [isSubscribed, setIsSubscribed] = useState(false);

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleNewsletter = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newsletterEmail || !newsletterEmail.includes('@')) {
      addToast({
        title: 'Invalid Email',
        message: 'Please provide a valid email address.',
        type: 'error',
      });
      return;
    }
    setIsSubscribed(true);
    addToast({
      title: 'Subscribed!',
      message: 'You have been added to Fazal’s monthly tech & productivity newsletter.',
      type: 'success',
    });
    setNewsletterEmail('');
  };

  return (
    <footer id="contact" className="relative bg-dark-950 border-t border-white/10 pt-20 pb-12 overflow-hidden">
      {/* Subtle background glow */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-3/4 h-24 bg-cyber-accent/5 blur-[100px] pointer-events-none" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-12 pb-16 border-b border-white/5">
          {/* Brand & Bio Column */}
          <div className="lg:col-span-2 space-y-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-dark-900 border border-cyber-accent/40 flex items-center justify-center shadow-neon-sm">
                <span className="font-mono text-cyber-neon font-black">F</span>
              </div>
              <span className="text-xl font-bold font-mono tracking-wider text-white">
                {siteSettings.logo_text || 'FAZAL'}
              </span>
            </div>
            <p className="text-gray-400 text-sm leading-relaxed max-w-sm">
              Empowering companies and individuals through high-converting WordPress websites, automated data analytics pipelines, and transformative MS Office corporate masterclasses.
            </p>
            {/* Social Icons */}
            <div className="flex items-center gap-3 pt-2">
              {siteSettings.social_links?.github && (
                <a
                  href={siteSettings.social_links.github}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-9 h-9 rounded-xl bg-dark-900 border border-white/10 flex items-center justify-center text-gray-400 hover:text-cyber-neon hover:border-cyber-accent/40 transition-all hover:scale-110"
                  aria-label="GitHub Profile"
                >
                  <GithubIcon className="w-4 h-4" />
                </a>
              )}
              {siteSettings.social_links?.linkedin && (
                <a
                  href={siteSettings.social_links.linkedin}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-9 h-9 rounded-xl bg-dark-900 border border-white/10 flex items-center justify-center text-gray-400 hover:text-cyber-neon hover:border-cyber-accent/40 transition-all hover:scale-110"
                  aria-label="LinkedIn Profile"
                >
                  <LinkedinIcon className="w-4 h-4" />
                </a>
              )}
              {siteSettings.social_links?.youtube && (
                <a
                  href={siteSettings.social_links.youtube}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-9 h-9 rounded-xl bg-dark-900 border border-white/10 flex items-center justify-center text-gray-400 hover:text-cyber-neon hover:border-cyber-accent/40 transition-all hover:scale-110"
                  aria-label="YouTube Channel"
                >
                  <YoutubeIcon className="w-4 h-4" />
                </a>
              )}
              {siteSettings.social_links?.facebook && (
                <a
                  href={siteSettings.social_links.facebook}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-9 h-9 rounded-xl bg-dark-900 border border-white/10 flex items-center justify-center text-gray-400 hover:text-cyber-neon hover:border-cyber-accent/40 transition-all hover:scale-110"
                  aria-label="Facebook Profile"
                >
                  <FacebookIcon className="w-4 h-4" />
                </a>
              )}
            </div>
          </div>

          {/* Quick Links */}
          <div className="space-y-4">
            <h4 className="text-sm font-semibold uppercase tracking-wider text-white font-mono">
              Quick Navigation
            </h4>
            <ul className="space-y-2.5 text-sm text-gray-400">
              <li>
                <Link to="/about" className="hover:text-cyber-neon transition-colors">About Muhammad</Link>
              </li>
              <li>
                <Link to="/projects" className="hover:text-cyber-neon transition-colors">Featured Projects</Link>
              </li>
              <li>
                <Link to="/ebooks" className="hover:text-cyber-neon transition-colors">Digital eBooks Store</Link>
              </li>
              <li>
                <Link to="/tutorials" className="hover:text-cyber-neon transition-colors">Video Tutorials</Link>
              </li>
              <li>
                <Link to="/blog" className="hover:text-cyber-neon transition-colors">Tech & Productivity Blog</Link>
              </li>
              <li>
                <Link to="/contact" className="hover:text-cyber-neon transition-colors">Contact & Consultation</Link>
              </li>
            </ul>
          </div>

          {/* Areas of Practice */}
          <div className="space-y-4">
            <h4 className="text-sm font-semibold uppercase tracking-wider text-white font-mono">
              Specializations
            </h4>
            <ul className="space-y-2.5 text-sm text-gray-400">
              <li className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-cyber-accent" />
                <span>WordPress Development</span>
              </li>
              <li className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-cyber-accent" />
                <span>Data Analytics & BI</span>
              </li>
              <li className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-cyber-accent" />
                <span>Google Apps Script</span>
              </li>
              <li className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-cyber-accent" />
                <span>MS Office Masterclasses</span>
              </li>
              <li className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-cyber-accent" />
                <span>PageSpeed & Web Vitals</span>
              </li>
            </ul>
          </div>

          {/* Newsletter Column */}
          <div className="space-y-4">
            <h4 className="text-sm font-semibold uppercase tracking-wider text-white font-mono">
              Stay in the Loop
            </h4>
            <p className="text-xs text-gray-400 leading-relaxed">
              Get monthly updates on free productivity templates, new eBooks, and WordPress tips directly to your inbox.
            </p>
            <form onSubmit={handleNewsletter} className="space-y-2">
              <div className="relative">
                <input
                  type="email"
                  value={newsletterEmail}
                  onChange={(e) => setNewsletterEmail(e.target.value)}
                  placeholder="Enter your email"
                  required
                  className="w-full px-3.5 py-2.5 text-sm rounded-xl bg-dark-900 border border-white/10 text-white placeholder-gray-500 focus:outline-none focus:border-cyber-accent focus:ring-1 focus:ring-cyber-accent"
                />
              </div>
              <button
                type="submit"
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-dark-800 hover:bg-cyber-accent hover:text-dark-950 text-white text-xs font-semibold font-mono tracking-wider transition-all border border-white/10 hover:border-cyber-accent"
              >
                {isSubscribed ? (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Subscribed</span>
                  </>
                ) : (
                  <>
                    <Mail className="w-3.5 h-3.5" />
                    <span>Subscribe</span>
                  </>
                )}
              </button>
            </form>
          </div>
        </div>

        {/* Bottom Bar with Copyright & Top Button */}
        <div className="pt-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-gray-500">
          <p>© {new Date().getFullYear()} Muhammad Fazal. All rights reserved.</p>
          <button
            onClick={scrollToTop}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-dark-900 border border-white/10 hover:border-cyber-accent/50 text-gray-300 hover:text-cyber-neon transition-all"
            aria-label="Back to top"
          >
            <span>Top</span>
            <ArrowUp className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </footer>
  );
};
