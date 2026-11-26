/**
 * permissions.ts — the signed-in user as the site's islands see it.
 *
 * What each role may do is defined in roles.ts and enforced by the save
 * service (netlify/functions/repo). The checks the UI makes with these helpers
 * only decide which buttons to show; they are not the security boundary.
 *
 * Roles come from app_metadata.roles, which only the Netlify dashboard can
 * set. user_metadata is editable by the user and is never used for access.
 */
import { can, canPostOn, rolesOf, ROLE_LABELS, type Capability } from './roles';
import type { Lang } from '../i18n/strings';

export type AuthUser = {
  /** Identity user ID — what project teams link to (engineers[].userId). */
  id?: string;
  email: string;
  app_metadata?: { roles?: string[] };
  user_metadata?: { full_name?: string };
};

export type ProjectEngineer = {
  name?: { ar?: string; en?: string };
  role?: { ar?: string; en?: string };
  /** Identity user ID of the linked account */
  userId?: string;
  /** Public contact number */
  phone?: string;
};

export { can, canPostOn, rolesOf, type Capability };

/** "Project manager · Finance" — the user's roles, for the signed-in chip. */
export function rolesText(user: AuthUser | null | undefined, lang: Lang): string {
  return rolesOf(user).map((r) => ROLE_LABELS[r][lang]).join(' · ');
}
