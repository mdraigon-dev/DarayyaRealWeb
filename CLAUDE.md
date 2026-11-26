# Claude Code instructions for the Darayya platform

This file gives you (Claude Code) the context you need to work on this codebase effectively.

## What to do FIRST when this is a fresh clone

1. **Install dependencies**: `npm install`
2. **Update `astro.config.mjs`** — set `site:` to the user's actual Netlify URL (or custom domain). No `base` path is needed on Netlify. The Decap backend is `git-gateway`, so `public/admin/config.yml` needs no repo placeholder.
3. **Test the build locally**: `npm run build` — if this succeeds, the site is deploy-ready.
4. **Help the user push to GitHub and connect Netlify** if not already done (see README).

## Architecture overview

- **Astro 5** static site generator. Output is plain HTML/CSS/JS, hosted on Netlify.
- **React 18** for interactive components (everything client-side: nav, map, filters).
- **Astro Content Collections** with Zod schemas validate the project Markdown files.
- **Decap CMS** at `/admin/` for non-technical editing, plus a custom dashboard/editor at `/{lang}/admin/` that commits via Netlify Git Gateway.
- **Netlify** auto-builds on every push to `main` (build command in `netlify.toml` runs the auto-translator first).

## Key files

- `src/content/team/directory.json` — shared team directory (edited at `/{lang}/admin/team/`).
- `src/content/projects/*.md` — the actual content. 17 projects right now. Each is bilingual (AR + EN in YAML frontmatter).
- `src/content/config.ts` — Zod schema. If you change this, also update `public/admin/config.yml` to keep them in sync.
- `src/i18n/strings.ts` — all UI strings. ~150 keys in `ar` and `en`. Add new strings here, never hard-code Arabic or English in components.
- `src/styles/global.css` — every visual style. Design tokens at the top.
- `astro.config.mjs` — `site` must match the deployed Netlify URL (used for SEO/absolute links; routing is unaffected).
- `src/data/` — client-side logic: donation math, save-service client, roles, admin prefs. `repo.ts` + `project-file-edit.ts` are shared by every surface that commits content.

## Common tasks

### Adding a new translated string
1. Add the key to both `ar` and `en` in `src/i18n/strings.ts`
2. Use it as `t(lang, 'your_key')` in components

### Adding a new project
The user should use the Decap CMS UI at `/admin/`. If they ask you to add one programmatically, create a new file `src/content/projects/SLUG.md` matching the schema in `src/content/config.ts`. Look at an existing project for reference.

### Changing the URL structure
1. On Netlify no `base` is needed. If moving to subdirectory hosting (e.g. GitHub Pages), set `base` in `astro.config.mjs`.
2. Components already build links from `import.meta.env.BASE_URL` — keep it that way; never hard-code `/ar/...` roots.

## Things to be careful about

- **Bilingual fields are objects `{ ar, en }`**, not flat strings. Always use `loc(lang, project.title)` to extract the right one.
- **Currency is always stored as USD** in the data. Display conversion happens at render time via `fmtMoney(lang, currency, usdAmount)`.
- **Map and other Leaflet code only runs client-side** because Leaflet needs `window`. All map components use `client:load`.
- **The logo is an SVG symbol** embedded once in `BaseLayout.astro`, referenced via `<use href="#darayya-logo">`. This is why `_logo_symbol.html.txt` exists — it gets inlined at build time.
- **The Council Dashboard at `/ar/admin/` is staff-only.** Netlify blocks it for anyone without the `admin` or `team-manager` role (`public/_redirects`), and `AdminDashboard` renders nothing but a sign-in notice until the signed-in user has the `view-dashboard` capability.
- **Roles and saving.** Every save from the site goes through the save service (`netlify/functions/repo.ts`), which checks the person's Identity roles (`app_metadata.roles`) with the rules in `netlify/lib/rules.ts`. UI buttons follow `src/data/roles.ts`. Never read roles from `user_metadata` (users can edit it) and don't add new direct Git Gateway calls. See `docs/ROLES.md`.
- **Team members are linked by Identity user ID, never by email.** `engineers[].userId` (and `userId` in `src/content/team/directory.json`) decides who may post; `isAssigned()` in `src/data/roles.ts` matches it against `sub` (save service) or `id` (browser). Never add an `email` field to team entries or show staff emails anywhere: the repo and site are public. The schema drops legacy emails, and the save service refuses new ones. Staff accounts for the "Linked account" dropdown come from the save service's `staff` action (`{ id, name, roles }` only). See `docs/ROLES.md`.
- **Tests**: `npm test` runs the save-service tests in `tests/`.
- **Creating a project must never overwrite an existing one.** `commitProjectFile` in `src/data/project-file-edit.ts` handles this: create mode checks for an existing file and saves with `expectSha: null`, so the save service refuses a collision (surfaced as `ID_EXISTS`). Don't "simplify" it back to a plain commit.

## Things to NOT do without asking the user

- Don't add payment processing — they said "no payments for v1".
- Don't add backend services beyond the save service (`netlify/functions/repo.ts`), which the user asked for. The site is hosted on Netlify.
- Don't remove the AR or EN locale — bilingual is core to the product.
- Don't change the Syrian green/gold color tokens without confirming.

## If the build fails

The most common issue is one of:
1. **Schema mismatch** — a project Markdown file doesn't match the Zod schema. Astro will tell you exactly which file. Check the YAML carefully.
2. **Missing `_logo_symbol.html.txt`** — it should be in `src/components/`. If missing, copy it from the original demo or git history.
3. **Decap CMS YAML errors** — `config.yml` is YAML, not JSON. Indentation matters.

## Deploy checklist

Before pushing for the first time, the user should:
- [ ] Run `npm run build` locally and verify no errors
- [ ] Push to GitHub and connect the repo to Netlify (it reads `netlify.toml` automatically)
- [ ] Update `site:` in `astro.config.mjs` to the assigned Netlify URL, commit, push
- [ ] Enable Netlify Identity (Invite only) + Git Gateway, and invite staff — see README Step 4
- [ ] (Optional) Set `MYMEMORY_EMAIL` env var to raise the auto-translation quota

After deploy, the site is at:
- `https://YOUR-SITE-NAME.netlify.app/`
- Decap CMS: `https://YOUR-SITE-NAME.netlify.app/admin/`
- Dashboard: `https://YOUR-SITE-NAME.netlify.app/ar/admin/`
