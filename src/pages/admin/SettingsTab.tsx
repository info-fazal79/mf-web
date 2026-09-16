import React, { useState } from 'react';
import { useStore } from '../../store/useStore';
import { Settings, Save, Sparkles, Image, Type, Link2, Download, Mail } from 'lucide-react';
import { supabase, isSupabaseConfigured } from '../../lib/supabase';

export const SettingsTab: React.FC = () => {
  const { siteSettings, setSiteSettings, addToast } = useStore();

  const [form, setForm] = useState({
    logo_type: siteSettings.logo_type || 'text',
    logo_text: siteSettings.logo_text || 'FAZAL',
    logo_image_url: siteSettings.logo_image_url || '',
    logo_width: siteSettings.logo_width || 120,
    hero_title: siteSettings.hero_title,
    hero_bio: siteSettings.hero_bio,
    cv_url: siteSettings.cv_url,
    contact_email: siteSettings.contact_email,
    facebook: siteSettings.social_links?.facebook || '',
    linkedin: siteSettings.social_links?.linkedin || '',
    youtube: siteSettings.social_links?.youtube || '',
    github: siteSettings.social_links?.github || '',
    fiverr: siteSettings.social_links?.fiverr || '',
  });

  const [isSaving, setIsSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);

    const updatedSettings = {
      logo_type: form.logo_type as 'text' | 'image',
      logo_text: form.logo_text,
      logo_image_url: form.logo_image_url,
      logo_width: Number(form.logo_width),
      hero_title: form.hero_title,
      hero_bio: form.hero_bio,
      cv_url: form.cv_url,
      contact_email: form.contact_email,
      social_links: {
        facebook: form.facebook,
        linkedin: form.linkedin,
        youtube: form.youtube,
        github: form.github,
        fiverr: form.fiverr,
      },
    };

    try {
      setSiteSettings(updatedSettings);

      if (isSupabaseConfigured()) {
        const { error } = await supabase
          .from('site_settings')
          .update(updatedSettings)
          .eq('id', 1);
        if (error) console.error('Supabase settings update error:', error);
      }

      addToast({
        title: 'Settings Saved',
        message: 'Brand and site settings updated across the platform.',
        type: 'success',
      });
    } catch (err) {
      console.error('Settings error:', err);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold text-white font-mono flex items-center gap-2">
          <Settings className="w-5 h-5 text-cyber-neon" />
          <span>Brand & Global Site Configuration</span>
        </h2>
        <p className="text-xs text-gray-400">
          Manage brand logo, dimensions, CV download link, and social profiles.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-8">
        {/* Logo Configuration */}
        <div className="glass-panel p-6 rounded-2xl border border-white/10 space-y-5">
          <h3 className="text-sm font-bold text-white font-mono uppercase tracking-wider flex items-center gap-2">
            <Type className="w-4 h-4 text-cyber-neon" />
            <span>Brand Logo Customization</span>
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-mono text-gray-300 uppercase mb-2">
                Logo Display Mode
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setForm({ ...form, logo_type: 'text' })}
                  className={`py-2 px-3 rounded-xl border text-xs font-mono font-bold flex items-center justify-center gap-2 transition-all ${
                    form.logo_type === 'text'
                      ? 'bg-cyber-accent text-dark-950 border-cyber-accent shadow-neon-sm'
                      : 'bg-dark-950 text-gray-400 border-white/10 hover:text-white'
                  }`}
                >
                  <Type className="w-3.5 h-3.5" />
                  <span>Custom Text</span>
                </button>

                <button
                  type="button"
                  onClick={() => setForm({ ...form, logo_type: 'image' })}
                  className={`py-2 px-3 rounded-xl border text-xs font-mono font-bold flex items-center justify-center gap-2 transition-all ${
                    form.logo_type === 'image'
                      ? 'bg-cyber-accent text-dark-950 border-cyber-accent shadow-neon-sm'
                      : 'bg-dark-950 text-gray-400 border-white/10 hover:text-white'
                  }`}
                >
                  <Image className="w-3.5 h-3.5" />
                  <span>Uploaded Image</span>
                </button>
              </div>
            </div>

            {form.logo_type === 'text' ? (
              <div>
                <label className="block text-xs font-mono text-gray-300 uppercase mb-1">
                  Brand Text Name
                </label>
                <input
                  type="text"
                  value={form.logo_text}
                  onChange={(e) => setForm({ ...form, logo_text: e.target.value })}
                  placeholder="FAZAL"
                  className="w-full px-3 py-2 rounded-xl bg-dark-950 border border-white/10 text-white text-xs font-mono focus:border-cyber-accent focus:outline-none"
                />
              </div>
            ) : (
              <div>
                <label className="block text-xs font-mono text-gray-300 uppercase mb-1">
                  Logo Image URL (SVG/PNG)
                </label>
                <input
                  type="url"
                  value={form.logo_image_url}
                  onChange={(e) => setForm({ ...form, logo_image_url: e.target.value })}
                  placeholder="https://.../logo.png"
                  className="w-full px-3 py-2 rounded-xl bg-dark-950 border border-white/10 text-white text-xs focus:border-cyber-accent focus:outline-none"
                />
              </div>
            )}
          </div>

          <div>
            <label className="block text-xs font-mono text-gray-300 uppercase mb-1">
              Logo Width: {form.logo_width}px
            </label>
            <input
              type="range"
              min="80"
              max="240"
              value={form.logo_width}
              onChange={(e) => setForm({ ...form, logo_width: parseInt(e.target.value) || 120 })}
              className="w-full accent-cyber-accent"
            />
          </div>
        </div>

        {/* Hero & Resume */}
        <div className="glass-panel p-6 rounded-2xl border border-white/10 space-y-5">
          <h3 className="text-sm font-bold text-white font-mono uppercase tracking-wider flex items-center gap-2">
            <Download className="w-4 h-4 text-cyber-neon" />
            <span>Hero Content & CV Link</span>
          </h3>

          <div>
            <label className="block text-xs font-mono text-gray-300 uppercase mb-1">
              Hero Heading
            </label>
            <input
              type="text"
              value={form.hero_title}
              onChange={(e) => setForm({ ...form, hero_title: e.target.value })}
              className="w-full px-3 py-2 rounded-xl bg-dark-950 border border-white/10 text-white text-xs focus:border-cyber-accent focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-mono text-gray-300 uppercase mb-1">
              Hero Bio Narrative
            </label>
            <textarea
              rows={4}
              value={form.hero_bio}
              onChange={(e) => setForm({ ...form, hero_bio: e.target.value })}
              className="w-full p-3 rounded-xl bg-dark-950 border border-white/10 text-white text-xs focus:border-cyber-accent focus:outline-none resize-none leading-relaxed"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-mono text-gray-300 uppercase mb-1">
                CV / Resume Download URL *
              </label>
              <input
                type="url"
                required
                value={form.cv_url}
                onChange={(e) => setForm({ ...form, cv_url: e.target.value })}
                placeholder="https://..."
                className="w-full px-3 py-2 rounded-xl bg-dark-950 border border-white/10 text-white text-xs focus:border-cyber-accent focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-mono text-gray-300 uppercase mb-1">
                Contact Email Address
              </label>
              <input
                type="email"
                value={form.contact_email}
                onChange={(e) => setForm({ ...form, contact_email: e.target.value })}
                placeholder="contact@muhammadfazal.com"
                className="w-full px-3 py-2 rounded-xl bg-dark-950 border border-white/10 text-white text-xs focus:border-cyber-accent focus:outline-none"
              />
            </div>
          </div>
        </div>

        {/* Social Media Links */}
        <div className="glass-panel p-6 rounded-2xl border border-white/10 space-y-5">
          <h3 className="text-sm font-bold text-white font-mono uppercase tracking-wider flex items-center gap-2">
            <Link2 className="w-4 h-4 text-cyber-neon" />
            <span>Social Profile URLs</span>
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-mono text-gray-300 uppercase mb-1">
                LinkedIn URL
              </label>
              <input
                type="url"
                value={form.linkedin}
                onChange={(e) => setForm({ ...form, linkedin: e.target.value })}
                placeholder="https://linkedin.com/in/..."
                className="w-full px-3 py-2 rounded-xl bg-dark-950 border border-white/10 text-white text-xs focus:border-cyber-accent focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-mono text-gray-300 uppercase mb-1">
                GitHub URL
              </label>
              <input
                type="url"
                value={form.github}
                onChange={(e) => setForm({ ...form, github: e.target.value })}
                placeholder="https://github.com/..."
                className="w-full px-3 py-2 rounded-xl bg-dark-950 border border-white/10 text-white text-xs focus:border-cyber-accent focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-mono text-gray-300 uppercase mb-1">
                YouTube URL
              </label>
              <input
                type="url"
                value={form.youtube}
                onChange={(e) => setForm({ ...form, youtube: e.target.value })}
                placeholder="https://youtube.com/@..."
                className="w-full px-3 py-2 rounded-xl bg-dark-950 border border-white/10 text-white text-xs focus:border-cyber-accent focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-mono text-gray-300 uppercase mb-1">
                Fiverr Profile URL
              </label>
              <input
                type="url"
                value={form.fiverr}
                onChange={(e) => setForm({ ...form, fiverr: e.target.value })}
                placeholder="https://fiverr.com/..."
                className="w-full px-3 py-2 rounded-xl bg-dark-950 border border-white/10 text-white text-xs focus:border-cyber-accent focus:outline-none"
              />
            </div>
          </div>
        </div>

        {/* Submit */}
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={isSaving}
            className="flex items-center gap-2 px-6 py-3 rounded-xl bg-cyber-accent text-dark-950 font-bold font-mono text-sm hover:bg-cyber-neon transition-all shadow-neon hover:shadow-neon-lg disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            <span>{isSaving ? 'Saving Changes...' : 'Save Site Settings'}</span>
          </button>
        </div>
      </form>
    </div>
  );
};
