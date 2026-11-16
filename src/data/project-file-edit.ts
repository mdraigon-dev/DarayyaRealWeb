/**
 * project-file-edit.ts
 *
 * Shared read-modify-write logic for every place that commits to a project's
 * Markdown file: the inline "add note" and "add field update" forms, and the
 * full project editor.
 *
 * The bug this fixes:
 * GitHub's contents API is eventually consistent. Right after a commit, a read
 * can still return the *old* SHA for a while, and any intermediary cache makes
 * it worse. The previous flow pinned each commit to a freshly-read SHA, so the
 * second edit in a session (a note, then an update, then a project edit) got
 * pinned to a stale SHA and failed with 409 "File changed since you opened it".
 *
 * Three things fix it together:
 *   1. Reads are now uncached (see git-gateway getFileSha/getFileContent).
 *   2. A single module-level cache is shared across ALL form islands on the
 *      page, seeded from the SHA that each commit's PUT response returns. So a
 *      note followed by an update reuses the note commit's SHA — no re-read,
 *      no stale window, no 409.
 *   3. If a 409 still happens (cold cache, another author, or a PUT that didn't
 *      echo a SHA), we retry: re-read the latest, replay the change, commit
 *      again, backing off until GitHub converges. Appends are always safe to
 *      replay; the editor hydrates live data on load so its retry is safe too.
 */

import { parse as parseYaml, stringify as stringifyYaml } from 'yaml';
import { getFileContent, getFileSha, commitFile, deleteFile, GitConflictError } from './git-gateway';

export type ProjectFileCache = { content: string; sha: string };

// Matches what the adders have always written. The editor passes its own
// (see serializeEditor) so its output stays byte-for-byte what it produced before.
const YAML_OPTS_APPEND = {
  lineWidth: 0,
  defaultStringType: 'QUOTE_DOUBLE' as const,
  defaultKeyType: 'PLAIN' as const,
};
const YAML_OPTS_EDITOR = {
  lineWidth: 0,
  defaultStringType: 'QUOTE_DOUBLE' as const,
};

// Shared across every island on the page for the lifetime of the tab. Keyed by
// repo file path. Holds the last content + SHA we know to be current, so
// successive edits chain without touching the (laggy) read API.
const sessionCache = new Map<string, ProjectFileCache>();

const MAX_ATTEMPTS = 7;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
// 0.5s, 1s, 2s, 4s, 6s, 6s → ~20s total worst case before giving up.
const backoff = (i: number) => Math.min(6000, 500 * 2 ** i);

const projectPath = (id: string) => `src/content/projects/${id}.md`;

function splitFrontmatter(content: string): { frontmatter: Record<string, unknown>; body: string } {
  const m = content.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!m) throw new Error('INVALID_FORMAT');
  return { frontmatter: parseYaml(m[1]) as Record<string, unknown>, body: m[2] };
}

function recordCommit(path: string, content: string, sha: string | null): void {
  // A known SHA lets the next edit skip the read entirely. If the PUT response
  // didn't include one, drop the entry so the next edit reads fresh (and the
  // retry loop absorbs any lag) rather than pinning to a guessed SHA.
  if (sha) sessionCache.set(path, { content, sha });
  else sessionCache.delete(path);
}

async function loadBase(path: string): Promise<ProjectFileCache> {
  const cached = sessionCache.get(path);
  if (cached) return cached;
  const fresh = await getFileContent(path);
  if (!fresh) throw new Error('NOT_FOUND');
  sessionCache.set(path, fresh);
  return fresh;
}

async function refreshCacheAfterConflict(path: string): Promise<void> {
  sessionCache.delete(path);
  const fresh = await getFileContent(path);
  if (fresh) sessionCache.set(path, fresh);
}

// ────────────────────────────────────────────────────────────────────
// Inline forms: append a note / update
// ────────────────────────────────────────────────────────────────────

