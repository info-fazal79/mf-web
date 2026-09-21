import React, { useEffect } from 'react';
import { useStore } from '../store/useStore';
import { Wrench, Mail, Server } from 'lucide-react';
import { GithubIcon, LinkedinIcon, YoutubeIcon, FacebookIcon } from '../components/ui/Icons';

export const MaintenancePage: React.FC = () => {
  const { siteSettings } = useStore();

  useEffect(() => {
    document.title = 'Maintenance Mode — Muhammad Fazal';
  }, []);

  const title = siteSettings.maintenance_title || 'Upgrading System & Infrastructure';
  const message = siteSettings.maintenance_message || 'We are currently deploying new features and performance enhancements. We will be back online shortly.';
  const contactEmail = siteSettings.contact_email || 'contact@muhammadfazal.com';
  const socialLinks = siteSettings.social_links;

  return (
    <div className="min-h-screen bg-[#07090D] text-gray-100 flex flex-col justify-between relative overflow-hidden font-sans selection:bg-cyber-accent selection:text-black">
      {/* Background Matrix/Cyber Ambient Effects */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#1f29370f_1px,transparent_1px),linear-gradient(to_bottom,#1f29370f_1px,transparent_1px)] bg-[size:4rem_4rem] pointer-events-none" />
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[700px] h-[350px] bg-cyber-accent/10 blur-[140px] rounded-full pointer-events-none" />
      <div className="absolute bottom-0 right-1/4 w-[500px] h-[300px] bg-amber-500/5 blur-[120px] rounded-full pointer-events-none" />

      {/* Top Brand Bar */}
      <header className="relative z-10 max-w-6xl mx-auto w-full px-6 py-8 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          {siteSettings.logo_type === 'image' && siteSettings.logo_image_url ? (
            <img
              src={siteSettings.logo_image_url}
              alt={siteSettings.logo_text || 'FAZAL'}
              style={{ width: `${siteSettings.logo_width || 120}px` }}
              className="h-auto object-contain"
            />
          ) : (
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-dark-900 border border-cyber-accent/40 flex items-center justify-center shadow-neon-sm">
                <span className="font-mono text-cyber-neon font-black text-lg">F</span>
              </div>
              <span className="text-xl font-bold tracking-wider font-mono bg-gradient-to-r from-white via-gray-200 to-cyber-neon bg-clip-text text-transparent">
                {siteSettings.logo_text || 'FAZAL'}
              </span>
            </div>
          )}
        </div>

        {/* Live Status In Progress Badge */}
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-mono font-medium shadow-[0_0_15px_rgba(245,158,11,0.15)]">
          <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
          <span>Live Status: In Progress</span>
        </div>
      </header>

      {/* Main Content Card */}
      <main className="relative z-10 max-w-2xl mx-auto px-6 py-12 text-center my-auto w-full">
        {/* Animated Cyber Core Icon */}
        <div className="relative inline-flex items-center justify-center mb-8">
          <div className="absolute inset-0 rounded-full bg-cyber-accent/20 blur-xl animate-pulse" />
          <div className="relative w-24 h-24 rounded-2xl bg-dark-900/90 border border-cyber-accent/40 flex items-center justify-center shadow-neon">
            <Server className="w-10 h-10 text-cyber-neon animate-pulse" />
            <div className="absolute -top-1.5 -right-1.5 w-6 h-6 rounded-lg bg-dark-950 border border-amber-500/60 flex items-center justify-center">
              <Wrench className="w-3.5 h-3.5 text-amber-400 animate-spin" style={{ animationDuration: '8s' }} />
            </div>
          </div>
        </div>

        {/* Heading */}
        <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-white tracking-tight mb-4 font-mono">
          {title}
        </h1>

        {/* Description */}
        <p className="text-base sm:text-lg text-gray-300 max-w-xl mx-auto mb-8 leading-relaxed">
          {message}
        </p>

        {/* Terminal Simulation Box */}
        <div className="mb-10 text-left bg-dark-950/80 border border-white/10 rounded-xl p-4 font-mono text-xs text-gray-400 shadow-xl max-w-lg mx-auto backdrop-blur-md">
          <div className="flex items-center gap-1.5 mb-3 border-b border-white/5 pb-2">
            <span className="w-2.5 h-2.5 rounded-full bg-red-500/80" />
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500/80" />
            <span className="w-2.5 h-2.5 rounded-full bg-green-500/80" />
            <span className="ml-2 text-[10px] text-gray-500">core-system-daemon ~ maintenance</span>
          </div>
          <p className="text-cyber-neon mb-1">&gt; SYSTEM_STATUS: CORE_SERVICES_PAUSED</p>
          <p className="text-gray-300 mb-1">&gt; MODE: ARCHITECTURAL_UPGRADE_ACTIVE</p>
          <p className="text-amber-400 mb-1">&gt; REASON: SCHEDULED_DEPLOYMENT & OPTIMIZATION</p>
          <p className="text-gray-500 flex items-center gap-1">
            <span>&gt; ESTIMATED_ONLINE: SHORTLY</span>
            <span className="inline-block w-1.5 h-3 bg-cyber-accent animate-pulse" />
          </p>
        </div>

        {/* Contact CTA */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-8">
          <a
            href={`mailto:${contactEmail}`}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-cyber-accent text-dark-950 font-bold font-mono text-sm hover:bg-cyber-neon transition-all shadow-neon hover:scale-105"
          >
            <Mail className="w-4 h-4" />
            <span>Contact via Email</span>
          </a>
        </div>

        {/* Social Links */}
        <div className="flex items-center justify-center gap-3">
          {socialLinks?.linkedin && (
            <a
              href={socialLinks.linkedin}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="LinkedIn Profile"
              className="p-2.5 rounded-xl bg-dark-900 border border-white/10 text-gray-400 hover:text-cyber-neon hover:border-cyber-accent/40 transition-all hover:scale-110"
              title="LinkedIn"
            >
              <LinkedinIcon className="w-4 h-4" />
            </a>
          )}
          {socialLinks?.github && (
            <a
              href={socialLinks.github}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="GitHub Profile"
              className="p-2.5 rounded-xl bg-dark-900 border border-white/10 text-gray-400 hover:text-cyber-neon hover:border-cyber-accent/40 transition-all hover:scale-110"
              title="GitHub"
            >
              <GithubIcon className="w-4 h-4" />
            </a>
          )}
          {socialLinks?.youtube && (
            <a
              href={socialLinks.youtube}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="YouTube Channel"
              className="p-2.5 rounded-xl bg-dark-900 border border-white/10 text-gray-400 hover:text-cyber-neon hover:border-cyber-accent/40 transition-all hover:scale-110"
              title="YouTube"
            >
              <YoutubeIcon className="w-4 h-4" />
            </a>
          )}
          {socialLinks?.facebook && (
            <a
              href={socialLinks.facebook}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Facebook Profile"
              className="p-2.5 rounded-xl bg-dark-900 border border-white/10 text-gray-400 hover:text-cyber-neon hover:border-cyber-accent/40 transition-all hover:scale-110"
              title="Facebook"
            >
              <FacebookIcon className="w-4 h-4" />
            </a>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 max-w-6xl mx-auto w-full px-6 py-6 border-t border-white/5 flex items-center justify-center text-xs text-gray-500 font-mono text-center">
        <div>
          &copy; {new Date().getFullYear()} Muhammad Fazal. All rights reserved.
        </div>
      </footer>
    </div>
  );
};
