import { afterEach, describe, expect, it, vi } from 'vitest';
import { registerEditorSave } from '@/lib/editor/editor-save-registry';
import { runPostLifecycleActionAfterSave } from './usePostLifecycle';

const postId = 'post-lifecycle-1';
let unregisterSave: (() => void) | null = null;

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

afterEach(() => {
  unregisterSave?.();
  unregisterSave = null;
});

describe('Post lifecycle save barrier', () => {
  it('preserves publish intent and reports a save failure without calling the action', async () => {
    let status = 'draft';
    const publish = vi.fn(async () => {
      status = 'published';
    });
    const onSaveFailure = vi.fn();
    const lock = { current: false };
    unregisterSave = registerEditorSave(`post:${postId}`, {
      flush: async () => false,
      hasPending: () => true,
    });

    const result = await runPostLifecycleActionAfterSave(postId, lock, publish, onSaveFailure);

    expect(result).toBeNull();
    expect(status).toBe('draft');
    expect(publish).not.toHaveBeenCalled();
    expect(onSaveFailure).toHaveBeenCalledOnce();
    expect(lock.current).toBe(false);
  });

  it('waits for body and configuration saves, then runs exactly one requested lifecycle action', async () => {
    const completion = deferred<boolean>();
    const order: string[] = [];
    let pending = true;
    const lock = { current: false };
    const schedule = vi.fn(async () => order.push('schedule'));
    const archive = vi.fn(async () => order.push('archive'));
    const onSaveFailure = vi.fn();
    unregisterSave = registerEditorSave(`post:${postId}`, {
      flush: async () => {
        order.push('flush');
        const saved = await completion.promise;
        pending = false;
        return saved;
      },
      hasPending: () => pending,
    });

    const scheduling = runPostLifecycleActionAfterSave(postId, lock, schedule, onSaveFailure);
    const concurrentArchive = runPostLifecycleActionAfterSave(postId, lock, archive, onSaveFailure);
    await Promise.resolve();
    expect(order).toEqual(['flush']);
    expect(lock.current).toBe(true);
    expect(schedule).not.toHaveBeenCalled();
    expect(archive).not.toHaveBeenCalled();

    completion.resolve(true);
    await expect(scheduling).resolves.toBe(2);
    await expect(concurrentArchive).resolves.toBeNull();

    expect(order).toEqual(['flush', 'schedule']);
    expect(schedule).toHaveBeenCalledOnce();
    expect(archive).not.toHaveBeenCalled();
    expect(onSaveFailure).not.toHaveBeenCalled();
    expect(lock.current).toBe(false);
  });

  it.each(['publish', 'unpublish', 'archive', 'schedule', 'republish'] as const)(
    'allows a %s lifecycle action after the registered save succeeds',
    async (name) => {
      let pending = true;
      const flush = vi.fn(async () => {
        pending = false;
        return true;
      });
      const action = vi.fn(async () => name);
      const onSaveFailure = vi.fn();
      unregisterSave = registerEditorSave(`post:${postId}`, { flush, hasPending: () => pending });

      await expect(runPostLifecycleActionAfterSave(postId, { current: false }, action, onSaveFailure)).resolves.toBe(
        name,
      );

      expect(flush).toHaveBeenCalledOnce();
      expect(action).toHaveBeenCalledOnce();
      expect(onSaveFailure).not.toHaveBeenCalled();
      unregisterSave();
      unregisterSave = null;
    },
  );
});
