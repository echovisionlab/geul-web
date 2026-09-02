import { useEffect, type RefObject } from 'react';
import type * as maplibregl from 'maplibre-gl';
import { DEFAULT_LOCALE, normalizeLocale, type SupportedLocale } from '@/lib/i18n/locale';

export interface MapLabelThemeConfig {
  labelTextColor?: string;
}

export interface UseMapLabelsOptions {
  mapRef: RefObject<maplibregl.Map | null>;
  isReady: boolean;
  showAreaLabels: boolean;
  showPoiLabels: boolean;
  labelLocale?: string | null;
  themeConfig?: MapLabelThemeConfig;
  colorScheme: 'light' | 'dark';
  beforeLayerIds?: string[];
}

const AREA_LAYER_ID = 'area-labels';
const WORLD_AREA_LAYER_ID = 'world-area-labels';
const WORLD_WATER_POINT_LAYER_ID = 'world-water-point-labels';
const WORLD_WATER_LINE_LAYER_ID = 'world-water-line-labels';
const ROAD_LAYER_ID = 'road-labels';
const POI_LAYER_ID = 'poi-labels';

const PLACE_CLASS_FIELD = [
  'downcase',
  ['coalesce', ['to-string', ['get', 'class']], ['to-string', ['get', 'place']], ''],
] as const;

const MAP_LABEL_LOCALE_FIELD_ALIASES: Record<SupportedLocale, string[]> = {
  en: ['en'],
  ko: ['ko'],
  ja: ['ja'],
  'zh-CN': ['zh-CN', 'zh_CN', 'zh-Hans', 'zh_Hans', 'zh'],
  'zh-TW': ['zh-TW', 'zh_TW', 'zh-Hant', 'zh_Hant', 'zh'],
  es: ['es'],
  'es-419': ['es-419', 'es_419', 'es'],
  fr: ['fr'],
  de: ['de'],
  'pt-BR': ['pt-BR', 'pt_BR', 'pt'],
  'pt-PT': ['pt-PT', 'pt_PT', 'pt'],
  it: ['it'],
  nl: ['nl'],
  ar: ['ar'],
  id: ['id'],
  vi: ['vi'],
  th: ['th'],
  tr: ['tr'],
  pl: ['pl'],
  ru: ['ru'],
};

type LabelTextFieldExpression = ['coalesce', ...Array<['get', string]>];

function getLabelTextColor(themeConfig: MapLabelThemeConfig | undefined, colorScheme: 'light' | 'dark'): string {
  return (
    themeConfig?.labelTextColor ?? (colorScheme === 'dark' ? 'rgba(226, 232, 240, 0.82)' : 'rgba(51, 65, 85, 0.82)')
  );
}

function resolveMapLabelLocale(locale: string | null | undefined): SupportedLocale {
  return normalizeLocale(locale) ?? DEFAULT_LOCALE;
}

function getLocaleNameFieldCandidates(locale: SupportedLocale): string[] {
  const aliases = MAP_LABEL_LOCALE_FIELD_ALIASES[locale] ?? [locale];
  const fields: string[] = [];
  const pushField = (field: string) => {
    if (!fields.includes(field)) {
      fields.push(field);
    }
  };

  for (const alias of aliases) {
    pushField(`name:${alias}`);
    pushField(`name_${alias}`);
  }

  pushField('name:en');
  pushField('name_en');
  pushField('name_int');
  pushField('name:latin');
  pushField('name:nonlatin');
  pushField('name');

  return fields;
}

function buildLabelTextField(locale: string | null | undefined): LabelTextFieldExpression {
  const resolvedLocale = resolveMapLabelLocale(locale);
  return [
    'coalesce',
    ...getLocaleNameFieldCandidates(resolvedLocale).map((field) => ['get', field] as ['get', string]),
  ];
}

function resolveLabelSource(map: maplibregl.Map, sourceLayer: string): { source: string; sourceLayer: string } {
  const layers = map.getStyle()?.layers ?? [];

  for (const layer of layers) {
    if (layer.type !== 'symbol' || !('source-layer' in layer)) {
      continue;
    }

    if (layer['source-layer'] !== sourceLayer) {
      continue;
    }

    if (typeof layer.source === 'string') {
      return { source: layer.source, sourceLayer };
    }
  }

  return { source: 'openmaptiles', sourceLayer };
}

function findExistingSymbolLayers(map: maplibregl.Map, sourceLayer: string, customLayerIds: string[]): string[] {
  const layers = map.getStyle()?.layers ?? [];
  return layers
    .filter(
      (layer) =>
        !customLayerIds.includes(layer.id) &&
        layer.type === 'symbol' &&
        'source-layer' in layer &&
        layer['source-layer'] === sourceLayer,
    )
    .map((layer) => layer.id);
}

