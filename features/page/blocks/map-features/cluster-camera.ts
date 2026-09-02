import type * as maplibregl from 'maplibre-gl';
import type { MapFeatureBounds } from '@/lib/types/map/features';

interface ClusterCameraTarget {
  bounds: MapFeatureBounds;
  lat: number;
  lng: number;
  minBreakoutZoom?: number | null;
}

const SAME_POINT_EPSILON = 0.00001;
const DRILL_DURATION_MS = 420;
const MIN_SAME_POINT_ZOOM = 9;
const MIN_DRILL_STEP = 1.25;
const FALLBACK_DRILL_STEP = 2;
const MAX_DRILL_ZOOM = 14;
const MIN_DRILL_PADDING_PX = 28;
const MAX_DRILL_PADDING_PX = 96;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function getDrillPaddingPx(map: maplibregl.Map): number {
  const container = map.getContainer();
  const width = container.clientWidth;
  const height = container.clientHeight;
  const shortestSide = Math.max(1, Math.min(width, height));
  return Math.round(clamp(shortestSide * 0.12, MIN_DRILL_PADDING_PX, MAX_DRILL_PADDING_PX));
}

function isSamePointBounds(bounds: MapFeatureBounds): boolean {
  return (
    Math.abs(bounds.west - bounds.east) < SAME_POINT_EPSILON &&
    Math.abs(bounds.south - bounds.north) < SAME_POINT_EPSILON
  );
}

export function focusFeatureCluster(map: maplibregl.Map, cluster: ClusterCameraTarget, currentZoom: number) {
  const drillPaddingPx = getDrillPaddingPx(map);
  const hintedZoom =
    typeof cluster.minBreakoutZoom === 'number'
      ? Math.min(Math.max(cluster.minBreakoutZoom, currentZoom + MIN_DRILL_STEP), MAX_DRILL_ZOOM)
      : null;

  if (isSamePointBounds(cluster.bounds)) {
    map.easeTo({
      center: [cluster.lng, cluster.lat],
      zoom: Math.min(Math.max(currentZoom + 4, MIN_SAME_POINT_ZOOM, hintedZoom ?? 0), MAX_DRILL_ZOOM),
      duration: DRILL_DURATION_MS - 40,
    });
    return;
  }

  const targetCamera = map.cameraForBounds(
    [
      [cluster.bounds.west, cluster.bounds.south],
      [cluster.bounds.east, cluster.bounds.north],
    ],
    {
      padding: drillPaddingPx,
      maxZoom: Math.min(Math.max(currentZoom + 5, 10), MAX_DRILL_ZOOM),
    },
  );

  if (
    targetCamera &&
    typeof targetCamera.zoom === 'number' &&
    Math.max(targetCamera.zoom, hintedZoom ?? 0) > currentZoom + MIN_DRILL_STEP
  ) {
    map.easeTo({
      center: targetCamera.center,
      zoom: Math.min(Math.max(targetCamera.zoom, hintedZoom ?? 0), MAX_DRILL_ZOOM),
      bearing: targetCamera.bearing ?? map.getBearing(),
      duration: DRILL_DURATION_MS,
    });
    return;
  }

  map.easeTo({
    center: [cluster.lng, cluster.lat],
    zoom: Math.min(Math.max(currentZoom + FALLBACK_DRILL_STEP, hintedZoom ?? 0), MAX_DRILL_ZOOM),
    duration: DRILL_DURATION_MS - 40,
  });
}
