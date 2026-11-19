/**
 * github.ts — the few GitHub REST calls the save service needs.
 *
 * Writes go through the Git Data API so one save = one commit = one deploy,
 * however many files it touches (a field update with photos, a document and
 * its details, a page and its QR images).
 */

export type GitHubConfig = {
  token: string;
  repo: string;   // "owner/name"
  branch: string; // "main"
  fetch?: typeof fetch;
};

export class GitHubError extends Error {
  constructor(readonly status: number, message: string) {
    super(message);
  }
}

export function github(cfg: GitHubConfig) {
  const f = cfg.fetch ?? fetch;
  const base = `https://api.github.com/repos/${cfg.repo}`;

  async function call<T = any>(method: string, path: string, body?: unknown): Promise<T | null> {
    const res = await f(`${base}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${cfg.token}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        'Cache-Control': 'no-cache',
        ...(body ? { 'Content-Type': 'application/json' } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (res.status === 404 && method === 'GET') return null;
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new GitHubError(res.status, `GitHub ${method} ${path}: ${res.status} ${text.slice(0, 300)}`);
    }
    return (res.status === 204 ? null : await res.json()) as T;
  }

  const enc = (p: string) => p.split('/').map(encodeURIComponent).join('/');

  return {
    /** Current commit SHA at the tip of the branch. */
    async head(): Promise<string> {
      const ref = await call('GET', `/git/ref/heads/${encodeURIComponent(cfg.branch)}`);
      if (!ref) throw new GitHubError(404, `Branch ${cfg.branch} not found`);
      return ref.object.sha;
    },

    /** A file as of a given commit: blob SHA, and its text when `withText`. */
    async file(path: string, commit: string, withText: boolean): Promise<{ sha: string; text: string | null } | null> {
      const data = await call('GET', `/contents/${enc(path)}?ref=${commit}`);
      if (!data || Array.isArray(data)) return null;
      let text: string | null = null;
      if (withText) {
        if (data.content) {
          text = Buffer.from(String(data.content).replace(/\n/g, ''), 'base64').toString('utf8');
        } else {
          // Over 1 MB the contents API omits the body; fetch the blob instead.
          const blob = await call('GET', `/git/blobs/${data.sha}`);
          text = blob ? Buffer.from(String(blob.content).replace(/\n/g, ''), 'base64').toString('utf8') : null;
        }
      }
      return { sha: data.sha, text };
    },

    async createBlob(content: string, encoding: 'utf-8' | 'base64'): Promise<string> {
      const blob = await call('POST', '/git/blobs', { content, encoding });
      return blob!.sha;
    },

    async treeOf(commit: string): Promise<string> {
      const c = await call('GET', `/git/commits/${commit}`);
      return c!.tree.sha;
    },

    async createTree(baseTree: string, entries: Array<{ path: string; sha: string | null }>): Promise<string> {
      const tree = await call('POST', '/git/trees', {
        base_tree: baseTree,
        tree: entries.map((e) => ({ path: e.path, mode: '100644', type: 'blob', sha: e.sha })),
      });
      return tree!.sha;
    },

    async createCommit(message: string, tree: string, parent: string): Promise<string> {
      const c = await call('POST', '/git/commits', { message, tree, parents: [parent] });
      return c!.sha;
    },

    /** Move the branch; fails (422) if someone else committed in between. */
    async moveBranch(commit: string): Promise<void> {
      await call('PATCH', `/git/refs/heads/${encodeURIComponent(cfg.branch)}`, { sha: commit, force: false });
    },
  };
}

export type GitHub = ReturnType<typeof github>;
