import { defineCollection, z } from 'astro:content';

// ============================================================
// Bilingual string helper
// AR is required; EN defaults to empty string when blank.
// At render time, loc(lang, obj) falls back to AR when EN is empty.
// en_auto is set by scripts/auto-translate.mjs to mark MyMemory output;
// the public site shows a small "auto-translated" badge for those fields.
// ============================================================
// When something happened: an ISO datetime ("2026-11-17T15:07:12.000Z") when
// the exact moment is known, or a plain date ("2026-05-22") when only the day
// is. Relative text like "3 days ago" is never stored — see src/data/time.ts.
const isoAt = z.string().regex(/^\d{4}-\d{2}-\d{2}(T[\d:.]+(Z|[+-]\d{2}:?\d{2})?)?$/, 'Use an ISO date, e.g. 2026-11-17');

// A bilingual text needs at least ONE language. Posts made from the site are
// written in whichever language the author is using, so an English-only note
// arrives with `ar: ""` (auto-translate fills the other side when it can).
// Requiring Arabic here used to fail the whole Netlify build — and with it
// every later deploy — the moment someone posted in English.
const bilingual = z.object({
  ar: z.string().optional().default(''),
  en: z.string().optional().default(''),
  en_auto: z.boolean().optional(),
  ar_auto: z.boolean().optional(),
}).refine((v) => v.ar.trim() !== '' || v.en.trim() !== '', {
  message: 'Arabic or English text is required / النص مطلوب بالعربية أو الإنجليزية',
});

// An Identity user ID. A bad value is dropped rather than failing the build.
const looseId = z.string().trim().regex(/^[\w-]{1,80}$/).optional().catch(undefined);

// Labels that may legitimately be blank (an author name, a photo caption, a
// legacy date). A blank one must never block the build.
const bilingualLabel = z.object({
  ar: z.string().optional().default(''),
  en: z.string().optional().default(''),
  en_auto: z.boolean().optional(),
  ar_auto: z.boolean().optional(),
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
    /** Optional funding deadline (YYYY-MM-DD); days left is computed live. */
    deadline: isoAt.optional(),
    /**
     * Government funding (absent = none). 'full' covers the whole budget;
     * 'partial' covers amountUSD. Not added to raisedUSD, which stays the sum
     * of recorded contributions. See src/data/gov-funding.ts.
     */
    govFunding: z.object({
      type: z.enum(['none', 'partial', 'full']).catch('none'),
      amountUSD: z.number().min(0).optional(),
      note: bilingualLabel.optional(),
    }).optional(),
    // Legacy fields from the online-donation era — no longer read or shown.
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
        length: bilingualLabel,
        budgetUSD: z.number().min(0),
        raisedUSD: z.number().min(0),
        /** Government's share of this item (partly government-funded projects) */
        govUSD: z.number().min(0).optional(),
      })
    ).default([]),

    // Field updates
    updates: z.array(
      z.object({
        at: isoAt.optional(),
        /** Legacy free-text date ("3 days ago") — superseded by `at` */
        date: bilingualLabel.optional(),
        author: bilingualLabel,
        body: bilingual,
      })
    ).default([]),

    // Photos
    photos: z.array(
      z.object({
        src: z.string().optional(),
        scene: z.enum(['road', 'water', 'sewer', 'light', 'internet', 'building', 'park']).optional(),
        status: z.enum(['healthy', 'warning', 'stalled', 'completed']),
        caption: bilingualLabel,
        at: isoAt.optional(),
        /** Legacy free-text date — superseded by `at` */
        date: bilingualLabel.optional(),
      })
    ).default([]),

    // Contributions recorded by admins (delivered via the Development
    // Committee). Each entry is the audit trail behind a raisedUSD change.
    fundLog: z.array(
      z.object({
        at: isoAt,
        amountUSD: z.number().positive(),
        /** Sub-item the amount went to, when the project has sub-items */
        subId: z.string().optional(),
        /** Display name of the admin who recorded it */
        by: z.string().optional(),
      })
    ).default([]),

    // Team — engineers, contractors, supervisors.
    // `userId` links the entry to a Netlify Identity account (who may post on
    // the project). Staff email addresses are never part of the site: any
    // legacy `email` left in a file is dropped here, before any page sees it.
    engineers: z.array(
      z.object({
        name: bilingual,
        role: bilingualLabel,
        /** Optional public contact number */
        phone: z.string().optional().catch(undefined),
        userId: looseId,
      })
    ).default([]),

    // General notes/comments
    comments: z.array(
      z.object({
        author: bilingualLabel,
        body: bilingual,
        at: isoAt.optional(),
        /** Legacy date string — superseded by `at` */
        date: z.string().optional(),
      })
    ).default([]),
  }).transform((p) => {
    // One rule for every page: when a project has line items, its totals are
    // the sum of those items. The fund recorder already works this way, and a
    // total edited on its own (e.g. in /admin/ CMS) used to show on the list
    // and map but not on the project page.
    if (p.subs.length === 0) return p;
    // Same for the government's share once it's saved per item.
    const itemGov = p.subs.reduce((a, s) => a + (s.govUSD || 0), 0);
    const govFunding = p.govFunding?.type === 'partial' && itemGov > 0
      ? { ...p.govFunding, amountUSD: itemGov }
      : p.govFunding;
    return {
      ...p,
      govFunding,
      budgetUSD: p.subs.reduce((a, s) => a + s.budgetUSD, 0),
      raisedUSD: p.subs.reduce((a, s) => a + s.raisedUSD, 0),
    };
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
    author: bilingualLabel,
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
    /** When it was published on the site (for the activity log) */
    at: isoAt.optional(),
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

// ============================================================
// HOW TO CONTRIBUTE — one editable page (src/content/contribute/page.json)
// ============================================================
// Everything is optional and loosely typed on purpose: this file is edited
// from the site, and a stray value must never be able to fail the build.
// The page skips any entry it can't show.
const contributeCollection = defineCollection({
  type: 'data',
  schema: z.object({
    intro: bilingualLabel.optional(),
    methods: z.array(
      z.object({
        id: z.string(),
        /** phone | whatsapp | email | link | address | text | qr */
        type: z.string(),
        label: bilingualLabel.optional(),
        /** phone number, email address or URL */
        value: z.string().optional(),
        /** address or free text */
        text: bilingualLabel.optional(),
        /** QR / image path under /uploads/contribute/ */
        image: z.string().optional(),
        /** short extra line, e.g. opening hours */
        note: bilingualLabel.optional(),
      }).passthrough()
    ).default([]),
    updatedAt: z.string().optional(),
    updatedBy: z.string().optional(),
  }),
});

// ============================================================
// TEAM DIRECTORY — src/content/team/directory.json
// Shared list of team members project managers add to projects. Edited from
// /{lang}/admin/team/. Lenient on purpose: anything malformed is skipped,
// never a build failure. No email addresses (the repository is public).
// ============================================================
const teamMember = z.object({
  id: z.string(),
  name: bilingualLabel,
  role: bilingualLabel.optional().default({ ar: '', en: '' }),
  userId: looseId,
  phone: z.string().optional().catch(undefined),
});
const teamCollection = defineCollection({
  type: 'data',
  schema: z.object({
    members: z.array(z.unknown()).catch([]).default([]).transform((items) =>
      items.flatMap((m) => {
        const r = teamMember.safeParse(m);
        return r.success ? [r.data] : [];
      })),
  }).passthrough(),
});

export const collections = {
  team: teamCollection,
  contribute: contributeCollection,
  projects: projectCollection,
  updates: updatesCollection,
  site: siteCollection,
  circulars: circularsCollection,
};
