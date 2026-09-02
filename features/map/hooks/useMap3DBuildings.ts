import { useEffect } from 'react';
import type * as maplibregl from 'maplibre-gl';
import { parseColorOpacity } from '@/lib/utils/color';

export interface MapBuildingThemeConfig {
  buildingFillColor?: string;
}

export interface UseMap3DBuildingsOptions {
  mapRef: React.RefObject<maplibregl.Map | null>;
  isReady: boolean;
  enabled: boolean;
  themeConfig?: MapBuildingThemeConfig;
  colorScheme: 'light' | 'dark';
}

const LAYER_ID = '3d-buildings';

function resolveBuildingSource(map: maplibregl.Map): { source: string; sourceLayer: string } {
  const layers = map.getStyle()?.layers ?? [];

  for (const layer of layers) {
    if (!('source-layer' in layer)) {
      continue;
    }

    if (layer['source-layer'] !== 'building') {
      continue;
    }

    if (typeof layer.source === 'string') {
      return { source: layer.source, sourceLayer: layer['source-layer'] };
    }
  }

  return { source: 'openmaptiles', sourceLayer: 'building' };
}

/**
 * Manages 3D building extrusion layer
 */
export function useMap3DBuildings({ mapRef, isReady, enabled, themeConfig, colorScheme }: UseMap3DBuildingsOptions) {
  useEffect(() => {
    if (!mapRef.current || !isReady) {
      return;
    }
    const map = mapRef.current;

    if (!enabled) {
      if (map.getLayer(LAYER_ID)) {
        map.removeLayer(LAYER_ID);
      }
      return;
    }

    const color = themeConfig?.buildingFillColor ?? (colorScheme === 'dark' ? '#2a2a3e' : '#e8e8e8');
    const opacity = themeConfig?.buildingFillColor ? parseColorOpacity(themeConfig.buildingFillColor) : 0.7;

    if (map.getLayer(LAYER_ID)) {
      // Keep existing layer in sync when theme/scheme changes.
      try {
        map.setPaintProperty(LAYER_ID, 'fill-extrusion-color', color);
        map.setPaintProperty(LAYER_ID, 'fill-extrusion-opacity', opacity);
      } catch {
        // ignore
      }
      return;
    }

    const add3DBuildings = () => {
      // Check again inside callback to prevent race conditions
      if (map.getLayer(LAYER_ID)) {
        return;
      }

      // Set dramatic lighting for 3D effect
      map.setLight({
        anchor: 'viewport',
        color: '#ffffff',
        intensity: 0.6,
        position: [1.5, 45, 30], // [radial, azimuthal, polar]
      });

      let labelLayerId: string | undefined;
      for (const layer of map.getStyle()?.layers || []) {
        if (layer.type === 'symbol') {
          labelLayerId = layer.id;
          break;
        }
      }

      const { source, sourceLayer } = resolveBuildingSource(map);

      try {
        map.addLayer(
          {
            id: LAYER_ID,
            source,
            'source-layer': sourceLayer,
            type: 'fill-extrusion',
            minzoom: 14,
            layout: { visibility: 'visible' },
            paint: {
              'fill-extrusion-color': color,
              'fill-extrusion-height': ['coalesce', ['get', 'render_height'], ['get', 'height'], 10],
              'fill-extrusion-base': ['coalesce', ['get', 'render_min_height'], 0],
              'fill-extrusion-opacity': opacity,
              'fill-extrusion-vertical-gradient': true,
            },
          },
          labelLayerId,
        );
      } catch {
        // ignore
      }
    };

    if (map.isStyleLoaded()) {
      add3DBuildings();
      return;
    }

    map.once('styledata', add3DBuildings);
    return () => {
      map.off('styledata', add3DBuildings);
    };
  }, [mapRef, isReady, enabled, themeConfig, colorScheme]);
}
