# نماء | Namaa — Darayya reconstruction platform

A bilingual (Arabic/English) reconstruction platform for the Darayya City Council in Syria. Built with **Astro**, **React**, **Decap CMS**, and deployed via **GitHub Pages**.

[![Status](https://img.shields.io/badge/status-v1-007A3D)](.) [![Lang](https://img.shields.io/badge/lang-AR%20%2B%20EN-C9A14A)](.) [![License](https://img.shields.io/badge/license-MIT-blue)](LICENSE)

---

## What this is

Three things in one repo:

1. **Public website** at `https://USERNAME.github.io/darayya-platform/` — bilingual site showing reconstruction projects with map, photos, transparency reports.
2. **Council Dashboard** at `/ar/admin/` and `/en/admin/` — **staff-only**, requires login. Shows live overview: donations feed, weekly chart, alerts, activity log, top donors, project management table.
3. **Decap CMS editor** at `/admin/` — **staff-only**, requires login. Friendly forms for editing project content. Saves directly to GitHub.

Both staff pages share the same login session. Staff log in once and can use both.

When staff edit a project in Decap and click "Publish":
When staff edit a project in Decap and click "Publish":
- Decap commits the change to GitHub via Git Gateway
- Netlify rebuilds the site automatically
- The public site updates in about 60 seconds

## Authentication model

The dashboard and CMS use **Netlify Identity** for login (configured in the Netlify dashboard, see Step 4 below).

The dashboard at `/ar/admin/` is publicly viewable — anyone can see the project list, donations feed, and activity. Editing actions (✎ Edit, + New Project) link to Decap CMS at `/admin/`, which requires login.

When v2 adds real donation processing, the dashboard should be moved behind authentication and real financial data should come from a backend API — never embed real financial data in static HTML.

---

## Quick deploy guide (Netlify)

This site deploys to **Netlify**. One platform, one URL — simpler than dual-hosting.

### Step 1 — Push the code to GitHub

```bash
# From inside this folder
git init -b main
git add .
git commit -m "Initial commit: Darayya platform"
gh repo create darayya-platform --public --source=. --remote=origin --push
```

Or, if not using the `gh` CLI:
1. Go to https://github.com/new
2. Create a public repo
3. Run:
   ```bash
   git init -b main
   git remote add origin https://github.com/YOUR_USERNAME/REPO_NAME.git
   git add . && git commit -m "Initial commit"
   git push -u origin main
   ```

### Step 2 — Connect Netlify

1. Sign up at https://netlify.com (free)
2. **Add new site → Import from Git** → connect your GitHub repo
3. Netlify reads `netlify.toml` from the repo for build settings — no manual config needed
4. First deploy takes ~2 min. You'll get a URL like `https://random-name-12345.netlify.app`
5. Optional: **Site settings → Site details → Change site name** to something memorable like `darayya-platform`

### Step 3 — Update `astro.config.mjs` with your real URL

Edit `astro.config.mjs` and change the `site:` value to your actual Netlify URL (or your custom domain if you have one). This is used for SEO and absolute links — it doesn't affect routing.

```js
site: 'https://YOUR-SITE-NAME.netlify.app',
```

Commit and push. Netlify redeploys automatically.

### Step 4 — Enable Netlify Identity (login for admin)

The Decap CMS editor at `/admin/` and Council Dashboard at `/ar/admin/` require staff to log in.

1. In Netlify dashboard → **Site settings → Identity → Enable Identity**
2. **Identity → Registration preferences → Invite only** (so random people can't sign up)
3. **Identity → Services → Git Gateway → Enable Git Gateway** (lets Decap commit content edits back to your repo)
4. **Identity → Invite users** → add staff by email

Staff receive an invite, set a password, then can log in at `/admin/` to edit content.

### Step 5 — Auto-translation (optional)

The CMS lets staff fill only Arabic and leave English blank. Without this step, EN visitors see Arabic on EN pages.

The included `scripts/auto-translate.mjs` runs as part of every Netlify build (see `netlify.toml`). It scans `src/content/projects/*.md`, finds any bilingual field where `en:` is empty, calls MyMemory's free API, and fills the field for the duration of that build.

**To raise MyMemory's daily limit from 5,000 → 50,000 chars:**
1. Pick any email address (a council inbox is fine — MyMemory doesn't verify it)
2. In Netlify dashboard → **Site settings → Environment variables → Add a variable**
3. Name: `MYMEMORY_EMAIL`, value: the email
4. Trigger a redeploy

**Caveats** (honest):
- Translations are NOT committed back to the repo — they're regenerated on every Netlify build. If MyMemory is rate-limited, the build still succeeds and EN pages fall back to Arabic.
- If staff edit a translation manually in Decap and click Publish, that edit IS committed and the auto-translator will skip it from then on (it never overwrites a non-empty EN field).
- Every auto-translation is marked with `en_auto: true` in source and displays a small "⚙ Auto-translated" pill on the public site so readers know to report mistranslations.
- Use the **Translation Helper** widget on `/ar/admin/` to spot-check translations before saving in Decap.

**To turn off auto-translation:** edit `netlify.toml` and change the `command =` line to just `"npm run build"`.

---

## Local development

```bash
npm install
npm run dev
```

The site opens at `http://localhost:4321/darayya-platform/`. The admin panel is at `http://localhost:4321/darayya-platform/admin/`.

To preview changes from Decap locally without OAuth, run:
```bash
npm run cms       # in a separate terminal — proxies to GitHub
npm run dev       # then visit /admin/ and log in
```

---

## Project structure

```
darayya-platform/
├── astro.config.mjs                # ← Edit site + base path here
├── package.json
├── tsconfig.json
├── public/
│   ├── admin/
│   │   ├── index.html              # ← Decap CMS entry point
│   │   └── config.yml              # ← Edit CMS schema + GitHub repo here
│   ├── logos/
│   │   └── darayya-emblem.svg
│   ├── fonts/                      # (empty — using Google Fonts CDN)
│   └── images/uploads/             # ← Photos uploaded via admin land here
├── src/
│   ├── content/
│   │   ├── config.ts               # ← Content schema (Zod validation)
│   │   ├── projects/               # ← 17 project Markdown files
│   │   │   ├── roads-jalaa.md
│   │   │   ├── water-east.md
│   │   │   └── ... (15 more)
│   │   └── site/
│   │       └── settings.json       # ← Global site settings
│   ├── components/
│   │   ├── Nav.tsx                 # ← Top navigation + lang/currency toggles
│   │   ├── Footer.tsx
│   │   ├── Logo.tsx                # ← Inline SVG via <use>
│   │   ├── HomeContent.tsx         # ← Home page React content
│   │   ├── ProjectCard.tsx
│   │   ├── ProjectsListContent.tsx
│   │   ├── ProjectDetailContent.tsx
│   │   ├── ProjectPhoto.tsx        # ← Generated SVG scenes (7 types)
│   │   ├── DarayyaMap.tsx          # ← Leaflet interactive map
│   │   ├── HealthPill.tsx
│   │   ├── TransparencyContent.tsx
│   │   └── _logo_symbol.html.txt   # ← Inline SVG symbol definition
│   ├── i18n/
│   │   └── strings.ts              # ← ~150 UI strings, AR + EN
│   ├── layouts/
│   │   └── BaseLayout.astro        # ← HTML shell with fonts/Leaflet/styles
│   ├── pages/
│   │   ├── index.astro             # ← Redirects to /ar/
│   │   ├── ar/
│   │   │   ├── index.astro         # AR home
│   │   │   ├── transparency.astro
│   │   │   └── projects/
│   │   │       ├── index.astro     # AR project list
│   │   │       └── [id].astro      # AR project detail (dynamic)
│   │   └── en/
│   │       └── ... (mirrors AR)
│   └── styles/
│       └── global.css              # ← Design tokens + all CSS
└── .github/workflows/
    └── deploy.yml                  # ← GitHub Pages deploy workflow
```

---

## Design system

The site uses the **new Syrian visual identity** colors:

```css
--sy-green:    #007A3D;   /* Official Syrian flag green */
--sy-green-dk: #00582C;   /* Primary text & buttons */
--sy-gold:     #C9A14A;   /* Qasioun gold */
--sy-paper:    #FDFBF6;   /* Warm off-white background */
```

Fonts:
- **Arabic**: Sakkal Majalla → Markazi Text → Amiri (graceful fallback)
- **English**: Lora (serif headings) + Inter (sans body)

---

## What's NOT included in v1

- **Real payment processing** — donation button shows but is disabled (the modal says "Online donations coming soon"). Add later via LaunchGood, a partner NGO, or a custom Stripe integration in a separate backend.
- **Admin dashboard** — the public admin in `/admin/` is for *editing content* (Decap CMS). A separate analytics dashboard (donations feed, charts, alerts) was in the demo but isn't in this build — that's a v2 feature requiring a backend.

---

## License

MIT — feel free to fork and adapt for other Syrian cities.

---

## Credits

- Design inspired by the official 2025 Syrian visual identity
- Built with [Astro](https://astro.build/), [Decap CMS](https://decapcms.org/), [Leaflet](https://leafletjs.com/), and [OpenStreetMap](https://www.openstreetmap.org/)

★ ★ ★

**مَعَاً نَبْنِي داريَّا** — حجراً حجراً، حيّاً حيّاً.