export async function appendProjectItem(opts: {
  projectId: string;
  field: 'comments' | 'updates';
  item: unknown;
  position: 'start' | 'end';
  message: string;
}): Promise<void> {
  const path = projectPath(opts.projectId);
  let lastErr: unknown;

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const base = await loadBase(path);

    const { frontmatter, body } = splitFrontmatter(base.content);
    const existing = Array.isArray(frontmatter[opts.field]) ? (frontmatter[opts.field] as unknown[]) : [];
    frontmatter[opts.field] = opts.position === 'start' ? [opts.item, ...existing] : [...existing, opts.item];
    const newContent = `---\n${stringifyYaml(frontmatter, YAML_OPTS_APPEND)}---\n${body}`;

    try {
      const newSha = await commitFile(path, newContent, opts.message, 'main', base.sha);
      recordCommit(path, newContent, newSha);
      return;
    } catch (err) {
      if (!(err instanceof GitConflictError)) throw err;
      lastErr = err;
      await sleep(backoff(attempt));
      await refreshCacheAfterConflict(path);
    }
  }
  throw lastErr ?? new GitConflictError('CONFLICT');
}

/**
 * Append several items to different frontmatter arrays in a SINGLE commit.
 * Used when one action touches more than one list — e.g. a field update that
 * also drops photos into the gallery — so they land together atomically and
 * share the same retry-through-lag protection as appendProjectItem.
 */
export async function appendProjectItems(opts: {
  projectId: string;
  ops: Array<{ field: 'comments' | 'updates' | 'photos'; item: unknown; position: 'start' | 'end' }>;
  message: string;
}): Promise<void> {
  const path = projectPath(opts.projectId);
  let lastErr: unknown;

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const base = await loadBase(path);
    const { frontmatter, body } = splitFrontmatter(base.content);

    for (const op of opts.ops) {
      const existing = Array.isArray(frontmatter[op.field]) ? (frontmatter[op.field] as unknown[]) : [];
      frontmatter[op.field] = op.position === 'start' ? [op.item, ...existing] : [...existing, op.item];
    }
    const newContent = `---\n${stringifyYaml(frontmatter, YAML_OPTS_APPEND)}---\n${body}`;

    try {
      const newSha = await commitFile(path, newContent, opts.message, 'main', base.sha);
      recordCommit(path, newContent, newSha);
      return;
    } catch (err) {
      if (!(err instanceof GitConflictError)) throw err;
      lastErr = err;
      await sleep(backoff(attempt));
      await refreshCacheAfterConflict(path);
    }
  }
  throw lastErr ?? new GitConflictError('CONFLICT');
}

// ────────────────────────────────────────────────────────────────────
// Full project editor: write the whole file
// ────────────────────────────────────────────────────────────────────

/**
 * Read the live project file so the editor can start from current truth —
 * in particular, comments/updates added inline since the last build. Returns
 * the parsed frontmatter and caches the SHA for the eventual save.
 */
export async function loadProjectForEdit(projectId: string): Promise<Record<string, unknown> | null> {
  const path = projectPath(projectId);
  const fresh = await getFileContent(path);
  if (!fresh) return null;
  sessionCache.set(path, fresh);
  return splitFrontmatter(fresh.content).frontmatter;
}

/**
 * Commit a full project file with the same retry-through-lag behaviour as
 * appendProjectItem.
 *
 * mode 'create' → new file, no SHA pin; a 409 means the ID already exists and
 *                 is surfaced (never silently overwrites another project).
 * mode 'update' → pins to the caller's SHA, else the shared cache's SHA (seeded
 *                 by loadProjectForEdit or a prior commit); retries through lag.
 *
 * Returns the new blob SHA.
 */
