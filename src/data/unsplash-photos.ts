/**
 * Curated Unsplash photo registry for illustrative project photos.
 *
 * Only photo IDs verified to exist on Unsplash are included here. For scenes
 * where verified IDs aren't yet curated (light, internet), the system falls
 * back to the generated SVG illustration — which is fine because those
 * categories still get a visual representation.
 *
 * Every Unsplash photo displayed using these URLs is marked with an
 * "ILLUSTRATIVE" badge in the UI to prevent any confusion with real
 * Darayya photos.
 *
 * To swap or add photos:
 *   1. Go to https://unsplash.com and find a photo
 *   2. View the page source, search for `images.unsplash.com/photo-`
 *   3. Copy the hash that follows (e.g. `1503708928676-1cb796a0891e`)
 *   4. Add an entry below with the photographer's name and Unsplash URL.
 *
 * License: https://unsplash.com/license (free for commercial use, no
 * attribution required, but we credit photographers as a courtesy).
 */

export type SceneType = 'road' | 'water' | 'sewer' | 'light' | 'internet' | 'building' | 'park';
export type Status = 'healthy' | 'warning' | 'stalled' | 'completed';

export type UnsplashPhoto = {
  /** Unsplash photo file hash (the part after `photo-` in image URLs) */
  hash: string;
  /** Photographer's name as shown on Unsplash */
  photographer: string;
  /** Link to the photographer's profile */
  link: string;
};

/**
 * Photo pools per scene type. Only includes IDs verified from Unsplash
 * search result pages. Empty arrays mean "no Unsplash photos for this scene
 * yet — use the SVG fallback instead."
 *
 * VERIFIED from Unsplash search result HTML on 2026-05-25.
 */
export const UNSPLASH_POOLS: Record<SceneType, UnsplashPhoto[]> = {
  road: [
    { hash: '1503708928676-1cb796a0891e', photographer: 'Jamar Penny',        link: 'https://unsplash.com/@pennypicsvideos' },
    { hash: '1517089596392-fb9a9033e05b', photographer: 'Shane McLendon',     link: 'https://unsplash.com/@kctinman' },
    { hash: '1529792083865-d23889753466', photographer: 'Nicolas J Leclercq', link: 'https://unsplash.com/@nicolasjleclercq' },
    { hash: '1534097575056-ddba81f714c8', photographer: 'Brandon Mowinkel',   link: 'https://unsplash.com/@bmowinkel' },
    { hash: '1593436878048-92622a77d315', photographer: 'Mika Baumeister',    link: 'https://unsplash.com/@kommumikation' },
    { hash: '1603814929877-d5d927322656', photographer: 'Jason Jarrach',      link: 'https://unsplash.com/@jasonjarr' },
    { hash: '1610477865545-37711c53144d', photographer: 'Zizi zi',            link: 'https://unsplash.com/@zizi_zi' },
    { hash: '1583024011792-b165975b52f5', photographer: 'EESOFUFFZICH',       link: 'https://unsplash.com/@eesofuffzich' },
  ],

  water: [
    // Verified water-pipeline photo from Unsplash search
    { hash: '1693907986952-3cd372e4c9d8', photographer: 'Rose Galloway Green', link: 'https://unsplash.com/@rgreen' },
    // Construction/dig site for water network work (re-use from road pool, fits the visual)
    { hash: '1517089596392-fb9a9033e05b', photographer: 'Shane McLendon',      link: 'https://unsplash.com/@kctinman' },
    { hash: '1583024011792-b165975b52f5', photographer: 'EESOFUFFZICH',        link: 'https://unsplash.com/@eesofuffzich' },
  ],

  sewer: [
    // Excavation work — use construction site photos
    { hash: '1517089596392-fb9a9033e05b', photographer: 'Shane McLendon',  link: 'https://unsplash.com/@kctinman' },
    { hash: '1603814929877-d5d927322656', photographer: 'Jason Jarrach',   link: 'https://unsplash.com/@jasonjarr' },
    { hash: '1583024011792-b165975b52f5', photographer: 'EESOFUFFZICH',    link: 'https://unsplash.com/@eesofuffzich' },
  ],

  // No verified IDs for these yet — falls back to generated SVG scene.
  // To add: find a photo on Unsplash, verify the hash, append here.
  light:    [],
  internet: [],
  building: [],
  park:     [],
};

/**
 * Build the full image URL from a photo entry.
 * The `&w=640&q=80` keeps file size reasonable for thumbnails.
 */
export function unsplashUrl(photo: UnsplashPhoto, width = 640): string {
  return `https://images.unsplash.com/photo-${photo.hash}?w=${width}&q=80&auto=format&fit=crop`;
}

/**
 * Deterministic photo picker: given a project ID and scene type, return a
 * stable photo from the pool. Returns null if the pool for that scene is
 * empty, signaling that the SVG fallback should be used.
 */
export function pickPhoto(projectId: string, scene: SceneType, photoIndex = 0): UnsplashPhoto | null {
  const pool = UNSPLASH_POOLS[scene];
  if (!pool || pool.length === 0) return null;
  // Simple deterministic hash: sum char codes of project ID + photo index
  let h = photoIndex;
  for (let i = 0; i < projectId.length; i++) h = (h * 31 + projectId.charCodeAt(i)) >>> 0;
  return pool[h % pool.length];
}
