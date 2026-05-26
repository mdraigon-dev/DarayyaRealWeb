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
  const url = `${GIT_GATEWAY_BASE}/contents/${encodeURIComponent(path)}?ref=${branch}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
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
  const url = `${GIT_GATEWAY_BASE}/contents/${encodeURIComponent(path)}?ref=${branch}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
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
 */
export async function commitFile(
  path: string,
  content: string,
  message: string,
  branch = 'main',
): Promise<void> {
  const token = await getToken();
  const sha = await getFileSha(path, branch);

  // GitHub's content API expects base64-encoded content
  const base64 = typeof btoa !== 'undefined'
    ? btoa(unescape(encodeURIComponent(content)))
    : Buffer.from(content, 'utf-8').toString('base64');

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
    throw new Error(`Commit failed: HTTP ${res.status} ${text.slice(0, 200)}`);
  }
}
