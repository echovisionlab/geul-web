import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createDebouncedPatch } from './debounced-patch';
import { requireActionSuccess } from './require-action-success';
import { Code } from '@connectrpc/connect';
import { SaveParkedError, UnretryableSaveError } from './save-failure';
import {
  getRejectedEditorSaves,
  hasRejectedEditorSaves,
  hasUnsavedEditorEdits,
  registerEditorSave,
} from './editor-save-registry';
import { resolveEditorSaveState } from './editor-save-state';

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('delayed editor patches', () => {
  it('exports a detached latest-field copy through in-flight saves and failure without changing the queue', async () => {
    type Patch = { title?: string; summary?: string | null; layout?: { footer: string } };
    let reject!: (error: Error) => void;
    const first = vi.fn(
      () =>
        new Promise<void>((_, fail) => {
          reject = fail;
        }),
    );
    const queue = createDebouncedPatch<Patch>(500);
    expect(queue.getPendingPatch()).toBeNull();
    queue.enqueue({ title: 'first', summary: 'old', layout: { footer: 'flow' } }, first);
    const flushed = queue.flush();
    const retry = vi.fn();
    queue.enqueue({ title: 'latest', summary: null }, retry);
    const copy = queue.getPendingPatch();
    expect(copy).toEqual({ title: 'latest', summary: null, layout: { footer: 'flow' } });
    copy!.layout!.footer = 'pinned';
    expect(queue.getPendingPatch()?.layout).toEqual({ footer: 'flow' });
    expect(queue.hasPending()).toBe(true);
    expect(first).toHaveBeenCalledOnce();
    expect(retry).not.toHaveBeenCalled();
    reject(new Error('stale settings'));
    expect(await flushed).toBe(false);
    expect(queue.getPendingPatch()).toEqual({ title: 'latest', summary: null, layout: { footer: 'flow' } });
    expect(await queue.flush()).toBe(true);
    expect(retry).toHaveBeenCalledExactlyOnceWith({ title: 'latest', summary: null, layout: { footer: 'flow' } });
    expect(queue.getPendingPatch()).toBeNull();
  });

  it('keeps the delay, combines different fields, and preserves explicit clearing values', async () => {
    const write = vi.fn();
    const queue = createDebouncedPatch<Record<string, unknown>>(500);
    queue.enqueue({ title: 'first', featured: true }, write);
    await vi.advanceTimersByTimeAsync(400);
    queue.enqueue({ title: '', summary: null, featured: false, clients: [] }, write);
    await vi.advanceTimersByTimeAsync(499);
    expect(write).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(write).toHaveBeenCalledExactlyOnceWith({ title: '', summary: null, featured: false, clients: [] });
  });

  it('serializes writes and includes edits made during an in-flight save in flush', async () => {
    let finish!: () => void;
    const first = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          finish = resolve;
        }),
    );
    const next = vi.fn();
    const queue = createDebouncedPatch<{ title?: string; summary?: string }>(500);
    queue.enqueue({ title: 'one' }, first);
    const flushed = queue.flush();
    queue.enqueue({ summary: 'two' }, next);
    await vi.advanceTimersByTimeAsync(500);
    expect(next).not.toHaveBeenCalled();
    finish();
    expect(await flushed).toBe(true);
    expect(next).toHaveBeenCalledExactlyOnceWith({ summary: 'two' });
  });

  it.each(['throw', 'result'] as const)(
    'retains a failed patch (%s) for retry without overwriting a newer edit',
    async (failure) => {
      const queue = createDebouncedPatch<{ title?: string; summary?: string }>(500);
      const fail = vi.fn(async () => {
        queue.enqueue({ title: 'new' }, write);
        if (failure === 'throw') {
          throw new Error('denied');
        }
        return requireActionSuccess(Promise.resolve({ error: 'denied' }));
      });
      const write = vi.fn();
      queue.enqueue({ title: 'old', summary: 'keep' }, fail);
      expect(await queue.flush()).toBe(false);
      expect(await queue.flush()).toBe(true);
      expect(write).toHaveBeenCalledExactlyOnceWith({ title: 'new', summary: 'keep' });
    },
  );

  it('does not requeue a failed in-flight save after its room is disposed', async () => {
    let reject!: (error: Error) => void;
    const queue = createDebouncedPatch<{ title: string }>(500);
    queue.enqueue(
      { title: 'old locale' },
      () =>
        new Promise((_, fail) => {
          reject = fail;
        }),
    );
    const flushed = queue.flush();
    queue.cancel();
    reject(new Error('room closed'));
    expect(await flushed).toBe(false);
    expect(queue.hasPending()).toBe(false);
  });
});

it('retains a full debounce after input made while another save is running', async () => {
  let finish!: () => void;
  const queue = createDebouncedPatch<{ title: string }>(500);
  queue.enqueue(
    { title: 'first' },
    () =>
      new Promise<void>((resolve) => {
        finish = resolve;
      }),
  );
  await vi.advanceTimersByTimeAsync(500);
  const write = vi.fn();
  queue.enqueue({ title: 'second' }, write);
  await vi.advanceTimersByTimeAsync(500);
  queue.enqueue({ title: 'latest' }, write);
  finish();
  await vi.advanceTimersByTimeAsync(499);
  expect(write).not.toHaveBeenCalled();
  await vi.advanceTimersByTimeAsync(1);
  expect(write).toHaveBeenCalledExactlyOnceWith({ title: 'latest' });
});

