import { notifications } from '@/components/core/Notification';
import { flushEditorSaves } from './editor-save-registry';

/**
 * Saves every pending edit of `document` before an action that needs them persisted (leaving the
 * editor, a status change, a delivery). When a save fails, shows `message` as a danger
 * notification; the caller stops when this resolves false.
 */
export async function flushEditorSavesOrNotify(document: string, message: string): Promise<boolean> {
  const saved = await flushEditorSaves(document);
  if (!saved) {
    notifications.show({ message, tone: 'danger' });
  }
  return saved;
}
