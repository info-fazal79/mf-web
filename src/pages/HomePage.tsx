import React, { useEffect } from 'react';
import { Navbar } from '../components/layout/Navbar';
import { Footer } from '../components/layout/Footer';
import { CartDrawer } from '../components/layout/CartDrawer';
import { ConsultationDrawer } from '../components/layout/ConsultationDrawer';
import { Toast } from '../components/layout/Toast';
import { VideoModal } from '../components/ui/VideoModal';
import { BlogModal } from '../components/ui/BlogModal';
import { CheckoutSuccessModal } from '../components/ui/CheckoutSuccessModal';

import { Hero } from '../components/sections/Hero';
import { About } from '../components/sections/About';
import { Experience } from '../components/sections/Experience';
import { Skills } from '../components/sections/Skills';
import { EbookStore } from '../components/sections/EbookStore';
import { Projects } from '../components/sections/Projects';
import { Tutorials } from '../components/sections/Tutorials';
import { BlogSection } from '../components/sections/BlogSection';
import { Testimonials } from '../components/sections/Testimonials';
import Lenis from 'lenis';

export const HomePage: React.FC = () => {
  useEffect(() => {
    // Initialize Lenis Smooth Scrolling
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
    <div className="min-h-screen bg-[#0D0F12] text-gray-100 font-sans selection:bg-cyber-accent selection:text-black">
      {/* Navigation Header */}
      <Navbar />

      {/* Main Content Sections */}
      <main>
        <Hero />
        <About />
        <Experience />
        <Skills />
        <EbookStore />
        <Projects />
        <Tutorials />
        <BlogSection />
        <Testimonials />
      </main>

      {/* Footer */}
      <Footer />

      {/* Interactive Drawers & Modals */}
      <CartDrawer />
      <ConsultationDrawer />
      <VideoModal />
      <BlogModal />
      <CheckoutSuccessModal />
      <Toast />
    </div>
  );
};
