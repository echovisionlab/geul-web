import { describe, expect, it } from 'vitest';
import {
  buildScreenSpaceClusterSnapshot,
  hasScreenSpaceClusterCandidate,
  shouldEnableScreenSpaceCluster,
} from './screen-space-cluster';

describe('hasScreenSpaceClusterCandidate', () => {
  it('returns false when fewer than two points are present', () => {
    expect(hasScreenSpaceClusterCandidate([], 56)).toBe(false);
    expect(hasScreenSpaceClusterCandidate([{ x: 0, y: 0 }], 56)).toBe(false);
  });

  it('returns true when any pair is closer than the threshold', () => {
    expect(
      hasScreenSpaceClusterCandidate(
        [
          { x: 100, y: 100 },
          { x: 132, y: 118 },
          { x: 280, y: 240 },
        ],
        56,
      ),
    ).toBe(true);
  });

  it('returns false when every pair is visually separable', () => {
    expect(
      hasScreenSpaceClusterCandidate(
        [
          { x: 100, y: 100 },
          { x: 220, y: 210 },
          { x: 360, y: 320 },
        ],
        56,
      ),
    ).toBe(false);
  });
});

describe('buildScreenSpaceClusterSnapshot', () => {
  it('builds transitive cluster groups and singleton ids from one snapshot', () => {
    const snapshot = buildScreenSpaceClusterSnapshot({
      places: [
        { id: 'a', lat: 0, lng: 0 },
        { id: 'b', lat: 0.1, lng: 0.1 },
        { id: 'c', lat: 0.2, lng: 0.2 },
        { id: 'd', lat: 5, lng: 5 },
      ],
      points: [
        { x: 100, y: 100 },
        { x: 132, y: 118 },
        { x: 162, y: 136 },
        { x: 360, y: 320 },
      ],
      distancePx: 56,
      currentZoom: 8,
      clusterMaxZoom: 22,
    });

    expect(snapshot.enabled).toBe(true);
    expect(snapshot.clusters).toHaveLength(1);
    expect(snapshot.clusters[0]?.placeIds).toEqual(['a', 'b', 'c']);
    expect(snapshot.clusters[0]?.count).toBe(3);
    expect(snapshot.singletonPlaceIds).toEqual(['d']);
    expect(snapshot.featureSourceData?.features[0]?.properties).toMatchObject({
      kind: 'cluster',
      count: 3,
    });
  });
});

describe('shouldEnableScreenSpaceCluster', () => {
  it('disables clustering when the current zoom is past the cluster max zoom', () => {
    expect(
      shouldEnableScreenSpaceCluster({
        places: [
          { id: 'a', lat: 0, lng: 0 },
          { id: 'b', lat: 0.1, lng: 0.1 },
        ],
        points: [
          { x: 100, y: 100 },
          { x: 128, y: 112 },
        ],
        distancePx: 56,
        currentZoom: 15,
        clusterMaxZoom: 12,
      }),
    ).toBe(false);
  });

  it('keeps clustering enabled while points are still visually overlapping within the zoom limit', () => {
    expect(
      shouldEnableScreenSpaceCluster({
        places: [
          { id: 'a', lat: 0, lng: 0 },
          { id: 'b', lat: 0.1, lng: 0.1 },
        ],
        points: [
          { x: 100, y: 100 },
          { x: 128, y: 112 },
        ],
        distancePx: 56,
        currentZoom: 15,
        clusterMaxZoom: 22,
      }),
    ).toBe(true);
  });
});
