# مَعَاً نَبْنِي داريَّا — Together We Rebuild Darayya

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
- Decap commits the change to GitHub
- GitHub Actions rebuilds the site automatically
- The public site updates in about 60 seconds

## Authentication model

The dashboard and CMS use **Netlify Identity** for login. This is a free service that handles user accounts, password resets, and session management without requiring you to run a server.

**Security note**: The dashboard's auth check happens client-side because GitHub Pages can only serve static HTML. Sample dashboard data (donor names, donation amounts, activity log) is **only loaded after authentication** — it's not in the static HTML that visitors can view-source. However, this protection level is appropriate for v1 because the data is illustrative sample data anyway. When v2 adds real donation processing, that data must come from a backend API that does proper server-side authorization — never embed real financial data in static HTML.

---

## Quick deploy guide (for Claude Code or manual setup)

### Step 1 — Create the GitHub repository

```bash
# From inside this folder
git init -b main
git add .
git commit -m "Initial commit: Darayya platform v1"
gh repo create darayya-platform --public --source=. --remote=origin --push
```

Or, if not using the `gh` CLI:
1. Go to https://github.com/new
2. Create a repo named **`darayya-platform`** (public, no README/gitignore/license — we have them)
3. Run:
   ```bash
   git init -b main
   git remote add origin https://github.com/YOUR_USERNAME/darayya-platform.git
   git add . && git commit -m "Initial commit"
   git push -u origin main
   ```

### Step 2 — Replace placeholders

Before the first deploy, replace `YOUR_GITHUB_USERNAME` and `USERNAME` in these files:

- **`astro.config.mjs`** — update `site` and `base`:
  ```js
  site: 'https://YOUR_USERNAME.github.io',
  base: '/darayya-platform',
  ```

- **`public/admin/config.yml`** — update the `backend.repo`:
  ```yaml
  repo: YOUR_USERNAME/darayya-platform
  ```

If using a custom domain (e.g. `darayya-council.org`):
- Set `site` to `https://darayya-council.org`
- Remove or set `base: '/'`
- Add a `CNAME` file in `public/` with just the domain name

### Step 3 — Enable GitHub Pages

1. Go to your repo on GitHub → **Settings** → **Pages**
2. Under **Source**, select **GitHub Actions** (not "Deploy from branch")
3. Push any commit to `main` — the included workflow (`.github/workflows/deploy.yml`) will build and deploy automatically.
4. First build takes ~2 minutes. After that, the URL is live.

### Step 4 — Set up authentication (required for admin login)

Both the **Decap CMS editor** at `/admin/` and the **Council Dashboard** at `/ar/admin/` require staff to log in. They share the same login session.

**This site is hosted on GitHub Pages**, which doesn't run server-side services. Authentication uses **Netlify Identity** — a free service hosted on Netlify that handles user accounts. You'll set up one tiny Netlify site whose only job is hosting the Identity service. The public site stays on GitHub Pages.

#### One-time setup (~5 min)

1. Sign up at https://netlify.com (free)
2. Click **Add new site** → **Import from Git** → connect this same GitHub repo (`mdraigon-dev/DarayyaRealWeb`). Netlify will detect Astro and auto-fill build settings. Click Deploy.
3. Wait ~2 min for the first deploy. Netlify gives you a URL like `https://random-name-12345.netlify.app`.
4. In Netlify dashboard → **Site settings** → **Site details** → **Change site name** to something stable like `darayya-platform`. URL becomes `https://darayya-platform.netlify.app`.
5. **Site settings** → **Identity** → **Enable Identity**
6. **Identity** → **Registration preferences** → set to **"Invite only"**
7. **Identity** → **Services** → **Git Gateway** → **Enable Git Gateway**
8. **Identity** → **Invite users** → add each staff member by email
9. Open `src/data/netlify-config.ts` and confirm `NETLIFY_IDENTITY_URL` matches your Netlify site URL (currently set to `https://darayya-platform.netlify.app`). If you used a different site name in step 4, update this constant **and** the URL in `public/admin/index.html` (both files are commented to remind you they need to match). Commit and push.

After that, login on `https://mdraigon-dev.github.io/DarayyaRealWeb/admin/` and `/ar/admin/` and `/en/admin/` will work.

#### Why this setup?

GitHub Pages serves static files only — there's no `/.netlify/identity` endpoint. The Netlify Identity widget tries to auto-detect that URL from `window.location.origin`, which on GitHub Pages resolves wrong and produces the error: *"Failed to load settings from /.netlify/identity"*. Our admin pages set `window.netlifyIdentityConfig.APIUrl` to point at the Netlify site explicitly, fixing the error.

---

### Step 5 — Push the workflow file

The `.github/workflows/deploy.yml` file is included in the repo. **If you push with a Personal Access Token (PAT), the PAT must have the `workflow` scope** — otherwise GitHub rejects the push with:

> refusing to allow a Personal Access Token to create or update workflow `.github/workflows/deploy.yml` without `workflow` scope

To fix: regenerate your PAT with `workflow` scope checked, or use SSH/`gh auth login`. After the first successful push, the workflow auto-deploys on every push to `main`.

---

### Step 6 — Auto-translation (optional but recommended)

The CMS lets staff fill only Arabic and leave English blank. By default, EN visitors then see Arabic on the English pages (functional but ugly). To get real English output, the workflow can call **MyMemory** (free translation API) to fill in the blanks before each build.

**How it works:**

1. Staff create/edit a project in Decap CMS, filling only Arabic
2. Staff click "Publish" → commits to GitHub
3. GitHub Actions workflow runs:
   - Scans `src/content/projects/*.md` for any bilingual fields with empty `en:`
   - For each, calls MyMemory: `https://api.mymemory.translated.net/get?q=...&langpair=ar|en`
   - Fills the `en:` field with the result, plus sets `en_auto: true` to mark it as machine-translated
   - Commits the filled translations back to `main` with message `chore: auto-translate empty EN fields via MyMemory [skip ci]`
   - Builds and deploys
4. Visitors on EN pages now see English. Any field that was auto-translated displays a small **"⚙ Auto-translated"** pill so readers know to take rough phrasing with a grain of salt.

**Free tier limits** (from MyMemory docs):
- Anonymous: **5,000 chars/day per IP**
- With registered email: **50,000 chars/day**

For the 17 starter projects with sub-projects and updates, total Arabic content is roughly 8,000–15,000 chars. The anonymous limit may be tight on the first deploy.

**To raise the limit:**
1. Pick any email address (a council inbox is fine — MyMemory doesn't verify it)
2. In your GitHub repo: **Settings → Secrets and variables → Actions → New repository secret**
3. Name: `MYMEMORY_EMAIL`, value: the email
4. The workflow will pass it to MyMemory and your daily limit goes to 50,000 chars

**To turn auto-translation off entirely:** delete the `Auto-translate AR → EN` and `Commit translations back to main` steps from `.github/workflows/deploy.yml`. The build still works; EN pages just show Arabic for empty fields.

**Reviewing & fixing translations:**
- Every auto-translation lives in `src/content/projects/*.md` under the `en:` field with a sibling `en_auto: true`. You can `grep -r "en_auto: true" src/content/projects/` to find all of them.
- To fix a wrong translation, edit the project in Decap CMS and fill the English field manually. The script never overwrites a non-empty EN field, so your fix sticks.
- On the dashboard at `/ar/admin/`, there's a **Translation Helper** widget where staff can paste Arabic and get a quick English preview from MyMemory before saving in Decap — useful for sanity-checking tricky technical terms.

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
