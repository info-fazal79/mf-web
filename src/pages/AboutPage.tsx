import React from 'react';
import { About } from '../components/sections/About';
import { Experience } from '../components/sections/Experience';

export const AboutPage: React.FC = () => {
  return (
    <div className="pt-24 space-y-0">
      {/* 3 Detailed Narrative Cards */}
      <About />

      {/* Experience Timeline */}
      <Experience />
    </div>
  );
};

