import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createUploadPartError } from './upload-errors';
import { retryUpload } from './upload-retry';

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

function cancellation() {
  const aborters = new Set<() => void>();
  return {
    registerAborter: (aborter: () => void) => {
      aborters.add(aborter);
      return () => {
        aborters.delete(aborter);
      };
    },
    cancel: () => {
      aborters.forEach((aborter) => aborter());
    },
    aborters,
  };
}

describe('upload retry policy', () => {
  it('bounds transient retries at five attempts with longer disconnect recovery delays', async () => {
    const operation = vi.fn().mockRejectedValue(createUploadPartError(503, 'unavailable'));
    const runtime = cancellation();
    const startedAt = Date.now();
    const result = retryUpload(operation, runtime);
    const rejected = expect(result).rejects.toMatchObject({ status: 503 });
    await vi.runAllTimersAsync();
    await rejected;
    expect(operation).toHaveBeenCalledTimes(5);
    expect(Date.now() - startedAt).toBe(15_000);
    expect(runtime.aborters.size).toBe(0);
  });

  it('cancels immediately during backoff and unregisters the aborter', async () => {
    const operation = vi.fn().mockRejectedValue(createUploadPartError(503, 'unavailable'));
    const runtime = cancellation();
    const result = retryUpload(operation, runtime);
    const rejected = expect(result).rejects.toThrow('Upload aborted');
    await vi.advanceTimersByTimeAsync(500);
    runtime.cancel();
    await rejected;
    await vi.runAllTimersAsync();
    expect(operation).toHaveBeenCalledOnce();
    expect(runtime.aborters.size).toBe(0);
  });

  it.each([false, true])('waits offline and %s selects cancellation instead of online recovery', async (cancel) => {
    const browser = new EventTarget();
    const network = { onLine: false };
    vi.stubGlobal('window', browser);
    vi.stubGlobal('navigator', network);
    const operation = vi
      .fn()
      .mockRejectedValueOnce(createUploadPartError(503, 'unavailable'))
      .mockResolvedValue('done');
    const runtime = cancellation();
    const result = retryUpload(operation, runtime);
    const outcome = cancel ? expect(result).rejects.toThrow('Upload aborted') : expect(result).resolves.toBe('done');
    await vi.advanceTimersByTimeAsync(60_000);
    expect(operation).toHaveBeenCalledOnce();
    if (cancel) {
      runtime.cancel();
    } else {
      network.onLine = true;
      browser.dispatchEvent(new Event('online'));
    }
    await outcome;
    network.onLine = true;
    browser.dispatchEvent(new Event('online'));
    expect(operation).toHaveBeenCalledTimes(cancel ? 1 : 2);
    expect(runtime.aborters.size).toBe(0);
  });

  it.each([429, 503])('honors HTTP-date Retry-After for %s', async (status) => {
    vi.setSystemTime(new Date('2026-10-05T00:00:00Z'));
    const error = createUploadPartError(status, 'busy', false, 'Mon, 05 Oct 2026 00:00:04 GMT');
    const operation = vi.fn().mockRejectedValueOnce(error).mockResolvedValue('done');
    const result = retryUpload(operation, cancellation());
    await vi.advanceTimersByTimeAsync(3999);
    expect(operation).toHaveBeenCalledOnce();
    await vi.advanceTimersByTimeAsync(1);
    await expect(result).resolves.toBe('done');
  });

  it('clamps Retry-After and ignores invalid or irrelevant values', () => {
    expect(createUploadPartError(503, 'busy', false, '999999').retryAfterMs).toBe(60_000);
    expect(createUploadPartError(503, 'busy', false, 'invalid').retryAfterMs).toBeUndefined();
    expect(createUploadPartError(400, 'invalid', false, '10').retryAfterMs).toBeUndefined();
  });
});
