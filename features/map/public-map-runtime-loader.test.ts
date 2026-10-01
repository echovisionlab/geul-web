import { describe, expect, it, vi } from 'vitest';
import { loadPublicMapRuntime, preloadPublicMapRuntime } from './public-map-runtime-loader';

describe('public map runtime loader', () => {
  it('shares an in-flight import, absorbs preload failures, and retries a rejected import', async () => {
    let rejectInitialImport: ((error: Error) => void) | undefined;
    const initialImport = vi.fn(
      () =>
        new Promise<() => null>((_resolve, reject) => {
          rejectInitialImport = reject;
        }),
    );
    const rejectedImport = loadPublicMapRuntime(initialImport);
    const dynamicImport = loadPublicMapRuntime(initialImport);
    const preload = preloadPublicMapRuntime(initialImport);

    expect(dynamicImport).toBe(rejectedImport);
    expect(initialImport).toHaveBeenCalledOnce();

    const error = new Error('runtime import failed');
    const rejection = expect(rejectedImport).rejects.toBe(error);
    rejectInitialImport?.(error);

    await Promise.all([rejection, expect(preload).resolves.toBeUndefined()]);

    const Runtime = () => null;
    const retryImport = vi.fn().mockResolvedValue(Runtime);

    await expect(loadPublicMapRuntime(retryImport)).resolves.toBe(Runtime);
    expect(retryImport).toHaveBeenCalledOnce();
  });
});
