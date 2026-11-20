/**
 * service.ts — the save service's logic, independent of Netlify so it can be
 * tested against a fake GitHub.
 *
 *   read   { path }                      → { exists, sha, text }
 *   blob   { data, upload? }             → { sha }  (binary upload, in chunks when large)
 *   commit { message, changes: [...] }   → { commit, shas }
 *
 * Every action needs a signed-in Netlify Identity user with at least one
 * role; `commit` checks each change against the role rules in rules.ts.
 */
import { authorize, classifyPath, RuleError, type FileChange } from './rules';
import { GitHubError, type GitHub } from './github';
import { rolesOf } from '../../src/data/roles';

export type ServiceUser = {
  sub?: string;
  email?: string;
  app_metadata?: { roles?: unknown };
  user_metadata?: { full_name?: string };
};

/** Temporary storage for chunks of a large upload (Netlify Blobs in production). */
export type ChunkStore = {
  set(key: string, value: string): Promise<void>;
  get(key: string): Promise<string | null>;
  delete(key: string): Promise<void>;
};

export type Reply = { status: number; body: Record<string, unknown> };

const ok = (body: Record<string, unknown>): Reply => ({ status: 200, body });
const fail = (status: number, code: string, message: string): Reply => ({ status, body: { error: code, message } });

const MAX_CHANGES = 30;
const MAX_TEXT_BYTES = 2 * 1024 * 1024;
const MAX_CHUNK_B64 = 4.2 * 1024 * 1024;  // keeps each request under Netlify's 6 MB limit
const MAX_UPLOAD_BYTES = 15 * 1024 * 1024;
const SHA = /^[0-9a-f]{40}$/;

export async function handle(opts: {
  user: ServiceUser | null | undefined;
  body: any;
  gh: GitHub;
  chunks: ChunkStore;
}): Promise<Reply> {
  const { user, body, gh, chunks } = opts;
  if (!user || !user.email) return fail(401, 'NOT_SIGNED_IN', 'Sign in to save changes.');
  if (rolesOf(user).length === 0) return fail(403, 'NO_ROLE', 'Your account has no role on this site yet. Ask an administrator.');
  if (!body || typeof body !== 'object') return fail(400, 'BAD_REQUEST', 'Missing request body.');

  try {
    switch (body.action) {
      case 'read': return await read(gh, body);
      case 'blob': return await blob(gh, chunks, user, body);
      case 'commit': return await commit(gh, user, body);
      default: return fail(400, 'BAD_REQUEST', 'Unknown action.');
    }
  } catch (e) {
    if (e instanceof RuleError) {
      const status = e.code === 'INVALID_FORMAT' || e.code === 'INVALID_CHANGE' || e.code === 'INVALID_AMOUNT' || e.code === 'EXCEEDS_BUDGET' ? 422 : 403;
      return fail(status, e.code, e.message);
    }
    if (e instanceof GitHubError) {
      if (e.status === 401 || e.status === 403) return fail(502, 'REPO_ACCESS', 'The save service cannot reach the repository. Check the GITHUB_TOKEN setting.');
      return fail(502, 'REPO_ERROR', 'The repository did not accept the change. Try again.');
    }
    return fail(500, 'SERVER_ERROR', 'Something went wrong while saving. Try again.');
  }
}

async function read(gh: GitHub, body: any): Promise<Reply> {
  const path = String(body.path || '');
  if (classifyPath(path).kind === 'forbidden') return fail(403, 'FORBIDDEN_PATH', 'The site cannot read this file.');
  const head = await gh.head();
  const f = await gh.file(path, head, body.textOnly !== false);
  if (!f) return ok({ exists: false, sha: null, text: null });
  return ok({ exists: true, sha: f.sha, text: f.text });
}

async function blob(gh: GitHub, chunks: ChunkStore, user: ServiceUser, body: any): Promise<Reply> {
  const data = String(body.data || '');
  if (!data || data.length > MAX_CHUNK_B64 || !/^[A-Za-z0-9+/=]+$/.test(data)) {
    return fail(413, 'BAD_UPLOAD', 'Upload chunk is missing or too large.');
  }
  const up = body.upload;
  if (!up || up.total === 1) return ok({ sha: await gh.createBlob(data, 'base64') });

  const id = String(up.id || '');
  const index = Number(up.index);
  const total = Number(up.total);
  if (!/^[\w-]{6,64}$/.test(id) || !Number.isInteger(index) || !Number.isInteger(total) || total < 2 || total > 4 || index < 0 || index >= total) {
    return fail(400, 'BAD_UPLOAD', 'Invalid upload chunk.');
  }
  const prefix = `${(user.sub || user.email || 'u').replace(/[^\w-]/g, '_')}/${id}`;
  await chunks.set(`${prefix}/${index}`, data);
  if (index < total - 1) return ok({ stored: index });

  const parts: Buffer[] = [];
  for (let i = 0; i < total; i++) {
    const part = await chunks.get(`${prefix}/${i}`);
    if (part == null) return fail(400, 'BAD_UPLOAD', 'Upload incomplete; please try again.');
    parts.push(Buffer.from(part, 'base64'));
  }
  const all = Buffer.concat(parts);
  for (let i = 0; i < total; i++) await chunks.delete(`${prefix}/${i}`).catch(() => {});
  if (all.length > MAX_UPLOAD_BYTES) return fail(413, 'BAD_UPLOAD', 'File is too large.');
  return ok({ sha: await gh.createBlob(all.toString('base64'), 'base64') });
}

