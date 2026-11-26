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

/** A team member saved by the old, per-browser "Engineer presets" (before the shared team directory). */
export type LegacyPreset = {
  name: { ar: string; en: string };
  role: { ar: string; en: string };
  phone?: string;
};

export type AdminPrefs = {
  /** Name shown as the author when this admin adds a note or field update. */
  displayName: string;
};

export function defaultPrefs(): AdminPrefs {
  return { displayName: '' };
}

function keyFor(email: string): string {
  return `darayya:admin-prefs:${email.trim().toLowerCase()}`;
}

function readRaw(email: string): Record<string, unknown> | null {
  try {
    const raw = window.localStorage.getItem(keyFor(email));
    const parsed = raw ? JSON.parse(raw) : null;
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
}

export function loadPrefs(email: string | undefined | null): AdminPrefs {
  if (!email || typeof window === 'undefined') return defaultPrefs();
  const parsed = readRaw(email);
  return { displayName: typeof parsed?.displayName === 'string' ? parsed.displayName : '' };
}

export function savePrefs(email: string | undefined | null, prefs: AdminPrefs): boolean {
  if (!email || typeof window === 'undefined') return false;
  try {
    // Keep any old presets until they're moved to the shared team directory.
    const old = readRaw(email);
    const keep = Array.isArray(old?.engineerPresets) && (old!.engineerPresets as unknown[]).length
      ? { engineerPresets: old!.engineerPresets }
      : {};
    window.localStorage.setItem(keyFor(email), JSON.stringify({ ...keep, displayName: prefs.displayName }));
    return true;
  } catch {
    return false;
  }
}

/**
 * Presets this browser still holds from the old profile page. Emails they
 * may contain are dropped: team members are linked by account now.
 */
export function loadLegacyPresets(email: string | undefined | null): LegacyPreset[] {
  if (!email || typeof window === 'undefined') return [];
  const list = readRaw(email)?.engineerPresets;
  if (!Array.isArray(list)) return [];
  const bl = (v: any) => ({ ar: typeof v?.ar === 'string' ? v.ar : '', en: typeof v?.en === 'string' ? v.en : '' });
  return list
    .filter((x: any) => x && typeof x === 'object' && typeof x.name === 'object')
    .map((x: any) => ({
      name: bl(x.name),
      role: bl(x.role),
      ...(typeof x.phone === 'string' && x.phone.trim() ? { phone: x.phone.trim() } : {}),
    }))
    .filter((x) => x.name.ar.trim() || x.name.en.trim());
}

/** Forget the old presets once they've been moved (the button shows only once). */
export function clearLegacyPresets(email: string | undefined | null): void {
  if (!email || typeof window === 'undefined') return;
  const old = readRaw(email);
  if (!old) return;
  delete old.engineerPresets;
  try { window.localStorage.setItem(keyFor(email), JSON.stringify(old)); } catch { /* storage blocked */ }
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
