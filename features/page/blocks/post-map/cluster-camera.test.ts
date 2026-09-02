import type * as maplibregl from 'maplibre-gl';
import { describe, expect, it, vi } from 'vitest';
import { focusFeatureCluster } from '../map-features/cluster-camera';

describe('focusFeatureCluster', () => {
  it('uses tighter drill padding on mobile-sized maps', () => {
    const cameraForBounds = vi.fn(() => ({
      center: [127, 37.5],
      zoom: 5.5,
      bearing: 0,
    }));
    const easeTo = vi.fn();

    focusFeatureCluster(
      {
        cameraForBounds,
        easeTo,
        getBearing: () => 0,
        getContainer: () => ({
          clientWidth: 390,
          clientHeight: 219,
        }),
      } as unknown as maplibregl.Map,
      {
        lat: 37.5,
        lng: 127,
        bounds: {
          west: 126,
          south: 37,
          east: 128,
          north: 38,
        },
      },
      1.5,
    );

    expect(cameraForBounds).toHaveBeenCalledWith(
      [
        [126, 37],
        [128, 38],
      ],
      expect.objectContaining({
        padding: 28,
      }),
    );
    expect(easeTo).toHaveBeenCalled();
  });

  it('prefers breakout zoom hints over conservative bounds fitting', () => {
    const cameraForBounds = vi.fn(() => ({
      center: [127, 37.5],
      zoom: 5.5,
      bearing: 0,
    }));
    const easeTo = vi.fn();

    focusFeatureCluster(
      {
        cameraForBounds,
        easeTo,
        getBearing: () => 0,
        getContainer: () => ({
          clientWidth: 390,
          clientHeight: 219,
        }),
      } as unknown as maplibregl.Map,
      {
        lat: 37.5,
        lng: 127,
        minBreakoutZoom: 7.2,
        bounds: {
          west: 126.98,
          south: 37.49,
          east: 127.02,
          north: 37.51,
        },
      },
      4.5,
    );

    expect(easeTo).toHaveBeenCalledWith(
      expect.objectContaining({
        zoom: 7.2,
      }),
    );
  });
});
