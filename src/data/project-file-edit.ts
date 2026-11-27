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
 *   1. Reads go through the save service (see repo.ts), which reads the exact latest commit.
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
import { govFundingOf, govCoveredUSD, govBySub } from './gov-funding';
import { getFileContent, getFileSha, commitFile, commitChanges, prepareChanges, GitConflictError, type Change } from './repo';

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
  /** Other files saved in the same commit, e.g. the photos' image files. */
  extra?: Change[];
}): Promise<void> {
  const path = projectPath(opts.projectId);
  let lastErr: unknown;
  const extra = await prepareChanges(opts.extra || []); // upload images once, before any retry

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const base = await loadBase(path);
    const { frontmatter, body } = splitFrontmatter(base.content);

    for (const op of opts.ops) {
      const existing = Array.isArray(frontmatter[op.field]) ? (frontmatter[op.field] as unknown[]) : [];
      frontmatter[op.field] = op.position === 'start' ? [op.item, ...existing] : [...existing, op.item];
    }
    const newContent = `---\n${stringifyYaml(frontmatter, YAML_OPTS_APPEND)}---\n${body}`;

    try {
      const shas = await commitChanges(opts.message, [...extra, { path, text: newContent, expectSha: base.sha }]);
      recordCommit(path, newContent, shas[path] ?? null);
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
 * The project's team as it is in the repository right now. The built pages
 * only know teams by linked account (emails are stripped at build time), so
 * the post buttons check this when the static team doesn't match: it covers
 * an engineer linked since the last build, and legacy email-linked entries
 * until the migration has run. The save service checks the same file.
 */
const liveTeams = new Map<string, Promise<unknown[]>>();
export function readLiveTeam(projectId: string): Promise<unknown[]> {
  let p = liveTeams.get(projectId);
  if (!p) {
    p = loadBase(projectPath(projectId))
      .then((f) => {
        const e = splitFrontmatter(f.content).frontmatter.engineers;
        return Array.isArray(e) ? e : [];
      })
      .catch(() => { liveTeams.delete(projectId); return []; });
    liveTeams.set(projectId, p);
  }
  return p;
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
      // Explicit null = "the file must not exist yet". If it was created in
      // the window between the check and the write, the save service refuses
      // with a 409 rather than overwriting — which we surface as ID_EXISTS too.
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

// ────────────────────────────────────────────────────────────────────
// Admin fund updates: record a contribution against a project (or a sub)
// ────────────────────────────────────────────────────────────────────

/**
 * Re-read → change → commit, retried through GitHub's read-after-write lag.
 *
 * Unlike commitProjectFile (which re-pins the SAME content on a conflict, fine
 * for the editor), this re-applies `mutate` to the freshly read file on every
 * attempt. So a note posted by someone else in between is kept, and any check
 * inside `mutate` (like the budget cap) runs against the current numbers.
 * `mutate` may throw to abort; it returns whatever the caller wants back.
 */
async function mutateProjectFile<T>(
  projectId: string,
  mutate: (fm: Record<string, unknown>) => T,
  message: string,
): Promise<T> {
  const path = projectPath(projectId);
  let lastErr: unknown;
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const base = await loadBase(path);
    const { frontmatter, body } = splitFrontmatter(base.content);
    const result = mutate(frontmatter);
    const newContent = `---\n${stringifyYaml(frontmatter, YAML_OPTS_APPEND)}---\n${body}`;
    try {
      const newSha = await commitFile(path, newContent, message, 'main', base.sha);
      recordCommit(path, newContent, newSha);
      return result;
    } catch (err) {
      if (!(err instanceof GitConflictError)) throw err;
      lastErr = err;
      await sleep(backoff(attempt));
      await refreshCacheAfterConflict(path);
    }
  }
  throw lastErr ?? new GitConflictError('CONFLICT');
}

const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : Number(v) || 0);

export type FundEntry = { at: string; amountUSD: number; subId?: string; by?: string };

/**
 * Record a contribution: add `amountUSD` to the project (or one sub-item) and
 * append a matching fundLog entry, in ONE commit — the raised figure and its
 * audit trail can never drift apart. This is the persistent replacement for
 * the old browser-only demo donations.
 *
 * Contributions only go up and never past the budget (INVALID_AMOUNT /
 * EXCEEDS_BUDGET). The check runs against the live file on every attempt, so
 * a stale page or a second admin can't push it over.
 *
 * With sub-items, the project-level raisedUSD is reset to the sum of the subs,
 * matching how the site computes the project total.
 */
export async function addProjectFunds(opts: {
  projectId: string;
  subId?: string;
  amountUSD: number;
  message: string;
  /** Display name of the admin recording it (shown in the activity log) */
  by?: string;
}): Promise<{ projectRaised: number; subRaised?: number; entry: FundEntry }> {
  if (!Number.isFinite(opts.amountUSD) || opts.amountUSD <= 0) throw new Error('INVALID_AMOUNT');
  const entry: FundEntry = {
    at: new Date().toISOString(),
    amountUSD: opts.amountUSD,
    ...(opts.subId ? { subId: opts.subId } : {}),
    ...(opts.by ? { by: opts.by } : {}),
  };

  return mutateProjectFile(opts.projectId, (fm) => {
    // The government's share counts towards the budget (see gov-funding.ts).
    if (govFundingOf(fm).type === 'full') throw new Error('GOV_FUNDED');
    const allSubs = Array.isArray(fm.subs) ? (fm.subs as Record<string, unknown>[]) : [];
    const budget = allSubs.length ? allSubs.reduce((a, s) => a + num(s.budgetUSD), 0) : num(fm.budgetUSD);
    const raisedNow = allSubs.length ? allSubs.reduce((a, s) => a + num(s.raisedUSD), 0) : num(fm.raisedUSD);
    if (raisedNow + govCoveredUSD(fm, budget) + opts.amountUSD > budget + 0.005) throw new Error('EXCEEDS_BUDGET');
    // An older file holds the government amount only for the whole project;
    // fix its per-item spread now, so this contribution doesn't move it.
    const g = govFundingOf(fm);
    if (g.type === 'partial' && allSubs.length && g.amountUSD > 0 && !allSubs.some((s) => num(s.govUSD) > 0)) {
      const shares = govBySub(fm as any);
      for (const s of allSubs) if (shares[String(s.id)]) s.govUSD = shares[String(s.id)];
    }

    let out: { projectRaised: number; subRaised?: number };
    if (opts.subId) {
      const subs = Array.isArray(fm.subs) ? (fm.subs as Record<string, unknown>[]) : [];
      const sub = subs.find((s) => s.id === opts.subId);
      if (!sub) throw new Error('SUB_NOT_FOUND');
      const newSubRaised = num(sub.raisedUSD) + opts.amountUSD;
      // The item's government share counts towards its budget too.
      const itemGov = govBySub(fm as any)[String(sub.id)] || 0;
      if (newSubRaised + itemGov > num(sub.budgetUSD) + 0.005) throw new Error('EXCEEDS_BUDGET');
      sub.raisedUSD = newSubRaised;
      fm.raisedUSD = subs.reduce((a, s) => a + num(s.raisedUSD), 0);
      out = { projectRaised: fm.raisedUSD as number, subRaised: newSubRaised };
    } else {
      const projectRaised = num(fm.raisedUSD) + opts.amountUSD;
      if (projectRaised > num(fm.budgetUSD)) throw new Error('EXCEEDS_BUDGET');
      fm.raisedUSD = projectRaised;
      out = { projectRaised };
    }
    fm.fundLog = [...(Array.isArray(fm.fundLog) ? fm.fundLog : []), entry];
    return { ...out, entry };
  }, opts.message);
}

/**
 * Record (or raise) the amount the government covers on a partly
 * government-funded project. With line items, `subId` names the item and
 * `amountUSD` is that item's new share; without, it is the project's amount.
 * Finance may only raise it; lowering or removing it is a project edit (the
 * save service enforces both). The government share plus recorded
 * contributions can never pass the budget, for the project or for an item.
 */
export async function setGovFundingAmount(opts: {
  projectId: string;
  subId?: string;
  amountUSD: number;
  message: string;
}): Promise<void> {
  if (!Number.isFinite(opts.amountUSD) || opts.amountUSD <= 0) throw new Error('INVALID_AMOUNT');
  await mutateProjectFile(opts.projectId, (fm) => {
    const g = govFundingOf(fm);
    if (g.type === 'full') throw new Error('GOV_FUNDED');
    const prev = fm.govFunding && typeof fm.govFunding === 'object' ? (fm.govFunding as Record<string, unknown>) : {};
    const subs = Array.isArray(fm.subs) ? (fm.subs as Record<string, unknown>[]) : [];

    if (subs.length) {
      const sub = subs.find((s) => s.id === opts.subId);
      if (!sub) throw new Error('SUB_NOT_FOUND');
      if (num(sub.raisedUSD) + opts.amountUSD > num(sub.budgetUSD) + 0.005) throw new Error('EXCEEDS_BUDGET');
      // An older file holds only a project amount: save its per-item spread
      // first, so the other items keep the share they were shown with.
      const shares = govBySub({ govFunding: { ...prev, type: 'partial' }, subs: subs as any });
      for (const s of subs) s.govUSD = shares[String(s.id)] || 0;
      sub.govUSD = opts.amountUSD;
      for (const s of subs) if (!num(s.govUSD)) delete s.govUSD;
      fm.govFunding = { ...prev, type: 'partial', amountUSD: subs.reduce((a, s) => a + num(s.govUSD), 0) };
      return;
    }

    const budget = num(fm.budgetUSD);
    const raised = num(fm.raisedUSD);
    if (raised + opts.amountUSD > budget + 0.005) throw new Error('EXCEEDS_BUDGET');
    fm.govFunding = { ...prev, type: 'partial', amountUSD: opts.amountUSD };
  }, opts.message);
}

/**
 * Delete a recorded contribution from the activity log. The amount is taken
 * back off the project (or its sub-item) in the same commit — otherwise the
 * raised total would include money with no record behind it. Never goes
 * below zero. Throws ITEM_NOT_FOUND if the entry is already gone.
 */
export async function removeFundEntry(opts: {
  projectId: string;
  entry: FundEntry;
  message: string;
}): Promise<void> {
  await mutateProjectFile(opts.projectId, (fm) => {
    const log = Array.isArray(fm.fundLog) ? (fm.fundLog as FundEntry[]) : [];
    const idx = log.findIndex((e) =>
      e.at === opts.entry.at && num(e.amountUSD) === opts.entry.amountUSD && (e.subId || '') === (opts.entry.subId || ''));
    if (idx < 0) throw new Error('ITEM_NOT_FOUND');
    const amount = num(log[idx].amountUSD);
    fm.fundLog = log.filter((_, i) => i !== idx);

    const subs = Array.isArray(fm.subs) ? (fm.subs as Record<string, unknown>[]) : [];
    const sub = opts.entry.subId ? subs.find((s) => s.id === opts.entry.subId) : undefined;
    if (sub) {
      sub.raisedUSD = Math.max(0, num(sub.raisedUSD) - amount);
      fm.raisedUSD = subs.reduce((a, s) => a + num(s.raisedUSD), 0);
    } else {
      fm.raisedUSD = Math.max(0, num(fm.raisedUSD) - amount);
    }
  }, opts.message);
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
 * the image file is deleted in the same commit.
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

    // A photo uploaded through the site takes its image file with it, in the
    // same commit, so the page never points at a missing file.
    const src = opts.field === 'photos' ? (removed as { src?: unknown }).src : undefined;
    const imageDelete: Change[] = typeof src === 'string' && /^\/uploads\/projects\/[\w-]+\/[\w.-]+$/.test(src)
      ? [{ path: `public${src}`, delete: true }]
      : [];

    try {
      const shas = await commitChanges(opts.message, [{ path, text: newContent, expectSha: base.sha }, ...imageDelete]);
      recordCommit(path, newContent, shas[path] ?? null);
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
}

// ────────────────────────────────────────────────────────────────────
// One-time migration: link team entries saved with an email to accounts
// ────────────────────────────────────────────────────────────────────

/**
 * For every project file: each team entry that still has an `email` gets the
 * matching account's `userId` (when there is one) and loses the email. All
 * changed files are saved in ONE commit. `resolve` maps the emails found to
 * user IDs (the save service's staff action); emails never leave this
 * function in anything that's saved or logged.
 */
export async function linkProjectTeams(opts: {
  projectIds: string[];
  resolve: (emails: string[]) => Promise<Record<string, string>>;
  message: string;
}): Promise<{ projects: number; linked: number; unmatched: number }> {
  const files: Array<{ path: string; sha: string; fm: Record<string, unknown>; body: string }> = [];
  for (const id of opts.projectIds) {
    const path = projectPath(id);
    sessionCache.delete(path);
    const f = await getFileContent(path);
    if (!f) continue;
    const { frontmatter, body } = splitFrontmatter(f.content);
    const team = Array.isArray(frontmatter.engineers) ? (frontmatter.engineers as Record<string, unknown>[]) : [];
    if (team.some((e) => e && typeof e === 'object' && 'email' in e)) files.push({ path, sha: f.sha, fm: frontmatter, body });
  }
  if (files.length === 0) return { projects: 0, linked: 0, unmatched: 0 };
  if (files.length > 30) throw new Error('TOO_MANY');

  const norm = (v: unknown) => (typeof v === 'string' ? v.trim().toLowerCase() : '');
  const emails = new Set<string>();
  for (const f of files) {
    for (const e of f.fm.engineers as Record<string, unknown>[]) if (norm(e?.email)) emails.add(norm(e.email));
  }
  const matches = emails.size ? await opts.resolve([...emails]) : {};

  let linked = 0;
  let unmatched = 0;
  const changes: Change[] = files.map((f) => {
    f.fm.engineers = (f.fm.engineers as Record<string, unknown>[]).map((e) => {
      if (!e || typeof e !== 'object' || !('email' in e)) return e;
      const { email, ...rest } = e;
      const id = matches[norm(email)];
      if (norm(email)) {
        if (id) linked++; else unmatched++;
      }
      return id && !rest.userId ? { ...rest, userId: id } : rest;
    });
    const text = `---\n${stringifyYaml(f.fm, YAML_OPTS_APPEND)}---\n${f.body}`;
    return { path: f.path, text, expectSha: f.sha };
  });

  const shas = await commitChanges(opts.message, changes);
  for (const c of changes) recordCommit(c.path, c.text!, shas[c.path] ?? null);
  liveTeams.clear();
  return { projects: files.length, linked, unmatched };
}