function isNativeWorldPlaceLayer(layerId: string): boolean {
  const normalized = layerId.toLowerCase();
  return normalized.includes('country') || normalized.includes('continent');
}

function findBeforeLayerId(map: maplibregl.Map, beforeLayerIds: string[] | undefined): string | undefined {
  if (!beforeLayerIds) {
    return undefined;
  }

  return beforeLayerIds.find((layerId) => Boolean(map.getLayer(layerId)));
}

function setLayerVisibility(map: maplibregl.Map, layerIds: string[], visible: boolean) {
  for (const layerId of layerIds) {
    if (!map.getLayer(layerId)) {
      continue;
    }

    try {
      map.setLayoutProperty(layerId, 'visibility', visible ? 'visible' : 'none');
    } catch {
      // ignore
    }
  }
}

function setLayerTextField(map: maplibregl.Map, layerIds: string[], textField: LabelTextFieldExpression) {
  for (const layerId of layerIds) {
    if (!map.getLayer(layerId)) {
      continue;
    }

    try {
      map.setLayoutProperty(layerId, 'text-field', textField);
    } catch {
      // ignore
    }
  }
}

function removeLayerIfPresent(map: maplibregl.Map, layerId: string) {
  if (!map.getLayer(layerId)) {
    return;
  }

  try {
    map.removeLayer(layerId);
  } catch {
    // ignore
  }
}

function syncCustomWorldPlaceLayer(
  map: maplibregl.Map,
  visible: boolean,
  labelLocale: string | null | undefined,
  themeConfig: MapLabelThemeConfig | undefined,
  colorScheme: 'light' | 'dark',
  beforeLayerIds: string[] | undefined,
) {
  if (!visible) {
    removeLayerIfPresent(map, WORLD_AREA_LAYER_ID);
    return;
  }

  const { source, sourceLayer } = resolveLabelSource(map, 'place');
  if (!map.getSource(source)) {
    removeLayerIfPresent(map, WORLD_AREA_LAYER_ID);
    return;
  }

  const textColor = getLabelTextColor(themeConfig, colorScheme);
  const textField = buildLabelTextField(labelLocale);
  const beforeId = findBeforeLayerId(map, beforeLayerIds);
  const worldLayer: maplibregl.SymbolLayerSpecification = {
    id: WORLD_AREA_LAYER_ID,
    type: 'symbol',
    source,
    'source-layer': sourceLayer,
    minzoom: 0,
    maxzoom: 8,
    filter: ['all', ['has', 'name'], ['match', PLACE_CLASS_FIELD, ['continent', 'country'], true, false]] as never,
    layout: {
      'text-field': textField as never,
      'text-font': ['Noto Sans Bold'] as never,
      'text-size': ['interpolate', ['linear'], ['zoom'], 0, 11, 2, 12.5, 4, 14] as never,
      'text-max-width': 8,
      'text-letter-spacing': 0.04,
      'symbol-sort-key': [
        'case',
        ['==', PLACE_CLASS_FIELD, 'continent'],
        0,
        ['coalesce', ['get', 'rank'], 100],
      ] as never,
    },
    paint: {
      'text-color': textColor,
    },
  };

  if (map.getLayer(WORLD_AREA_LAYER_ID)) {
    try {
      map.setLayoutProperty(WORLD_AREA_LAYER_ID, 'text-field', textField as never);
      map.setPaintProperty(WORLD_AREA_LAYER_ID, 'text-color', textColor);
      map.setPaintProperty(WORLD_AREA_LAYER_ID, 'text-halo-width', 0);
      map.setPaintProperty(WORLD_AREA_LAYER_ID, 'text-halo-blur', 0);
      map.setLayoutProperty(WORLD_AREA_LAYER_ID, 'visibility', 'visible');
    } catch {
      removeLayerIfPresent(map, WORLD_AREA_LAYER_ID);
      try {
        map.addLayer(worldLayer, beforeId);
      } catch {
        // ignore
      }
    }
    return;
  }

  try {
    map.addLayer(worldLayer, beforeId);
  } catch {
    // ignore
  }
}

