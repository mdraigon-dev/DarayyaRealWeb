/**
 * documents.ts — delete a circular / report.
 *
 * A published document is two files: its details (src/content/circulars/…md)
 * and the attachment (public/circulars/files/…). Both go in one commit.
 */
import { commitChanges, getFileSha } from './repo';

export async function deleteDocument(opts: {
  /** The content entry's file name, e.g. "report-2026-q1-financial.md" */
  source: string;
  /** Public path of the attachment, e.g. "/circulars/files/x.pdf" */
  file: string;
  message: string;
}): Promise<void> {
  const name = opts.source.endsWith('.md') ? opts.source : `${opts.source}.md`;
  const path = `src/content/circulars/${name}`;
  if (!(await getFileSha(path))) throw new Error('ITEM_NOT_FOUND');
  await commitChanges(opts.message, [
    { path, delete: true },
    ...(opts.file.startsWith('/circulars/files/') ? [{ path: `public${opts.file}`, delete: true as const }] : []),
  ]);
}