export async function commitProjectFile(opts: {
  projectId: string;
  frontmatter: Record<string, unknown>;
  message: string;
  mode: 'create' | 'update';
  knownSha?: string;
}): Promise<string | null> {
  const path = projectPath(opts.projectId);
  const content = `---\n${stringifyYaml(opts.frontmatter, YAML_OPTS_EDITOR)}---\n`;

  if (opts.mode === 'create') {
    try {
      const newSha = await commitFile(path, content, opts.message, 'main', undefined);
      recordCommit(path, content, newSha);
      return newSha;
    } catch (err) {
      if (err instanceof GitConflictError) throw new Error('ID_EXISTS');
      throw err;
    }
  }

  let sha = opts.knownSha ?? sessionCache.get(path)?.sha;
  let lastErr: unknown;

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    try {
      const newSha = await commitFile(path, content, opts.message, 'main', sha);
      recordCommit(path, content, newSha);
      return newSha;
    } catch (err) {
      if (!(err instanceof GitConflictError)) throw err;
      lastErr = err;
      await sleep(backoff(attempt));
      // Re-pin to the latest HEAD and retry. Safe: the editor loaded live data
      // on mount, and its edit page has no inline forms, so nothing this user
      // just added is being overwritten.
      const latest = await getFileSha(path);
      sha = latest ?? undefined;
    }
  }
  throw lastErr ?? new GitConflictError('CONFLICT');
}

// ────────────────────────────────────────────────────────────────────
// Admin fund updates: record a contribution against a project (or a sub)
// ────────────────────────────────────────────────────────────────────

/**
 * Add `amountUSD` to a project's raised funds and commit it — the persistent
 * replacement for the old browser-only demo donations. Management records real
 * contributions here; once the site rebuilds, every visitor sees the new total.
 *
 * Targeting:
 *   - subId given → add to that sub-item's raisedUSD. The project-level
 *     raisedUSD is then reset to the sum of the subs, because the display math
 *     (computeProjectRaised) derives the project total from the subs whenever
 *     subs exist. Keeping the two in sync means the number is right even if
 *     something reads the top-level field directly.
 *   - no subId → add to the project-level raisedUSD (used for projects that
 *     have no sub-items).
 *
 * amountUSD must be positive and may not push the target past its budget
 * (throws INVALID_AMOUNT / EXCEEDS_BUDGET). Corrections go through the full
 * project editor, which sets the raised figure directly.
 * Runs through the same shared-cache + retry-through-lag path as every other
 * commit here, so rapid successive updates don't 409 on a stale SHA.
 *
 * Returns the new project-level total and, when a sub was targeted, its total.
 */
export async function addProjectFunds(opts: {
  projectId: string;
  subId?: string;
  amountUSD: number;
  message: string;
}): Promise<{ projectRaised: number; subRaised?: number }> {
  // Contributions only go up, and never past the planned budget. The UI checks
  // this too, but the authoritative check is here, against the LIVE file: the
  // page may be stale, or another admin may have recorded funds since it loaded.
  if (!Number.isFinite(opts.amountUSD) || opts.amountUSD <= 0) throw new Error('INVALID_AMOUNT');

  const frontmatter = await loadProjectForEdit(opts.projectId);
  if (!frontmatter) throw new Error('NOT_FOUND');

  const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : Number(v) || 0);
  let result: { projectRaised: number; subRaised?: number };

  if (opts.subId) {
    const subs = Array.isArray(frontmatter.subs) ? (frontmatter.subs as Record<string, unknown>[]) : [];
    const sub = subs.find((s) => s.id === opts.subId);
    if (!sub) throw new Error('SUB_NOT_FOUND');
    const newSubRaised = num(sub.raisedUSD) + opts.amountUSD;
    if (newSubRaised > num(sub.budgetUSD)) throw new Error('EXCEEDS_BUDGET');
    sub.raisedUSD = newSubRaised;
    // Keep the project-level field equal to the sum of the subs.
    const projectRaised = subs.reduce((a, s) => a + num(s.raisedUSD), 0);
    frontmatter.raisedUSD = projectRaised;
    result = { projectRaised, subRaised: newSubRaised };
  } else {
    const projectRaised = num(frontmatter.raisedUSD) + opts.amountUSD;
    if (projectRaised > num(frontmatter.budgetUSD)) throw new Error('EXCEEDS_BUDGET');
    frontmatter.raisedUSD = projectRaised;
    result = { projectRaised };
  }

  await commitProjectFile({
    projectId: opts.projectId,
    frontmatter,
    message: opts.message,
    mode: 'update',
  });

  return result;
}

