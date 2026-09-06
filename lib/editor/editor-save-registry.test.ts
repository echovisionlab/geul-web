import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createDebouncedPatch } from './debounced-patch';
import { flushEditorSaves, registerEditorSave } from './editor-save-registry';

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('locale transition saves', () => {
  it('waits for the old locale acknowledgement and blocks transition on failure', async () => {
    const queue = createDebouncedPatch<{ title: string }>(500);
    let finish!: () => void;
    queue.enqueue(
      { title: '한국어' },
      () =>
        new Promise<void>((resolve) => {
          finish = resolve;
        }),
    );
    const unregister = registerEditorSave('work:one', queue);
    try {
      const navigate = vi.fn();
      const transition = flushEditorSaves('work:one').then((saved) => {
        if (saved) {
          navigate();
        }
      });
      expect(navigate).not.toHaveBeenCalled();
      finish();
      await transition;
      expect(navigate).toHaveBeenCalledOnce();
      queue.enqueue({ title: '실패' }, async () => {
        throw new Error('forbidden');
      });
      expect(await flushEditorSaves('work:one')).toBe(false);
    } finally {
      unregister();
      queue.cancel();
    }
  });

  it('flushes only the selected document and catches edits to an earlier queue during the flush', async () => {
    const a = createDebouncedPatch<{ title: string }>(500);
    const b = createDebouncedPatch<{ summary: string }>(500);
    const other = vi.fn(async () => true);
    const write = vi.fn();
    const cleanups = [
      registerEditorSave('post:one', a),
      registerEditorSave('post:one', b),
      registerEditorSave('post:other', { flush: other, hasPending: () => false }),
    ];
    b.enqueue({ summary: 'two' }, async () => {
      a.enqueue({ title: 'late' }, write);
    });
    try {
      expect(await flushEditorSaves('post:one')).toBe(true);
      expect(write).toHaveBeenCalledExactlyOnceWith({ title: 'late' });
      expect(other).not.toHaveBeenCalled();
    } finally {
      cleanups.forEach((cleanup) => cleanup());
      a.cancel();
      b.cancel();
    }
  });
});
