import React, { useState, useEffect } from 'react';
import { ShoppingBag, MessageSquareQuote, Menu, X, Shield, Sparkles } from 'lucide-react';
import { useStore } from '../../store/useStore';
import { Link, useLocation } from 'react-router-dom';

export const Navbar: React.FC = () => {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const location = useLocation();

  const {
    cart,
    setIsCartOpen,
    setIsConsultationOpen,
    siteSettings,
    isAdminAuthenticated,
  } = useStore();

  const totalCartCount = cart.reduce((acc, item) => acc + item.quantity, 0);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const navLinks = [
    { name: 'Home', href: '#home' },
    { name: 'About', href: '#about' },
    { name: 'e-Book', href: '#ebooks' },
    { name: 'Projects', href: '#projects' },
    { name: 'Tutorials', href: '#tutorials' },
    { name: 'Blog', href: '#blog' },
    { name: 'Contact', href: '#contact' },
  ];

  const handleNavClick = (href: string) => {
    setIsMobileMenuOpen(false);
    if (location.pathname !== '/') {
      window.location.href = `/${href}`;
      return;
    }
    const element = document.querySelector(href);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        isScrolled
          ? 'bg-dark-950/85 backdrop-blur-xl border-b border-white/10 py-3 shadow-2xl'
          : 'bg-transparent py-5'
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between">
        {/* Brand Logo */}
        <Link to="/" className="flex items-center gap-2.5 group">
          {siteSettings.logo_type === 'image' && siteSettings.logo_image_url ? (
            <img
              src={siteSettings.logo_image_url}
              alt={siteSettings.logo_text || 'FAZAL'}
              style={{ width: `${siteSettings.logo_width || 120}px` }}
              className="h-auto object-contain transition-transform group-hover:scale-105"
            />
          ) : (
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-xl bg-dark-900 border border-cyber-accent/40 flex items-center justify-center shadow-neon-sm group-hover:border-cyber-accent transition-all">
                <span className="font-mono text-cyber-neon font-black text-lg">F</span>
              </div>
              <div className="flex flex-col">
                <span className="text-xl font-bold tracking-wider font-mono bg-gradient-to-r from-white via-gray-200 to-cyber-neon bg-clip-text text-transparent group-hover:text-cyber-neon transition-colors">
                  {siteSettings.logo_text || 'FAZAL'}
                </span>
                <span className="text-[10px] text-gray-400 font-mono tracking-widest uppercase -mt-1 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-cyber-accent animate-ping" />
                  Portfolio & Store
                </span>
              </div>
            </div>
          )}
        </Link>

        {/* Desktop Nav Links */}
        <nav className="hidden lg:flex items-center gap-8 glass-panel px-6 py-2 rounded-full border border-white/5 shadow-inner">
          {navLinks.map((link) => (
            <button
              key={link.name}
              onClick={() => handleNavClick(link.href)}
              className="text-sm font-medium text-gray-300 hover:text-cyber-neon transition-all relative py-1 group"
            >
              {link.name}
              <span className="absolute bottom-0 left-0 w-0 h-0.5 bg-cyber-accent transition-all duration-300 group-hover:w-full" />
            </button>
          ))}
        </nav>

        {/* Right Header Actions */}
        <div className="flex items-center gap-3">
          {/* Admin shortcut if logged in */}
          {isAdminAuthenticated && (
            <Link
              to="/admin"
              className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cyber-dim border border-cyber-accent/40 text-cyber-neon text-xs font-mono font-medium hover:bg-cyber-accent/20 transition-all"
              title="Admin Dashboard"
            >
              <Shield className="w-3.5 h-3.5" />
              <span>Admin</span>
            </Link>
          )}

          {/* Cart Trigger */}
          <button
            onClick={() => setIsCartOpen(true)}
            className="relative p-2.5 rounded-xl bg-dark-900/90 border border-white/10 hover:border-cyber-accent/50 text-gray-300 hover:text-cyber-neon transition-all group"
            aria-label="View Shopping Cart"
          >
            <ShoppingBag className="w-5 h-5 transition-transform group-hover:scale-110" />
            {totalCartCount > 0 && (
              <span className="absolute -top-1.5 -right-1.5 min-w-5 h-5 px-1 rounded-full bg-cyber-accent text-dark-950 text-xs font-bold flex items-center justify-center shadow-neon-sm animate-pulse">
                {totalCartCount}
              </span>
            )}
          </button>

          {/* Consultation Neon CTA */}
          <button
            onClick={() => setIsConsultationOpen(true)}
            className="hidden sm:inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-cyber-accent text-dark-950 font-semibold text-sm hover:bg-cyber-neon transition-all duration-300 shadow-neon-sm hover:shadow-neon transform hover:-translate-y-0.5 active:translate-y-0"
          >
            <Sparkles className="w-4 h-4 text-dark-950 animate-spin" style={{ animationDuration: '6s' }} />
            <span>Get Consultation</span>
          </button>

          {/* Mobile Menu Toggle */}
          <button
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="lg:hidden p-2.5 rounded-xl bg-dark-900 border border-white/10 text-gray-300 hover:text-white"
            aria-label="Toggle navigation menu"
          >
            {isMobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Drawer Menu */}
      {isMobileMenuOpen && (
        <div className="lg:hidden fixed inset-x-0 top-[65px] bg-dark-950/95 backdrop-blur-2xl border-b border-white/10 px-6 py-6 shadow-2xl transition-all">
          <div className="flex flex-col gap-4">
            {navLinks.map((link) => (
              <button
                key={link.name}
                onClick={() => handleNavClick(link.href)}
                className="text-left py-2 text-base font-medium text-gray-200 hover:text-cyber-neon border-b border-white/5"
              >
                {link.name}
              </button>
            ))}
            <div className="pt-2 flex flex-col gap-3">
              <button
                onClick={() => {
                  setIsMobileMenuOpen(false);
                  setIsConsultationOpen(true);
                }}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-cyber-accent text-dark-950 font-semibold shadow-neon-sm"
              >
                <MessageSquareQuote className="w-4 h-4" />
                <span>Get Consultation</span>
              </button>
              <Link
                to="/admin"
                onClick={() => setIsMobileMenuOpen(false)}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-dark-900 border border-white/10 text-gray-400 hover:text-cyber-neon text-sm font-mono"
              >
                <Shield className="w-4 h-4" />
                <span>Admin Dashboard</span>
              </Link>
            </div>
          </div>
        </div>
      )}
    </header>
  );
};
