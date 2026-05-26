import { defineConfig } from 'astro/config';
import react from '@astrojs/react';

// Deployment config for Netlify.
// Netlify serves the site at the domain root (e.g. https://your-site.netlify.app/),
// so we don't need a `base` path prefix.
//
// If you ever switch to GitHub Pages, change to:
//   site: 'https://USERNAME.github.io',
//   base: '/REPO_NAME',
export default defineConfig({
  site: 'https://luminous-sunshine-7432ff.netlify.app',
  // No base path — Netlify serves from the root.
  output: 'static',
  trailingSlash: 'always',

  integrations: [react()],

  i18n: {
    locales: ['ar', 'en'],
    defaultLocale: 'ar',
    routing: {
      prefixDefaultLocale: true, // /ar/... and /en/...
    },
  },

  build: {
    assets: 'assets',
  },
});
