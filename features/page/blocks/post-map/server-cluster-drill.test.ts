import { describe, expect, it } from 'vitest';
import { findContinuingCluster, type ClusterDrillTarget } from '../map-features/server-cluster-drill';

function createCluster(overrides: Partial<ClusterDrillTarget> = {}): ClusterDrillTarget {
  return {
    id: 'cluster-1',
    lat: 37.5665,
    lng: 126.978,
    placeCount: 8,
    minBreakoutZoom: 6.5,
    bounds: {
      west: 126.976,
      south: 37.565,
      east: 126.98,
      north: 37.568,
    },
    ...overrides,
  };
}

describe('findContinuingCluster', () => {
  it('keeps drilling the clicked cluster even when other viewport features exist', () => {
    const clickedCluster = createCluster();
    const continuingCluster = createCluster({
      id: 'cluster-7',
      lat: 37.5669,
      lng: 126.9784,
      bounds: {
        west: 126.977,
        south: 37.5655,
        east: 126.9798,
        north: 37.5682,
      },
    });

    const match = findContinuingCluster(
      [
        createCluster({
          id: 'cluster-unrelated',
          lat: 37.58,
          lng: 126.99,
          placeCount: 2,
          bounds: {
            west: 126.989,
            south: 37.579,
            east: 126.991,
            north: 37.581,
          },
        }),
        continuingCluster,
      ],
      {
        attempts: 1,
        cluster: clickedCluster,
      },
    );

    expect(match).toEqual(continuingCluster);
  });

  it('stops drilling once the clicked cluster splits into smaller groups', () => {
    const clickedCluster = createCluster();

    const match = findContinuingCluster(
      [
        createCluster({
          id: 'cluster-4a',
          placeCount: 4,
        }),
        createCluster({
          id: 'cluster-4b',
          placeCount: 4,
          lat: 37.5675,
          lng: 126.979,
        }),
      ],
      {
        attempts: 1,
        cluster: clickedCluster,
      },
    );

    expect(match).toBeNull();
  });
});
