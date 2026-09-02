import {
  clampMapZoom,
  DEFAULT_CENTER,
  DEFAULT_MAP_CONFIG,
  normalizeMapZoomBounds,
  type MapAspectRatio,
  type MapConfig,
  type MapLabelVisibilityMode,
  type MapPreferredScheme,
} from '@/lib/types/map/model';
import type { MapBlockProps } from './schema';

/**
 * Props input type for toMapConfig - accepts both strict MapBlockProps and loose string props
 */
type MapBlockPropsInput = Partial<MapBlockProps> | Record<string, unknown>;

/**
 * Convert MapBlockProps (or partial) to MapConfig for rendering
 * Used by both Page Editor and Post Editor
 */
export function toMapConfig(props: MapBlockPropsInput): MapConfig {
  const centerLatStr = String(props.centerLat ?? '');
  const centerLngStr = String(props.centerLng ?? '');
  const centerLat = parseFloat(centerLatStr);
  const centerLng = parseFloat(centerLngStr);
  const hasValidCenter = !isNaN(centerLat) && !isNaN(centerLng);

  // Parse preferredScheme
  const scheme = String(props.preferredScheme ?? 'auto');
  const preferredScheme = (['auto', 'light', 'dark'].includes(scheme) ? scheme : 'auto') as MapPreferredScheme;
  const areaLabelsMode = (
    ['inherit', 'show', 'hide'].includes(String(props.areaLabelsMode ?? 'inherit'))
      ? String(props.areaLabelsMode ?? 'inherit')
      : 'inherit'
  ) as MapLabelVisibilityMode;
  const poiLabelsMode = (
    ['inherit', 'show', 'hide'].includes(String(props.poiLabelsMode ?? 'inherit'))
      ? String(props.poiLabelsMode ?? 'inherit')
      : 'inherit'
  ) as MapLabelVisibilityMode;

  // Parse previewWidth (empty string = undefined = full width)
  const previewWidthStr = String(props.previewWidth ?? '');
  const previewWidth = previewWidthStr ? parseInt(previewWidthStr, 10) : undefined;
  const zoomBounds = normalizeMapZoomBounds({
    minZoom: parseFloat(String(props.minZoom ?? String(DEFAULT_MAP_CONFIG.minZoom))),
    maxZoom: parseFloat(String(props.maxZoom ?? String(DEFAULT_MAP_CONFIG.maxZoom))),
  });
  const parsedZoom = parseFloat(String(props.zoom ?? String(DEFAULT_MAP_CONFIG.zoom)));

  return {
    center: hasValidCenter ? { lat: centerLat, lng: centerLng } : DEFAULT_CENTER,
    zoom: clampMapZoom(parsedZoom, zoomBounds),
    minZoom: zoomBounds.minZoom,
    maxZoom: zoomBounds.maxZoom,
    aspectRatio: String(props.aspectRatio ?? '16:9') as MapAspectRatio,
    previewWidth: previewWidth && !isNaN(previewWidth) ? previewWidth : undefined,
    draggable: String(props.draggable) !== 'false',
    zoomable: String(props.zoomable) !== 'false',
    rotatable: String(props.rotatable) === 'true',
    tiltable: String(props.tiltable) === 'true',
    pinClickable: String(props.pinClickable) !== 'false',
    pitch: parseInt(String(props.pitch ?? '0'), 10) || 0,
    bearing: parseInt(String(props.bearing ?? '0'), 10) || 0,
    show3DBuildings: String(props.show3DBuildings) === 'true',
    autoRotate: String(props.autoRotate) === 'true',
    autoRotateSpeed: parseFloat(String(props.autoRotateSpeed ?? '1')) || 1,
    showDirections: String(props.showDirections) !== 'false',
    themeId: props.themeId ? String(props.themeId) : undefined,
    preferredScheme,
    areaLabelsMode,
    poiLabelsMode,
  };
}

/**
 * Convert MapConfig updates to MapBlockProps partial for saving
 * Used by both Page Editor and Post Editor
 */
export function fromMapConfigUpdate(config: Partial<MapConfig>): Partial<MapBlockProps> {
  const result: Partial<MapBlockProps> = {};

  if (config.center) {
    result.centerLat = String(config.center.lat);
    result.centerLng = String(config.center.lng);
  }
  if (config.zoom !== undefined) {
    result.zoom = String(config.zoom);
  }
  if (config.minZoom !== undefined) {
    result.minZoom = String(config.minZoom);
  }
  if (config.maxZoom !== undefined) {
    result.maxZoom = String(config.maxZoom);
  }
  if (config.aspectRatio !== undefined) {
    result.aspectRatio = config.aspectRatio;
  }
  if (config.previewWidth !== undefined) {
    result.previewWidth = config.previewWidth ? String(config.previewWidth) : '';
  }
  if (config.draggable !== undefined) {
    result.draggable = config.draggable ? 'true' : 'false';
  }
  if (config.zoomable !== undefined) {
    result.zoomable = config.zoomable ? 'true' : 'false';
  }
  if (config.rotatable !== undefined) {
    result.rotatable = config.rotatable ? 'true' : 'false';
  }
  if (config.tiltable !== undefined) {
    result.tiltable = config.tiltable ? 'true' : 'false';
  }
  if (config.pinClickable !== undefined) {
    result.pinClickable = config.pinClickable ? 'true' : 'false';
  }
  if (config.pitch !== undefined) {
    result.pitch = String(config.pitch);
  }
  if (config.bearing !== undefined) {
    result.bearing = String(config.bearing);
  }
  if (config.show3DBuildings !== undefined) {
    result.show3DBuildings = config.show3DBuildings ? 'true' : 'false';
  }
  if (config.autoRotate !== undefined) {
    result.autoRotate = config.autoRotate ? 'true' : 'false';
  }
  if (config.autoRotateSpeed !== undefined) {
    result.autoRotateSpeed = String(config.autoRotateSpeed);
  }
  if (config.showDirections !== undefined) {
    result.showDirections = config.showDirections ? 'true' : 'false';
  }
  if (config.themeId !== undefined) {
    result.themeId = config.themeId ?? '';
  }
  if (config.preferredScheme !== undefined) {
    result.preferredScheme = config.preferredScheme ?? 'auto';
  }
  if (config.areaLabelsMode !== undefined) {
    result.areaLabelsMode = config.areaLabelsMode ?? 'inherit';
  }
  if (config.poiLabelsMode !== undefined) {
    result.poiLabelsMode = config.poiLabelsMode ?? 'inherit';
  }

  return result;
}
