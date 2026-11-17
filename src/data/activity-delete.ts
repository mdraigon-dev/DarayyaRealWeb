/**
 * Deleting an entry from the activity log deletes the record behind it:
 *   - field update / note / photo → removed from the project (a site-uploaded
 *     photo's image file goes too)
 *   - recorded contribution → removed AND its amount taken back off the
 *     project, so the raised total never includes unrecorded money
 *   - document → its listing and attachment are removed
 */
import type { ActivityRef } from './activity-feed';
import { removeProjectItem, removeFundEntry } from './project-file-edit';
import { deleteDocument } from './documents';

export async function deleteActivity(ref: ActivityRef, who: string): Promise<void> {
  if (ref.kind === 'item') {
    const label = ref.field === 'updates' ? 'field update' : ref.field === 'comments' ? 'note' : 'photo';
    await removeProjectItem({
      projectId: ref.projectId,
      field: ref.field,
      item: ref.item,
      message: `Delete ${label} on ${ref.projectId} by ${who}`,
    });
    return;
  }
  if (ref.kind === 'fund') {
    await removeFundEntry({
      projectId: ref.projectId,
      entry: ref.entry,
      message: `Delete recorded contribution of $${ref.entry.amountUSD} on ${ref.projectId} by ${who}`,
    });
    return;
  }
  await deleteDocument({
    source: ref.source,
    file: ref.file,
    message: `Delete document ${ref.source} by ${who}`,
  });
}
