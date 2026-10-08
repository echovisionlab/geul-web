import { afterEach, describe, expect, it, vi } from 'vitest';
import manifest from './cdn-runtime-manifest.json';
import { createThreeCdnRuntimeLoader, THREE_CDN_TIMEOUT_MS } from './cdn-runtime';

const three = { REVISION: manifest.versions.three.split('.')[1], WebGLRenderer: class {} };

afterEach(() => vi.useRealTimers());

describe('Three CDN runtime', () => {
  it('shares an in-flight and resolved runtime between concurrent renderers', async () => {
    let resolve!: (module: unknown) => void;
    const importModule = vi.fn(
      () =>
        new Promise<unknown>((done) => {
          resolve = done;
        }),
    );
    const loader = createThreeCdnRuntimeLoader(importModule);
    const first = loader.loadThree();
    const second = loader.loadThree();
    expect(first).toBe(second);
    resolve(three);
    expect(await first).toBe(three);
    expect(await loader.loadThree()).toBe(three);
    expect(importModule).toHaveBeenCalledOnce();
  });

  it('permits a later load after network failure', async () => {
    const importModule = vi.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce(three);
    const loader = createThreeCdnRuntimeLoader(importModule);
    await expect(loader.loadThree()).rejects.toThrow('offline');
    await expect(loader.loadThree()).resolves.toBe(three);
    expect(importModule).toHaveBeenCalledTimes(2);
  });

  it('rejects a runtime revision that differs from the installed types', async () => {
    const loader = createThreeCdnRuntimeLoader(async () => ({ ...three, REVISION: '175' }));
    await expect(loader.loadThree()).rejects.toThrow('does not match');
  });

  it('ends a hung CDN request without leaving callers loading indefinitely', async () => {
    vi.useFakeTimers();
    const loader = createThreeCdnRuntimeLoader(() => new Promise(() => {}));
    const pending = expect(loader.loadThree()).rejects.toThrow('did not respond');
    await vi.advanceTimersByTimeAsync(THREE_CDN_TIMEOUT_MS);
    await pending;
  });

  it('loads bundled Ionian after Three is ready, sharing both concurrent imports', async () => {
    const module = { ParticlesEngine: class {} };
    let ready!: (module: unknown) => void;
    const importModule = vi.fn(
      () =>
        new Promise((resolve) => {
          ready = resolve;
        }),
    );
    const importIonian = vi.fn().mockResolvedValue(module);
    const loader = createThreeCdnRuntimeLoader(importModule, importIonian);
    const pending = loader.loadIonian();
    expect(loader.loadIonian()).toBe(pending);
    expect(importIonian).not.toHaveBeenCalled();
    ready(three);
    await expect(pending).resolves.toBe(module);
    await expect(loader.loadIonian()).resolves.toBe(module);
    expect(importModule).toHaveBeenCalledOnce();
    expect(importModule).toHaveBeenCalledWith(manifest.threeUrl);
    expect(importIonian).toHaveBeenCalledOnce();
    expect(new URL(manifest.threeUrl).hostname).toBe('cdn.jsdelivr.net');
  });

  it('does not evaluate Ionian on CDN failure and permits a later attempt', async () => {
    const importModule = vi.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce(three);
    const importIonian = vi.fn().mockResolvedValue({ ParticlesEngine: class {} });
    const loader = createThreeCdnRuntimeLoader(importModule, importIonian);
    await expect(loader.loadIonian()).rejects.toThrow('offline');
    expect(importIonian).not.toHaveBeenCalled();
    await expect(loader.loadIonian()).resolves.toHaveProperty('ParticlesEngine');
    expect(importIonian).toHaveBeenCalledOnce();
  });

  it('clears a failed Ionian chunk load without downloading Three again', async () => {
    const importModule = vi.fn().mockResolvedValue(three);
    const importIonian = vi
      .fn()
      .mockRejectedValueOnce(new Error('chunk failed'))
      .mockResolvedValueOnce({ ParticlesEngine: class {} });
    const loader = createThreeCdnRuntimeLoader(importModule, importIonian);
    await expect(loader.loadIonian()).rejects.toThrow('chunk failed');
    await expect(loader.loadIonian()).resolves.toHaveProperty('ParticlesEngine');
    expect(importModule).toHaveBeenCalledOnce();
  });

  it('rejects an invalid Ionian chunk', async () => {
    const loader = createThreeCdnRuntimeLoader(
      async () => three,
      async () => ({}) as never,
    );
    await expect(loader.loadIonian()).rejects.toThrow('Ionian runtime is unavailable');
  });
});
