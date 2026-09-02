import { describe, expect, it } from 'vitest';
import { buildPostMapConfig } from './shared';
import { getFullWorldZoomForDimensions } from './viewport';

describe('buildPostMapConfig', () => {
  it('uses a world view by default instead of fitting tightly to places', () => {
    const config = buildPostMapConfig(
      {
        aspectRatio: '16:9',
        previewWidth: '100',
        minZoom: '-2',
        maxZoom: '22',
        preferredScheme: 'auto',
        areaLabelsMode: 'inherit',
        poiLabelsMode: 'inherit',
      },
      null,
    );

    expect(config.center).toEqual({ lat: 0, lng: 0 });
    expect(config.zoom).toBeCloseTo(getFullWorldZoomForDimensions(1280, 720), 3);
    expect(config.minZoom).toBe(-2);
    expect(config.maxZoom).toBe(22);
    expect(config.cluster).toBe(false);
    expect(config.areaLabelsMode).toBe('inherit');
    expect(config.poiLabelsMode).toBe('inherit');
  });

  it('clamps the initial zoom into the configured zoom bounds', () => {
    const config = buildPostMapConfig(
      {
        aspectRatio: '16:9',
        previewWidth: '100',
        minZoom: '4',
        maxZoom: '6',
        preferredScheme: 'auto',
        areaLabelsMode: 'inherit',
        poiLabelsMode: 'inherit',
      },
      null,
      {
        bounds: {
          west: -180,
          south: -85,
          east: 180,
          north: 85,
        },
        zoom: 2.5,
      },
    );

    expect(config.zoom).toBe(4);
    expect(config.minZoom).toBe(4);
    expect(config.maxZoom).toBe(6);
  });
});
