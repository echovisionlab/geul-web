import type { HocuspocusProvider } from '@hocuspocus/provider';
import { notifications } from '@/components/core/Notification';
import { persistCollaborativeDocumentNow } from '@/lib/collab/persist-now';
import { flushEditorSavesOrNotify } from './flush-editor-saves-or-notify';

export async function persistEditorDocumentBeforeAction({
  document,
  provider,
  requiresSync,
  isSynced,
  saveFailedMessage,
  syncingMessage,
  syncingTone,
}: {
  document: string;
  provider: HocuspocusProvider | null;
  requiresSync: boolean;
  isSynced: boolean;
  saveFailedMessage: string;
  syncingMessage: string;
  syncingTone: 'accent' | 'warning';
}): Promise<boolean> {
  if (!(await flushEditorSavesOrNotify(document, saveFailedMessage))) {
    return false;
  }
  if (requiresSync && !isSynced) {
    notifications.show({ message: syncingMessage, tone: syncingTone });
    return false;
  }
  try {
    await persistCollaborativeDocumentNow(provider);
    return true;
  } catch (error) {
    notifications.show({
      message: error instanceof Error ? error.message : saveFailedMessage,
      tone: 'danger',
    });
    return false;
  }
}
