// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { registerEditorSave } from '@/lib/editor/editor-save-registry';
import { runPageStatusChangeAfterSave } from './PageEditor';

const pageId = 'page-lifecycle-1';
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

describe('Page lifecycle save barrier', () => {
  it('preserves publish intent without changing status when a registered save fails', async () => {
    const order: string[] = [];
    const publish = vi.fn(async () => order.push('publish'));
    const unpublish = vi.fn(async () => order.push('unpublish'));
    const onSaveFailure = vi.fn(() => order.push('save-failed'));
    unregisterSave = registerEditorSave(`page:${pageId}`, {
      flush: async () => {
        order.push('flush');
        return false;
      },
      hasPending: () => true,
    });

    const changed = await runPageStatusChangeAfterSave(pageId, 'published', { publish, unpublish }, onSaveFailure);

    expect(changed).toBe(false);
    expect(order).toEqual(['flush', 'save-failed']);
    expect(publish).not.toHaveBeenCalled();
    expect(unpublish).not.toHaveBeenCalled();
  });

  it('runs the requested status change only after the registered save succeeds', async () => {
    const completion = deferred<boolean>();
    const order: string[] = [];
    const publish = vi.fn(async () => order.push('publish'));
    const unpublish = vi.fn(async () => order.push('unpublish'));
    const onSaveFailure = vi.fn();
    let pending = true;
    unregisterSave = registerEditorSave(`page:${pageId}`, {
      flush: async () => {
        order.push('flush');
        const saved = await completion.promise;
        pending = false;
        return saved;
      },
      hasPending: () => pending,
    });

    const change = runPageStatusChangeAfterSave(pageId, 'draft', { publish, unpublish }, onSaveFailure);
    await Promise.resolve();
    expect(order).toEqual(['flush']);
    expect(unpublish).not.toHaveBeenCalled();

    completion.resolve(true);
    await expect(change).resolves.toBe(true);

    expect(order).toEqual(['flush', 'unpublish']);
    expect(publish).not.toHaveBeenCalled();
    expect(unpublish).toHaveBeenCalledOnce();
    expect(onSaveFailure).not.toHaveBeenCalled();
  });
});
