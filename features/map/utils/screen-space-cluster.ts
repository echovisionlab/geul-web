import type { Coordinate } from '@/lib/types/common/coordinate';
import type { MapRendererPlace, MapServerFeatureSource } from '../types';

export interface ScreenPoint {
  x: number;
  y: number;
}

interface ScreenSpaceClusterOptions {
  places: Pick<MapRendererPlace, 'id' | 'lat' | 'lng'>[];
  points: ScreenPoint[];
  distancePx: number;
  currentZoom: number;
  clusterMaxZoom: number;
}

export interface ScreenSpaceClusterGroup {
  id: string;
  count: number;
  center: Coordinate;
  bounds: {
    west: number;
    south: number;
    east: number;
    north: number;
  };
  placeIds: string[];
}

export interface ScreenSpaceClusterSnapshot {
  enabled: boolean;
  clusters: ScreenSpaceClusterGroup[];
  singletonPlaceIds: string[];
  featureSourceData: MapServerFeatureSource | null;
}

const EMPTY_CLUSTER_SNAPSHOT: ScreenSpaceClusterSnapshot = {
  enabled: false,
  clusters: [],
  singletonPlaceIds: [],
  featureSourceData: null,
};

function createEmptySnapshot(places: Pick<MapRendererPlace, 'id' | 'lat' | 'lng'>[]): ScreenSpaceClusterSnapshot {
  if (places.length === 0) {
    return EMPTY_CLUSTER_SNAPSHOT;
  }

  return {
    enabled: false,
    clusters: [],
    singletonPlaceIds: places.map((place) => place.id),
    featureSourceData: null,
  };
}

function buildGroupIndexes(points: ScreenPoint[], distancePx: number): number[][] {
  const parent = points.map((_, index) => index);
  const thresholdSq = distancePx * distancePx;

  const find = (index: number): number => {
    let current = index;

    while (parent[current] !== current) {
      parent[current] = parent[parent[current]];
      current = parent[current];
    }

    return current;
  };

  const union = (left: number, right: number) => {
    const leftRoot = find(left);
    const rightRoot = find(right);

    if (leftRoot === rightRoot) {
      return;
    }

    parent[rightRoot] = leftRoot;
  };

  for (let i = 0; i < points.length; i += 1) {
    for (let j = i + 1; j < points.length; j += 1) {
      const dx = points[i].x - points[j].x;
      const dy = points[i].y - points[j].y;
      if (dx * dx + dy * dy < thresholdSq) {
        union(i, j);
      }
    }
  }

  const groups = new Map<number, number[]>();

  for (let index = 0; index < points.length; index += 1) {
    const root = find(index);
    const bucket = groups.get(root);
    if (bucket) {
      bucket.push(index);
      continue;
    }
    groups.set(root, [index]);
  }

  return Array.from(groups.values());
}

function buildClusterGroup(places: Pick<MapRendererPlace, 'id' | 'lat' | 'lng'>[]): ScreenSpaceClusterGroup {
  const placeIds = places.map((place) => place.id).sort();
  const count = places.length;
  const center = places.reduce<Coordinate>(
    (acc, place) => ({
      lat: acc.lat + place.lat / count,
      lng: acc.lng + place.lng / count,
    }),
    { lat: 0, lng: 0 },
  );

  return {
    id: `cluster:${placeIds.join('|')}`,
    count,
    center,
    bounds: places.reduce(
      (acc, place) => ({
        west: Math.min(acc.west, place.lng),
        south: Math.min(acc.south, place.lat),
        east: Math.max(acc.east, place.lng),
        north: Math.max(acc.north, place.lat),
      }),
      {
        west: Number.POSITIVE_INFINITY,
        south: Number.POSITIVE_INFINITY,
        east: Number.NEGATIVE_INFINITY,
        north: Number.NEGATIVE_INFINITY,
      },
    ),
    placeIds,
  };
}

function buildFeatureSourceData(clusters: ScreenSpaceClusterGroup[]): MapServerFeatureSource | null {
  if (clusters.length === 0) {
    return null;
  }

  return {
    type: 'FeatureCollection',
    features: clusters.map((cluster) => ({
      type: 'Feature',
      geometry: {
        type: 'Point',
        coordinates: [cluster.center.lng, cluster.center.lat],
      },
      properties: {
        kind: 'cluster',
        id: cluster.id,
        count: cluster.count,
      },
    })),
  };
}

export function hasScreenSpaceClusterCandidate(points: ScreenPoint[], distancePx: number): boolean {
  if (points.length < 2 || !Number.isFinite(distancePx) || distancePx <= 0) {
    return false;
  }

  return buildGroupIndexes(points, distancePx).some((group) => group.length > 1);
}

export function buildScreenSpaceClusterSnapshot({
  places,
  points,
  distancePx,
  currentZoom,
  clusterMaxZoom,
}: ScreenSpaceClusterOptions): ScreenSpaceClusterSnapshot {
  if (
    places.length < 2 ||
    points.length !== places.length ||
    !Number.isFinite(distancePx) ||
    distancePx <= 0 ||
    !Number.isFinite(currentZoom) ||
    !Number.isFinite(clusterMaxZoom) ||
    currentZoom > clusterMaxZoom
  ) {
    return createEmptySnapshot(places);
  }

  const groupIndexes = buildGroupIndexes(points, distancePx);
  const clusters = groupIndexes
    .filter((group) => group.length > 1)
    .map((group) => buildClusterGroup(group.map((index) => places[index]!)))
    .sort((left, right) => left.id.localeCompare(right.id));

  if (clusters.length === 0) {
    return createEmptySnapshot(places);
  }

  const singletonPlaceIds = groupIndexes
    .filter((group) => group.length === 1)
    .map((group) => places[group[0]]!.id)
    .sort();

  return {
    enabled: true,
    clusters,
    singletonPlaceIds,
    featureSourceData: buildFeatureSourceData(clusters),
  };
}

export function shouldEnableScreenSpaceCluster(options: ScreenSpaceClusterOptions): boolean {
  return buildScreenSpaceClusterSnapshot(options).enabled;
}
