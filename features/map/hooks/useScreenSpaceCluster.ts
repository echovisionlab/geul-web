import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import type * as maplibregl from 'maplibre-gl';
import { MAP_CLUSTER_SAMPLE_INTERVAL_MS } from '@/lib/utils/map-cluster';
import type { MapRendererPlace } from '../types';
import { buildScreenSpaceClusterSnapshot, type ScreenSpaceClusterSnapshot } from '../utils';

export interface UseScreenSpaceClusterOptions {
  mapRef: RefObject<maplibregl.Map | null>;
  enabled: boolean;
  isReady: boolean;
  places: Pick<MapRendererPlace, 'id' | 'lat' | 'lng'>[];
  clusterRadiusPx: number;
  clusterMaxZoom: number;
  sampleIntervalMs?: number;
}

const EMPTY_CLUSTER_SNAPSHOT: ScreenSpaceClusterSnapshot = {
  enabled: false,
  clusters: [],
  singletonPlaceIds: [],
  featureSourceData: null,
};

function areSameStringArrays(left: string[], right: string[]): boolean {
  if (left.length !== right.length) {
    return false;
  }

  return left.every((value, index) => value === right[index]);
}

function areSameClusters(
  left: ScreenSpaceClusterSnapshot['clusters'],
  right: ScreenSpaceClusterSnapshot['clusters'],
): boolean {
  if (left.length !== right.length) {
    return false;
  }

  return left.every((cluster, index) => {
    const other = right[index];
    return (
      cluster.id === other?.id &&
      cluster.count === other.count &&
      cluster.center.lat === other.center.lat &&
      cluster.center.lng === other.center.lng &&
      cluster.bounds.west === other.bounds.west &&
      cluster.bounds.south === other.bounds.south &&
      cluster.bounds.east === other.bounds.east &&
      cluster.bounds.north === other.bounds.north &&
      areSameStringArrays(cluster.placeIds, other.placeIds)
    );
  });
}

function areSameSnapshot(left: ScreenSpaceClusterSnapshot, right: ScreenSpaceClusterSnapshot): boolean {
  return (
    left.enabled === right.enabled &&
    areSameStringArrays(left.singletonPlaceIds, right.singletonPlaceIds) &&
    areSameClusters(left.clusters, right.clusters)
  );
}

export function useScreenSpaceCluster({
  mapRef,
  enabled,
  isReady,
  places,
  clusterRadiusPx,
  clusterMaxZoom,
  sampleIntervalMs = MAP_CLUSTER_SAMPLE_INTERVAL_MS,
}: UseScreenSpaceClusterOptions): ScreenSpaceClusterSnapshot {
  const [snapshot, setSnapshot] = useState<ScreenSpaceClusterSnapshot>(EMPTY_CLUSTER_SNAPSHOT);
  const lastSampleAtRef = useRef(0);

  const updateClusterSnapshot = useCallback(() => {
    const map = mapRef.current;
    if (!enabled || !map || places.length < 2) {
      setSnapshot((current) => (areSameSnapshot(current, EMPTY_CLUSTER_SNAPSHOT) ? current : EMPTY_CLUSTER_SNAPSHOT));
      return;
    }

    const nextSnapshot = buildScreenSpaceClusterSnapshot({
      places,
      points: places.map((place) => map.project([place.lng, place.lat])),
      distancePx: clusterRadiusPx,
      currentZoom: map.getZoom(),
      clusterMaxZoom,
    });

    setSnapshot((current) => (areSameSnapshot(current, nextSnapshot) ? current : nextSnapshot));
  }, [clusterMaxZoom, clusterRadiusPx, enabled, mapRef, places]);

  useEffect(() => {
    const map = mapRef.current;
    if (!enabled || !isReady || !map || places.length < 2) {
      setSnapshot((current) => (areSameSnapshot(current, EMPTY_CLUSTER_SNAPSHOT) ? current : EMPTY_CLUSTER_SNAPSHOT));
      return;
    }

    const sampleClusterSnapshot = () => {
      const now =
        typeof performance !== 'undefined' && typeof performance.now === 'function' ? performance.now() : Date.now();
      if (now - lastSampleAtRef.current < sampleIntervalMs) {
        return;
      }

      lastSampleAtRef.current = now;
      updateClusterSnapshot();
    };

    lastSampleAtRef.current = 0;
    updateClusterSnapshot();
    map.on('render', sampleClusterSnapshot);
    map.on('moveend', updateClusterSnapshot);

    return () => {
      map.off('render', sampleClusterSnapshot);
      map.off('moveend', updateClusterSnapshot);
    };
  }, [enabled, isReady, mapRef, places.length, sampleIntervalMs, updateClusterSnapshot]);

  return snapshot;
}
