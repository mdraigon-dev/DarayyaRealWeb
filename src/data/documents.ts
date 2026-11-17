/**
 * documents.ts — admin delete for circulars / reports.
 *
 * A published document is two files: its metadata (src/content/circulars/…md)
 * and the attachment (public/circulars/files/…). The metadata goes first, so
 * the site never lists a document whose file is missing; the attachment is
 * then removed best-effort (an orphaned file is harmless and invisible).
 */
import { deleteFile, GitConflictError } from './git-gateway';

export async function deleteDocument(opts: {
  /** The content entry's file name, e.g. "report-2026-q1-financial.md" */
  source: string;
  /** Public path of the attachment, e.g. "/circulars/files/x.pdf" */
  file: string;
  message: string;
}): Promise<void> {
  const name = opts.source.endsWith('.md') ? opts.source : `${opts.source}.md`;
  const path = `src/content/circulars/${name}`;

  let removed = false;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      removed = await deleteFile(path, opts.message);
      break;
    } catch (err) {
      // The file changed between reading its SHA and deleting — read again.
      if (!(err instanceof GitConflictError) || attempt === 2) throw err;
      await new Promise((r) => setTimeout(r, 600 * (attempt + 1)));
    }
  }
  if (!removed) throw new Error('ITEM_NOT_FOUND');

  if (opts.file.startsWith('/circulars/files/')) {
    try {
      await deleteFile(`public${opts.file}`, `${opts.message} (file)`);
    } catch {
      // Listing is already gone; an orphaned attachment is harmless.
    }
  }
}
