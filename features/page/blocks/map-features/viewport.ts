import type { Coordinate } from '@/lib/types/common/coordinate';
import type { MapFeatureBounds, MapFeatureViewportRequest } from '@/lib/types/map/features';
import { clampMapZoom, type MapAspectRatio, type MapViewConfig } from '@/lib/types/map/model';
import { getMapClusterRadiusPxForZoom, MAP_CLUSTER_DEFAULT_MIN_POINTS } from '@/lib/utils/map-cluster';

export type MapViewportBounds = MapFeatureBounds;
export type MapViewportRequest = MapFeatureViewportRequest;

const WORLD_VIEW_CENTER: Coordinate = { lat: 0, lng: 0 };
const WORLD_TILE_SIZE = 256;
const DEFAULT_VIEWPORT_WIDTH = 1280;
const WORLD_MERCATOR_LIMIT = 85;
const WORLD_LONGITUDE_EPSILON = 0.00001;
const VIEWPORT_QUERY_PREFIX = 'pm_';

export function getClusterRadiusPxForZoom(zoom: number, widthPx?: number): number {
  return getMapClusterRadiusPxForZoom(zoom, widthPx);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function normalizeLongitude(lng: number): number {
  let value = lng;
  while (value < -180) {
    value += 360;
  }
  while (value > 180) {
    value -= 360;
  }
  return value;
}

function normalizeViewportBoundsForDimensions(
  bounds: MapViewportBounds,
  zoom: number,
  widthPx: number,
  heightPx: number,
): MapViewportBounds {
  const worldScale = 256 * 2 ** zoom;
  const coversFullLongitude = widthPx >= worldScale - 1;
  const coversFullLatitude = heightPx >= worldScale - 1;

  return {
    west: coversFullLongitude ? -180 : normalizeLongitude(bounds.west),
    south: coversFullLatitude
      ? -WORLD_MERCATOR_LIMIT
      : clamp(bounds.south, -WORLD_MERCATOR_LIMIT, WORLD_MERCATOR_LIMIT),
    east: coversFullLongitude ? 180 : normalizeLongitude(bounds.east),
    north: coversFullLatitude ? WORLD_MERCATOR_LIMIT : clamp(bounds.north, -WORLD_MERCATOR_LIMIT, WORLD_MERCATOR_LIMIT),
  };
}

export function isFullWorldLongitudeBounds(bounds: MapViewportBounds): boolean {
  return Math.abs(bounds.west + 180) < WORLD_LONGITUDE_EPSILON && Math.abs(bounds.east - 180) < WORLD_LONGITUDE_EPSILON;
}

export function getViewportHeightForWidth(widthPx: number, aspectRatio: MapAspectRatio): number {
  switch (aspectRatio) {
    case '4:3':
      return Math.round(widthPx * (3 / 4));
    case '1:1':
      return Math.round(widthPx);
    case '16:9':
    default:
      return Math.round(widthPx * (9 / 16));
  }
}

export function getFullWorldZoomForDimensions(widthPx: number, heightPx: number): number {
  const fitSize = Math.max(1, Math.min(widthPx, heightPx));
  return Math.log2(fitSize / WORLD_TILE_SIZE);
}

function lngLatToWorldPixel(lng: number, lat: number, zoom: number): { x: number; y: number } {
  const scale = 256 * 2 ** zoom;
  const safeLat = clamp(lat, -85.05112878, 85.05112878);
  const x = ((lng + 180) / 360) * scale;
  const sinLat = Math.sin((safeLat * Math.PI) / 180);
  const y = (0.5 - Math.log((1 + sinLat) / (1 - sinLat)) / (4 * Math.PI)) * scale;
  return { x, y };
}

function worldPixelToLngLat(x: number, y: number, zoom: number): Coordinate {
  const scale = 256 * 2 ** zoom;
  const lng = (x / scale) * 360 - 180;
  const n = Math.PI - (2 * Math.PI * y) / scale;
  const lat = (180 / Math.PI) * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n)));
  return { lat, lng: normalizeLongitude(lng) };
}

function latToMercatorY(lat: number): number {
  const safeLat = clamp(lat, -85.05112878, 85.05112878);
  const sinLat = Math.sin((safeLat * Math.PI) / 180);
  return 0.5 - Math.log((1 + sinLat) / (1 - sinLat)) / (4 * Math.PI);
}

