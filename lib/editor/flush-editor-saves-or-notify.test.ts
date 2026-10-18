import { afterEach, describe, expect, it } from 'vitest';
import { notificationQueue, notifications } from '@/components/core/Notification/notifications';
import { registerEditorSave } from './editor-save-registry';
import { flushEditorSavesOrNotify } from './flush-editor-saves-or-notify';

function deferredSave() {
  let finish!: (saved: boolean) => void;
  let pending = true;
  const save = {
    flush: () =>
      new Promise<boolean>((resolve) => {
        finish = (saved) => {
          pending = !saved;
          resolve(saved);
        };
      }),
    hasPending: () => pending,
  };
  return { save, finish: (saved: boolean) => finish(saved) };
}

const visibleNotifications = () => notificationQueue.visibleToasts.map((toast) => toast.content);

afterEach(() => notifications.clean());

describe('flushEditorSavesOrNotify', () => {
  it('resolves true only after the pending save of the document is acknowledged, without a notification', async () => {
    const { save, finish } = deferredSave();
    const unregister = registerEditorSave('work:one', save);
    try {
      const result = flushEditorSavesOrNotify('work:one', 'Could not save');
      await expect(Promise.race([result, Promise.resolve('still saving')])).resolves.toBe('still saving');

      finish(true);

      await expect(result).resolves.toBe(true);
      expect(visibleNotifications()).toEqual([]);
    } finally {
      unregister();
    }
  });

  it('resolves false and shows the given message as a danger notification when a save fails', async () => {
    const { save, finish } = deferredSave();
    const unregister = registerEditorSave('work:one', save);
    try {
      const result = flushEditorSavesOrNotify('work:one', 'Could not save');
      finish(false);

      await expect(result).resolves.toBe(false);
      expect(visibleNotifications()).toEqual([{ message: 'Could not save', tone: 'danger' }]);
    } finally {
      unregister();
    }
  });
});