// ────────────────────────────────────────────────────────────────────
// Admin deletes: remove a note, field update or photo
// ────────────────────────────────────────────────────────────────────

/**
 * Does `fileItem` (from the repo) correspond to `shown` (what the page renders)?
 *
 * Exact equality is too strict: the build's auto-translator fills empty `en`
 * sides and adds `en_auto` flags, so the rendered copy can carry text the repo
 * file doesn't have yet. So we treat the file item as a *subset* of the shown
 * one: every non-empty value in the file must equal the shown value, empty
 * file values are allowed to differ (a translation filled them in), and
 * `*_auto` flags are ignored. At least one non-empty value must actually match,
 * so two blank items never count as the same.
 */
export function itemMatches(fileItem: unknown, shown: unknown): boolean {
  let matchedSomething = false;
  const walk = (f: unknown, s: unknown): boolean => {
    if (f === undefined || f === null || f === '') return true;
    if (typeof f !== 'object') {
      if (typeof f === 'string' && typeof s === 'string' ? f.trim() === s.trim() : f === s) {
        matchedSomething = true;
        return true;
      }
      return false;
    }
    if (Array.isArray(f)) return false; // no list values in comments/updates/photos
    if (!s || typeof s !== 'object') return false;
    for (const [k, v] of Object.entries(f as Record<string, unknown>)) {
      if (k.endsWith('_auto')) continue;
      if (!walk(v, (s as Record<string, unknown>)[k])) return false;
    }
    return true;
  };
  return walk(fileItem, shown) && matchedSomething;
}

/**
 * Remove one item from a frontmatter list and commit. `item` is the item as the
 * page shows it; the first matching entry in the LIVE file is removed (see
 * itemMatches). Throws ITEM_NOT_FOUND if it's no longer there — e.g. another
 * admin already deleted it.
 *
 * For a photo whose image was uploaded through the site (/uploads/projects/…),
 * the image file is deleted too, after the entry is gone — so the page never
 * points at a missing file. That second step is best-effort: if it fails, the
 * photo is already off the site and only an orphaned file remains.
 */
export async function removeProjectItem(opts: {
  projectId: string;
  field: 'comments' | 'updates' | 'photos';
  item: unknown;
  message: string;
}): Promise<void> {
  const path = projectPath(opts.projectId);
  let lastErr: unknown;
  let removed: unknown;

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const base = await loadBase(path);
    const { frontmatter, body } = splitFrontmatter(base.content);
    const list = Array.isArray(frontmatter[opts.field]) ? (frontmatter[opts.field] as unknown[]) : [];
    const idx = list.findIndex((x) => itemMatches(x, opts.item));

    if (idx < 0) {
      // A cold read can lag a recent write (e.g. an item added from another
      // tab). Give the read API one more chance before concluding it's gone.
      if (attempt === 0) {
        await sleep(backoff(0));
        await refreshCacheAfterConflict(path);
        continue;
      }
      throw new Error('ITEM_NOT_FOUND');
    }

    removed = list[idx];
    frontmatter[opts.field] = list.filter((_, i) => i !== idx);
    const newContent = `---\n${stringifyYaml(frontmatter, YAML_OPTS_APPEND)}---\n${body}`;

    try {
      const newSha = await commitFile(path, newContent, opts.message, 'main', base.sha);
      recordCommit(path, newContent, newSha);
      lastErr = undefined;
      break;
    } catch (err) {
      if (!(err instanceof GitConflictError)) throw err;
      lastErr = err;
      await sleep(backoff(attempt));
      await refreshCacheAfterConflict(path);
    }
  }
  if (lastErr) throw lastErr;
  if (removed === undefined) throw new Error('ITEM_NOT_FOUND');

  if (opts.field === 'photos') {
    const src = (removed as { src?: unknown }).src;
    if (typeof src === 'string' && src.startsWith('/uploads/projects/')) {
      try {
        await deleteFile(`public${src}`, `${opts.message} (image file)`);
      } catch {
        // Entry is already removed; an orphaned file is harmless.
      }
    }
  }
}