function mercatorYToLat(y: number): number {
  const n = Math.PI - 2 * Math.PI * y;
  return (180 / Math.PI) * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n)));
}

export function buildBoundsFromViewport(
  center: Coordinate,
  zoom: number,
  widthPx: number,
  heightPx: number,
): MapViewportBounds {
  const { x, y } = lngLatToWorldPixel(center.lng, center.lat, zoom);
  const halfWidth = widthPx / 2;
  const halfHeight = heightPx / 2;
  const northWest = worldPixelToLngLat(x - halfWidth, y - halfHeight, zoom);
  const southEast = worldPixelToLngLat(x + halfWidth, y + halfHeight, zoom);

  return {
    west: northWest.lng,
    south: southEast.lat,
    east: southEast.lng,
    north: northWest.lat,
  };
}

export function getCenterFromBounds(bounds: MapViewportBounds): Coordinate {
  const spanLng = bounds.west <= bounds.east ? bounds.east - bounds.west : bounds.east + 360 - bounds.west;
  const centerLng = normalizeLongitude(bounds.west + spanLng / 2);
  const northY = latToMercatorY(bounds.north);
  const southY = latToMercatorY(bounds.south);
  const centerLat = mercatorYToLat((northY + southY) / 2);

  return { lat: centerLat, lng: centerLng };
}

export function getDefaultMapViewport(aspectRatio: MapAspectRatio): MapViewportRequest {
  const widthPx = DEFAULT_VIEWPORT_WIDTH;
  const heightPx = getViewportHeightForWidth(widthPx, aspectRatio);
  const zoom = getFullWorldZoomForDimensions(widthPx, heightPx);
  const bounds = normalizeViewportBoundsForDimensions(
    buildBoundsFromViewport(WORLD_VIEW_CENTER, zoom, widthPx, heightPx),
    zoom,
    widthPx,
    heightPx,
  );

  return {
    bounds,
    zoom,
    widthPx,
    heightPx,
    clusterRadiusPx: getClusterRadiusPxForZoom(zoom, widthPx),
    minClusterPoints: MAP_CLUSTER_DEFAULT_MIN_POINTS,
  };
}

export function getResponsiveMapViewport(
  viewport: Pick<MapViewportRequest, 'bounds' | 'zoom' | 'minClusterPoints'>,
  widthPx: number,
  heightPx: number,
): MapViewportRequest {
  const safeWidth = Math.max(1, Math.round(widthPx));
  const safeHeight = Math.max(1, Math.round(heightPx));
  const isWorldView = isFullWorldLongitudeBounds(viewport.bounds);
  const nextZoom = isWorldView ? getFullWorldZoomForDimensions(safeWidth, safeHeight) : viewport.zoom;
  const center = isWorldView ? WORLD_VIEW_CENTER : getCenterFromBounds(viewport.bounds);
  const bounds = normalizeViewportBoundsForDimensions(
    buildBoundsFromViewport(center, nextZoom, safeWidth, safeHeight),
    nextZoom,
    safeWidth,
    safeHeight,
  );

  return {
    bounds,
    zoom: nextZoom,
    widthPx: safeWidth,
    heightPx: safeHeight,
    clusterRadiusPx: getClusterRadiusPxForZoom(nextZoom, safeWidth),
    minClusterPoints: viewport.minClusterPoints,
  };
}

export function clampMapViewportToZoomBounds(
  viewport: MapViewportRequest,
  zoomBounds: Pick<MapViewConfig, 'minZoom' | 'maxZoom'>,
): MapViewportRequest {
  const zoom = clampMapZoom(viewport.zoom, zoomBounds);
  if (Math.abs(zoom - viewport.zoom) < 0.00001) {
    return viewport;
  }

  return {
    ...viewport,
    zoom,
    clusterRadiusPx: getClusterRadiusPxForZoom(zoom, viewport.widthPx),
  };
}

function parseBounds(raw: string | null | undefined): MapViewportBounds | null {
  if (!raw) {
    return null;
  }

  const values = raw.split(',').map((value) => Number.parseFloat(value));
  if (values.length !== 4 || values.some((value) => !Number.isFinite(value))) {
    return null;
  }

  return {
    west: normalizeLongitude(values[0]),
    south: clamp(values[1], -85, 85),
    east: normalizeLongitude(values[2]),
    north: clamp(values[3], -85, 85),
  };
}

