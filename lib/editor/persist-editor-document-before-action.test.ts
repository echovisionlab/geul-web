import { afterEach, describe, expect, it, vi } from 'vitest';
import { notificationQueue, notifications } from '@/components/core/Notification/notifications';
import { persistCollaborativeDocumentNow } from '@/lib/collab/persist-now';
import { registerEditorSave } from './editor-save-registry';
import { persistEditorDocumentBeforeAction } from './persist-editor-document-before-action';

vi.mock('@/lib/collab/persist-now', () => ({ persistCollaborativeDocumentNow: vi.fn() }));

const options = {
  document: 'campaign:campaign-1',
  provider: null,
  requiresSync: true,
  isSynced: true,
  saveFailedMessage: 'Could not save',
  syncingMessage: 'Still syncing',
  syncingTone: 'warning' as const,
};
let unregister: (() => void) | undefined;
afterEach(() => {
  unregister?.();
  unregister = undefined;
  notifications.clean();
  vi.resetAllMocks();
});
function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((finish) => {
    resolve = finish;
  });
  return { promise, resolve };
}
const notices = () => notificationQueue.visibleToasts.map((toast) => toast.content);

describe('persisting an editor before an action', () => {
  it('allows the action only after registered saves and provider durability both finish', async () => {
    const saved = deferred();
    const persistenceStarted = deferred();
    const persisted = deferred();
    let pending = true;
    unregister = registerEditorSave(options.document, {
      hasPending: () => pending,
      flush: async () => {
        await saved.promise;
        pending = false;
        return true;
      },
    });
    vi.mocked(persistCollaborativeDocumentNow).mockImplementation(() => {
      persistenceStarted.resolve();
      return persisted.promise;
    });
    const complete = vi.fn();

    const action = persistEditorDocumentBeforeAction(options).then(complete);
    expect(persistCollaborativeDocumentNow).not.toHaveBeenCalled();
    saved.resolve();
    await persistenceStarted.promise;
    expect(complete).not.toHaveBeenCalled();
    persisted.resolve();
    await action;

    expect(complete).toHaveBeenCalledWith(true);
    expect(notices()).toEqual([]);
  });

  it('does not persist or allow the action after a registered save fails', async () => {
    unregister = registerEditorSave(options.document, { hasPending: () => true, flush: async () => false });

    await expect(persistEditorDocumentBeforeAction(options)).resolves.toBe(false);

    expect(persistCollaborativeDocumentNow).not.toHaveBeenCalled();
    expect(notices()).toEqual([{ message: 'Could not save', tone: 'danger' }]);
  });

  it('does not persist or allow the action until a required locale room is synced', async () => {
    await expect(persistEditorDocumentBeforeAction({ ...options, isSynced: false })).resolves.toBe(false);

    expect(persistCollaborativeDocumentNow).not.toHaveBeenCalled();
    expect(notices()).toEqual([{ message: 'Still syncing', tone: 'warning' }]);
  });

  it.each([
    [new Error('Persistence failed'), 'Persistence failed'],
    ['unstructured failure', 'Could not save'],
  ])('does not allow the action when provider persistence fails: %s', async (error, message) => {
    vi.mocked(persistCollaborativeDocumentNow).mockRejectedValue(error);

    await expect(persistEditorDocumentBeforeAction(options)).resolves.toBe(false);

    expect(notices()).toEqual([{ message, tone: 'danger' }]);
  });
});
