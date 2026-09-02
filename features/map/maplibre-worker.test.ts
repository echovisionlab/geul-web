import { describe, expect, it, vi } from 'vitest';
import { configureMapLibreWorker, MAPLIBRE_WORKER_URL } from './maplibre-worker';

describe('configureMapLibreWorker', () => {
  it('uses the same-origin worker asset instead of resolving against the current route', () => {
    const setWorkerUrl = vi.fn();

    configureMapLibreWorker(setWorkerUrl);

    expect(setWorkerUrl).toHaveBeenCalledWith('/providers/maplibre/maplibre-gl-worker.mjs');
    expect(MAPLIBRE_WORKER_URL).not.toBe('');
  });
});
