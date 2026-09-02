import type { MapTheme } from '@/lib/types/map-theme/model';
import { clampMapZoom, normalizeMapZoomBounds, type MapViewConfig, type MapViewTheme } from '@/lib/types/map/model';
import { mapThemeToViewTheme } from '@/lib/utils/map-theme';
import {
  clampMapViewportToZoomBounds,
  getCenterFromBounds,
  getFullWorldZoomForDimensions,
  getViewportHeightForWidth,
  type MapViewportRequest,
} from './viewport';

export { clampMapViewportToZoomBounds };

export interface FeatureMapConfigProps {
  aspectRatio: MapViewConfig['aspectRatio'];
  previewWidth: string;
  minZoom?: string;
  maxZoom?: string;
  preferredScheme: MapViewConfig['preferredScheme'];
  areaLabelsMode: MapViewConfig['areaLabelsMode'];
  poiLabelsMode: MapViewConfig['poiLabelsMode'];
}

const WORLD_VIEW_CENTER = {
  lat: 0,
  lng: 0,
} as const;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function parsePreviewWidth(value: string): number | undefined {
  if (!value) {
    return undefined;
  }

  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) {
    return undefined;
  }

  return clamp(parsed, 10, 100);
}

function buildMapViewTheme(theme: MapTheme | null | undefined): MapViewTheme | null {
  return theme ? mapThemeToViewTheme(theme) : null;
}

function parseZoomBound(value: string | undefined): number | undefined {
  if (!value) {
    return undefined;
  }

  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export function buildFeatureMapConfig(
  props: FeatureMapConfigProps,
  theme: MapTheme | null | undefined,
  viewport?: Pick<MapViewportRequest, 'bounds' | 'zoom'>,
): MapViewConfig {
  const defaultWidth = 1280;
  const defaultHeight = getViewportHeightForWidth(defaultWidth, props.aspectRatio);
  const zoomBounds = normalizeMapZoomBounds({
    minZoom: parseZoomBound(props.minZoom),
    maxZoom: parseZoomBound(props.maxZoom),
  });
  const zoom = clampMapZoom(viewport?.zoom ?? getFullWorldZoomForDimensions(defaultWidth, defaultHeight), zoomBounds);

  return {
    center: viewport ? getCenterFromBounds(viewport.bounds) : WORLD_VIEW_CENTER,
    zoom,
    minZoom: zoomBounds.minZoom,
    maxZoom: zoomBounds.maxZoom,
    cluster: false,
    pitch: 0,
    bearing: 0,
    aspectRatio: props.aspectRatio,
    previewWidth: parsePreviewWidth(props.previewWidth),
    draggable: true,
    zoomable: true,
    rotatable: false,
    tiltable: false,
    pinClickable: true,
    autoRotate: false,
    autoRotateSpeed: 1,
    showDirections: false,
    show3DBuildings: false,
    preferredScheme: props.preferredScheme,
    areaLabelsMode: props.areaLabelsMode,
    poiLabelsMode: props.poiLabelsMode,
    places: [],
    theme: buildMapViewTheme(theme),
  };
}
