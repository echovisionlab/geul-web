import type { StyleSpecification } from 'maplibre-gl';
import { parseColorOpacity } from '@/lib/utils/color';

export interface BaseMapStyleConfig {
  backgroundColor: string;
  waterColor: string;
  landColor: string;
  roadColor: string;
  buildingFillColor: string;
  buildingStrokeEnabled: boolean;
  buildingStrokeColor: string;
}

// OpenFreeMap styles for non-themed maps (free, unlimited, no API key)
export const TILE_STYLES = {
  light: 'https://tiles.openfreemap.org/styles/liberty',
  dark: 'https://tiles.openfreemap.org/styles/dark',
};

const OPENFREEMAP_GLYPHS_URL = 'https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf';

/**
 * Build MapLibre StyleSpecification from theme config
 * All colors support RGBA format - MapLibre parses them directly
 *
 * Uses OpenFreeMap (free, unlimited, no API key required)
 * Same OpenMapTiles schema for 100% compatibility
 */
export function buildMapLibreStyle(config: BaseMapStyleConfig): StyleSpecification {
  // Extract opacity from RGBA colors for layers that need explicit opacity
  const buildingFillOpacity = parseColorOpacity(config.buildingFillColor);

  return {
    version: 8,
    name: 'CustomTheme',
    sources: {
      openmaptiles: {
        type: 'vector',
        url: 'https://tiles.openfreemap.org/planet',
      },
    },
    glyphs: OPENFREEMAP_GLYPHS_URL,
    layers: [
      {
        id: 'background',
        type: 'background',
        layout: { visibility: 'visible' as const },
        paint: { 'background-color': config.backgroundColor },
      },
      {
        id: 'water',
        type: 'fill',
        source: 'openmaptiles',
        'source-layer': 'water',
        layout: { visibility: 'visible' as const },
        paint: { 'fill-color': config.waterColor },
      },
      {
        id: 'landuse',
        type: 'fill',
        source: 'openmaptiles',
        'source-layer': 'landuse',
        layout: { visibility: 'visible' as const },
        paint: { 'fill-color': config.landColor, 'fill-opacity': 0.5 },
      },
      {
        id: 'roads',
        type: 'line',
        source: 'openmaptiles',
        'source-layer': 'transportation',
        layout: { visibility: 'visible' as const },
        paint: {
          'line-color': config.roadColor,
          'line-width': ['interpolate', ['linear'], ['zoom'], 10, 0.2, 14, 0.5, 18, 1],
        },
      },
      ...(buildingFillOpacity > 0
        ? [
            {
              id: 'building-fill',
              type: 'fill' as const,
              source: 'openmaptiles',
              'source-layer': 'building',
              minzoom: 14,
              layout: { visibility: 'visible' as const },
              paint: {
                'fill-color': config.buildingFillColor,
              },
            },
          ]
        : []),
      ...(config.buildingStrokeEnabled
        ? [
            {
              id: 'building-stroke',
              type: 'line' as const,
              source: 'openmaptiles',
              'source-layer': 'building',
              minzoom: 14,
              layout: { visibility: 'visible' as const },
              paint: {
                'line-color': config.buildingStrokeColor,
                'line-width': 0.5,
              },
            },
          ]
        : []),
    ],
  };
}