function readQueryValue(query: Record<string, string | string[] | undefined> | undefined, key: string): string | null {
  const value = query?.[key];
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }
  return value ?? null;
}

function getViewportQueryKey(sectionId: string, suffix: string): string {
  return `${VIEWPORT_QUERY_PREFIX}${sectionId}_${suffix}`;
}

export function stripViewportSearchParams(params: URLSearchParams): URLSearchParams {
  const next = new URLSearchParams(params.toString());

  for (const key of Array.from(next.keys())) {
    if (key.startsWith(VIEWPORT_QUERY_PREFIX)) {
      next.delete(key);
    }
  }

  return next;
}

export function parseViewportFromQuery(
  sectionId: string | undefined,
  query: Record<string, string | string[] | undefined> | undefined,
  aspectRatio: MapAspectRatio,
): MapViewportRequest {
  const fallback = getDefaultMapViewport(aspectRatio);
  if (!sectionId) {
    return fallback;
  }

  const bounds = parseBounds(readQueryValue(query, getViewportQueryKey(sectionId, 'b'))) ?? fallback.bounds;
  const zoom = Number.parseFloat(readQueryValue(query, getViewportQueryKey(sectionId, 'z')) ?? '');
  const widthPx = Number.parseInt(readQueryValue(query, getViewportQueryKey(sectionId, 'w')) ?? '', 10);
  const heightPx = Number.parseInt(readQueryValue(query, getViewportQueryKey(sectionId, 'h')) ?? '', 10);
  const clusterRadiusPx = Number.parseInt(readQueryValue(query, getViewportQueryKey(sectionId, 'r')) ?? '', 10);
  const minClusterPoints = Number.parseInt(readQueryValue(query, getViewportQueryKey(sectionId, 'm')) ?? '', 10);

  return {
    bounds: normalizeViewportBoundsForDimensions(
      bounds,
      Number.isFinite(zoom) ? zoom : fallback.zoom,
      Number.isFinite(widthPx) && widthPx > 0 ? widthPx : fallback.widthPx,
      Number.isFinite(heightPx) && heightPx > 0 ? heightPx : fallback.heightPx,
    ),
    zoom: Number.isFinite(zoom) ? zoom : fallback.zoom,
    widthPx: Number.isFinite(widthPx) && widthPx > 0 ? widthPx : fallback.widthPx,
    heightPx: Number.isFinite(heightPx) && heightPx > 0 ? heightPx : fallback.heightPx,
    clusterRadiusPx:
      Number.isFinite(clusterRadiusPx) && clusterRadiusPx > 0 ? clusterRadiusPx : fallback.clusterRadiusPx,
    minClusterPoints:
      Number.isFinite(minClusterPoints) && minClusterPoints > 0 ? minClusterPoints : fallback.minClusterPoints,
  };
}

export function writeViewportToSearchParams(
  params: URLSearchParams,
  sectionId: string,
  viewport: MapViewportRequest,
): URLSearchParams {
  const normalizedBounds = normalizeViewportBoundsForDimensions(
    viewport.bounds,
    viewport.zoom,
    viewport.widthPx,
    viewport.heightPx,
  );
  const next = new URLSearchParams(params.toString());
  next.set(
    getViewportQueryKey(sectionId, 'b'),
    [
      normalizedBounds.west.toFixed(5),
      normalizedBounds.south.toFixed(5),
      normalizedBounds.east.toFixed(5),
      normalizedBounds.north.toFixed(5),
    ].join(','),
  );
  next.set(getViewportQueryKey(sectionId, 'z'), viewport.zoom.toFixed(2));
  next.set(getViewportQueryKey(sectionId, 'w'), String(Math.round(viewport.widthPx)));
  next.set(getViewportQueryKey(sectionId, 'h'), String(Math.round(viewport.heightPx)));
  next.set(getViewportQueryKey(sectionId, 'r'), String(Math.round(viewport.clusterRadiusPx)));
  next.set(getViewportQueryKey(sectionId, 'm'), String(Math.round(viewport.minClusterPoints)));
  return next;
}
