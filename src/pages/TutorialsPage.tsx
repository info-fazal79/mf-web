import React from 'react';
import { Tutorials } from '../components/sections/Tutorials';

export const TutorialsPage: React.FC = () => {
  return (
    <div className="pt-24 space-y-0">
      {/* Main Filterable Tutorials Section */}
      <Tutorials />
    </div>
  );
};

