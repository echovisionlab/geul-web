'use client';

import { useCallback, useEffect, useRef, type RefObject } from 'react';
import type * as maplibregl from 'maplibre-gl';
import { focusFeatureCluster } from './cluster-camera';
import type { MapFeatureBounds } from '@/lib/types/map/features';

const MAX_AUTO_DRILL_ATTEMPTS = 6;
const MAX_DRILL_ZOOM = 13.99;
const MIN_CLUSTER_MATCH_DEGREES = 0.0015;

export interface ClusterDrillTarget {
  id: string;
  lat: number;
  lng: number;
  placeCount: number;
  bounds: MapFeatureBounds;
  minBreakoutZoom?: number | null;
}

interface PendingClusterDrill<TCluster extends ClusterDrillTarget> {
  attempts: number;
  cluster: TCluster;
}

export function findContinuingCluster<TCluster extends ClusterDrillTarget>(
  clusters: TCluster[],
  pending: PendingClusterDrill<TCluster>,
): TCluster | null {
  const candidates = clusters.filter(
    (cluster) =>
      cluster.placeCount === pending.cluster.placeCount &&
      clusterContainsAnchor(cluster, pending.cluster.lat, pending.cluster.lng),
  );

  if (candidates.length === 0) {
    return null;
  }

  return candidates.reduce((best, candidate) => {
    if (!best) {
      return candidate;
    }

    return getClusterCenterDistance(candidate, pending.cluster) < getClusterCenterDistance(best, pending.cluster)
      ? candidate
      : best;
  }, candidates[0] ?? null);
}

export function useServerClusterDrill<TCluster extends ClusterDrillTarget>({
  mapRef,
  clusters,
  isFetching,
  viewportZoom,
}: {
  mapRef: RefObject<maplibregl.Map | null>;
  clusters: TCluster[];
  isFetching: boolean;
  viewportZoom: number;
}) {
  const pendingClusterDrillRef = useRef<PendingClusterDrill<TCluster> | null>(null);

  const handleClusterClick = useCallback(
    (cluster: TCluster | undefined) => {
      if (!cluster || !mapRef.current) {
        return;
      }

      pendingClusterDrillRef.current = {
        attempts: 0,
        cluster,
      };
      focusFeatureCluster(mapRef.current, cluster, viewportZoom);
    },
    [mapRef, viewportZoom],
  );

  useEffect(() => {
    if (!mapRef.current || isFetching) {
      return;
    }

    const pending = pendingClusterDrillRef.current;
    if (!pending) {
      return;
    }

    if (pending.attempts >= MAX_AUTO_DRILL_ATTEMPTS || viewportZoom >= MAX_DRILL_ZOOM) {
      pendingClusterDrillRef.current = null;
      return;
    }

    const continuingCluster = findContinuingCluster(clusters, pending);
    if (!continuingCluster) {
      pendingClusterDrillRef.current = null;
      return;
    }

    pendingClusterDrillRef.current = {
      attempts: pending.attempts + 1,
      cluster: continuingCluster,
    };
    focusFeatureCluster(mapRef.current, continuingCluster, viewportZoom);
  }, [clusters, isFetching, mapRef, viewportZoom]);

  return {
    handleClusterClick,
  };
}

function clusterContainsAnchor(cluster: Pick<ClusterDrillTarget, 'bounds'>, lat: number, lng: number): boolean {
  const latSpan = Math.abs(cluster.bounds.north - cluster.bounds.south);
  const lngSpan = Math.abs(cluster.bounds.east - cluster.bounds.west);
  const latMargin = Math.max(latSpan * 0.35, MIN_CLUSTER_MATCH_DEGREES);
  const lngMargin = Math.max(lngSpan * 0.35, MIN_CLUSTER_MATCH_DEGREES);

  return (
    lat >= cluster.bounds.south - latMargin &&
    lat <= cluster.bounds.north + latMargin &&
    lng >= cluster.bounds.west - lngMargin &&
    lng <= cluster.bounds.east + lngMargin
  );
}

function getClusterCenterDistance(
  cluster: Pick<ClusterDrillTarget, 'lat' | 'lng'>,
  reference: Pick<ClusterDrillTarget, 'lat' | 'lng'>,
): number {
  return Math.hypot(cluster.lat - reference.lat, cluster.lng - reference.lng);
}
