import React, { useState } from 'react';
import { useStore } from '../../store/useStore';
import { isSupabaseConfigured } from '../../lib/supabase';
import { 
  Shield, 
  LayoutDashboard, 
  BookOpen, 
  FolderGit2, 
  FileText, 
  Users, 
  MessageSquare, 
  Settings, 
  LogOut, 
  ExternalLink,
  Menu,
  X,
  Sparkles,
  Database
} from 'lucide-react';
import { YoutubeIcon } from '../../components/ui/Icons';
import { Link, Navigate } from 'react-router-dom';

import { OverviewTab } from './OverviewTab';
import { EbooksTab } from './EbooksTab';
import { ProjectsTab } from './ProjectsTab';
import { BlogTab } from './BlogTab';
import { TutorialsTab } from './TutorialsTab';
import { ConsultationsTab } from './ConsultationsTab';
import { CommentsTab } from './CommentsTab';
import { SettingsTab } from './SettingsTab';
import { Toast } from '../../components/layout/Toast';

type AdminTab = 
  | 'overview' 
  | 'ebooks' 
  | 'projects' 
  | 'blogs' 
  | 'tutorials' 
  | 'consultations' 
  | 'comments' 
  | 'settings';

export const AdminLayout: React.FC = () => {
  const { 
    isAdminAuthenticated, 
    setAdminAuthenticated, 
    consultations, 
    comments,
    addToast,
    siteSettings 
  } = useStore();

  const [activeTab, setActiveTab] = useState<AdminTab>('overview');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  React.useEffect(() => {
    document.title = 'Admin Dashboard — Muhammad Fazal';
  }, []);

  // Protected route check
  if (!isAdminAuthenticated) {
    return <Navigate to="/admin/login" replace />;
  }

  const isConnected = isSupabaseConfigured();
  const pendingConsultationsCount = consultations.filter((c) => c.status === 'new').length;
  const pendingCommentsCount = comments.filter((c) => !c.is_approved).length;

  const navItems = [
    { id: 'overview', label: 'Overview', icon: <LayoutDashboard className="w-4 h-4" /> },
    { id: 'ebooks', label: 'eBook Store', icon: <BookOpen className="w-4 h-4" /> },
    { id: 'projects', label: 'Projects', icon: <FolderGit2 className="w-4 h-4" /> },
    { id: 'blogs', label: 'Blog Posts', icon: <FileText className="w-4 h-4" /> },
    { id: 'tutorials', label: 'Tutorials', icon: <YoutubeIcon className="w-4 h-4" /> },
    { 
      id: 'consultations', 
      label: 'Consultations', 
      icon: <Users className="w-4 h-4" />,
      badge: pendingConsultationsCount > 0 ? pendingConsultationsCount : undefined,
    },
    { 
      id: 'comments', 
      label: 'Comments', 
      icon: <MessageSquare className="w-4 h-4" />,
      badge: pendingCommentsCount > 0 ? pendingCommentsCount : undefined,
    },
    { id: 'settings', label: 'Site Settings', icon: <Settings className="w-4 h-4" /> },
  ];

  const handleLogout = () => {
    setAdminAuthenticated(false);
    addToast({
      title: 'Signed Out',
      message: 'You have been logged out of the admin console.',
      type: 'info',
    });
  };

  return (
    <div className="min-h-screen bg-dark-950 text-gray-100 flex flex-col font-sans">
      {/* Top Navbar */}
      <header className="h-16 border-b border-white/10 bg-dark-900/80 backdrop-blur-md sticky top-0 z-40 px-4 sm:px-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className="lg:hidden p-2 rounded-lg bg-dark-950 text-gray-400 hover:text-white"
          >
            {isSidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>

          <Link to="/" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-cyber-dim border border-cyber-accent/40 flex items-center justify-center text-cyber-neon font-mono font-bold shadow-neon-sm">
              F
            </div>
            <span className="font-mono font-bold text-white text-lg hidden sm:inline tracking-wider">
              FAZAL ADMIN
            </span>
          </Link>

          {/* Database Status Indicator */}
          <div className="ml-2 sm:ml-4 flex items-center gap-2 px-2.5 py-1 rounded-full bg-dark-950 border border-white/10 text-[11px] font-mono">
            <Database className="w-3 h-3 text-cyber-neon" />
            <span className="text-gray-300 hidden md:inline">Supabase:</span>
            {isConnected ? (
              <span className="text-emerald-400 font-bold flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Live PostgreSQL
              </span>
            ) : (
              <span className="text-amber-400 font-bold flex items-center gap-1" title="Running with local storage seed data">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                Demo Mode (Active)
              </span>
            )}
          </div>
        </div>

        {/* Right Actions */}
        <div className="flex items-center gap-3">
          <a
            href={siteSettings.site_url || 'https://muhammadfazal.com'}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-dark-950 border border-white/10 text-gray-300 hover:text-cyber-neon text-xs font-mono transition-colors"
          >
            <span>View Public Site</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </a>

          <button
            onClick={handleLogout}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 hover:bg-red-500/20 text-xs font-mono transition-colors"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Log Out</span>
          </button>
        </div>
      </header>

      {/* Main Layout Container */}
      <div className="flex-1 flex">
        {/* Sidebar */}
        <aside
          className={`fixed lg:static inset-y-16 left-0 z-30 w-64 bg-dark-900 border-r border-white/10 p-4 flex flex-col justify-between transition-transform duration-300 ${
            isSidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
          }`}
        >
          <div className="space-y-1">
            <div className="px-3 py-2 text-[10px] font-mono text-gray-500 uppercase tracking-widest">
              Navigation Modules
            </div>

            {navItems.map((item) => (
              <button
                key={item.id}
                onClick={() => {
                  setActiveTab(item.id as AdminTab);
                  setIsSidebarOpen(false);
                }}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-mono font-medium transition-all ${
                  activeTab === item.id
                    ? 'bg-cyber-accent text-dark-950 font-bold shadow-neon-sm'
                    : 'text-gray-400 hover:text-white hover:bg-dark-950'
                }`}
              >
                <div className="flex items-center gap-3">
                  {item.icon}
                  <span>{item.label}</span>
                </div>
                {item.badge !== undefined && (
                  <span
                    className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                      activeTab === item.id
                        ? 'bg-dark-950 text-white'
                        : 'bg-cyber-accent text-dark-950'
                    }`}
                  >
                    {item.badge}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Admin Profile Footnote */}
          <div className="p-3 rounded-xl bg-dark-950 border border-white/5 flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg overflow-hidden border border-cyber-accent/40 shrink-0">
              <img
                src="/fazal.jpg"
                alt="Muhammad Fazal"
                className="w-full h-full object-cover object-center"
              />
            </div>
            <div className="min-w-0">
              <div className="text-xs font-bold text-white font-mono truncate">Muhammad Fazal</div>
              <div className="text-[10px] text-cyber-neon font-mono truncate">Full Administrator</div>
            </div>
          </div>
        </aside>

        {/* Content Area */}
        <main className="flex-1 p-6 sm:p-8 lg:p-10 max-w-7xl overflow-y-auto">
          {activeTab === 'overview' && <OverviewTab />}
          {activeTab === 'ebooks' && <EbooksTab />}
          {activeTab === 'projects' && <ProjectsTab />}
          {activeTab === 'blogs' && <BlogTab />}
          {activeTab === 'tutorials' && <TutorialsTab />}
          {activeTab === 'consultations' && <ConsultationsTab />}
          {activeTab === 'comments' && <CommentsTab />}
          {activeTab === 'settings' && <SettingsTab />}
        </main>
      </div>

      <Toast />
    </div>
  );
};
