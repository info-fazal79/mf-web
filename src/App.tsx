import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { MainLayout } from './components/layout/MainLayout';
import { HomePage } from './pages/HomePage';
import { AboutPage } from './pages/AboutPage';
import { EbooksPage } from './pages/EbooksPage';
import { ProjectsPage } from './pages/ProjectsPage';
import { TutorialsPage } from './pages/TutorialsPage';
import { PlaylistCoursePage } from './pages/PlaylistCoursePage';
import { BlogPage } from './pages/BlogPage';
import { BlogPostPage } from './pages/BlogPostPage';
import { ContactPage } from './pages/ContactPage';
import { AdminLogin } from './pages/admin/AdminLogin';
import { AdminLayout } from './pages/admin/AdminLayout';
import { MaintenanceGuard } from './components/MaintenanceGuard';
import { useSupabaseData } from './hooks/useSupabaseData';

export const App: React.FC = () => {
  // Synchronize Supabase database entities on mount
  useSupabaseData();

  return (
    <BrowserRouter>
      <Routes>
        {/* Public Multi-Page Routes Wrapped in MaintenanceGuard & MainLayout */}
        <Route
          path="/"
          element={
            <MaintenanceGuard>
              <MainLayout />
            </MaintenanceGuard>
          }
        >
          <Route index element={<HomePage />} />
          <Route path="about" element={<AboutPage />} />
          <Route path="ebooks" element={<EbooksPage />} />
          <Route path="store" element={<Navigate to="/ebooks" replace />} />
          <Route path="projects" element={<ProjectsPage />} />
          <Route path="tutorials" element={<TutorialsPage />} />
          <Route path="tutorials/:slug" element={<PlaylistCoursePage />} />
          <Route path="blog" element={<BlogPage />} />
          <Route path="blog/:slug" element={<BlogPostPage />} />
          <Route path="contact" element={<ContactPage />} />
        </Route>

        {/* Admin Portal Routes */}
        <Route path="/admin/login" element={<AdminLogin />} />
        <Route path="/admin/*" element={<AdminLayout />} />

        {/* Catch-all Fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
};

export default App;
