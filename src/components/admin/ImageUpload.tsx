import React, { useState, useRef } from 'react';
import { UploadCloud, Image as ImageIcon, X, Check, Loader2, Link2, Sparkles } from 'lucide-react';
import { uploadImageFile, StorageFolder } from '../../services/storage';
import { formatFileSize } from '../../utils/imageCompressor';

interface ImageUploadProps {
  label: string;
  value: string;
  onChange: (url: string) => void;
  folder: StorageFolder;
  aspectRatio?: 'video' | 'cover' | 'square' | 'wide' | 'auto';
  helperText?: string;
  required?: boolean;
}

export const ImageUpload: React.FC<ImageUploadProps> = ({
  label,
  value,
  onChange,
  folder,
  aspectRatio = 'auto',
  helperText,
  required = false,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [stats, setStats] = useState<{
    originalSize: number;
    compressedSize: number;
    ratio: string;
  } | null>(null);
  const [showManualUrl, setShowManualUrl] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = async (file: File) => {
    if (!file.type.startsWith('image/') && !file.name.toLowerCase().endsWith('.svg')) {
      alert('Please upload a valid image file (JPG, PNG, WebP, SVG, etc.).');
      return;
    }

    try {
      setIsUploading(true);
      setStats(null);

      const result = await uploadImageFile(file, folder, {
        maxWidth: 1600,
        quality: 0.82,
      });

      onChange(result.url);
      setStats({
        originalSize: result.originalSize,
        compressedSize: result.compressedSize,
        ratio: result.compressionRatio,
      });
    } catch (err: any) {
      console.error('Image compression / upload failed:', err);
      alert('Failed to compress and upload image. Please try again or paste a URL manually.');
    } finally {
      setIsUploading(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange('');
    setStats(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="block text-xs font-mono text-gray-300 uppercase">
          {label} {required && <span className="text-red-400">*</span>}
        </label>
        <button
          type="button"
          onClick={() => setShowManualUrl(!showManualUrl)}
          className="text-[11px] font-mono text-cyber-neon hover:underline flex items-center gap-1 transition-colors"
        >
          <Link2 className="w-3 h-3" />
          <span>{showManualUrl ? 'Use File Upload' : 'Paste Direct URL'}</span>
        </button>
      </div>

      {showManualUrl ? (
        <div className="space-y-1.5">
          <input
            type="url"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder="https://..."
            required={required}
            className="w-full px-3 py-2 rounded-xl bg-dark-950 border border-white/10 text-white text-xs font-mono focus:border-cyber-accent focus:outline-none"
          />
          <p className="text-[11px] text-gray-500 font-sans">
            Paste an existing public image URL (Unsplash, Cloudinary, etc.)
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {/* Upload Drop Zone / Preview Card */}
          <div
            onClick={() => !isUploading && fileInputRef.current?.click()}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            className={`relative group rounded-xl border-2 border-dashed transition-all cursor-pointer overflow-hidden p-4 ${
              isDragging
                ? 'border-cyber-accent bg-cyber-dim/40 shadow-neon-sm'
                : value
                ? 'border-white/15 bg-dark-950/80 hover:border-cyber-accent/40'
                : 'border-white/10 bg-dark-950/50 hover:border-white/25 hover:bg-dark-950/80'
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,.svg"
              className="hidden"
              onChange={(e) => {
                if (e.target.files && e.target.files.length > 0) {
                  handleFile(e.target.files[0]);
                }
              }}
            />

            {isUploading ? (
              <div className="py-6 flex flex-col items-center justify-center gap-2 text-center">
                <Loader2 className="w-6 h-6 text-cyber-neon animate-spin" />
                <div className="text-xs font-mono text-white font-bold">Uploading & Optimizing...</div>
                <div className="text-[11px] text-gray-400 font-mono">Converting raster image to WebP or preserving vector SVG</div>
              </div>
            ) : value ? (
              <div className="flex flex-col sm:flex-row items-center gap-4">
                {/* Thumbnail Preview */}
                <div className="relative w-28 h-20 shrink-0 rounded-lg overflow-hidden border border-white/10 bg-dark-900 group/preview flex items-center justify-center p-1">
                  <img
                    src={value}
                    alt="Uploaded preview"
                    className="w-full h-full object-contain"
                  />
                  <div className="absolute inset-0 bg-dark-950/60 opacity-0 group-hover/preview:opacity-100 transition-opacity flex items-center justify-center">
                    <span className="text-[10px] font-mono text-white font-bold">Change</span>
                  </div>
                </div>

                {/* Details / Status */}
                <div className="flex-1 min-w-0 space-y-1 text-left">
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-[10px] font-mono font-bold">
                      <Check className="w-2.5 h-2.5" />
                      <span>{value.includes('.svg') ? 'Vector SVG Ready' : 'Optimized WebP'}</span>
                    </span>
                    {stats && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-mono text-cyber-neon bg-cyber-dim px-2 py-0.5 rounded border border-cyber-accent/30">
                        <Sparkles className="w-2.5 h-2.5" />
                        <span>{stats.ratio}</span>
                      </span>
                    )}
                  </div>

                  <div className="text-xs font-mono text-gray-300 truncate max-w-full">
                    {value.startsWith('data:') ? 'Local compressed preview' : value.split('/').pop() || value}
                  </div>

                  {stats && (
                    <div className="text-[11px] text-gray-500 font-mono">
                      {formatFileSize(stats.originalSize)} → {formatFileSize(stats.compressedSize)}
                    </div>
                  )}

                  <div className="text-[11px] text-gray-400 font-sans">
                    Click or drag & drop another image to replace
                  </div>
                </div>

                {/* Remove button */}
                <button
                  type="button"
                  onClick={handleClear}
                  className="p-1.5 rounded-lg bg-dark-900 border border-white/10 text-gray-400 hover:text-red-400 hover:border-red-500/40 transition-colors shrink-0"
                  title="Remove image"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div className="py-5 flex flex-col items-center justify-center gap-2 text-center">
                <div className="w-10 h-10 rounded-xl bg-cyber-dim border border-cyber-accent/30 text-cyber-neon flex items-center justify-center transition-transform group-hover:scale-110">
                  <UploadCloud className="w-5 h-5" />
                </div>
                <div>
                  <span className="text-xs font-mono font-bold text-white group-hover:text-cyber-neon transition-colors">
                    Click to upload
                  </span>{' '}
                  <span className="text-xs font-mono text-gray-400">or drag & drop</span>
                </div>
                <p className="text-[11px] text-gray-500 font-mono">
                  JPG, PNG, WebP up to 10MB • Automatically converted & compressed to WebP
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {helperText && (
        <p className="text-[11px] text-gray-500 font-sans">{helperText}</p>
      )}
    </div>
  );
};
