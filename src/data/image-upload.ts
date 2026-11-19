/**
 * image-upload.ts
 *
 * Commit a site photo to the repo and return the URL it will be served at.
 *
 * Photos go to public/uploads/projects/<projectId>/<id>.<ext>, which Netlify
 * serves at /uploads/projects/<projectId>/<id>.<ext> (the site has no base
 * path). The caller stores that path as a photo's `src`, and ProjectPhoto
 * renders it as a real image once the rebuild deploys.
 *
 * Each image is its own binary commit — separate files from the project's .md,
 * so they never collide with the metadata commit that references them.
 */

import type { Change } from './repo';

export const MAX_IMAGE_BYTES = 8 * 1024 * 1024; // 8 MB per image
export const MAX_IMAGES_PER_UPDATE = 6;

const IMAGE_EXT: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
  'image/gif': 'gif',
};

/** Accepts only the raster formats browsers can display reliably. */
export function isAllowedImage(file: File): boolean {
  return file.type in IMAGE_EXT;
}

function randomSuffix(): string {
  return Math.random().toString(36).slice(2, 8);
}


/**
 * Upload one image for a project. Returns the public `src` path to store on
 * the photo entry. Throws 'IMAGE_TYPE' / 'IMAGE_SIZE' on validation failure.
 */
/**
 * Downscale large photos before upload (phone photos are often 5–12 MB).
 * Anything over 2,400 px or 2.5 MB is re-encoded as JPEG; small images and
 * GIFs are left alone.
 */
export async function shrinkImage(file: File, maxDim = 2400, maxBytes = 2.5 * 1024 * 1024): Promise<File> {
  if (file.type === 'image/gif') return file;
  let bmp: ImageBitmap;
  try { bmp = await createImageBitmap(file); } catch { return file; }
  const scale = Math.min(1, maxDim / Math.max(bmp.width, bmp.height));
  if (scale === 1 && file.size <= maxBytes) { bmp.close?.(); return file; }
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bmp.width * scale);
  canvas.height = Math.round(bmp.height * scale);
  const ctx = canvas.getContext('2d');
  if (!ctx) return file;
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(bmp, 0, 0, canvas.width, canvas.height);
  bmp.close?.();
  const blob: Blob | null = await new Promise((r) => canvas.toBlob(r, 'image/jpeg', 0.85));
  if (!blob || blob.size >= file.size) return file;
  return new File([blob], file.name.replace(/\.\w+$/, '') + '.jpg', { type: 'image/jpeg' });
}

/**
 * Prepare a site photo for a project: validates and downscales it, and
 * returns its public path plus the file change to include in the commit that
 * adds the photo to the project (one commit for the whole field update).
 */
export async function prepareProjectPhoto(
  projectId: string,
  file: File,
): Promise<{ src: string; change: Change }> {
  if (!isAllowedImage(file)) throw new Error('IMAGE_TYPE');
  if (file.size > MAX_IMAGE_BYTES) throw new Error('IMAGE_SIZE');
  const ready = await shrinkImage(file);
  const ext = IMAGE_EXT[ready.type];
  const id = `${Date.now()}-${randomSuffix()}`;
  return {
    src: `/uploads/projects/${projectId}/${id}.${ext}`,
    change: { path: `public/uploads/projects/${projectId}/${id}.${ext}`, file: ready, expectSha: null },
  };
}