it('automatically retries failed intent and cancels retries on disposal', async () => {
  const queue = createDebouncedPatch<{ title: string }>(100, 'retry-test', null, undefined, true);
  const write = vi.fn().mockRejectedValueOnce(new Error('disconnected')).mockResolvedValue(undefined);
  queue.enqueue({ title: 'retained' }, write);
  await vi.advanceTimersByTimeAsync(100);
  expect(queue.hasPending()).toBe(true);
  await vi.advanceTimersByTimeAsync(999);
  expect(write).toHaveBeenCalledOnce();
  await vi.advanceTimersByTimeAsync(1);
  expect(write).toHaveBeenCalledTimes(2);
  expect(queue.hasPending()).toBe(false);
  const failed = vi.fn().mockRejectedValue(new Error('disconnected'));
  queue.enqueue({ title: 'unmounted' }, failed);
  await vi.advanceTimersByTimeAsync(100);
  queue.cancel();
  queue.deactivateRecovery();
  await vi.advanceTimersByTimeAsync(30_000);
  expect(failed).toHaveBeenCalledOnce();
});

describe('refused editor patches', () => {
  it('stops retrying a refused patch, keeps it for review and still saves newer edits', async () => {
    type Patch = { slug?: string; title?: string };
    const write = vi
      .fn<(patch: Patch) => Promise<void>>()
      .mockRejectedValueOnce(new UnretryableSaveError('Slug is taken', 'AlreadyExists'))
      .mockResolvedValue(undefined);
    const queue = createDebouncedPatch<Patch>(100, 'post:refused', 'post:refused', undefined, true);
    const unregister = registerEditorSave('post:refused', queue);
    try {
      queue.enqueue({ slug: 'taken' }, write);
      await vi.advanceTimersByTimeAsync(100);
      expect(write).toHaveBeenCalledOnce();
      expect(queue.hasPending()).toBe(false);
      expect(queue.hasFailure()).toBe(false);
      expect(queue.getRejected()).toMatchObject({
        patch: { slug: 'taken' },
        reason: 'AlreadyExists',
        message: 'Slug is taken',
      });
      expect(hasRejectedEditorSaves('post:refused')).toBe(true);
      expect(
        resolveEditorSaveState({ phase: 'synced', hasUnsavedEdits: false, hasFailure: false, hasRejected: true }),
      ).toBe('rejected');

      // No automatic retry of the refused value, even long after.
      await vi.advanceTimersByTimeAsync(60_000);
      expect(write).toHaveBeenCalledOnce();

      // A newer edit is saved normally, and leaving still reports the refused one as unsaved.
      queue.enqueue({ title: 'new title' }, write);
      expect(await queue.flush()).toBe(false);
      expect(write).toHaveBeenLastCalledWith({ title: 'new title' });

      getRejectedEditorSaves('post:refused')[0]!.discard();
      expect(queue.getRejected()).toBeNull();
      expect(await queue.flush()).toBe(true);
    } finally {
      unregister();
    }
  });

  it('classifies server action failures by their Connect code', async () => {
    await expect(
      requireActionSuccess(Promise.resolve({ error: 'denied', errorCode: Code.PermissionDenied })),
    ).rejects.toMatchObject({ name: 'UnretryableSaveError', reason: 'PermissionDenied' });
    const transient = await requireActionSuccess(Promise.resolve({ error: 'busy', errorCode: Code.Unavailable })).catch(
      (error: unknown) => error,
    );
    expect(transient).toBeInstanceOf(Error);
    expect(transient).not.toBeInstanceOf(UnretryableSaveError);
  });
});

describe('parked editor patches', () => {
  it('keeps fields of a read-only room with their backup, sends nothing more and counts them as unsaved', async () => {
    type Patch = { name?: string };
    const write = vi.fn<(patch: Patch) => Promise<void>>().mockRejectedValue(new SaveParkedError());
    const queue = createDebouncedPatch<Patch>(100, 'form:parked', 'form:parked', undefined, true, 'form-schema');
    const unregister = registerEditorSave('form:parked', queue);
    try {
      queue.enqueue({ name: 'draft' }, write);
      await vi.advanceTimersByTimeAsync(100);
      expect(write).toHaveBeenCalledOnce();
      expect(queue.hasPending()).toBe(false);
      expect(queue.hasParked()).toBe(true);
      expect(queue.hasFailure()).toBe(false);
      expect(queue.getRejected()).toBeNull();
      expect(queue.getPendingPatch()).toEqual({ name: 'draft' });
      expect(hasUnsavedEditorEdits('form:parked')).toBe(true);
      await vi.advanceTimersByTimeAsync(60_000);
      expect(write).toHaveBeenCalledOnce();
      expect(await queue.flush()).toBe(true);
    } finally {
      unregister();
    }
  });

  it('counts parked fields as durable only when their backup was written, and resumes them on edit access', async () => {
    type Patch = { name?: string };
    let parked = true;
    const write = vi.fn<(patch: Patch) => Promise<void>>(async () => {
      if (parked) {
        throw new SaveParkedError();
      }
    });
    // No recovery key: the backup cannot be restored by a later page.
    const memoryOnly = createDebouncedPatch<Patch>(100, 'form:memory', null, undefined, true);
    memoryOnly.enqueue({ name: 'draft' }, write);
    await vi.advanceTimersByTimeAsync(100);
    expect(memoryOnly.hasParked()).toBe(true);
    expect(memoryOnly.isDurable()).toBe(false);

    parked = false;
    memoryOnly.resumeParked();
    await vi.advanceTimersByTimeAsync(0);
    expect(write).toHaveBeenLastCalledWith({ name: 'draft' });
    expect(memoryOnly.hasParked()).toBe(false);
    expect(memoryOnly.hasPending()).toBe(false);
  });
});
