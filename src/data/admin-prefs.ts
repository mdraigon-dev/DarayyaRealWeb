/**
 * admin-prefs.ts
 *
 * Per-admin preferences, stored in the browser's localStorage keyed by the
 * signed-in account's email. This keeps them entirely client-side — no repo
 * commit, no backend — which fits the platform's static-hosting model and the
 * same approach used for other per-browser conveniences.
 *
 * Preferences are therefore per-browser: they follow the account on this
 * device. (If they ever need to roam across devices, the natural upgrade is to
 * write them into Netlify Identity user_metadata instead — the shape here maps
 * onto that cleanly.)
 */

export type EngineerPreset = {
  name: { ar: string; en: string };
  role: { ar: string; en: string };
  email?: string;
  phone?: string;
};

export type AdminPrefs = {
  /** Name shown as the author when this admin adds a note or field update. */
  displayName: string;
  /** Reusable team members the admin can drop into a new project. */
  engineerPresets: EngineerPreset[];
};

export function defaultPrefs(): AdminPrefs {
  return { displayName: '', engineerPresets: [] };
}

function keyFor(email: string): string {
  return `darayya:admin-prefs:${email.trim().toLowerCase()}`;
}

export function loadPrefs(email: string | undefined | null): AdminPrefs {
  if (!email || typeof window === 'undefined') return defaultPrefs();
  try {
    const raw = window.localStorage.getItem(keyFor(email));
    if (!raw) return defaultPrefs();
    const parsed = JSON.parse(raw) as Partial<AdminPrefs>;
    return {
      displayName: typeof parsed.displayName === 'string' ? parsed.displayName : '',
      engineerPresets: Array.isArray(parsed.engineerPresets)
        ? parsed.engineerPresets.filter(isEngineerPreset)
        : [],
    };
  } catch {
    return defaultPrefs();
  }
}

export function savePrefs(email: string | undefined | null, prefs: AdminPrefs): boolean {
  if (!email || typeof window === 'undefined') return false;
  try {
    window.localStorage.setItem(keyFor(email), JSON.stringify(prefs));
    return true;
  } catch {
    return false;
  }
}

/**
 * The author name to use for this user's notes/updates: their saved display
 * name if set, otherwise their Identity full name, otherwise their email.
 */
export function preferredAuthorName(
  user: { email: string; user_metadata?: { full_name?: string } },
  prefs: AdminPrefs | null | undefined,
): string {
  const chosen = prefs?.displayName?.trim();
  if (chosen) return chosen;
  return user.user_metadata?.full_name || user.email;
}

/**
 * Who to name in a commit message. The repo is public, so this is the
 * person's display name, never their email address.
 */
export function commitName(user: { email: string; user_metadata?: { full_name?: string } } | null | undefined): string {
  if (!user) return 'admin';
  let prefs: AdminPrefs | null = null;
  try { prefs = loadPrefs(user.email); } catch { /* storage blocked */ }
  const n = preferredAuthorName(user, prefs).trim();
  return n && !n.includes('@') ? n : 'admin';
}

/**
 * The author shown publicly on a note or update. Same as preferredAuthorName
 * but never an email address — those end up in the repo and on public pages.
 * Falls back to "City Council" when the account has no display name.
 */
export function publicAuthor(
  typed: string,
  user: { email: string; user_metadata?: { full_name?: string } },
  prefs: AdminPrefs | null | undefined,
): { ar: string; en: string } {
  const n = (typed.trim() || preferredAuthorName(user, prefs)).trim();
  if (n && !n.includes('@')) return { ar: n, en: n };
  return { ar: 'مجلس المدينة', en: 'City Council' };
}

function isEngineerPreset(x: unknown): x is EngineerPreset {
  if (!x || typeof x !== 'object') return false;
  const e = x as Record<string, unknown>;
  return typeof e.name === 'object' && typeof e.role === 'object';
}
