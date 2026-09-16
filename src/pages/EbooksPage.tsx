import React from 'react';
import { EbookStore } from '../components/sections/EbookStore';

export const EbooksPage: React.FC = () => {
  return (
    <div className="pt-24 space-y-0">
      {/* Main eBook Store Grid */}
      <EbookStore />
    </div>
  );
};

