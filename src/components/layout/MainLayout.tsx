import React, { useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Navbar } from './Navbar';
import { Footer } from './Footer';
import { CartDrawer } from './CartDrawer';
import { ConsultationDrawer } from './ConsultationDrawer';
import { Toast } from './Toast';
import { VideoModal } from '../ui/VideoModal';
import { CheckoutSuccessModal } from '../ui/CheckoutSuccessModal';
import { ScrollToTop } from './ScrollToTop';
import Lenis from 'lenis';

export const MainLayout: React.FC = () => {
  const location = useLocation();

  useEffect(() => {
    const titles: Record<string, string> = {
      '/': 'Muhammad Fazal',
      '/about': 'About — Muhammad Fazal',
      '/ebooks': 'e-Books — Muhammad Fazal',
      '/store': 'e-Books — Muhammad Fazal',
      '/projects': 'Projects — Muhammad Fazal',
      '/tutorials': 'Tutorials — Muhammad Fazal',
      '/blog': 'Blog — Muhammad Fazal',
      '/contact': 'Contact — Muhammad Fazal',
    };

    if (titles[location.pathname]) {
      document.title = titles[location.pathname];
    } else if (!location.pathname.startsWith('/tutorials/') && !location.pathname.startsWith('/blog/')) {
      document.title = 'Muhammad Fazal';
    }
  }, [location.pathname]);

  useEffect(() => {
    // Initialize Lenis Smooth Scrolling across all public pages
    const lenis = new Lenis({
      duration: 1.2,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      orientation: 'vertical',
      gestureOrientation: 'vertical',
      smoothWheel: true,
    });

    function raf(time: number) {
      lenis.raf(time);
      requestAnimationFrame(raf);
    }

    requestAnimationFrame(raf);

    return () => {
      lenis.destroy();
    };
  }, []);

  return (
    <div className="min-h-screen bg-[#0D0F12] text-gray-100 font-sans selection:bg-cyber-accent selection:text-black flex flex-col">
      <ScrollToTop />
      
      {/* Persistent Global Header */}
      <Navbar />

      {/* Dynamic Page Outlet */}
      <main className="flex-1">
        <Outlet />
      </main>

      {/* Persistent Global Footer */}
      <Footer />

      {/* Global Modals & Drawers */}
      <CartDrawer />
      <ConsultationDrawer />
      <VideoModal />
      <CheckoutSuccessModal />
      <Toast />
    </div>
  );
};
