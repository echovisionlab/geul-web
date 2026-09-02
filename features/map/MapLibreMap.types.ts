import type * as maplibregl from 'maplibre-gl';
import type { StyleSpecification } from 'maplibre-gl';
import type { MapRendererPlace, MapRendererProps, MapServerFeatureSource, MapViewportSnapshot } from './types';

export interface MapLibreMapProps extends MapRendererProps {
  onPlaceClick?: (place: MapRendererPlace) => void;
  featureSourceData?: MapServerFeatureSource;
  onFeatureClusterClick?: (featureId: string) => void;
  onViewportSettled?: (viewport: MapViewportSnapshot) => void;
  zoomPosition?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
  zIndex?: number;
  /** Show navigation controls (zoom buttons). Defaults to true when zoomable. */
  showNavigation?: boolean;
  /** Use instant transitions (jumpTo) instead of animated (easeTo). Useful for continuous updates. */
  instantTransitions?: boolean;
  /** Callback to receive the map instance after load. */
  onMapReady?: (map: maplibregl.Map) => void;
  /** Optional style injection for embedded, offline, or custom map surfaces. */
  mapStyleOverride?: StyleSpecification | string;
}
