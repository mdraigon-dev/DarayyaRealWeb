/**
 * identity-cookie.ts — keep Netlify's `nf_jwt` cookie in step with sign-in.
 *
 * Netlify's CDN reads the roles in this cookie to decide who may open staff
 * pages (public/_redirects). Tokens last an hour, so it's refreshed whenever
 * the page loads for a signed-in person, and cleared on sign-out.
 */
export function setJwtCookie(token: string): void {
  document.cookie = `nf_jwt=${token}; path=/; max-age=3600; secure; samesite=lax`;
}

export function clearJwtCookie(): void {
  document.cookie = 'nf_jwt=; path=/; max-age=0; secure; samesite=lax';
}

export async function syncJwtCookie(user: { jwt: (force?: boolean) => Promise<string> } | null | undefined): Promise<void> {
  if (!user) { clearJwtCookie(); return; }
  try { setJwtCookie(await user.jwt()); } catch { /* offline: keep the old cookie */ }
}

/** Wire the cookie to the Identity widget's events. */
export function watchIdentityCookie(): void {
  const ni = (window as any).netlifyIdentity;
  if (!ni) return;
  ni.on('init', (u: any) => { void syncJwtCookie(u); });
  ni.on('login', (u: any) => { void syncJwtCookie(u); });
  ni.on('logout', () => clearJwtCookie());
}
