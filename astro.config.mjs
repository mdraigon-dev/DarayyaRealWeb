import { defineConfig } from 'astro/config';
import react from '@astrojs/react';

// Deployment config for: https://mdraigon-dev.github.io/DarayyaRealWeb/
// To redeploy elsewhere, update `site` and `base` to match the new location.
export default defineConfig({
  site: 'https://mdraigon-dev.github.io',
  base: '/DarayyaRealWeb',
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
