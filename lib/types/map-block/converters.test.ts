import { describe, expect, it } from 'vitest';
import { fromMapConfigUpdate, toMapConfig } from './converters';

describe('map block converters', () => {
  it('normalizes invalid zoom bounds and clamps zoom into the resolved range', () => {
    const config = toMapConfig({
      zoom: '18',
      minZoom: '12',
      maxZoom: '8',
    });

    expect(config.minZoom).toBe(12);
    expect(config.maxZoom).toBe(12);
    expect(config.zoom).toBe(12);
  });

  it('serializes zoom bounds back into block props updates', () => {
    expect(
      fromMapConfigUpdate({
        minZoom: 3.5,
        maxZoom: 9,
      }),
    ).toEqual({
      minZoom: '3.5',
      maxZoom: '9',
    });
  });
});
