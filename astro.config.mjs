import { defineConfig } from 'astro/config';
import react from '@astrojs/react';

// IMPORTANT: When deploying to GitHub Pages, replace these with your repo info.
// For a repo at https://github.com/USERNAME/darayya-platform :
//   site: 'https://USERNAME.github.io'
//   base: '/darayya-platform'
// If you use a custom domain, set `site` to that domain and remove `base`.
export default defineConfig({
  site: 'https://USERNAME.github.io',
  base: '/darayya-platform',
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
