import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { compressImageWithStats, CompressionResult } from '../utils/imageCompressor';

export type StorageFolder = 'ebooks' | 'projects' | 'blogs' | 'tutorials' | 'covers' | 'logos' | 'media';

export interface UploadResult {
  url: string;
  originalSize: number;
  compressedSize: number;
  compressionRatio: string;
}

/**
 * Upload an image file directly to Supabase storage with automatic client-side WebP compression.
 * Organized into target folders (ebooks/, projects/, blogs/, tutorials/, logos/).
 * Preserves vector SVGs without rasterization; compresses JPG/PNG/WebP to WebP.
 */
export async function uploadImageFile(
  file: File,
  folder: StorageFolder,
  options: { maxWidth?: number; quality?: number } = {}
): Promise<UploadResult> {
  const { maxWidth = 1200, quality = 0.8 } = options;
  const isSvg = file.type === 'image/svg+xml' || file.name.toLowerCase().endsWith('.svg');

  // 1. Generate clean, unique filename
  const cleanBaseName = file.name
    .replace(/\.[^/.]+$/, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 30) || 'image';

  const uniqueId = typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID().slice(0, 8)
    : Math.random().toString(36).substring(2, 10);

  let uploadBlob: Blob;
  let fileName: string;
  let contentType: string;
  let originalSize = file.size;
  let compressedSize = file.size;
  let compressionRatio = 'Vector SVG';

  if (isSvg) {
    uploadBlob = file;
    fileName = `${cleanBaseName}-${Date.now()}-${uniqueId}.svg`;
    contentType = 'image/svg+xml';
  } else {
    // Client-Side WebP Compression for raster images
    const stats: CompressionResult = await compressImageWithStats(file, maxWidth, quality);
    uploadBlob = stats.blob;
    compressedSize = stats.compressedSize;
    compressionRatio = stats.compressionRatio;
    fileName = `${cleanBaseName}-${Date.now()}-${uniqueId}.webp`;
    contentType = 'image/webp';
  }

  // 2. Fallback to Data URL if Supabase is not configured
  if (!isSupabaseConfigured()) {
    console.warn('[Storage] Supabase is not configured. Falling back to local data URL for preview.');
    const dataUrl = await new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.readAsDataURL(uploadBlob);
    });

    return {
      url: dataUrl,
      originalSize,
      compressedSize,
      compressionRatio,
    };
  }

  // 3. Try upload to 'media' bucket first (media/${folder}/${fileName})
  // If 'media' bucket is not available, fallback to specific bucket (${folder}/${fileName})
  let targetBucket = 'media';
  let targetPath = `${folder}/${fileName}`;

  let { data, error } = await supabase.storage
    .from(targetBucket)
    .upload(targetPath, uploadBlob, {
      contentType,
      cacheControl: '31536000', // 1 year cache
      upsert: true,
    });

  // If 'media' bucket was not found, attempt upload to folder-named bucket directly
  if (error && (error.message.toLowerCase().includes('bucket') || error.message.toLowerCase().includes('not found'))) {
    targetBucket = folder;
    targetPath = fileName;
    const fallbackAttempt = await supabase.storage
      .from(targetBucket)
      .upload(targetPath, uploadBlob, {
        contentType,
        cacheControl: '31536000',
        upsert: true,
      });

    data = fallbackAttempt.data;
    error = fallbackAttempt.error;
  }

  if (error) {
    console.error('[Storage] Supabase upload failed:', error);
    // As a resilient fallback, provide data URL so the user is never blocked
    const dataUrl = await new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.readAsDataURL(uploadBlob);
    });

    return {
      url: dataUrl,
      originalSize,
      compressedSize,
      compressionRatio,
    };
  }

  // 5. Get Public URL
  const { data: publicUrlData } = supabase.storage
    .from(targetBucket)
    .getPublicUrl(targetPath);

  return {
    url: publicUrlData.publicUrl,
    originalSize,
    compressedSize,
    compressionRatio,
  };
}

/**
 * Upload a PDF document (e.g., CV / Resume, eBook PDF) directly to Supabase storage.
 * Uploads to 'media/resumes/' or 'resumes/' bucket with 'application/pdf' contentType.
 */
export async function uploadPdfFile(
  file: File,
  folder: string = 'resumes'
): Promise<string> {
  const cleanBaseName = file.name
    .replace(/\.[^/.]+$/, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 30) || 'resume';

  const uniqueId = typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID().slice(0, 8)
    : Math.random().toString(36).substring(2, 10);

  const fileName = `${cleanBaseName}-${Date.now()}-${uniqueId}.pdf`;

  if (!isSupabaseConfigured()) {
    console.warn('[Storage] Supabase is not configured. Falling back to local data URL.');
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.readAsDataURL(file);
    });
  }

  let targetBucket = 'media';
  let targetPath = `${folder}/${fileName}`;

  let { data, error } = await supabase.storage
    .from(targetBucket)
    .upload(targetPath, file, {
      contentType: 'application/pdf',
      cacheControl: '31536000',
      upsert: true,
    });

  if (error && (error.message.toLowerCase().includes('bucket') || error.message.toLowerCase().includes('not found'))) {
    targetBucket = folder;
    targetPath = fileName;
    const fallbackAttempt = await supabase.storage
      .from(targetBucket)
      .upload(targetPath, file, {
        contentType: 'application/pdf',
        cacheControl: '31536000',
        upsert: true,
      });
    data = fallbackAttempt.data;
    error = fallbackAttempt.error;
  }

  if (error) {
    console.error('[Storage] Supabase PDF upload failed:', error);
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.readAsDataURL(file);
    });
  }

  const { data: publicUrlData } = supabase.storage
    .from(targetBucket)
    .getPublicUrl(targetPath);

  return publicUrlData.publicUrl;
}
