import { describe, expect, it } from 'vitest';
import { buildMapLibreStyle } from './style-builder';

const baseConfig = {
  backgroundColor: '#ffffff',
  waterColor: '#dbeafe',
  landColor: '#f8fafc',
  roadColor: '#cbd5e1',
  buildingFillColor: '#94a3b8',
  buildingStrokeEnabled: true,
  buildingStrokeColor: '#475569',
};

describe('style-builder', () => {
  it('loads generated map style resources directly from OpenFreeMap', () => {
    const style = buildMapLibreStyle(baseConfig);
    expect(style.sources.openmaptiles).toEqual({
      type: 'vector',
      url: 'https://tiles.openfreemap.org/planet',
    });
    expect(style.glyphs).toBe('https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf');
  });
});
