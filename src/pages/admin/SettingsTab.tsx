import React, { useState, useRef } from 'react';
import { useStore } from '../../store/useStore';
import { Settings, Save, Sparkles, Image, Type, Link2, Download, Mail, Upload, FileUp, CheckCircle2, ExternalLink, Loader2 } from 'lucide-react';
import { supabase, isSupabaseConfigured } from '../../lib/supabase';
import { ImageUpload } from '../../components/admin/ImageUpload';
import { uploadPdfFile } from '../../services/storage';

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
  });

  const [isSaving, setIsSaving] = useState(false);
  const [isUploadingPdf, setIsUploadingPdf] = useState(false);
  const [uploadedPdfName, setUploadedPdfName] = useState('');
  const pdfInputRef = useRef<HTMLInputElement>(null);

  const handlePdfUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.toLowerCase().endsWith('.pdf') && file.type !== 'application/pdf') {
      alert('Please select a valid .pdf document.');
      if (pdfInputRef.current) pdfInputRef.current.value = '';
      return;
    }

    try {
      setIsUploadingPdf(true);
      const publicUrl = await uploadPdfFile(file, 'resumes');
      setForm((prev) => ({ ...prev, cv_url: publicUrl }));
      setUploadedPdfName(file.name);
      addToast({
        title: 'CV Uploaded',
        message: `"${file.name}" uploaded to storage successfully.`,
        type: 'success',
      });
    } catch (err: any) {
      console.error('PDF upload error:', err);
      alert('Failed to upload PDF. Please try again or enter a direct link.');
    } finally {
      setIsUploadingPdf(false);
      if (pdfInputRef.current) pdfInputRef.current.value = '';
    }
  };

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

          <div className="space-y-5">
            <div>
              <label className="block text-xs font-mono text-gray-300 uppercase mb-2">
                Logo Display Mode
              </label>
              <div className="grid grid-cols-2 gap-2 max-w-xs">
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
                  className="w-full max-w-md px-3.5 py-2.5 rounded-xl bg-dark-950 border border-white/10 text-white text-xs font-mono focus:border-cyber-accent focus:outline-none"
                />
              </div>
            ) : (
              <div className="space-y-4">
                {/* Direct File Upload Zone */}
                <ImageUpload
                  label="Brand Logo Upload"
                  value={form.logo_image_url}
                  onChange={(url) => setForm({ ...form, logo_image_url: url })}
                  folder="logos"
                  helperText="Upload PNG, SVG, WebP, or JPG. SVGs preserve sharp vector scaling; raster images are automatically compressed to WebP."
                />

                {/* Direct URL Input fallback / manual entry */}
                <div>
                  <label className="block text-xs font-mono text-gray-300 uppercase mb-1">
                    Or Direct Logo Image URL
                  </label>
                  <input
                    type="url"
                    value={form.logo_image_url}
                    onChange={(e) => setForm({ ...form, logo_image_url: e.target.value })}
                    placeholder="https://.../logo.png (or paste external/SVG URL)"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-dark-950 border border-white/10 text-white text-xs font-mono focus:border-cyber-accent focus:outline-none"
                  />
                </div>
              </div>
            )}

            {/* Logo Width Slider */}
            <div className="pt-2 border-t border-white/10">
              <div className="flex items-center justify-between mb-2">
                <label className="block text-xs font-mono text-gray-300 uppercase">
                  Logo Rendered Width: <span className="text-cyber-neon font-bold">{form.logo_width}px</span>
                </label>
                <span className="text-[11px] font-mono text-gray-500">Min 60px — Max 300px</span>
              </div>
              <input
                type="range"
                min="60"
                max="300"
                value={form.logo_width}
                onChange={(e) => setForm({ ...form, logo_width: parseInt(e.target.value) || 120 })}
                className="w-full accent-cyber-accent cursor-pointer"
              />
            </div>

            {/* Interactive Live Logo Preview Box */}
            <div className="p-4 rounded-xl bg-dark-950/80 border border-white/10 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono font-bold text-gray-300 uppercase flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-cyber-neon" />
                  <span>Live Header Navbar Preview</span>
                </span>
                <span className="text-[10px] font-mono text-cyber-neon bg-cyber-dim px-2 py-0.5 rounded border border-cyber-accent/30">
                  {form.logo_width}px applied
                </span>
              </div>

              <div className="p-4 rounded-xl bg-dark-900 border border-white/5 flex items-center justify-between min-h-[72px] overflow-hidden">
                <div className="flex items-center">
                  {form.logo_type === 'image' ? (
                    form.logo_image_url ? (
                      <img
                        src={form.logo_image_url}
                        alt={form.logo_text || 'Brand Logo'}
                        style={{ width: `${form.logo_width}px` }}
                        className="h-auto max-h-16 object-contain transition-all"
                      />
                    ) : (
                      <div className="text-xs font-mono text-gray-500 italic py-2">
                        No logo image selected. Drop a file above or enter a URL to preview.
                      </div>
                    )
                  ) : (
                    <div className="flex items-center gap-2.5">
                      <div className="w-9 h-9 rounded-xl bg-dark-950 border border-cyber-accent/40 flex items-center justify-center shadow-neon-sm">
                        <span className="font-mono text-cyber-neon font-black text-lg">
                          {form.logo_text ? form.logo_text.charAt(0).toUpperCase() : 'F'}
                        </span>
                      </div>
                      <span className="text-xl font-bold tracking-wider font-mono bg-gradient-to-r from-white via-gray-200 to-cyber-neon bg-clip-text text-transparent">
                        {form.logo_text || 'FAZAL'}
                      </span>
                    </div>
                  )}
                </div>

                <div className="hidden sm:flex items-center gap-4 text-xs font-mono text-gray-500">
                  <span>Home</span>
                  <span>About</span>
                  <span>Projects</span>
                  <span className="px-2.5 py-1 rounded-lg bg-cyber-dim border border-cyber-accent/30 text-cyber-neon text-[10px] font-bold">
                    Navbar Simulation
                  </span>
                </div>
              </div>
            </div>
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
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-mono text-gray-300 uppercase">
                  CV / Resume Download URL *
                </label>
                <button
                  type="button"
                  onClick={() => pdfInputRef.current?.click()}
                  disabled={isUploadingPdf}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-cyber-dim border border-cyber-accent/40 text-cyber-neon hover:bg-cyber-accent/20 text-[11px] font-mono font-bold transition-all disabled:opacity-50"
                  title="Choose PDF from computer"
                >
                  {isUploadingPdf ? (
                    <>
                      <Loader2 className="w-3 h-3 animate-spin" />
                      <span>Uploading PDF...</span>
                    </>
                  ) : (
                    <>
                      <FileUp className="w-3 h-3" />
                      <span>Upload CV (PDF)</span>
                    </>
                  )}
                </button>
              </div>

              {/* Hidden PDF File Input */}
              <input
                ref={pdfInputRef}
                type="file"
                accept=".pdf,application/pdf"
                className="hidden"
                onChange={handlePdfUpload}
              />

              {/* Manual URL Input with action shortcuts */}
              <div className="relative">
                <input
                  type="url"
                  required
                  value={form.cv_url}
                  onChange={(e) => setForm({ ...form, cv_url: e.target.value })}
                  placeholder="https://... or click 'Upload CV (PDF)'"
                  className="w-full pl-3.5 pr-20 py-2.5 rounded-xl bg-dark-950 border border-white/10 text-white text-xs font-mono focus:border-cyber-accent focus:outline-none"
                />
                <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => pdfInputRef.current?.click()}
                    disabled={isUploadingPdf}
                    className="p-1 rounded-lg text-gray-400 hover:text-cyber-neon hover:bg-dark-900 transition-colors"
                    title="Upload PDF from device"
                  >
                    <Upload className="w-3.5 h-3.5" />
                  </button>
                  {form.cv_url && (
                    <a
                      href={form.cv_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-1 rounded-lg text-gray-400 hover:text-cyber-neon hover:bg-dark-900 transition-colors"
                      title="Open CV file in new tab"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  )}
                </div>
              </div>

              {/* Uploaded Badge / Preview */}
              {form.cv_url && (
                <div className="flex items-center justify-between px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-mono">
                  <span className="flex items-center gap-1.5 truncate">
                    <CheckCircle2 className="w-3.5 h-3.5 shrink-0 text-emerald-400" />
                    <span className="truncate">
                      ✓ CV Active: {uploadedPdfName || (form.cv_url.split('/').pop()?.split('?')[0] || 'Resume.pdf')}
                    </span>
                  </span>
                  <a
                    href={form.cv_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="shrink-0 underline hover:text-white ml-2 flex items-center gap-1 text-[11px] font-bold"
                  >
                    <span>View</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              )}
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
                Facebook Profile URL
              </label>
              <input
                type="url"
                value={form.facebook}
                onChange={(e) => setForm({ ...form, facebook: e.target.value })}
                placeholder="https://facebook.com/your-username"
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
