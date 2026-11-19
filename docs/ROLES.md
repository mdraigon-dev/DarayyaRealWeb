# Roles and permissions

Staff sign in with Netlify Identity. What each person can do depends on the
roles in their Identity account. A person can hold several roles and gets
everything each one allows.

| Role (type exactly) | Arabic | Can do |
|---|---|---|
| `admin` | مسؤول النظام | Everything, including deletes, reversing contributions, and the content manager at `/admin/` |
| `team-manager` | مدير الفريق | See the Dashboard; edit the "How to contribute" page |
| `project-manager` | مدير المشاريع | Create and edit projects (details, budgets, line items, team); post notes, updates and photos on any project; delete notes, updates and photos |
| `engineer` | مهندس | Post notes, field updates and photos on projects whose team lists their email |
| `secretary` | أمين السر | Upload circulars and reports (cannot delete or replace them) |
| `finance` | المالية | Record contributions against projects (cannot reverse them) |

Only `admin` can: delete documents, delete activity-log entries, reverse a
recorded contribution, change a raised amount directly, or delete a project.

## How it's enforced

- **Saves** go through the save service (`netlify/functions/repo.ts`). It
  reads the person's roles from their Identity token, compares each change
  with the file in the repository, and refuses anything their roles don't
  allow (`netlify/lib/rules.ts`). It commits to GitHub with its own token,
  so staff accounts never get direct write access to the repository.
- **Staff pages** (Dashboard, project editor, profile, `/admin/`) are blocked
  by Netlify for anyone without the right role (`public/_redirects`).
- **Buttons** on the site follow the same rules (`src/data/roles.ts`), so
  people only see what they can use.

## One-time setup in Netlify

1. **GitHub token for the save service.** On GitHub: Settings → Developer
   settings → Fine-grained personal access tokens → Generate new token.
   Repository access: *Only select repositories* → this repository.
   Permissions: *Contents: Read and write*. Copy the token. Note its expiry
   date: when it expires, saving stops until you replace it.
2. **Environment variables.** Netlify → Project configuration → Environment
   variables → Add:
   - `GITHUB_TOKEN` = the token (mark it secret; scope: Functions)
   - `GITHUB_REPO` = `owner/name` of this repository
   - `GITHUB_BRANCH` = `main` (optional)
3. **Lock Git Gateway to admins.** Netlify → Project configuration →
   Identity → Services → Git Gateway → Edit settings → Roles: `admin`.
   Without this, any signed-in account could still write to the repository
   through Git Gateway and skip the role rules.
4. **Invite only.** Identity → Registration → *Invite only*.
5. **Give everyone their roles** (next section) — including yourself, as
   `admin` — before deploying this version. Without a role, an account can't
   save anything.

## Giving someone a role

Netlify → Identity → Users → click the person → Edit settings → **Roles**:
type the roles separated by commas, e.g. `secretary, finance` → Save.

The person must **sign out and sign in again** for a change to take effect.

Engineers also need to be on the project's team: in the project editor, add
them under the team section with the same email they sign in with.

## Changing the rules

Edit `GRANTS` in `src/data/roles.ts` (what each role can do) and, for page
access, `GATED_PAGES` there plus the matching lines in `public/_redirects`.
The save service's checks are in `netlify/lib/rules.ts`.
