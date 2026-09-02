import { describe, expect, it, vi } from 'vitest';
import { createTiptapMapSelectionMenuRegistry } from './MapSelectionMenuRegistry';

describe('createTiptapMapSelectionMenuRegistry', () => {
  it('publishes live NodeView bindings and does not let stale cleanup remove a replacement', () => {
    const registry = createTiptapMapSelectionMenuRegistry();
    const listener = vi.fn();
    registry.subscribe(listener);
    const first = {
      snapshot: { places: [], textAlignment: 'left' as const, previewWidth: '100' },
      commands: {},
    };
    const replacement = {
      snapshot: { places: [], textAlignment: 'center' as const, previewWidth: '64' },
      commands: {},
    };

    const unregisterFirst = registry.register('map-1', first);
    const unregisterReplacement = registry.register('map-1', replacement);
    unregisterFirst();
    expect(registry.get('map-1')).toBe(replacement);

    unregisterReplacement();
    expect(registry.get('map-1')).toBeUndefined();
    expect(listener).toHaveBeenCalledTimes(3);
  });
});
