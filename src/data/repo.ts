/**
 * repo.ts — how the site reads and saves content.
 *
 * Every save goes to the site's own save service (/.netlify/functions/repo),
 * which checks the signed-in person's roles and commits to GitHub. One call
 * to commitChanges = one commit = one deploy, however many files it touches.
 *
 * (This replaces the direct Git Gateway calls the site used before; Git
 * Gateway can't tell a secretary from an administrator.)
 */

const ENDPOINT = '/.netlify/functions/repo';

/** The file changed since it was read (HTTP 409): re-read and try again. */
export class GitConflictError extends Error {
  readonly code = 'CONFLICT' as const;
  constructor(message: string) {
    super(message);
    this.name = 'GitConflictError';
  }
}

/** The person's roles don't allow this change (or they have no role). */
export class PermissionError extends Error {
  constructor(readonly code: string, message: string) {
    super(message);
    this.name = 'PermissionError';
  }
}

/** Any other failure, with the service's error code when there is one. */
export class SaveError extends Error {
  constructor(readonly code: string, message: string) {
    super(message);
    this.name = 'SaveError';
  }
}

export type Change = {
  path: string;
  /** new text contents */
  text?: string;
  /** a binary file to upload (image, PDF…) */
  file?: Blob;
  /** an already-uploaded binary */
  blob?: string;
  delete?: true;
  /**
   * The version this change was based on: a blob SHA, or null for "must not
   * exist yet". Leave undefined to skip the check.
   */
  expectSha?: string | null;
};

async function token(): Promise<string> {
  const ni = (window as any).netlifyIdentity;
  const user = ni?.currentUser?.();
  if (!user) throw new PermissionError('NOT_SIGNED_IN', 'Not signed in');
  const t = await user.jwt();
  if (!t) throw new PermissionError('NOT_SIGNED_IN', 'Failed to get sign-in token');
  return t;
}

async function call(body: Record<string, unknown>): Promise<any> {
  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { Authorization: `Bearer ${await token()}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    cache: 'no-store',
  });
  let data: any = null;
  try { data = await res.json(); } catch { /* non-JSON error page */ }
  if (res.ok) return data;
  const code = data?.error || `HTTP_${res.status}`;
  const message = data?.message || `Save failed (HTTP ${res.status})`;
  if (res.status === 409) throw new GitConflictError(message);
  if (res.status === 401 || res.status === 403) throw new PermissionError(code, message);
  throw new SaveError(code, message);
}

// ── Reading ─────────────────────────────────────────────────────────────

export async function getFileContent(path: string): Promise<{ content: string; sha: string } | null> {
  const r = await call({ action: 'read', path });
  return r?.exists ? { content: r.text ?? '', sha: r.sha } : null;
}

export async function getFileSha(path: string): Promise<string | null> {
  const r = await call({ action: 'read', path, textOnly: false });
  return r?.exists ? r.sha : null;
}

// ── Uploading binaries ──────────────────────────────────────────────────

const CHUNK = 3 * 1024 * 1024; // raw bytes per request (≈4 MB once encoded)

function blobToBase64(b: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => {
      const s = r.result as string;
      resolve(s.slice(s.indexOf(',') + 1));
    };
    r.onerror = () => reject(r.error || new Error('read failed'));
    r.readAsDataURL(b);
  });
}

/** Upload a file's bytes to the repository; returns its blob SHA. */
export async function uploadBlob(file: Blob): Promise<string> {
  const total = Math.max(1, Math.ceil(file.size / CHUNK));
  if (total === 1) return (await call({ action: 'blob', data: await blobToBase64(file) })).sha;
  const id = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
  let last: any;
  for (let i = 0; i < total; i++) {
    const part = file.slice(i * CHUNK, (i + 1) * CHUNK);
    last = await call({ action: 'blob', data: await blobToBase64(part), upload: { id, index: i, total } });
  }
  return last.sha;
}

/** Upload any binaries now, so a retried commit doesn't upload them again. */
export async function prepareChanges(changes: Change[]): Promise<Change[]> {
  const out: Change[] = [];
  for (const c of changes) {
    if (c.file) {
      const { file, ...rest } = c;
      out.push({ ...rest, blob: await uploadBlob(file) });
    } else out.push(c);
  }
  return out;
}

// ── Saving ──────────────────────────────────────────────────────────────

/**
 * Save several file changes as a single commit. Returns the new blob SHA of
 * each written file (null for deletes), so a caller can chain edits.
 */
export async function commitChanges(message: string, changes: Change[]): Promise<Record<string, string | null>> {
  const ready = await prepareChanges(changes);
  const r = await call({
    action: 'commit',
    message,
    changes: ready.map((c) => ({
      path: c.path,
      ...(c.text !== undefined ? { text: c.text } : {}),
      ...(c.blob ? { blob: c.blob } : {}),
      ...(c.delete ? { delete: true } : {}),
      ...(c.expectSha !== undefined ? { expectSha: c.expectSha } : {}),
    })),
  });
  return r?.shas || {};
}

/**
 * Save one text file. `knownSha` pins the version it was based on (a 409
 * GitConflictError if it changed since); undefined skips that check.
 */
export async function commitFile(
  path: string,
  content: string,
  message: string,
  _branch = 'main',
  knownSha?: string | null,
): Promise<string | null> {
  const shas = await commitChanges(message, [{ path, text: content, expectSha: knownSha }]);
  return shas[path] ?? null;
}

/** Delete a file. Returns false if it was already gone. */
export async function deleteFile(path: string, message: string): Promise<boolean> {
  const sha = await getFileSha(path);
  if (!sha) return false;
  await commitChanges(message, [{ path, delete: true }]);
  return true;
}

// ── Messages for people ─────────────────────────────────────────────────

/** A sentence to show when a save fails, in the page's language. */
export function saveErrorMessage(err: unknown, lang: 'ar' | 'en'): string {
  const ar = lang === 'ar';
  if (err instanceof GitConflictError) {
    return ar ? 'تغيّر هذا المحتوى للتو. أعد تحميل الصفحة وحاول مجدداً.' : 'This was just changed by someone else. Reload the page and try again.';
  }
  if (err instanceof PermissionError) {
    if (err.code === 'NOT_SIGNED_IN') return ar ? 'سجّل الدخول أولاً.' : 'Please sign in first.';
    if (err.code === 'NO_ROLE') return ar ? 'لا يملك حسابك أي صلاحية على الموقع بعد. تواصل مع مسؤول النظام.' : 'Your account has no role on this site yet. Contact an administrator.';
    return ar ? 'صلاحيات حسابك لا تسمح بهذا الإجراء.' : "Your role doesn't allow this action.";
  }
  if (err instanceof SaveError) {
    if (err.code === 'NOT_CONFIGURED' || err.code === 'REPO_ACCESS') {
      return ar ? 'خدمة الحفظ غير مُعدّة بعد. تواصل مع مسؤول النظام.' : 'The save service is not set up yet. Contact an administrator.';
    }
    if (err.code === 'EXCEEDS_BUDGET') return ar ? 'المبلغ يتجاوز الميزانية.' : 'The amount exceeds the budget.';
  }
  return ar ? 'تعذّر الحفظ. تحقّق من الاتصال وحاول مجدداً.' : "Couldn't save. Check your connection and try again.";
}
