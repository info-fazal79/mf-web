import { supabase } from '@/lib/supabase';

export type MediaItem = {
  id: string;
  path: string;
  url: string;
  name: string;
  mime: string | null;
  size: number | null;
  width: number | null;
  height: number | null;
  folder: string;
  alt: string | null;
  created_at: string;
};

const COMPRESSIBLE = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_SIDE = 1920;

function slugify(name: string) {
  return (
    name
      .toLowerCase()
      .replace(/\.[^.]+$/, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60) || 'file'
  );
}

async function readImage(file: Blob): Promise<HTMLImageElement> {
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    return img;
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Resize large photos and convert to WebP in the browser before upload. */
async function compress(file: File): Promise<{ blob: Blob; ext: string; mime: string; width?: number; height?: number }> {
  const ext = file.name.split('.').pop()?.toLowerCase() || 'bin';
  if (!COMPRESSIBLE.includes(file.type)) {
    let width: number | undefined;
    let height: number | undefined;
    if (file.type.startsWith('image/')) {
      try {
        const img = await readImage(file);
        width = img.naturalWidth;
        height = img.naturalHeight;
      } catch {}
    }
    return { blob: file, ext, mime: file.type || 'application/octet-stream', width, height };
  }
  const img = await readImage(file);
  const scale = Math.min(1, MAX_SIDE / Math.max(img.naturalWidth, img.naturalHeight));
  const w = Math.round(img.naturalWidth * scale);
  const h = Math.round(img.naturalHeight * scale);
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  canvas.getContext('2d')!.drawImage(img, 0, 0, w, h);
  const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/webp', 0.85));
  if (!blob || blob.size >= file.size) return { blob: file, ext, mime: file.type, width: img.naturalWidth, height: img.naturalHeight };
  return { blob, ext: 'webp', mime: 'image/webp', width: w, height: h };
}

export async function uploadMedia(file: File, folder = 'general'): Promise<MediaItem> {
  if (!supabase) throw new Error('Supabase is not configured');
  const { blob, ext, mime, width, height } = await compress(file);
  const now = new Date();
  const path = `${folder}/${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, '0')}/${crypto.randomUUID().slice(0, 8)}-${slugify(file.name)}.${ext}`;
  const up = await supabase.storage.from('media').upload(path, blob, { contentType: mime, cacheControl: '31536000' });
  if (up.error) throw up.error;
  const url = supabase.storage.from('media').getPublicUrl(path).data.publicUrl;
  const { data, error } = await supabase
    .from('media')
    .insert({ path, url, name: file.name, mime, size: blob.size, width, height, folder })
    .select()
    .single();
  if (error) {
    await supabase.storage.from('media').remove([path]);
    throw error;
  }
  return data as MediaItem;
}

export async function deleteMedia(item: MediaItem) {
  if (!supabase) return;
  const rm = await supabase.storage.from('media').remove([item.path]);
  if (rm.error) throw rm.error;
  const { error } = await supabase.from('media').delete().eq('id', item.id);
  if (error) throw error;
}

export function formatBytes(n: number | null) {
  if (!n) return '—';
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}
