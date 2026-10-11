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

import { commitBinaryFile } from './git-gateway';

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

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const idx = result.indexOf(',');
      resolve(idx >= 0 ? result.slice(idx + 1) : result);
    };
    reader.onerror = () => reject(reader.error || new Error('FileReader failed'));
    reader.readAsDataURL(file);
  });
}

/**
 * Upload one image for a project. Returns the public `src` path to store on
 * the photo entry. Throws 'IMAGE_TYPE' / 'IMAGE_SIZE' on validation failure.
 */
export async function uploadProjectPhoto(
  projectId: string,
  file: File,
  commitMessage: string,
): Promise<{ src: string }> {
  if (!isAllowedImage(file)) throw new Error('IMAGE_TYPE');
  if (file.size > MAX_IMAGE_BYTES) throw new Error('IMAGE_SIZE');

  const ext = IMAGE_EXT[file.type];
  const id = `${Date.now()}-${randomSuffix()}`;
  const repoPath = `public/uploads/projects/${projectId}/${id}.${ext}`;
  const publicSrc = `/uploads/projects/${projectId}/${id}.${ext}`;

  const base64 = await fileToBase64(file);
  await commitBinaryFile(repoPath, base64, commitMessage);

  return { src: publicSrc };
}
