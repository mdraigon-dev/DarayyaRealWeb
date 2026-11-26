/**
 * roles.ts — who can do what. Shared by the site (to show the right buttons)
 * and by the save service in netlify/functions (which enforces it).
 *
 * Roles live in Netlify Identity under each user's app_metadata.roles. Only
 * someone with access to the Netlify dashboard can set them; a user cannot
 * change their own. (user_metadata, which users CAN edit, is never read.)
 *
 * A person can hold several roles; they get the union of what each allows.
 */

export const ROLES = ['admin', 'team-manager', 'project-manager', 'engineer', 'secretary', 'finance'] as const;
export type Role = (typeof ROLES)[number];

export type Capability =
  | 'view-dashboard'        // Dashboard page
  | 'edit-projects'         // create projects, edit details, budgets, line items, engineers
  | 'post-any-project'      // notes, field updates, photos on any project
  | 'post-assigned-project' // the same, only on projects whose team links the person's account
  | 'moderate-projects'     // delete notes, updates, photos
  | 'record-funds'          // record a contribution
  | 'reverse-funds'         // reverse a recorded contribution, adjust totals directly
  | 'upload-documents'      // add circulars and reports
  | 'delete-documents'      // delete circulars and reports
  | 'edit-contribute-page'  // "How to contribute" contact and payment details
  | 'delete-activity';      // delete entries from the activity log

const GRANTS: Record<Role, Capability[]> = {
  'admin': [
    'view-dashboard', 'edit-projects', 'post-any-project', 'moderate-projects', 'record-funds',
    'reverse-funds', 'upload-documents', 'delete-documents', 'edit-contribute-page', 'delete-activity',
  ],
  'team-manager': ['view-dashboard', 'edit-contribute-page'],
  'project-manager': ['edit-projects', 'post-any-project', 'moderate-projects'],
  'engineer': ['post-assigned-project'],
  'secretary': ['upload-documents'],
  'finance': ['record-funds'],
};

export const ROLE_LABELS: Record<Role, { ar: string; en: string }> = {
  'admin': { ar: 'مسؤول النظام', en: 'Administrator' },
  'team-manager': { ar: 'مدير الفريق', en: 'Team manager' },
  'project-manager': { ar: 'مدير المشاريع', en: 'Project manager' },
  'engineer': { ar: 'مهندس', en: 'Engineer' },
  'secretary': { ar: 'أمين السر', en: 'Secretary' },
  'finance': { ar: 'المالية', en: 'Finance' },
};

/** Paths (after /ar or /en) that are blocked at Netlify's CDN for anyone without these roles. */
export const GATED_PAGES: Array<{ prefix: string; roles: Role[] }> = [
  { prefix: '/admin/edit/', roles: ['admin', 'project-manager'] },
  { prefix: '/admin/new/', roles: ['admin', 'project-manager'] },
  { prefix: '/admin/profile/', roles: [...ROLES] },
  { prefix: '/admin/team/', roles: ['admin', 'project-manager'] },
  { prefix: '/admin/', roles: ['admin', 'team-manager'] },
];

export type RoleUser = {
  /** Identity user ID as the save service sees it (the token's `sub`). */
  sub?: string;
  /** Identity user ID as the browser's netlifyIdentity user has it. */
  id?: string;
  email?: string;
  app_metadata?: { roles?: unknown };
} | null | undefined;

/** The user's recognised roles (unknown strings are ignored, case-insensitive). */
export function rolesOf(user: RoleUser): Role[] {
  const raw = user?.app_metadata?.roles;
  if (!Array.isArray(raw)) return [];
  const set = new Set<Role>();
  for (const r of raw) {
    const k = String(r).trim().toLowerCase().replace(/[\s_]+/g, '-');
    if ((ROLES as readonly string[]).includes(k)) set.add(k as Role);
  }
  return [...set];
}

export function capsOf(user: RoleUser): Set<Capability> {
  const caps = new Set<Capability>();
  for (const r of rolesOf(user)) GRANTS[r].forEach((c) => caps.add(c));
  return caps;
}

export function can(user: RoleUser, cap: Capability): boolean {
  return capsOf(user).has(cap);
}

/**
 * TEMPORARY: team entries saved before accounts were linked by user ID still
 * carry the engineer's email. Until an administrator has run "Link existing
 * project teams" on the team directory page, those still count. Once no
 * project file contains `email:` under engineers, set this to false (and
 * delete it): see docs/ROLES.md.
 */
export const LEGACY_EMAIL_MATCH = true;

/** The account's Identity user ID: `sub` in the save service, `id` in the browser. */
export function userIdOf(user: RoleUser): string {
  return String(user?.sub || user?.id || '').trim();
}

/** Is this person on the project's team (linked by their Identity user ID)? */
export function isAssigned(user: RoleUser, engineers: unknown): boolean {
  if (!user || !Array.isArray(engineers)) return false;
  const id = userIdOf(user);
  const email = (user.email || '').trim().toLowerCase();
  return engineers.some((e: any) => {
    const linked = typeof e?.userId === 'string' ? e.userId.trim() : '';
    if (linked) return !!id && linked === id;
    if (!LEGACY_EMAIL_MATCH || !email) return false;
    return typeof e?.email === 'string' && e.email.trim().toLowerCase() === email;
  });
}

/** Can this person add notes, field updates and photos on this project? */
export function canPostOn(user: RoleUser, engineers: unknown): boolean {
  const caps = capsOf(user);
  if (caps.has('post-any-project')) return true;
  return caps.has('post-assigned-project') && isAssigned(user, engineers);
}

/** Roles allowed to open a page (path without the /ar or /en prefix), or null if it's public. */
export function pageRoles(path: string): Role[] | null {
  const p = path.endsWith('/') ? path : `${path}/`;
  const hit = GATED_PAGES.find((g) => p.startsWith(g.prefix));
  return hit ? hit.roles : null;
}

export function hasAnyRole(user: RoleUser, roles: readonly Role[]): boolean {
  const mine = rolesOf(user);
  return mine.some((r) => roles.includes(r));
}