function syncCustomAreaLayer(
  map: maplibregl.Map,
  visible: boolean,
  labelLocale: string | null | undefined,
  themeConfig: MapLabelThemeConfig | undefined,
  colorScheme: 'light' | 'dark',
  beforeLayerIds: string[] | undefined,
) {
  if (!visible) {
    removeLayerIfPresent(map, AREA_LAYER_ID);
    return;
  }

  const { source, sourceLayer } = resolveLabelSource(map, 'place');
  if (!map.getSource(source)) {
    removeLayerIfPresent(map, AREA_LAYER_ID);
    return;
  }

  const textColor = getLabelTextColor(themeConfig, colorScheme);
  const textField = buildLabelTextField(labelLocale);
  const beforeId = findBeforeLayerId(map, beforeLayerIds);
  const layer: maplibregl.SymbolLayerSpecification = {
    id: AREA_LAYER_ID,
    type: 'symbol',
    source,
    'source-layer': sourceLayer,
    minzoom: 4,
    filter: [
      'all',
      ['has', 'name'],
      ['match', PLACE_CLASS_FIELD, ['continent', 'country', 'ocean'], false, true],
    ] as never,
    layout: {
      'text-field': textField as never,
      'text-font': ['Noto Sans Regular'] as never,
      'text-size': ['interpolate', ['linear'], ['zoom'], 4, 10, 7, 11, 10, 12.5, 13, 14.5, 16, 17] as never,
      'text-max-width': 10,
      'text-letter-spacing': 0.02,
      'symbol-sort-key': ['coalesce', ['get', 'rank'], 100] as never,
    },
    paint: {
      'text-color': textColor,
    },
  };

  if (map.getLayer(AREA_LAYER_ID)) {
    try {
      map.setLayoutProperty(AREA_LAYER_ID, 'text-field', textField as never);
      map.setPaintProperty(AREA_LAYER_ID, 'text-color', textColor);
      map.setPaintProperty(AREA_LAYER_ID, 'text-halo-width', 0);
      map.setPaintProperty(AREA_LAYER_ID, 'text-halo-blur', 0);
      map.setLayoutProperty(AREA_LAYER_ID, 'visibility', 'visible');
    } catch {
      removeLayerIfPresent(map, AREA_LAYER_ID);
      try {
        map.addLayer(layer, beforeId);
      } catch {
        // ignore
      }
    }
    return;
  }

  try {
    map.addLayer(layer, beforeId);
  } catch {
    // ignore
  }
}

function syncCustomWorldWaterLayers(
  map: maplibregl.Map,
  visible: boolean,
  labelLocale: string | null | undefined,
  themeConfig: MapLabelThemeConfig | undefined,
  colorScheme: 'light' | 'dark',
  beforeLayerIds: string[] | undefined,
) {
  if (!visible) {
    removeLayerIfPresent(map, WORLD_WATER_POINT_LAYER_ID);
    removeLayerIfPresent(map, WORLD_WATER_LINE_LAYER_ID);
    return;
  }

  const { source, sourceLayer } = resolveLabelSource(map, 'water_name');
  if (!map.getSource(source)) {
    removeLayerIfPresent(map, WORLD_WATER_POINT_LAYER_ID);
    removeLayerIfPresent(map, WORLD_WATER_LINE_LAYER_ID);
    return;
  }

  const textColor = getLabelTextColor(themeConfig, colorScheme);
  const textField = buildLabelTextField(labelLocale);
  const beforeId = findBeforeLayerId(map, beforeLayerIds);
  const pointLayer: maplibregl.SymbolLayerSpecification = {
    id: WORLD_WATER_POINT_LAYER_ID,
    type: 'symbol',
    source,
    'source-layer': sourceLayer,
    minzoom: 0,
    maxzoom: 8,
    filter: ['all', ['has', 'name'], ['match', ['geometry-type'], ['MultiPoint', 'Point'], true, false]] as never,
    layout: {
      'text-field': textField as never,
      'text-font': ['Noto Sans Regular'] as never,
      'text-size': ['interpolate', ['linear'], ['zoom'], 0, 11, 4, 12.5, 8, 14] as never,
      'text-max-width': 10,
      'text-letter-spacing': 0.03,
    },
    paint: {
      'text-color': textColor,
    },
  };
  const lineLayer: maplibregl.SymbolLayerSpecification = {
    id: WORLD_WATER_LINE_LAYER_ID,
    type: 'symbol',
    source,
    'source-layer': sourceLayer,
    minzoom: 0,
    maxzoom: 8,
    filter: [
      'all',
      ['has', 'name'],
      ['match', ['geometry-type'], ['LineString', 'MultiLineString'], true, false],
    ] as never,
    layout: {
      'symbol-placement': 'line',
      'text-field': textField as never,
      'text-font': ['Noto Sans Regular'] as never,
      'text-size': ['interpolate', ['linear'], ['zoom'], 0, 11, 4, 12, 8, 13] as never,
      'text-letter-spacing': 0.03,
    },
    paint: {
      'text-color': textColor,
    },
  };

  const syncLayer = (layerId: string, layer: maplibregl.SymbolLayerSpecification) => {
    if (map.getLayer(layerId)) {
      try {
        map.setLayoutProperty(layerId, 'text-field', textField as never);
        map.setPaintProperty(layerId, 'text-color', textColor);
        map.setPaintProperty(layerId, 'text-halo-width', 0);
        map.setPaintProperty(layerId, 'text-halo-blur', 0);
        map.setLayoutProperty(layerId, 'visibility', 'visible');
      } catch {
        removeLayerIfPresent(map, layerId);
        try {
          map.addLayer(layer, beforeId);
        } catch {
          // ignore
        }
      }
      return;
    }

    try {
      map.addLayer(layer, beforeId);
    } catch {
      // ignore
    }
  };

  syncLayer(WORLD_WATER_POINT_LAYER_ID, pointLayer);
  syncLayer(WORLD_WATER_LINE_LAYER_ID, lineLayer);
}

