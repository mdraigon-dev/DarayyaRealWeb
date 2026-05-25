/**
 * Netlify Identity configuration.
 *
 * WHEN TO EDIT THIS FILE:
 *
 * The site is hosted on GitHub Pages (https://mdraigon-dev.github.io/DarayyaRealWeb/),
 * but Netlify Identity is a server-side service that only works when hosted on Netlify.
 * To make staff login work, you need ONE Netlify site whose only job is hosting the
 * Identity service. Then you point this config at it.
 *
 * SETUP STEPS (one-time, ~5 min):
 *
 *  1. Sign up at https://netlify.com (free)
 *  2. Click "Add new site" → "Import from Git" → connect this same GitHub repo.
 *     Netlify will detect Astro and auto-fill build settings. Click Deploy.
 *  3. Wait ~2 min for first deploy. You'll get a URL like
 *     https://random-name-12345.netlify.app
 *  4. In the Netlify dashboard for that site, you can rename it under
 *     Site settings → Site details → Change site name to something like
 *     "darayya-platform". The URL becomes https://darayya-platform.netlify.app
 *  5. Site settings → Identity → Enable Identity
 *  6. Identity → Registration preferences → set to "Invite only"
 *  7. Identity → Services → Git Gateway → Enable Git Gateway
 *  8. Identity → Invite users → add each staff member by email
 *  9. Paste the Netlify URL (no trailing slash) into NETLIFY_IDENTITY_URL below
 *     and commit. The next deploy makes login work on the GitHub Pages site.
 *
 * If this constant is an empty string, the login screen will show a clear
 * configuration message instead of a broken widget.
 */

export const NETLIFY_IDENTITY_URL: string = 'https://darayya-platform.netlify.app';
