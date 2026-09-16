import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { HomePage } from './pages/HomePage';
import { AdminLogin } from './pages/admin/AdminLogin';
import { AdminLayout } from './pages/admin/AdminLayout';
import { useSupabaseData } from './hooks/useSupabaseData';

export const App: React.FC = () => {
  // Sync Supabase backend data or fallback on mount
  useSupabaseData();

  return (
    <BrowserRouter>
      <Routes>
        {/* Public Portfolio & Digital Store */}
        <Route path="/" element={<HomePage />} />

        {/* Admin Authentication */}
        <Route path="/admin/login" element={<AdminLogin />} />

        {/* Secure Admin Dashboard */}
        <Route path="/admin/*" element={<AdminLayout />} />

        {/* Fallback to Home */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
};

export default App;
