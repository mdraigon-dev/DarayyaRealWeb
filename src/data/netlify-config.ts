/**
 * Netlify Identity configuration.
 *
 * Since this site is now deployed on Netlify itself, the Netlify Identity widget
 * automatically detects the right API URL from window.location.origin. No explicit
 * URL needed.
 *
 * IF you ever want to deploy this site somewhere OTHER than Netlify (e.g. on
 * GitHub Pages with Identity hosted on a separate Netlify site), set this
 * constant to the Netlify site's URL (no trailing slash):
 *     export const NETLIFY_IDENTITY_URL = 'https://your-netlify-site.netlify.app';
 *
 * For Netlify-hosted deployments, leave it empty.
 *
 * IDENTITY SETUP STEPS (in the Netlify dashboard, ~5 min):
 *
 *   1. Site settings → Identity → Enable Identity
 *   2. Identity → Registration preferences → set to "Invite only"
 *   3. Identity → Services → Git Gateway → Enable Git Gateway
 *   4. Identity → Invite users → add each staff member by email
 *
 * Staff will receive an invite link, set a password, then can log in at
 * /admin/ (Decap CMS) and /ar/admin/ (Dashboard).
 */

export const NETLIFY_IDENTITY_URL: string = '';
