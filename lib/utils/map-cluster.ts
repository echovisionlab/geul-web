import { MAP_MAX_ZOOM_LIMIT } from '@/lib/types/map/model';

export const MAP_CLUSTER_DEFAULT_RADIUS_PX = 56;
export const MAP_CLUSTER_MAX_ZOOM = MAP_MAX_ZOOM_LIMIT;
export const MAP_CLUSTER_SAMPLE_INTERVAL_MS = 120;
export const MAP_CLUSTER_DEFAULT_MIN_POINTS = 2;

const DEFAULT_VIEWPORT_WIDTH = 1280;
const MOBILE_CLUSTER_WIDTH_PX = 480;
const TABLET_CLUSTER_WIDTH_PX = 768;

function getBaseClusterRadiusPxForZoom(zoom: number): number {
  if (zoom >= 9) {
    return 14;
  }
  if (zoom >= 7) {
    return 18;
  }
  if (zoom >= 5) {
    return 24;
  }
  if (zoom >= 3.5) {
    return 32;
  }
  if (zoom >= 2.5) {
    return 40;
  }

  return MAP_CLUSTER_DEFAULT_RADIUS_PX;
}

export function getMapClusterRadiusPxForZoom(zoom: number, widthPx: number = DEFAULT_VIEWPORT_WIDTH): number {
  const baseRadius = getBaseClusterRadiusPxForZoom(zoom);
  const effectiveWidthPx = widthPx > 0 ? widthPx : DEFAULT_VIEWPORT_WIDTH;

  if (effectiveWidthPx <= MOBILE_CLUSTER_WIDTH_PX) {
    return Math.max(18, Math.round(baseRadius * 0.64));
  }

  if (effectiveWidthPx <= TABLET_CLUSTER_WIDTH_PX) {
    return Math.max(20, Math.round(baseRadius * 0.82));
  }

  return baseRadius;
}
