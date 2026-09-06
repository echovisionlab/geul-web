import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createDebouncedPatch } from './debounced-patch';
import { requireActionSuccess } from './require-action-success';

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('delayed editor patches', () => {
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
