/**
 * Role classification for a logged-in Netlify Identity user against
 * a specific project. Used by AuthAwareNoteAdder and AuthAwareUpdateAdder
 * to decide whether to show posting UI.
 *
 * The rules:
 *   - 'admin'              → user.user_metadata.roles includes 'admin'
 *                            (or an admin email allowlist matches,
 *                            or PERMISSIVE_MODE is true and they're
 *                            signed in)
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
 * ⚠ SECURITY NOTE: this check runs CLIENT-SIDE only. Git Gateway accepts
 * any commit from any signed-in Identity user; a determined user could
 * open DevTools and bypass this gate to post anyway. For real
 * authorization, a Netlify Function would need to sit in front of Git
 * Gateway and validate role server-side. For a council platform with
 * trusted invited users, this client-side defense-in-depth is usually
 * sufficient — bad commits show up in git log with the offender's
 * identity attached. Revoke their Identity invitation if abused.
 *
 * BOOTSTRAP / PERMISSIVE MODE:
 * By default, any signed-in user is treated as admin so the platform
 * works out-of-the-box without Netlify Identity dashboard config.
 * Once you're ready to lock down by role, do BOTH of:
 *   1. Set PERMISSIVE_MODE = false below
 *   2. For each user who should be admin, go to Netlify dashboard →
 *      Identity → Users → click user → User metadata →
 *      add 'roles: ["admin"]'
 * Engineers listed in a project's engineers[] with matching email
 * can always post on that one project regardless of PERMISSIVE_MODE.
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
 * Permissive mode: when true, ANY signed-in Identity user is treated
 * as an admin. This is the default so the platform works as soon as
 * you invite yourself to Netlify Identity, no role configuration needed.
 *
 * Flip this to false once you have roles configured for all users who
 * should be admins. Engineers listed on a specific project will still
 * be able to post on THAT project regardless of this flag.
 */
const PERMISSIVE_MODE = true;

/**
 * Hardcoded admin email allowlist as a fallback for the role-metadata
 * check. Lowercased. Use this if PERMISSIVE_MODE is false but you want
 * specific people to be admin without setting Identity role metadata.
 */
const ADMIN_EMAIL_ALLOWLIST: string[] = [
  // Add your council admin email here, e.g.:
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

  // Permissive mode (default): any signed-in user is admin. Flip
  // PERMISSIVE_MODE to false above once you've configured roles.
  if (PERMISSIVE_MODE) return 'admin';

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
