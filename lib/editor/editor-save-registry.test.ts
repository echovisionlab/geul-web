// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createDebouncedPatch } from './debounced-patch';
import { flushAllEditorSaves, flushEditorSaves, registerEditorSave } from './editor-save-registry';
import {
  clearEditorSaveRecovery,
  persistEditorSaveRecoveryEntry,
  readEditorSaveRecovery,
} from './editor-save-recovery';

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  window.sessionStorage.clear();
  vi.useRealTimers();
});

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

  it('preserves an unkeyed legacy archive without blocking healthy navigation', async () => {
    window.sessionStorage.clear();
    persistEditorSaveRecoveryEntry('work:archived', 'old-queue', {
      document: 'work:archived',
      updatedAt: Date.now(),
      patch: { title: 'old draft' },
    });
    const current = createDebouncedPatch<{ summary: string }>(500);
    current.enqueue({ summary: 'current' }, async () => undefined);
    const unregister = registerEditorSave('page:current', current);
    try {
      expect(await flushEditorSaves('page:current')).toBe(true);
      expect(await flushAllEditorSaves()).toBe(true);
      expect(await flushEditorSaves('work:archived')).toBe(true);
      expect(readEditorSaveRecovery('work:archived')?.entries).toMatchObject([
        { id: 'old-queue', document: 'work:archived', patch: { title: 'old draft' } },
      ]);
    } finally {
      unregister();
      current.cancel();
      clearEditorSaveRecovery('work:archived', ['old-queue']);
    }
  });

  it('blocks on a keyed orphan only when a registered writer matches its exact scope, document, and key', async () => {
    const document = 'work:one:en';
    const recoveryScope = 'work-room:one:en';
    persistEditorSaveRecoveryEntry(recoveryScope, 'matching-orphan', {
      document,
      updatedAt: Date.now(),
      recoveryKey: 'work-metadata',
      patch: { title: 'recoverable title' },
    });
    const queue = createDebouncedPatch<{ title: string }>(
      500,
      document,
      recoveryScope,
      undefined,
      false,
      'work-metadata',
    );
    const unregister = registerEditorSave(document, queue);
    try {
      expect(await flushEditorSaves(document)).toBe(false);
      expect(readEditorSaveRecovery(recoveryScope)?.entries).toMatchObject([
        { id: 'matching-orphan', recoveryKey: 'work-metadata', patch: { title: 'recoverable title' } },
      ]);
    } finally {
      unregister();
      queue.cancel();
      clearEditorSaveRecovery(recoveryScope);
    }
  });

  it('does not block on a wrong key, locale, scope, or an unkeyed legacy archive', async () => {
    const document = 'work:one:en';
    const recoveryScope = 'work-room:one:en';
    const otherScope = 'work-room:one:ko';
    const persist = (scope: string, id: string, entryDocument: string, recoveryKey?: string) =>
      persistEditorSaveRecoveryEntry(scope, id, {
        document: entryDocument,
        updatedAt: Date.now(),
        patch: { title: id },
        ...(recoveryKey === undefined ? {} : { recoveryKey }),
      });
    persist(recoveryScope, 'wrong-key', document, 'work-layout');
    persist(recoveryScope, 'wrong-locale', 'work:one:ko', 'work-metadata');
    persist(recoveryScope, 'unkeyed-legacy', document);
    persist(otherScope, 'wrong-scope', document, 'work-metadata');

    const queue = createDebouncedPatch<{ title: string }>(
      500,
      document,
      recoveryScope,
      undefined,
      false,
      'work-metadata',
    );
    const unregister = registerEditorSave(document, queue);
    try {
      expect(await flushEditorSaves(document)).toBe(true);
      expect(
        readEditorSaveRecovery(recoveryScope)
          ?.entries.map(({ id }) => id)
          .sort(),
      ).toEqual(['unkeyed-legacy', 'wrong-key', 'wrong-locale'].sort());
      expect(readEditorSaveRecovery(otherScope)?.entries.map(({ id }) => id)).toEqual(['wrong-scope']);
    } finally {
      unregister();
      queue.cancel();
      clearEditorSaveRecovery(recoveryScope);
      clearEditorSaveRecovery(otherScope);
    }
  });

  it('keeps a matching recovered save blocking until its automatic retry is durably acknowledged', async () => {
    const document = 'post:one:en';
    const recoveryScope = 'post-room:one:en';
    persistEditorSaveRecoveryEntry(recoveryScope, 'failed-prior-queue', {
      document,
      updatedAt: Date.now(),
      recoveryKey: 'post-metadata',
      patch: { title: 'pending canonical title' },
    });
    const write = vi.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValue(undefined);
    const queue = createDebouncedPatch<{ title: string }>(
      500,
      document,
      recoveryScope,
      undefined,
      false,
      'post-metadata',
    );
    queue.activateRecovery(write);
    const unregister = registerEditorSave(document, queue);
    try {
      expect(queue.getPendingPatch()).toEqual({ title: 'pending canonical title' });
      expect(await flushEditorSaves(document)).toBe(false);
      expect(write).toHaveBeenCalledExactlyOnceWith({ title: 'pending canonical title' });

      await vi.advanceTimersByTimeAsync(1_000);

      expect(write).toHaveBeenCalledTimes(2);
      expect(await flushEditorSaves(document)).toBe(true);
      expect(readEditorSaveRecovery(recoveryScope)).toBeNull();
    } finally {
      unregister();
      queue.cancel();
      queue.deactivateRecovery();
      clearEditorSaveRecovery(recoveryScope);
    }
  });
});
