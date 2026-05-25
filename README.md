# مَعَاً نَبْنِي داريَّا — Together We Rebuild Darayya

A bilingual (Arabic/English) reconstruction platform for the Darayya City Council in Syria. Built with **Astro**, **React**, **Decap CMS**, and deployed via **GitHub Pages**.

[![Status](https://img.shields.io/badge/status-v1-007A3D)](.) [![Lang](https://img.shields.io/badge/lang-AR%20%2B%20EN-C9A14A)](.) [![License](https://img.shields.io/badge/license-MIT-blue)](LICENSE)

---

## What this is

Three things in one repo:

1. **Public website** at `https://USERNAME.github.io/darayya-platform/` — bilingual site showing reconstruction projects with map, photos, transparency reports.
2. **Admin panel** at `https://USERNAME.github.io/darayya-platform/admin/` — Decap CMS friendly editor for council staff to add/edit projects without touching code.
3. **Static content** in `src/content/projects/` — one Markdown file per project, edited via the admin panel.

When staff edit a project in the admin and click "Publish":
- Decap commits the change to GitHub
- GitHub Actions rebuilds the site automatically
- The public site updates in about 60 seconds

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

### Step 4 — Set up Decap CMS GitHub OAuth (required for staff to log in)

The admin panel needs an OAuth proxy so staff can authenticate with GitHub. The simplest free option:

**Option A — Use Sebastian Gierlinger's free proxy** (recommended for getting started fast):
1. Register a new OAuth App at https://github.com/settings/applications/new
   - Application name: `Darayya CMS`
   - Homepage URL: `https://YOUR_USERNAME.github.io/darayya-platform/`
   - Authorization callback URL: `https://api.netlify.com/auth/done` (yes, even without Netlify — this proxy just needs *any* URL)
2. Note your **Client ID** and **Client Secret**
3. Deploy your own free OAuth handler on Cloudflare Workers (5 minutes): https://github.com/sterlingwes/cloudflare-decap-oauth
4. Update `public/admin/config.yml` to point to your worker URL:
   ```yaml
   backend:
     name: github
     repo: YOUR_USERNAME/darayya-platform
     branch: main
     base_url: https://YOUR_WORKER.workers.dev
   ```

**Option B — Quick test using Netlify Identity** (no Cloudflare needed):
- Sign up at https://netlify.com (free)
- Connect your GitHub repo → enable **Identity** in the site settings
- Invite council staff by email
- Replace the backend section of `config.yml` with:
  ```yaml
  backend:
    name: git-gateway
    branch: main
  ```
- Add the Netlify Identity widget to `public/admin/index.html`:
  ```html
  <script src="https://identity.netlify.com/v1/netlify-identity-widget.js"></script>
  ```

Either way works. **Option A is purer GitHub Pages; Option B is easier for non-technical setup.**

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
