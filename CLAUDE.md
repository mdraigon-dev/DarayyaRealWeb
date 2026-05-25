# Claude Code instructions for the Darayya platform

This file gives you (Claude Code) the context you need to work on this codebase effectively.

## What to do FIRST when this is a fresh clone

1. **Install dependencies**: `npm install`
2. **Replace placeholders** in `astro.config.mjs` (site, base) and `public/admin/config.yml` (backend.repo) with the user's actual GitHub username and repo name. Ask them if you don't know.
3. **Test the build locally**: `npm run build` — if this succeeds, the site is deploy-ready.
4. **Help the user push to GitHub** if not already pushed.

## Architecture overview

- **Astro 5** static site generator. Output is plain HTML/CSS/JS, hosted on GitHub Pages.
- **React 18** for interactive components (everything client-side: nav, map, filters).
- **Astro Content Collections** with Zod schemas validate the project Markdown files.
- **Decap CMS** at `/admin/` for non-technical editing.
- **GitHub Actions** auto-deploys on push to `main`.

## Key files

- `src/content/projects/*.md` — the actual content. 17 projects right now. Each is bilingual (AR + EN in YAML frontmatter).
- `src/content/config.ts` — Zod schema. If you change this, also update `public/admin/config.yml` to keep them in sync.
- `src/i18n/strings.ts` — all UI strings. ~150 keys in `ar` and `en`. Add new strings here, never hard-code Arabic or English in components.
- `src/styles/global.css` — every visual style. Design tokens at the top.
- `astro.config.mjs` — `site` and `base` must match the GitHub Pages URL.

## Common tasks

### Adding a new translated string
1. Add the key to both `ar` and `en` in `src/i18n/strings.ts`
2. Use it as `t(lang, 'your_key')` in components

### Adding a new project
The user should use the Decap CMS UI at `/admin/`. If they ask you to add one programmatically, create a new file `src/content/projects/SLUG.md` matching the schema in `src/content/config.ts`. Look at an existing project for reference.

### Changing the URL structure
1. Update `astro.config.mjs` `base`
2. Update `public/admin/config.yml` `backend.repo`
3. Update any `BASE_URL` references — but everything should use `import.meta.env.BASE_URL` already.

## Things to be careful about

- **Bilingual fields are objects `{ ar, en }`**, not flat strings. Always use `loc(lang, project.title)` to extract the right one.
- **Currency is always stored as USD** in the data. Display conversion happens at render time via `fmtMoney(lang, currency, usdAmount)`.
- **Map and other Leaflet code only runs client-side** because Leaflet needs `window`. All map components use `client:load`.
- **The logo is an SVG symbol** embedded once in `BaseLayout.astro`, referenced via `<use href="#darayya-logo">`. This is why `_logo_symbol.html.txt` exists — it gets inlined at build time.
- **The Council Dashboard at `/ar/admin/` is auth-gated.** It uses Netlify Identity (loaded via `<script>` in the page) and `<AuthGate>` component. The dashboard uses `client:only="react"` (not `client:load`) so its HTML and data are NEVER server-rendered — they only appear in the page after the user is authenticated client-side. This is important: if you change it to `client:load`, sample donation data leaks into static HTML.

## Things to NOT do without asking the user

- Don't add payment processing — they said "no payments for v1".
- Don't add backend services — this must stay deployable to GitHub Pages.
- Don't remove the AR or EN locale — bilingual is core to the product.
- Don't change the Syrian green/gold color tokens without confirming.

## If the build fails

The most common issue is one of:
1. **Schema mismatch** — a project Markdown file doesn't match the Zod schema. Astro will tell you exactly which file. Check the YAML carefully.
2. **Missing `_logo_symbol.html.txt`** — it should be in `src/components/`. If missing, copy it from the original demo or git history.
3. **Decap CMS YAML errors** — `config.yml` is YAML, not JSON. Indentation matters.

## Deploy checklist

Before pushing for the first time, the user should:
- [ ] Replace `YOUR_USERNAME` and `USERNAME` in `astro.config.mjs` and `public/admin/config.yml`
- [ ] Run `npm run build` locally and verify no errors
- [ ] Push to GitHub
- [ ] Enable GitHub Pages with "GitHub Actions" as the source
- [ ] (Optional) Set up Decap OAuth — see README

After deploy, the site is at:
- `https://USERNAME.github.io/darayya-platform/`
- Admin: `https://USERNAME.github.io/darayya-platform/admin/`
