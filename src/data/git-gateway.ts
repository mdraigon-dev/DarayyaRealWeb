/**
 * Git Gateway client.
 *
 * Netlify's Git Gateway exposes GitHub's content API at /.netlify/git/github/
 * with the same shape as github.com/api. We send a PUT request to update a
 * file in the repo, authenticated with the user's Netlify Identity JWT.
 *
 * This is the same mechanism Decap CMS uses internally; we're bypassing
 * Decap's form UI and going straight to the same backend.
 *
 * Reference: https://docs.netlify.com/visitor-access/git-gateway/
 */

const GIT_GATEWAY_BASE = '/.netlify/git/github';

/**
 * Thrown when GitHub rejects a write because the file changed since the SHA
 * we pinned (HTTP 409). Callers can catch this specifically to distinguish a
 * genuine concurrent edit from other failures and recover (re-read + retry).
 */
export class GitConflictError extends Error {
  readonly code = 'CONFLICT' as const;
  constructor(message: string) {
    super(message);
    this.name = 'GitConflictError';
  }
}

/**
 * Get the current Netlify Identity user's JWT token. This token authorizes
 * the Git Gateway request and tells Netlify which user did the commit.
 */
async function getToken(): Promise<string> {
  const ni = (window as any).netlifyIdentity;
  if (!ni) throw new Error('Netlify Identity widget not loaded');
  const user = ni.currentUser();
  if (!user) throw new Error('Not signed in');
  // jwt() returns a Promise that may auto-refresh expired tokens
  const token = await user.jwt();
  if (!token) throw new Error('Failed to get auth token');
  return token;
}

/**
 * Fetch the current SHA of a file in the repo. Required by GitHub's content
 * API for any update — the SHA confirms we're updating the file we expect.
 *
 * Returns null if the file doesn't exist (e.g. when creating a new project).
 */
export async function getFileSha(path: string, branch = 'main'): Promise<string | null> {
  const token = await getToken();
  // no-store + a unique query param defeat any HTTP/CDN caching between the
  // Git Gateway and us — critical right after a write, when a cached response
  // would echo the pre-commit SHA and make the next commit 409.
  const url = `${GIT_GATEWAY_BASE}/contents/${encodeURIComponent(path)}?ref=${branch}&_=${Date.now()}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}`, 'Cache-Control': 'no-cache' },
    cache: 'no-store',
  });
  if (res.status === 404) return null;
  if (!res.ok) {
    throw new Error(`Failed to fetch file SHA: HTTP ${res.status}`);
  }
  const data = await res.json();
  return data.sha;
}

/**
 * Fetch a file's text contents and SHA. The SHA is needed to commit an
 * update later. Returns null if the file doesn't exist.
 *
 * Used by features that need to read-modify-write an existing project file,
 * e.g. the inline "add note" form on a project page.
 */
export async function getFileContent(path: string, branch = 'main'): Promise<{ content: string; sha: string } | null> {
  const token = await getToken();
  // See getFileSha — bust caches so we never read a stale post-commit version.
  const url = `${GIT_GATEWAY_BASE}/contents/${encodeURIComponent(path)}?ref=${branch}&_=${Date.now()}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}`, 'Cache-Control': 'no-cache' },
    cache: 'no-store',
  });
  if (res.status === 404) return null;
  if (!res.ok) {
    throw new Error(`Failed to fetch file content: HTTP ${res.status}`);
  }
  const data = await res.json();
  // GitHub returns content as base64 with newlines
  const b64 = (data.content || '').replace(/\n/g, '');
  let content: string;
  try {
    // btoa/atob use Latin-1; need a UTF-8-safe decode for Arabic text
    const binary = atob(b64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    content = new TextDecoder('utf-8').decode(bytes);
  } catch {
    content = atob(b64);
  }
  return { content, sha: data.sha };
}

/**
 * Commit a file change (create or update) via Git Gateway.
 *
 * @param path     The file path relative to repo root (e.g. "src/content/projects/foo.md")
 * @param content  The new file contents as a string
 * @param message  Commit message
 * @param branch   Branch to commit to (default: main)
 * @param knownSha Optional: the SHA of the file the caller just read. When
 *                 provided, we skip the extra fetch AND pin the commit to
 *                 that exact version (GitHub returns a 409 if the file
 *                 changed since, which is the right behavior for a
 *                 read-modify-write — better than silently overwriting).
 *
 * Returns the new blob SHA of the committed file (from GitHub's PUT response).
 * Chaining this SHA into the next commit lets a caller make several rapid
 * edits to the same file without re-reading — which matters because GitHub's
 * read API lags a write by up to ~a minute and would otherwise hand back a
 * stale SHA and cause a spurious 409 on the next edit.
 */
export async function commitFile(
  path: string,
  content: string,
  message: string,
  branch = 'main',
  knownSha?: string,
): Promise<string | null> {
  const token = await getToken();
  // Use the caller-provided SHA when available; only fetch fresh when not.
  // For brand-new files, callers pass null/undefined and we get null back.
  const sha = knownSha !== undefined ? knownSha : await getFileSha(path, branch);

  // GitHub's content API expects base64-encoded content. We use the
  // standard "encode to UTF-8 bytes, then base64" sequence: encodeURIComponent
  // produces percent-encoded UTF-8, unescape decodes those to a raw byte
  // string, and btoa converts bytes to base64. This is the canonical way
  // to base64-encode arbitrary Unicode text in a browser.
  const base64 = btoa(unescape(encodeURIComponent(content)));

  const body: Record<string, unknown> = {
    message,
    content: base64,
    branch,
  };
  if (sha) body.sha = sha; // include only when updating

  const url = `${GIT_GATEWAY_BASE}/contents/${encodeURIComponent(path)}`;
  const res = await fetch(url, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    // GitHub returns 409 when the file changed between read and write.
    // Surface a typed error so callers can recover instead of just erroring.
    if (res.status === 409) {
      throw new GitConflictError('File changed since you opened it. Refresh the page and try again.');
    }
    throw new Error(`Commit failed: HTTP ${res.status} ${text.slice(0, 200)}`);
  }

  // GitHub returns the new file metadata, including the blob SHA the next
  // update must pin to. Return it so callers can chain edits without re-reading.
  const data = await res.json().catch(() => null);
  return data?.content?.sha ?? null;
}

/**
 * Commit a binary file (already encoded as base64) via Git Gateway.
 * Used for circular document uploads where the source is a File from
 * an <input type='file'>, base64-encoded via FileReader.
 *
 * Unlike commitFile (which takes UTF-8 string and re-encodes), this
 * variant trusts the caller to have already produced valid base64.
 */
export async function commitBinaryFile(
  path: string,
  base64Content: string,
  message: string,
  branch = 'main',
): Promise<void> {
  const token = await getToken();
  // Brand-new file expected, so no need to fetch SHA. But be safe in case
  // a file with the same path already exists (unlikely with our random id
  // suffix, but possible).
  const sha = await getFileSha(path, branch);

  const body: Record<string, unknown> = {
    message,
    content: base64Content,
    branch,
  };
  if (sha) body.sha = sha;

  const url = `${GIT_GATEWAY_BASE}/contents/${encodeURIComponent(path)}`;
  const res = await fetch(url, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    if (res.status === 413) {
      throw new Error('File too large for Git Gateway. Maximum is around 25 MB.');
    }
    throw new Error(`Binary commit failed: HTTP ${res.status} ${text.slice(0, 200)}`);
  }
}
