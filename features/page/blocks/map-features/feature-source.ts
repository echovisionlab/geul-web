import type { MapServerFeatureSource } from '@/features/map/types';

interface MapFeatureCluster {
  id: string;
  lat: number;
  lng: number;
  placeCount: number;
}

export function buildClusterFeatureSource(clusters: MapFeatureCluster[]): MapServerFeatureSource {
  return {
    type: 'FeatureCollection',
    features: clusters.map((cluster) => ({
      type: 'Feature' as const,
      geometry: {
        type: 'Point' as const,
        coordinates: [cluster.lng, cluster.lat] as [number, number],
      },
      properties: {
        kind: 'cluster' as const,
        id: cluster.id,
        count: cluster.placeCount,
      },
    })),
  };
}
