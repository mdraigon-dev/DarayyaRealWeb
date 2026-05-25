import { defineCollection, z } from 'astro:content';

// ============================================================
// PROJECT COLLECTION
// One Markdown file per project, with frontmatter for all fields.
// Council staff edit these via Decap CMS at /admin/.
// ============================================================
const projectCollection = defineCollection({
  type: 'content',
  schema: ({ image }) =>
    z.object({
      // Identification
      id: z.string(),
      order: z.number().default(0),
      featured: z.boolean().default(false),

      // Category — using enum for consistency
      category: z.enum([
        'roads',
        'water',
        'sewer',
        'lighting',
        'communications',
        'facilities',
      ]),

      // Status & health
      status: z.enum(['funding', 'active', 'completed', 'planning']),
      health: z.enum(['healthy', 'warning', 'stalled', 'completed']),

      // Bilingual fields — Arabic primary, English optional
      title: z.object({
        ar: z.string(),
        en: z.string(),
      }),
      location: z.object({
        ar: z.string(),
        en: z.string(),
      }),
      description: z.object({
        ar: z.string(),
        en: z.string(),
      }),

      // Money & timing
      budgetUSD: z.number().positive(),
      raisedUSD: z.number().min(0),
      donors: z.number().int().min(0).default(0),
      daysLeft: z.number().int().min(0).default(0),

      // Map coordinates (Darayya area ~33.45 N, 36.25 E)
      lat: z.number(),
      lng: z.number(),

      // Sub-projects (3rd tier of the hierarchy)
      subs: z.array(
        z.object({
          id: z.string(),
          title: z.object({ ar: z.string(), en: z.string() }),
          length: z.object({ ar: z.string(), en: z.string() }),
          budgetUSD: z.number().positive(),
          raisedUSD: z.number().min(0),
        })
      ).default([]),

      // Field updates
      updates: z.array(
        z.object({
          date: z.object({ ar: z.string(), en: z.string() }),
          author: z.object({ ar: z.string(), en: z.string() }),
          body: z.object({ ar: z.string(), en: z.string() }),
        })
      ).default([]),

      // Photos
      photos: z.array(
        z.object({
          // Either a real uploaded image OR a generated scene type
          src: z.string().optional(),
          scene: z.enum(['road', 'water', 'sewer', 'light', 'internet', 'building', 'park']).optional(),
          status: z.enum(['healthy', 'warning', 'stalled', 'completed']),
          caption: z.object({ ar: z.string(), en: z.string() }),
          date: z.object({ ar: z.string(), en: z.string() }),
        })
      ).default([]),
    }),
});

// ============================================================
// FIELD UPDATES — global feed (for admin dashboard, transparency)
// ============================================================
const updatesCollection = defineCollection({
  type: 'content',
  schema: z.object({
    date: z.string(), // ISO date
    projectId: z.string(),
    author: z.object({ ar: z.string(), en: z.string() }),
    body: z.object({ ar: z.string(), en: z.string() }),
  }),
});

// ============================================================
// SITE SETTINGS — global content (about, contact, etc.)
// ============================================================
const siteCollection = defineCollection({
  type: 'data',
  schema: z.object({
    title: z.object({ ar: z.string(), en: z.string() }),
    tagline: z.object({ ar: z.string(), en: z.string() }),
    contactEmail: z.string().email(),
    contactPhone: z.string(),
  }),
});

export const collections = {
  projects: projectCollection,
  updates: updatesCollection,
  site: siteCollection,
};
