/**
 * project-file-edit.ts
 *
 * Shared read-modify-write logic for the inline "add note" and "add field
 * update" forms. Both append an item to a frontmatter array in a project's
 * Markdown file and commit it via Git Gateway.
 *
 * Why this exists (the bug it fixes):
 * GitHub's contents API is eventually consistent — after a commit, re-reading
 * the file can return the *old* SHA for up to ~a minute (about as long as a
 * Netlify rebuild). The old flow re-read the file on every submit, so a second
 * note added during that window got pinned to a stale SHA and failed with a
 * 409 ("File changed since you opened it").
 *
 * The fix: keep an in-memory cache of the just-written content plus the SHA
 * that GitHub's PUT response handed back, and chain straight into the next
 * edit instead of re-reading. The read API is never on the hot path between
 * one edit and the next, so the staleness window can't bite. A 409 now only
 * means a genuinely concurrent edit by another user, which we recover from by
 * reading the latest version and replaying the append on top.
 */

import { parse as parseYaml, stringify as stringifyYaml } from 'yaml';
import { getFileContent, commitFile, GitConflictError } from './git-gateway';

export type ProjectFileCache = { content: string; sha: string };

// Match the serialization the editor and adders have always used, so commits
// stay diff-clean against files written by the full ProjectEditor.
const YAML_OPTS = {
  lineWidth: 0,
  defaultStringType: 'QUOTE_DOUBLE' as const,
  defaultKeyType: 'PLAIN' as const,
};

function splitFrontmatter(content: string): { frontmatter: Record<string, unknown>; body: string } {
  const m = content.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!m) throw new Error('INVALID_FORMAT');
  return { frontmatter: parseYaml(m[1]) as Record<string, unknown>, body: m[2] };
}

function serialize(frontmatter: Record<string, unknown>, body: string): string {
  return `---\n${stringifyYaml(frontmatter, YAML_OPTS)}---\n${body}`;
}

async function readFresh(path: string): Promise<ProjectFileCache> {
  const f = await getFileContent(path);
  if (!f) throw new Error('NOT_FOUND');
  return f;
}

// After a 409 we want the *latest* version, but the read API may still echo
// the SHA we just collided on. Poll briefly until it moves past that SHA.
async function readPastSha(path: string, staleSha: string): Promise<ProjectFileCache> {
  for (let i = 0; i < 4; i++) {
    const f = await getFileContent(path);
    if (f && f.sha !== staleSha) return f;
    await new Promise((r) => setTimeout(r, 500 + i * 500));
  }
  return readFresh(path);
}

export type AppendResult = { cache: ProjectFileCache };

/**
 * Append `item` to a frontmatter array field (`comments` or `updates`) and
 * commit. Pass the `cache` returned by the previous call to chain rapid edits
 * without re-reading; pass null on the first edit of a session.
 */
export async function appendProjectItem(opts: {
  projectId: string;
  field: 'comments' | 'updates';
  item: unknown;
  position: 'start' | 'end';
  message: string;
  cache: ProjectFileCache | null;
}): Promise<AppendResult> {
  const path = `src/content/projects/${opts.projectId}.md`;

  const apply = async (file: ProjectFileCache): Promise<ProjectFileCache> => {
    const { frontmatter, body } = splitFrontmatter(file.content);
    const existing = Array.isArray(frontmatter[opts.field])
      ? (frontmatter[opts.field] as unknown[])
      : [];
    frontmatter[opts.field] =
      opts.position === 'start' ? [opts.item, ...existing] : [...existing, opts.item];

    const newContent = serialize(frontmatter, body);
    const newSha = await commitFile(path, newContent, opts.message, 'main', file.sha);

    // PUT normally echoes the new blob SHA. If it didn't, fall back to a fresh
    // read so the next edit isn't pinned to a now-stale SHA.
    if (!newSha) return readFresh(path);
    return { content: newContent, sha: newSha };
  };

  const base = opts.cache ?? (await readFresh(path));

  try {
    return { cache: await apply(base) };
  } catch (err) {
    if (!(err instanceof GitConflictError)) throw err;
    // Someone else committed to this file. Take their version and replay our
    // append on top of it so nothing is lost.
    const fresh = await readPastSha(path, base.sha);
    return { cache: await apply(fresh) };
  }
}
