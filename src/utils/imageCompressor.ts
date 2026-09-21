/**
 * Client-Side Image Compression & WebP Converter
 * Automatically compresses high-resolution JPG/PNG images to modern, high-performance WebP format.
 */

export interface CompressionResult {
  blob: Blob;
  originalSize: number;
  compressedSize: number;
  compressionRatio: string;
}

export async function compressImageToWebP(
  file: File,
  maxWidth = 1200,
  quality = 0.8
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);

        canvas.toBlob(
          (blob) => {
            if (blob) resolve(blob);
            else reject(new Error('WebP compression failed'));
          },
          'image/webp',
          quality
        );
      };
      img.onerror = (error) => reject(error);
    };
    reader.onerror = (error) => reject(error);
  });
}

/**
 * Enhanced compression function returning detailed statistics (sizes, savings)
 */
export async function compressImageWithStats(
  file: File,
  maxWidth = 1200,
  quality = 0.8
): Promise<CompressionResult> {
  const originalSize = file.size;
  const blob = await compressImageToWebP(file, maxWidth, quality);
  const compressedSize = blob.size;
  const savings = Math.max(0, Math.round(((originalSize - compressedSize) / originalSize) * 100));
  const compressionRatio = `${savings}% smaller`;

  return {
    blob,
    originalSize,
    compressedSize,
    compressionRatio,
  };
}

export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}
