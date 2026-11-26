/**
 * user-settings.ts — personal display settings from the "My preferences" page.
 *
 * Kept in localStorage so they apply instantly on this device (an inline
 * script in BaseLayout applies them before the page paints), and, for
 * signed-in staff, copied to their Identity account (user_metadata.preferences)
 * so they follow the person to other devices. user_metadata is editable by
 * the user: it holds preferences only, never anything that grants access.
 */

export type TextSize = 'normal' | 'large' | 'larger';
export type UserSettings = {
  textSize: TextSize;
  reduceMotion: boolean;
  /** Language to open when visiting the site's root address; '' = Arabic default */
  language: '' | 'ar' | 'en';
};

/** Also read by the inline script in BaseLayout.astro and src/pages/index.astro. */
export const SETTINGS_KEY = 'darayya:settings';

export const DEFAULT_SETTINGS: UserSettings = { textSize: 'normal', reduceMotion: false, language: '' };

export function normalizeSettings(raw: unknown): UserSettings {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  return {
    textSize: r.textSize === 'large' || r.textSize === 'larger' ? r.textSize : 'normal',
    reduceMotion: r.reduceMotion === true,
    language: r.language === 'ar' || r.language === 'en' ? r.language : '',
  };
}

export function loadSettings(): UserSettings {
  try {
    const raw = window.localStorage.getItem(SETTINGS_KEY);
    return normalizeSettings(raw ? JSON.parse(raw) : null);
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

/** Apply to the current page (attributes on <html>, read by global.css). */
export function applySettings(s: UserSettings): void {
  const el = document.documentElement;
  if (s.textSize === 'normal') el.removeAttribute('data-text-size');
  else el.setAttribute('data-text-size', s.textSize);
  if (s.reduceMotion) el.setAttribute('data-reduce-motion', '');
  else el.removeAttribute('data-reduce-motion');
}

/**
 * Netlify sends the site's main address to /en/ when this cookie is present
 * (netlify.toml), otherwise to Arabic.
 */
export const LANG_COOKIE = 'darayya_lang_en';
function syncLanguageCookie(language: UserSettings['language']): void {
  try {
    document.cookie = language === 'en'
      ? `${LANG_COOKIE}=1; path=/; max-age=31536000; samesite=lax; secure`
      : `${LANG_COOKIE}=; path=/; max-age=0; samesite=lax; secure`;
  } catch { /* cookies blocked */ }
}

/** Save on this device and apply now. */
export function saveSettings(s: UserSettings): void {
  try { window.localStorage.setItem(SETTINGS_KEY, JSON.stringify(s)); } catch { /* storage blocked */ }
  syncLanguageCookie(s.language);
  applySettings(s);
}

type IdentityUser = {
  user_metadata?: Record<string, unknown>;
  update?: (attrs: Record<string, unknown>) => Promise<unknown>;
};

/** Copy the settings to the signed-in account. Best effort. */
export async function pushSettingsToAccount(user: IdentityUser | null | undefined, s: UserSettings): Promise<boolean> {
  if (!user?.update) return false;
  try {
    await user.update({ data: { preferences: s } });
    return true;
  } catch {
    return false;
  }
}

/**
 * When someone signs in (or a signed-in page loads), take the settings saved
 * on their account, if any, so another device's choices apply here too.
 */
export function pullSettingsFromAccount(user: IdentityUser | null | undefined): void {
  const remote = user?.user_metadata?.preferences;
  if (!remote || typeof remote !== 'object') return;
  const next = normalizeSettings(remote);
  const now = loadSettings();
  if (JSON.stringify(next) !== JSON.stringify(now)) saveSettings(next);
}

/** Smooth scrolling unless the person asked for less motion. */
export function scrollBehavior(): ScrollBehavior {
  if (typeof document === 'undefined') return 'auto';
  const reduced = document.documentElement.hasAttribute('data-reduce-motion')
    || (typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches);
  return reduced ? 'auto' : 'smooth';
}
