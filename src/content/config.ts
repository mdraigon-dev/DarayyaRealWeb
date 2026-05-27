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

// Permissive bilingual for user-authored content (updates, comments).
// Staff can post in either language; the other side starts blank and
// gets filled by the auto-translator at build time. We coerce empty
// ar to the en value (and vice-versa) so loc() always has something
// to return, and we don't reject valid entries that only have one side.
const bilingualUserContent = z.object({
  ar: z.string().optional().default(''),
  en: z.string().optional().default(''),
  en_auto: z.boolean().optional(),
}).transform(obj => ({
  ...obj,
  ar: obj.ar || obj.en || '',
  en: obj.en || obj.ar || '',
}));

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
    /** ISO date YYYY-MM-DD — when the funding window closes.
     *  When set, daysLeft is computed at build time from today's date.
     *  When absent, the static daysLeft value is used as-is.            */
    fundingDeadline: z.string().optional(),

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
        date: bilingualUserContent,
        author: bilingualUserContent,
        body: bilingualUserContent,
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
        author: bilingualUserContent,
        body: bilingualUserContent,
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
// Optional bilingual: same shape as `bilingual` but the AR side can be
// empty. Used for fields like circular descriptions where some
// documents simply don't have one.
const bilingualOptional = z.object({
  ar: z.string().optional().default(''),
  en: z.string().optional().default(''),
  en_auto: z.boolean().optional(),
});

const circularsCollection = defineCollection({
  type: 'content',
  schema: z.object({
    id: z.string(),
    title: bilingual,
    description: bilingualOptional.optional().default({ ar: '', en: '' }),
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
