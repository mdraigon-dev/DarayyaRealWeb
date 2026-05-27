import { defineCollection, z } from 'astro:content';

// ============================================================
// Bilingual string helper
// AR is required; EN defaults to empty string when blank.
// At render time, loc(lang, obj) falls back to AR when EN is empty.
// en_auto is set by scripts/auto-translate.mjs to mark MyMemory output;
// the public site shows a small "auto-translated" badge for those fields.
// ============================================================
const bilingual = z.object({
  ar: z.string().min(1, 'العربية مطلوبة'),
  en: z.string().optional().default(''),
  en_auto: z.boolean().optional(),
});

// ============================================================
// PROJECT COLLECTION
// One Markdown file per project, with frontmatter for all fields.
// Council staff edit these via Decap CMS at /admin/.
// ============================================================
const projectCollection = defineCollection({
  type: 'content',
  schema: z.object({
    // Identification
    id: z.string(),
    order: z.number().default(0),
    featured: z.boolean().default(false),

    category: z.enum([
      'roads',
      'water',
      'sewer',
      'lighting',
      'communications',
      'facilities',
    ]),

    status: z.enum(['funding', 'active', 'completed', 'planning']),
    health: z.enum(['healthy', 'warning', 'stalled', 'completed']),

    title: bilingual,
    location: bilingual,
    description: bilingual,

    // Money & timing
    budgetUSD: z.number().positive(),
    raisedUSD: z.number().min(0),
    donors: z.number().int().min(0).default(0),
    daysLeft: z.number().int().min(0).default(0),

    // Map coordinates (Darayya area ~33.45 N, 36.25 E)
    lat: z.number().default(33.45),
    lng: z.number().default(36.25),

    // Sub-projects (3rd tier of the hierarchy)
    subs: z.array(
      z.object({
        id: z.string(),
        title: bilingual,
        length: bilingual,
        budgetUSD: z.number().positive(),
        raisedUSD: z.number().min(0),
      })
    ).default([]),

    // Field updates
    updates: z.array(
      z.object({
        date: bilingual,
        author: bilingual,
        body: bilingual,
      })
    ).default([]),

    // Photos
    photos: z.array(
      z.object({
        src: z.string().optional(),
        scene: z.enum(['road', 'water', 'sewer', 'light', 'internet', 'building', 'park']).optional(),
        status: z.enum(['healthy', 'warning', 'stalled', 'completed']),
        caption: bilingual,
        date: bilingual,
      })
    ).default([]),

    // Team — engineers, contractors, supervisors
    engineers: z.array(
      z.object({
        name: bilingual,
        role: bilingual,
        phone: z.string().optional(),
        email: z.string().optional(),
      })
    ).default([]),

    // General notes/comments
    comments: z.array(
      z.object({
        author: bilingual,
        body: bilingual,
        date: z.string().optional(),
      })
    ).default([]),
  }),
});

// ============================================================
// FIELD UPDATES — global feed
// ============================================================
const updatesCollection = defineCollection({
  type: 'content',
  schema: z.object({
    date: z.string(),
    projectId: z.string(),
    author: bilingual,
    body: bilingual,
  }),
});

// ============================================================
// CIRCULARS & DECISIONS — council-issued documents
// One .md file per document, with file binary stored under
// public/circulars/files/. Public site shows a list with download
// links; admin upload form (in src/components/CircularUploader.tsx)
// commits both the file and the metadata via Git Gateway.
// ============================================================
const circularsCollection = defineCollection({
  type: 'content',
  schema: z.object({
    id: z.string(),
    title: bilingual,
    description: bilingual,
    category: z.enum([
      'decision',      // قرار رسمي
      'announcement',  // إعلان / تعميم
      'report',        // تقرير
      'policy',        // سياسة / لائحة
      'minutes',       // محضر اجتماع
      'other',         // أخرى
    ]),
    /** ISO date string (YYYY-MM-DD) — when the document was issued */
    date: z.string(),
    /** Public path to the binary file under /circulars/files/ */
    file: z.string(),
    /** Size in bytes, used for display only */
    fileSize: z.number().int().nonnegative().default(0),
    /** MIME type, used to decide whether to show an inline preview */
    fileType: z.string().default('application/octet-stream'),
    /** Display name of the council member who uploaded it */
    uploadedBy: z.string().default(''),
    /** Sort order — defaults to ISO date sort, but can be pinned */
    order: z.number().default(0),
  }),
});

// ============================================================
// SITE SETTINGS
// ============================================================
const siteCollection = defineCollection({
  type: 'data',
  schema: z.object({
    title: bilingual,
    tagline: bilingual,
    contactEmail: z.string().email(),
    contactPhone: z.string(),
  }),
});

export const collections = {
  projects: projectCollection,
  updates: updatesCollection,
  site: siteCollection,
  circulars: circularsCollection,
};
