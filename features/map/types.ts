import type { Coordinate } from '@/lib/types/common/coordinate';
import type { AddressComponents } from '@/lib/types/map-place/model';
import type { ResolvedThemeConfig } from '@/lib/types/map-theme/model';

/**
 * Place data for map renderer
 */
export interface MapRendererPlace {
  id: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  href?: string;
  /** Address components for detailed field display */
  addressComponents?: AddressComponents | null;
}

export interface MapServerFeatureProperties {
  kind: 'cluster' | 'item';
  id: string;
  count?: number;
}

export interface MapServerFeatureSource {
  type: 'FeatureCollection';
  features: {
    type: 'Feature';
    geometry: {
      type: 'Point';
      coordinates: number[];
    };
    properties: MapServerFeatureProperties;
  }[];
}

export interface MapViewportSnapshot {
  bounds: {
    west: number;
    south: number;
    east: number;
    north: number;
  };
  center: Coordinate;
  zoom: number;
  widthPx: number;
  heightPx: number;
}

/**
 * Common interface for map renderer components (MapLibreMap, GoogleMap, etc.)
 */
export interface MapRendererProps {
  places: MapRendererPlace[];
  center: Coordinate;
  zoom: number;
  minZoom?: number;
  maxZoom?: number;
  clusterRadius?: number;
  clusterMaxZoom?: number;
  /** Locale used for base map labels when custom/native symbol layers are localized. */
  labelLocale?: string | null;
  cluster?: boolean;
  height?: string | number;
  pinClickable?: boolean;
  draggable?: boolean;
  zoomable?: boolean;
  /** Allow map rotation (bearing) */
  rotatable?: boolean;
  /** Allow map tilting (pitch) */
  tiltable?: boolean;
  popupEnabled?: boolean;
  onZoomChange?: (zoom: number) => void;
  onCenterChange?: (center: Coordinate) => void;
  onPitchChange?: (pitch: number) => void;
  onBearingChange?: (bearing: number) => void;
  /** 3D tilt angle (0 = 2D) */
  pitch?: number;
  /** Map rotation in degrees */
  bearing?: number;
  /** Show 3D buildings */
  show3DBuildings?: boolean;
  /** Enable auto-rotation (only active when pitch > 0) */
  autoRotate?: boolean;
  /** Auto-rotation speed in degrees per second */
  autoRotateSpeed?: number;
  /** Show directions links on callout click */
  showDirections?: boolean;
  /** Resolved theme config (pre-fetched from themeId). Rendering never invents a fallback. */
  themeConfig: ResolvedThemeConfig;
  /** Final resolved visibility for base area labels (city, district, neighborhood). */
  showAreaLabels?: boolean;
  /** Final resolved visibility for base POI labels (stations, venues, landmarks). */
  showPoiLabels?: boolean;
}