function displayName(user: ServiceUser): string {
  const n = (user.user_metadata?.full_name || '').trim();
  return n && !n.includes('@') ? n : 'staff member';
}

function validChanges(raw: unknown): FileChange[] {
  if (!Array.isArray(raw) || raw.length === 0 || raw.length > MAX_CHANGES) {
    throw new RuleError('INVALID_CHANGE', 'A save must contain between 1 and 30 file changes.');
  }
  const seen = new Set<string>();
  return raw.map((c: any) => {
    const path = String(c?.path || '');
    if (seen.has(path)) throw new RuleError('INVALID_CHANGE', `Duplicate file in one save: ${path}`);
    seen.add(path);
    const out: FileChange = { path };
    const kinds = [typeof c.text === 'string', typeof c.blob === 'string', c.delete === true].filter(Boolean).length;
    if (kinds !== 1) throw new RuleError('INVALID_CHANGE', `Each change needs exactly one of text, blob or delete (${path}).`);
    if (typeof c.text === 'string') {
      if (Buffer.byteLength(c.text, 'utf8') > MAX_TEXT_BYTES) throw new RuleError('INVALID_CHANGE', `File too large: ${path}`);
      out.text = c.text;
    }
    if (typeof c.blob === 'string') {
      if (!SHA.test(c.blob)) throw new RuleError('INVALID_CHANGE', `Invalid upload reference for ${path}`);
      out.blob = c.blob;
    }
    if (c.delete === true) out.delete = true;
    if (c.expectSha === null || (typeof c.expectSha === 'string' && SHA.test(c.expectSha))) out.expectSha = c.expectSha;
    return out;
  });
}

async function commit(gh: GitHub, user: ServiceUser, body: any): Promise<Reply> {
  const changes = validChanges(body.changes);
  const message = String(body.message || 'Update from the site').replace(/[\r\n]+/g, ' ').slice(0, 300);
  const fullMessage = `${message}\n\nSaved by: ${displayName(user)} (${rolesOf(user).join(', ')})`;

  for (let attempt = 0; attempt < 3; attempt++) {
    const head = await gh.head();
    const cache = new Map<string, Promise<{ sha: string; text: string | null } | null>>();
    const get = (path: string) => {
      if (!cache.has(path)) cache.set(path, gh.file(path, head, /\.(md|json)$/.test(path)));
      return cache.get(path)!;
    };

    // Optimistic concurrency: the client says which version it edited.
    for (const c of changes) {
      if (c.expectSha === undefined) continue;
      const now = await get(c.path);
      if ((now?.sha ?? null) !== c.expectSha) {
        return fail(409, 'CONFLICT', 'This file changed since you opened it. Reload and try again.');
      }
    }

    await authorize(user, changes, async (path) => {
      const f = await get(path);
      return { exists: !!f, text: f?.text ?? null };
    });

    const entries: Array<{ path: string; sha: string | null }> = [];
    const shas: Record<string, string | null> = {};
    for (const c of changes) {
      if (c.delete) {
        if (await get(c.path)) entries.push({ path: c.path, sha: null });
        shas[c.path] = null;
      } else {
        const sha = c.blob ?? await gh.createBlob(c.text!, 'utf-8');
        entries.push({ path: c.path, sha });
        shas[c.path] = sha;
      }
    }
    if (entries.length === 0) return ok({ commit: head, shas });

    const tree = await gh.createTree(await gh.treeOf(head), entries);
    const sha = await gh.createCommit(fullMessage, tree, head);
    try {
      await gh.moveBranch(sha);
      return ok({ commit: sha, shas });
    } catch (e) {
      // Someone else committed in between: re-check against the new tip.
      if (e instanceof GitHubError && e.status === 422) continue;
      throw e;
    }
  }
  return fail(409, 'CONFLICT', 'The site is busy saving other changes. Try again in a moment.');
}