function syncCustomPoiLayer(
  map: maplibregl.Map,
  visible: boolean,
  labelLocale: string | null | undefined,
  themeConfig: MapLabelThemeConfig | undefined,
  colorScheme: 'light' | 'dark',
  beforeLayerIds: string[] | undefined,
) {
  if (!visible) {
    removeLayerIfPresent(map, POI_LAYER_ID);
    return;
  }

  const { source, sourceLayer } = resolveLabelSource(map, 'poi');
  if (!map.getSource(source)) {
    removeLayerIfPresent(map, POI_LAYER_ID);
    return;
  }

  const textColor = getLabelTextColor(themeConfig, colorScheme);
  const textField = buildLabelTextField(labelLocale);
  const beforeId = findBeforeLayerId(map, beforeLayerIds);

  const layer: maplibregl.SymbolLayerSpecification = {
    id: POI_LAYER_ID,
    type: 'symbol',
    source,
    'source-layer': sourceLayer,
    minzoom: 12,
    filter: ['has', 'name'] as never,
    layout: {
      'text-field': textField as never,
      'text-font': ['Noto Sans Regular'] as never,
      'text-size': ['interpolate', ['linear'], ['zoom'], 12, 10, 14, 11, 16, 12.5] as never,
      'text-max-width': 8,
      'text-letter-spacing': 0.01,
      'symbol-sort-key': ['coalesce', ['get', 'rank'], 100] as never,
    },
    paint: {
      'text-color': textColor,
    },
  };

  if (map.getLayer(POI_LAYER_ID)) {
    try {
      map.setLayoutProperty(POI_LAYER_ID, 'text-field', textField as never);
      map.setPaintProperty(POI_LAYER_ID, 'text-color', textColor);
      map.setPaintProperty(POI_LAYER_ID, 'text-halo-width', 0);
      map.setPaintProperty(POI_LAYER_ID, 'text-halo-blur', 0);
      map.setLayoutProperty(POI_LAYER_ID, 'visibility', 'visible');
    } catch {
      removeLayerIfPresent(map, POI_LAYER_ID);
      try {
        map.addLayer(layer, beforeId);
      } catch {
        // ignore
      }
    }
    return;
  }

  try {
    map.addLayer(layer, beforeId);
  } catch {
    // ignore
  }
}

function syncCustomRoadLayer(
  map: maplibregl.Map,
  visible: boolean,
  labelLocale: string | null | undefined,
  themeConfig: MapLabelThemeConfig | undefined,
  colorScheme: 'light' | 'dark',
  beforeLayerIds: string[] | undefined,
) {
  if (!visible) {
    removeLayerIfPresent(map, ROAD_LAYER_ID);
    return;
  }

  const { source, sourceLayer } = resolveLabelSource(map, 'transportation_name');
  if (!map.getSource(source)) {
    removeLayerIfPresent(map, ROAD_LAYER_ID);
    return;
  }

  const textColor = getLabelTextColor(themeConfig, colorScheme);
  const textField = buildLabelTextField(labelLocale);
  const beforeId = findBeforeLayerId(map, beforeLayerIds);

  const layer: maplibregl.SymbolLayerSpecification = {
    id: ROAD_LAYER_ID,
    type: 'symbol',
    source,
    'source-layer': sourceLayer,
    minzoom: 11,
    filter: ['has', 'name'] as never,
    layout: {
      'symbol-placement': 'line',
      'text-field': textField as never,
      'text-font': ['Noto Sans Regular'] as never,
      'text-size': ['interpolate', ['linear'], ['zoom'], 11, 9.5, 13, 10.5, 15, 11.5] as never,
      'symbol-sort-key': ['coalesce', ['get', 'rank'], 100] as never,
    },
    paint: {
      'text-color': textColor,
    },
  };

  if (map.getLayer(ROAD_LAYER_ID)) {
    try {
      map.setLayoutProperty(ROAD_LAYER_ID, 'text-field', textField as never);
      map.setPaintProperty(ROAD_LAYER_ID, 'text-color', textColor);
      map.setPaintProperty(ROAD_LAYER_ID, 'text-halo-width', 0);
      map.setPaintProperty(ROAD_LAYER_ID, 'text-halo-blur', 0);
      map.setLayoutProperty(ROAD_LAYER_ID, 'visibility', 'visible');
    } catch {
      removeLayerIfPresent(map, ROAD_LAYER_ID);
      try {
        map.addLayer(layer, beforeId);
      } catch {
        // ignore
      }
    }
    return;
  }

  try {
    map.addLayer(layer, beforeId);
  } catch {
    // ignore
  }
}

