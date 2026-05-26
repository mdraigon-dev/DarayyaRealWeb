/**
 * Role classification for a logged-in Netlify Identity user against
 * a specific project. Used by AuthAwareNoteAdder and AuthAwareUpdateAdder
 * to decide whether to show posting UI.
 *
 * The rules:
 *   - 'admin'              → user.user_metadata.roles includes 'admin'
 *                            (or an admin email allowlist matches)
 *   - 'engineer-of-project'→ user.email matches one of the project's
 *                            engineers[].email entries (case-insensitive)
 *   - 'logged-in-other'    → authenticated but not admin and not
 *                            listed on this project's team
 *   - 'anonymous'          → not authenticated
 *
 * UI uses these to gate features:
 *   admin: full editor + inline note + inline update
 *   engineer-of-project: inline note + inline update (but not full editor)
 *   logged-in-other: nothing (could change later)
 *   anonymous: nothing
 *
 * BOOTSTRAP: until you set roles in the Netlify Identity dashboard
 * (Identity → Users → click user → User metadata → roles: ["admin"]),
 * NO ONE is admin. To unblock yourself without going through that:
 * add your email to ADMIN_EMAIL_ALLOWLIST below.
 */

import type { Lang } from '../i18n/strings';

export type AuthUser = {
  email: string;
  user_metadata?: {
    full_name?: string;
    roles?: string[];
  };
};

export type ProjectEngineer = {
  name?: { ar?: string; en?: string };
  role?: { ar?: string; en?: string };
  email?: string;
  phone?: string;
};

export type PermissionRole = 'admin' | 'engineer-of-project' | 'logged-in-other' | 'anonymous';

/**
 * Hardcoded admin email allowlist as a fallback for the role-metadata
 * check. Lowercased. Leave empty in production once Identity roles are set.
 */
const ADMIN_EMAIL_ALLOWLIST: string[] = [
  // Add your council admin email here to bootstrap, e.g.:
  // 'mdraigon@example.com',
];

export function classifyUser(
  authUser: AuthUser | null | undefined,
  engineers: ProjectEngineer[] | undefined,
): PermissionRole {
  if (!authUser) return 'anonymous';

  const email = (authUser.email || '').trim().toLowerCase();

  // Admin via Identity role metadata
  const roles = authUser.user_metadata?.roles || [];
  if (roles.map(r => r.toLowerCase()).includes('admin')) {
    return 'admin';
  }

  // Admin via the bootstrap allowlist
  if (ADMIN_EMAIL_ALLOWLIST.map(e => e.toLowerCase()).includes(email)) {
    return 'admin';
  }

  // Engineer-of-this-project: email matches a team member's email
  if (email && engineers && engineers.length > 0) {
    for (const eng of engineers) {
      const engEmail = (eng?.email || '').trim().toLowerCase();
      if (engEmail && engEmail === email) {
        return 'engineer-of-project';
      }
    }
  }

  return 'logged-in-other';
}

/**
 * Convenience: should this user be allowed to post on this project?
 * True for admin OR engineer-of-project; false otherwise.
 */
export function canPost(role: PermissionRole): boolean {
  return role === 'admin' || role === 'engineer-of-project';
}

/**
 * Friendly label for the auth bar, e.g. "Signed in as Jane (admin)" or
 * "Signed in as Mahmoud (engineer on this project)".
 */
export function roleLabel(role: PermissionRole, lang: Lang): string {
  if (lang === 'ar') {
    if (role === 'admin') return 'مسؤول';
    if (role === 'engineer-of-project') return 'مهندس على هذا المشروع';
    if (role === 'logged-in-other') return 'مسجّل دخول';
    return '';
  }
  if (role === 'admin') return 'admin';
  if (role === 'engineer-of-project') return 'engineer on this project';
  if (role === 'logged-in-other') return 'signed in';
  return '';
}
