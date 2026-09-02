import { describe, expect, it, vi } from 'vitest';
import {
  enqueueFileDownloadPolicyWrite,
  waitForFileDownloadPolicyWrites,
} from './file-download-policy-write-coordinator';

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((nextResolve, nextReject) => {
    resolve = nextResolve;
    reject = nextReject;
  });
  return { promise, reject, resolve };
}

describe('file download policy write coordinator', () => {
  it('orders writes for the same target and drains through the latest tail', async () => {
    const first = deferred<string>();
    const writes: string[] = [];
    const firstResult = enqueueFileDownloadPolicyWrite('post:1:file:1', async () => {
      writes.push('first:start');
      const value = await first.promise;
      writes.push('first:end');
      return value;
    });
    const secondResult = enqueueFileDownloadPolicyWrite('post:1:file:1', async () => {
      writes.push('second');
      return 'second';
    });
    const drained = waitForFileDownloadPolicyWrites('post:1:file:1').then(() => writes.push('drained'));

    await Promise.resolve();
    expect(writes).toEqual(['first:start']);
    first.resolve('first');
    await expect(firstResult).resolves.toBe('first');
    await expect(secondResult).resolves.toBe('second');
    await drained;
    expect(writes).toEqual(['first:start', 'first:end', 'second', 'drained']);
  });

  it('does not let a failed write break a later same-target write', async () => {
    const first = deferred<void>();
    const second = vi.fn(async () => 'saved');
    const firstResult = enqueueFileDownloadPolicyWrite('post:1:file:2', () => first.promise);
    const secondResult = enqueueFileDownloadPolicyWrite('post:1:file:2', second);

    first.reject(new Error('save failed'));
    await expect(firstResult).rejects.toThrow('save failed');
    await expect(secondResult).resolves.toBe('saved');
    expect(second).toHaveBeenCalledTimes(1);
  });

  it('does not block writes for a different target', async () => {
    const blocked = deferred<void>();
    void enqueueFileDownloadPolicyWrite('post:1:file:3', () => blocked.promise);
    const independent = vi.fn(async () => 'independent');

    await expect(enqueueFileDownloadPolicyWrite('post:1:file:4', independent)).resolves.toBe('independent');
    expect(independent).toHaveBeenCalledTimes(1);
    blocked.resolve();
    await waitForFileDownloadPolicyWrites('post:1:file:3');
  });
});
