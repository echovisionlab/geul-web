import { describe, expect, it, vi } from 'vitest';
import { loadVideoJsRuntime } from './videojs-loader';

vi.mock('./videojs-player', () => ({ mountVideoJsPlayer: vi.fn(), disposeVideoJsPlayer: vi.fn() }));

describe('loadVideoJsRuntime', () => {
  it('shares the pending and resolved runtime promise between consumers', async () => {
    const first = loadVideoJsRuntime();
    expect(loadVideoJsRuntime()).toBe(first);
    const runtime = await first;
    expect(runtime.mountVideoJsPlayer).toBeTypeOf('function');
    expect(loadVideoJsRuntime()).toBe(first);
  });
});
