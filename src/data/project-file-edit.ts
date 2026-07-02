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
import { getFileContent, getFileSha, commitFile, GitConflictError } from './git-gateway';

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
  const m = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
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
    // Fast pre-check: if a file with this ID already exists, refuse before
    // committing anything. (Passing `undefined` here would make commitFile
    // fetch the existing SHA and silently overwrite the other project.)
    const existing = await getFileSha(path).catch(() => null);
    if (existing) throw new Error('ID_EXISTS');
    try {
      // Explicit null = commit with NO sha. If the file was created in the
      // window between the check and the write, GitHub rejects with 409/422
      // rather than overwriting — which we surface as ID_EXISTS too.
      const newSha = await commitFile(path, content, opts.message, 'main', null);
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
