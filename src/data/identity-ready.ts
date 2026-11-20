/**
 * identity-ready.ts — has the Netlify Identity widget started itself yet?
 *
 * The widget script (loaded in BaseLayout) calls its own init() on
 * DOMContentLoaded. Components must NOT call netlifyIdentity.init() again:
 * a second init reloads the stored user, and right after a password-reset
 * link that is the user the link just signed in. The widget then swaps its
 * "set a new password" form for the signed-in screen, so the person ends up
 * logged in without ever choosing a password.
 *
 * Instead, components wait until the widget has started (its iframe exists)
 * and then read currentUser().
 */
export function identityStarted(): boolean {
  return typeof document !== 'undefined' && !!document.getElementById('netlify-identity-widget');
}
