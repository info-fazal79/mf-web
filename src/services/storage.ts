import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { compressImageWithStats, CompressionResult } from '../utils/imageCompressor';

export type StorageFolder = 'ebooks' | 'projects' | 'blogs' | 'tutorials' | 'covers';

export interface UploadResult {
  url: string;
  originalSize: number;
  compressedSize: number;
  compressionRatio: string;
}

/**
 * Upload an image file directly to Supabase storage with automatic client-side WebP compression.
 * Organized into target folders (ebooks/, projects/, blogs/, tutorials/).
 */
export async function uploadImageFile(
  file: File,
  folder: StorageFolder,
  options: { maxWidth?: number; quality?: number } = {}
): Promise<UploadResult> {
  const { maxWidth = 1200, quality = 0.8 } = options;

  // 1. Client-Side WebP Compression
  const stats: CompressionResult = await compressImageWithStats(file, maxWidth, quality);

  // 2. Generate clean, unique filename
  const cleanBaseName = file.name
    .replace(/\.[^/.]+$/, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 30) || 'image';

  const uniqueId = typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID().slice(0, 8)
    : Math.random().toString(36).substring(2, 10);

  const fileName = `${cleanBaseName}-${Date.now()}-${uniqueId}.webp`;

  // 3. Fallback to Data URL if Supabase is not configured
  if (!isSupabaseConfigured()) {
    console.warn('[Storage] Supabase is not configured. Falling back to local data URL for preview.');
    const dataUrl = await new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.readAsDataURL(stats.blob);
    });

    return {
      url: dataUrl,
      originalSize: stats.originalSize,
      compressedSize: stats.compressedSize,
      compressionRatio: stats.compressionRatio,
    };
  }

  // 4. Try upload to 'media' bucket first (media/${folder}/${fileName})
  // If 'media' bucket is not available, fallback to specific bucket (${folder}/${fileName})
  let targetBucket = 'media';
  let targetPath = `${folder}/${fileName}`;

  let { data, error } = await supabase.storage
    .from(targetBucket)
    .upload(targetPath, stats.blob, {
      contentType: 'image/webp',
      cacheControl: '31536000', // 1 year cache
      upsert: true,
    });

  // If 'media' bucket was not found, attempt upload to folder-named bucket directly
  if (error && (error.message.toLowerCase().includes('bucket') || error.message.toLowerCase().includes('not found'))) {
    targetBucket = folder;
    targetPath = fileName;
    const fallbackAttempt = await supabase.storage
      .from(targetBucket)
      .upload(targetPath, stats.blob, {
        contentType: 'image/webp',
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
      reader.readAsDataURL(stats.blob);
    });

    return {
      url: dataUrl,
      originalSize: stats.originalSize,
      compressedSize: stats.compressedSize,
      compressionRatio: stats.compressionRatio,
    };
  }

  // 5. Get Public URL
  const { data: publicUrlData } = supabase.storage
    .from(targetBucket)
    .getPublicUrl(targetPath);

  return {
    url: publicUrlData.publicUrl,
    originalSize: stats.originalSize,
    compressedSize: stats.compressedSize,
    compressionRatio: stats.compressionRatio,
  };
}