export function useMapLabels({
  mapRef,
  isReady,
  showAreaLabels,
  showPoiLabels,
  labelLocale,
  themeConfig,
  colorScheme,
  beforeLayerIds,
}: UseMapLabelsOptions) {
  useEffect(() => {
    if (!mapRef.current || !isReady) {
      return;
    }

    const map = mapRef.current;

    const syncLabels = () => {
      if (!map.isStyleLoaded()) {
        return;
      }

      const textField = buildLabelTextField(labelLocale);
      const nativePlaceLayers = findExistingSymbolLayers(map, 'place', [AREA_LAYER_ID, WORLD_AREA_LAYER_ID]);
      const nativeWorldPlaceLayers = nativePlaceLayers.filter(isNativeWorldPlaceLayer);
      const nativeLocalPlaceLayers = nativePlaceLayers.filter((layerId) => !isNativeWorldPlaceLayer(layerId));

      if (nativeWorldPlaceLayers.length > 0) {
        setLayerVisibility(map, nativeWorldPlaceLayers, false);
      }
      syncCustomWorldPlaceLayer(map, true, labelLocale, themeConfig, colorScheme, beforeLayerIds);

      if (nativeLocalPlaceLayers.length > 0) {
        setLayerTextField(map, nativeLocalPlaceLayers, textField);
        setLayerVisibility(map, nativeLocalPlaceLayers, showAreaLabels);
        removeLayerIfPresent(map, AREA_LAYER_ID);
      } else {
        syncCustomAreaLayer(map, showAreaLabels, labelLocale, themeConfig, colorScheme, beforeLayerIds);
      }

      const nativeWaterLayers = findExistingSymbolLayers(map, 'water_name', [
        WORLD_WATER_POINT_LAYER_ID,
        WORLD_WATER_LINE_LAYER_ID,
      ]);
      if (nativeWaterLayers.length > 0) {
        setLayerVisibility(map, nativeWaterLayers, false);
      }
      syncCustomWorldWaterLayers(map, true, labelLocale, themeConfig, colorScheme, beforeLayerIds);

      const nativeRoadLayers = findExistingSymbolLayers(map, 'transportation_name', [ROAD_LAYER_ID]);
      if (nativeRoadLayers.length > 0) {
        setLayerTextField(map, nativeRoadLayers, textField);
        setLayerVisibility(map, nativeRoadLayers, showAreaLabels);
        removeLayerIfPresent(map, ROAD_LAYER_ID);
      } else {
        syncCustomRoadLayer(map, showAreaLabels, labelLocale, themeConfig, colorScheme, beforeLayerIds);
      }

      const nativePoiLayers = findExistingSymbolLayers(map, 'poi', [POI_LAYER_ID]);
      if (nativePoiLayers.length > 0) {
        setLayerTextField(map, nativePoiLayers, textField);
        setLayerVisibility(map, nativePoiLayers, showPoiLabels);
        removeLayerIfPresent(map, POI_LAYER_ID);
      } else {
        syncCustomPoiLayer(map, showPoiLabels, labelLocale, themeConfig, colorScheme, beforeLayerIds);
      }
    };

    if (map.isStyleLoaded()) {
      syncLabels();
    } else {
      map.once('style.load', syncLabels);
    }

    return () => {
      map.off('style.load', syncLabels);
    };
  }, [beforeLayerIds, colorScheme, isReady, labelLocale, mapRef, showAreaLabels, showPoiLabels, themeConfig]);
}
