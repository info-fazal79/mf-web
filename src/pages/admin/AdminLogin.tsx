import React, { useState } from 'react';
import { Shield, Lock, Mail, ArrowRight, Sparkles, AlertCircle } from 'lucide-react';
import { supabase, isSupabaseConfigured } from '../../lib/supabase';
import { useStore } from '../../store/useStore';
import { Link, useNavigate } from 'react-router-dom';

export const AdminLogin: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [loading, setLoading] = useState(false);

  const { setAdminAuthenticated, addToast } = useStore();
  const navigate = useNavigate();

  React.useEffect(() => {
    document.title = 'Admin Login — Muhammad Fazal';
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setLoading(true);

    try {
      if (isSupabaseConfigured()) {
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
        if (data.session) {
          setAdminAuthenticated(true);
          addToast({
            title: 'Welcome Back, Fazal!',
            message: 'Authenticated via Supabase Auth successfully.',
            type: 'success',
          });
          navigate('/admin');
          return;
        }
      }

      // Default demo login check
      if (email === 'admin@fazal.dev' && password === 'admin123') {
        setAdminAuthenticated(true);
        addToast({
          title: 'Demo Admin Session Started',
          message: 'Logged in with Demo privileges.',
          type: 'success',
        });
        navigate('/admin');
      } else {
        // In demo mode, inform user of demo credentials
        setErrorMsg('Invalid credentials. Use admin@fazal.dev / admin123 or 1-Click Demo Login below.');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to authenticate');
    } finally {
      setLoading(false);
    }
  };

  const handleQuickDemoLogin = () => {
    setAdminAuthenticated(true);
    addToast({
      title: 'Demo Access Granted',
      message: 'Logged into FAZAL Admin Dashboard.',
      type: 'success',
    });
    navigate('/admin');
  };

  return (
    <div className="min-h-screen bg-dark-950 flex items-center justify-center p-4 relative overflow-hidden cyber-grid-bg">
      {/* Background glow */}
      <div className="absolute w-96 h-96 bg-cyber-accent/10 rounded-full blur-[140px] pointer-events-none" />

      <div className="w-full max-w-md relative z-10">
        <div className="glass-panel p-8 sm:p-10 rounded-3xl border border-white/10 shadow-2xl space-y-7">
          {/* Header */}
          <div className="text-center space-y-2">
            <div className="mx-auto w-14 h-14 rounded-2xl bg-dark-900 border border-cyber-accent/40 flex items-center justify-center text-cyber-neon shadow-neon-sm">
              <Shield className="w-7 h-7" />
            </div>
            <h1 className="text-2xl font-extrabold text-white font-mono tracking-wider">
              FAZAL ADMIN PORTAL
            </h1>
            <p className="text-xs text-gray-400 font-mono">
              Authenticate to manage portfolio, store, and inquiries
            </p>
          </div>

          {errorMsg && (
            <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-mono text-gray-300 uppercase mb-1.5">
                Admin Email
              </label>
              <div className="relative">
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@fazal.dev"
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-dark-950 border border-white/10 text-white placeholder-gray-500 text-sm focus:border-cyber-accent focus:outline-none"
                />
                <Mail className="w-4 h-4 text-gray-500 absolute left-3.5 top-3.5" />
              </div>
            </div>

            <div>
              <label className="block text-xs font-mono text-gray-300 uppercase mb-1.5">
                Password
              </label>
              <div className="relative">
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-dark-950 border border-white/10 text-white placeholder-gray-500 text-sm focus:border-cyber-accent focus:outline-none"
                />
                <Lock className="w-4 h-4 text-gray-500 absolute left-3.5 top-3.5" />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-xl bg-cyber-accent text-dark-950 font-mono font-bold text-sm tracking-wider hover:bg-cyber-neon transition-all shadow-neon hover:shadow-neon-lg flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {loading ? (
                <span>Authenticating...</span>
              ) : (
                <>
                  <span>Sign In</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {/* 1-Click Demo Login Button */}
          <div className="pt-2 border-t border-white/5 space-y-3">
            <button
              type="button"
              onClick={handleQuickDemoLogin}
              className="w-full py-2.5 rounded-xl bg-dark-900 border border-cyber-accent/30 hover:border-cyber-accent text-cyber-neon font-mono text-xs font-semibold flex items-center justify-center gap-2 hover:bg-cyber-dim transition-all"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>1-Click Demo Access</span>
            </button>
            <div className="text-center">
              <Link to="/" className="text-xs text-gray-500 hover:text-gray-300 font-mono">
                &larr; Return to Public Website
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
