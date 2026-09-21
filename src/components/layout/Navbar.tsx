import React, { useState, useEffect } from 'react';
import { ShoppingBag, MessageSquareQuote, Menu, X, Shield, Sparkles } from 'lucide-react';
import { useStore } from '../../store/useStore';
import { Link, NavLink, useLocation } from 'react-router-dom';

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

  // Close mobile menu on route change
  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [location.pathname]);

  const navLinks = [
    { name: 'Home', to: '/' },
    { name: 'About', to: '/about' },
    { name: 'e-Book', to: '/ebooks' },
    { name: 'Projects', to: '/projects' },
    { name: 'Tutorials', to: '/tutorials' },
    { name: 'Blog', to: '/blog' },
    { name: 'Contact', to: '/contact' },
  ];

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        isScrolled
          ? 'bg-dark-950/90 backdrop-blur-xl border-b border-white/10 py-3 shadow-2xl'
          : 'bg-dark-950/60 backdrop-blur-md border-b border-white/5 py-4'
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
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-dark-900 border border-cyber-accent/40 flex items-center justify-center shadow-neon-sm group-hover:border-cyber-accent transition-all">
                <span className="font-mono text-cyber-neon font-black text-lg">F</span>
              </div>
              <span className="text-xl font-bold tracking-wider font-mono bg-gradient-to-r from-white via-gray-200 to-cyber-neon bg-clip-text text-transparent group-hover:text-cyber-neon transition-colors">
                {siteSettings.logo_text || 'FAZAL'}
              </span>
            </div>
          )}
        </Link>

        {/* Desktop Nav Links - Clean natural text menu with neon underline on hover */}
        <nav className="hidden lg:flex items-center gap-8">
          {navLinks.map((link) => (
            <NavLink
              key={link.name}
              to={link.to}
              end={link.to === '/'}
              className={({ isActive }) =>
                `text-sm font-medium transition-colors relative py-1.5 group ${
                  isActive
                    ? 'text-cyber-neon font-semibold'
                    : 'text-gray-300 hover:text-cyber-neon'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <span>{link.name}</span>
                  <span
                    className={`absolute bottom-0 left-0 h-0.5 bg-[#00E599] transition-all duration-300 ${
                      isActive ? 'w-full shadow-neon-sm' : 'w-0 group-hover:w-full'
                    }`}
                  />
                </>
              )}
            </NavLink>
          ))}
        </nav>

        {/* Right Header Actions */}
        <div className="flex items-center gap-3 sm:gap-4">
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

          {/* Cart Trigger - only visible when totalCartCount > 0, simple icon link without border or background */}
          {totalCartCount > 0 && (
            <button
              onClick={() => setIsCartOpen(true)}
              className="relative p-1.5 text-gray-300 hover:text-cyber-neon transition-colors group"
              aria-label="View Shopping Cart"
            >
              <ShoppingBag className="w-5 h-5 transition-transform group-hover:scale-110" />
              <span className="absolute -top-1 -right-1.5 min-w-4 h-4 px-1 rounded-full bg-cyber-accent text-dark-950 text-[10px] font-bold flex items-center justify-center shadow-neon-sm animate-pulse">
                {totalCartCount}
              </span>
            </button>
          )}

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
            className="lg:hidden p-2 text-gray-300 hover:text-white"
            aria-label="Toggle navigation menu"
          >
            {isMobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Drawer Menu */}
      {isMobileMenuOpen && (
        <div className="lg:hidden fixed inset-x-0 top-[69px] bg-dark-950/95 backdrop-blur-2xl border-b border-white/10 px-6 py-6 shadow-2xl transition-all max-h-[85vh] overflow-y-auto">
          <div className="flex flex-col gap-3">
            {navLinks.map((link) => (
              <NavLink
                key={link.name}
                to={link.to}
                end={link.to === '/'}
                onClick={() => setIsMobileMenuOpen(false)}
                className={({ isActive }) =>
                  `flex items-center justify-between py-2 text-sm font-medium transition-colors ${
                    isActive
                      ? 'text-cyber-neon font-bold'
                      : 'text-gray-300 hover:text-cyber-neon'
                  }`
                }
              >
                <span>{link.name}</span>
                <span className="text-xs text-cyber-neon">&rarr;</span>
              </NavLink>
            ))}

            <div className="pt-4 border-t border-white/10 flex flex-col gap-3">
              <button
                onClick={() => {
                  setIsMobileMenuOpen(false);
                  setIsConsultationOpen(true);
                }}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-cyber-accent text-dark-950 font-semibold shadow-neon-sm font-mono text-sm"
              >
                <MessageSquareQuote className="w-4 h-4" />
                <span>Get Consultation</span>
              </button>

              {isAdminAuthenticated && (
                <Link
                  to="/admin"
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-dark-900 border border-white/10 text-gray-400 hover:text-cyber-neon text-sm font-mono"
                >
                  <Shield className="w-4 h-4" />
                  <span>Admin Dashboard</span>
                </Link>
              )}
            </div>
          </div>
        </div>
      )}
    </header>
  );
};
