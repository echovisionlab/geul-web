import type { Coordinate } from '../common/coordinate';
import type { AddressComponents } from '../map-place/model';
import type { ThemeSettings, ThemeVariant } from '../map-theme/model';

/**
 * Aspect ratio options for map display
 */
export type MapAspectRatio = '16:9' | '4:3' | '1:1';

/**
 * Preferred color scheme for map theme
 */
export type MapPreferredScheme = 'auto' | 'light' | 'dark';

/**
 * Per-map override for theme-driven base label visibility.
 */
export type MapLabelVisibilityMode = 'inherit' | 'show' | 'hide';

export interface MapZoomBounds {
  minZoom: number;
  maxZoom: number;
}

export const MAP_MIN_ZOOM_LIMIT = -2;
export const MAP_MAX_ZOOM_LIMIT = 22;
export const DEFAULT_MAP_ZOOM = 15;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function normalizeMapZoomBounds(bounds?: Partial<MapZoomBounds>): MapZoomBounds {
  const rawMinZoom =
    typeof bounds?.minZoom === 'number' && Number.isFinite(bounds.minZoom) ? bounds.minZoom : MAP_MIN_ZOOM_LIMIT;
  const rawMaxZoom =
    typeof bounds?.maxZoom === 'number' && Number.isFinite(bounds.maxZoom) ? bounds.maxZoom : MAP_MAX_ZOOM_LIMIT;

  const minZoom = clamp(rawMinZoom, MAP_MIN_ZOOM_LIMIT, MAP_MAX_ZOOM_LIMIT);
  const maxZoom = clamp(rawMaxZoom, minZoom, MAP_MAX_ZOOM_LIMIT);

  return { minZoom, maxZoom };
}

export function clampMapZoom(zoom: number, bounds?: Partial<MapZoomBounds>): number {
  const { minZoom, maxZoom } = normalizeMapZoomBounds(bounds);
  const safeZoom = Number.isFinite(zoom) ? zoom : DEFAULT_MAP_ZOOM;
  return clamp(safeZoom, minZoom, maxZoom);
}

/**
 * Map configuration for rendering
 * Stored with content (Page/Post) and passed to MapDisplay
 */
export interface MapConfig {
  /** Map center coordinate (always explicit) */
  center: Coordinate;
  /** Zoom level (always explicit) */
  zoom: number;
  /** Minimum allowed zoom level */
  minZoom: number;
  /** Maximum allowed zoom level */
  maxZoom: number;
  /** Display aspect ratio */
  aspectRatio: MapAspectRatio;
  /** Preview width in percent (10-100, undefined = 100% container width) */
  previewWidth?: number;
  /** Allow map dragging */
  draggable: boolean;
  /** Allow map zooming */
  zoomable: boolean;
  /** Allow map rotation (bearing) */
  rotatable: boolean;
  /** Allow map tilting (pitch) */
  tiltable: boolean;
  /** Allow pin click to show popup */
  pinClickable: boolean;
  /** 3D tilt angle (0 = 2D, 45-60 = 3D) */
  pitch: number;
  /** Map rotation in degrees */
  bearing: number;
  /** Show 3D buildings */
  show3DBuildings: boolean;
  /** Enable auto-rotation (only active when pitch > 0) */
  autoRotate: boolean;
  /** Auto-rotation speed in degrees per second */
  autoRotateSpeed: number;
  /** Show directions links on callout click */
  showDirections: boolean;
  /** MapTheme ID reference */
  themeId?: string;
  /** Preferred color scheme when theme supports both light/dark */
  preferredScheme?: MapPreferredScheme;
  /** Override visibility for area labels such as city/district/neighborhood names */
  areaLabelsMode?: MapLabelVisibilityMode;
  /** Override visibility for POI labels such as stations, landmarks, and venues */
  poiLabelsMode?: MapLabelVisibilityMode;
}

/**
 * Default map configuration
 */
export const DEFAULT_MAP_CONFIG: MapConfig = {
  center: { lat: 37.5665, lng: 126.978 }, // Seoul
  zoom: DEFAULT_MAP_ZOOM,
  minZoom: MAP_MIN_ZOOM_LIMIT,
  maxZoom: MAP_MAX_ZOOM_LIMIT,
  aspectRatio: '16:9',
  draggable: true,
  zoomable: true,
  rotatable: false,
  tiltable: false,
  pinClickable: true,
  pitch: 0,
  bearing: 0,
  show3DBuildings: false,
  autoRotate: false,
  autoRotateSpeed: 1,
  showDirections: true,
  areaLabelsMode: 'inherit',
  poiLabelsMode: 'inherit',
};

/**
 * Default center (Seoul) for when no places are selected
 */
export const DEFAULT_CENTER: Coordinate = { lat: 37.5665, lng: 126.978 };

/**
 * Minimal place data embedded in HTML for client-side rendering
 */
export interface MapViewPlace {
  id: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  addressComponents?: AddressComponents | null;
}

/**
 * Minimal theme data embedded in HTML for client-side rendering
 */
export interface MapViewTheme {
  id: string;
  settings: ThemeSettings;
  lightVariant: Omit<ThemeVariant, 'id' | 'scheme'>;
  darkVariant: Omit<ThemeVariant, 'id' | 'scheme'>;
}

/**
 * Complete map view configuration embedded in HTML
 * Contains all data needed for client-side rendering without additional fetches
 */
export interface MapViewConfig {
  // Viewport
  center: Coordinate;
  zoom: number;
  minZoom: number;
  maxZoom: number;
  pitch: number;
  bearing: number;
  cluster?: boolean;

  // Display
  aspectRatio: MapAspectRatio;
  /** Preview width in percent (10-100, undefined = 100% container width) */
  previewWidth?: number;

  // Interaction
  draggable: boolean;
  zoomable: boolean;
  rotatable: boolean;
  tiltable: boolean;
  pinClickable: boolean;

  // Animation
  autoRotate: boolean;
  autoRotateSpeed: number;
  showDirections: boolean;
  show3DBuildings: boolean;
  preferredScheme: MapPreferredScheme;
  areaLabelsMode?: MapLabelVisibilityMode;
  poiLabelsMode?: MapLabelVisibilityMode;

  // Embedded data
  places: MapViewPlace[];
  theme: MapViewTheme | null;
}
