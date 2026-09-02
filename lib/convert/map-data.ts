/**
 * Map data utilities for embedding place/theme data
 *
 * Shared by both Post (HTML injection) and Page (JSON props enrichment)
 */
import { JSDOM } from 'jsdom';
import { getPublicMapPlacesByIdsAction } from '@/lib/actions/map-place';
import { resolvePublicMapThemesByIdsAction } from '@/lib/actions/map-theme';
import type { MapViewConfig, MapViewPlace, MapViewTheme } from '@/lib/types/map/model';
import { mapThemeToViewTheme } from '@/lib/utils/map-theme';

// ============================================================================
// Shared Utilities
// ============================================================================

/**
 * Fetch places by IDs and convert to MapViewPlace format
 */
async function fetchMapViewPlaces(
  placeIds: string[],
  requestedLocale?: string | null,
): Promise<Map<string, MapViewPlace>> {
  if (placeIds.length === 0) {
    return new Map();
  }

  const placesData = await getPublicMapPlacesByIdsAction(placeIds, requestedLocale);
  const placesMap = new Map<string, MapViewPlace>();

  for (const place of placesData) {
    placesMap.set(place.id, {
      id: place.id,
      name: place.name,
      address: place.address,
      lat: place.lat,
      lng: place.lng,
      addressComponents: place.addressComponents ?? undefined,
    });
  }

  return placesMap;
}

/**
 * Fetch themes by IDs and convert to MapViewTheme format (batch query)
 */
async function fetchMapViewThemes(themeIds: string[]): Promise<Map<string, MapViewTheme>> {
  if (themeIds.length === 0) {
    return new Map();
  }

  const themesData = await resolvePublicMapThemesByIdsAction(themeIds);
  const themesMap = new Map<string, MapViewTheme>();

  for (const result of themesData) {
    themesMap.set(result.requestedThemeId, mapThemeToViewTheme(result.theme));
  }

  return themesMap;
}

// ============================================================================
// Post-specific: HTML Injection
// ============================================================================

function parseBool(value: string | null, defaultValue: boolean): boolean {
  if (value === null || value === '') {
    return defaultValue;
  }
  return value === 'true';
}

function parseNum(value: string | null, defaultValue: number): number {
  if (value === null || value === '') {
    return defaultValue;
  }
  const num = parseFloat(value);
  return isNaN(num) ? defaultValue : num;
}

function extractConfigFromElement(element: Element): {
  placeIds: string[];
  themeId: string | null;
  caption: string | null;
  partialConfig: Omit<MapViewConfig, 'places' | 'theme'>;
} {
  const mapPlaceIds = element.getAttribute('data-map-place-ids') || '';
  const placeIds = mapPlaceIds.split(',').filter((id) => id.trim());

  const rawThemeId = element.getAttribute('data-theme-id');
  const themeId = rawThemeId === null || rawThemeId === '' ? null : rawThemeId;

  // Caption: try data-caption, then figcaption sibling
  const caption =
    element.getAttribute('data-caption') || element.parentElement?.querySelector('figcaption')?.textContent || null;

  const centerLat = parseNum(element.getAttribute('data-center-lat'), 0);
  const centerLng = parseNum(element.getAttribute('data-center-lng'), 0);

  const partialConfig: Omit<MapViewConfig, 'places' | 'theme'> = {
    center: { lat: centerLat, lng: centerLng },
    zoom: parseNum(element.getAttribute('data-zoom'), 15),
    minZoom: parseNum(element.getAttribute('data-min-zoom'), -2),
    maxZoom: parseNum(element.getAttribute('data-max-zoom'), 22),
    pitch: parseNum(element.getAttribute('data-pitch'), 0),
    bearing: parseNum(element.getAttribute('data-bearing'), 0),
    aspectRatio: (element.getAttribute('data-aspect-ratio') || '16:9') as '16:9' | '4:3' | '1:1',
    previewWidth: element.getAttribute('data-preview-width')
      ? parseNum(element.getAttribute('data-preview-width'), 0)
      : undefined,
    draggable: parseBool(element.getAttribute('data-draggable'), true),
    zoomable: parseBool(element.getAttribute('data-zoomable'), true),
    rotatable: parseBool(element.getAttribute('data-rotatable'), false),
    tiltable: parseBool(element.getAttribute('data-tiltable'), false),
    pinClickable: parseBool(element.getAttribute('data-pin-clickable'), true),
    autoRotate: parseBool(element.getAttribute('data-auto-rotate'), false),
    autoRotateSpeed: parseNum(element.getAttribute('data-auto-rotate-speed'), 1),
    showDirections: parseBool(element.getAttribute('data-show-directions'), true),
    show3DBuildings: parseBool(element.getAttribute('data-show-3d-buildings'), false),
    preferredScheme: (element.getAttribute('data-preferred-scheme') || 'auto') as 'auto' | 'light' | 'dark',
    areaLabelsMode: (element.getAttribute('data-area-labels-mode') || 'inherit') as 'inherit' | 'show' | 'hide',
    poiLabelsMode: (element.getAttribute('data-poi-labels-mode') || 'inherit') as 'inherit' | 'show' | 'hide',
  };

  return { placeIds, themeId, caption, partialConfig };
}

function removeOldAttributes(element: Element): void {
  const attributesToRemove = [
    'data-map-place-ids',
    'data-aspect-ratio',
    'data-preview-width',
    'data-zoom',
    'data-min-zoom',
    'data-max-zoom',
    'data-draggable',
    'data-zoomable',
    'data-rotatable',
    'data-tiltable',
    'data-pin-clickable',
    'data-center-lat',
    'data-center-lng',
    'data-pitch',
    'data-bearing',
    'data-show-3d-buildings',
    'data-auto-rotate',
    'data-auto-rotate-speed',
    'data-show-directions',
    'data-theme-id',
    'data-preferred-scheme',
    'data-area-labels-mode',
    'data-poi-labels-mode',
    'data-caption',
  ];

  for (const attr of attributesToRemove) {
    element.removeAttribute(attr);
  }
}

/**
 * Inject map data into HTML by replacing data-* attributes with embedded JSON
 *
 * Used by Post conversion to embed place/theme data in HTML.
 */
export async function injectMapData(html: string, requestedLocale?: string | null): Promise<string> {
  if (!html.includes('class="map-block"')) {
    return html;
  }

  const dom = new JSDOM(html);
  const document = dom.window.document;
  const mapBlocks = document.querySelectorAll('.map-block[data-map-place-ids]');

  if (mapBlocks.length === 0) {
    return html;
  }

  // Collect all place IDs and theme IDs for batch fetching
  const allPlaceIds = new Set<string>();
  const allThemeIds = new Set<string>();
  const elementConfigs: Array<{
    element: Element;
    placeIds: string[];
    themeId: string | null;
    partialConfig: Omit<MapViewConfig, 'places' | 'theme'>;
  }> = [];

  mapBlocks.forEach((element) => {
    const { placeIds, themeId, partialConfig } = extractConfigFromElement(element);
    // Note: caption is preserved in HTML structure (figcaption), not in JSON config

    if (placeIds.length === 0) {
      return;
    }

    placeIds.forEach((id) => allPlaceIds.add(id));
    if (themeId) {
      allThemeIds.add(themeId);
    }

    elementConfigs.push({ element, placeIds, themeId, partialConfig });
  });

  if (elementConfigs.length === 0) {
    return html;
  }

  // Batch fetch
  const [placesMap, themesMap] = await Promise.all([
    fetchMapViewPlaces(Array.from(allPlaceIds), requestedLocale),
    fetchMapViewThemes(Array.from(allThemeIds)),
  ]);

  // Process each element
  for (const { element, placeIds, themeId, partialConfig } of elementConfigs) {
    const places: MapViewPlace[] = [];
    for (const id of placeIds) {
      const place = placesMap.get(id);
      if (place) {
        places.push(place);
      }
    }

    if (places.length === 0) {
      continue;
    }

    let center = partialConfig.center;
    if (center.lat === 0 && center.lng === 0) {
      center = { lat: places[0].lat, lng: places[0].lng };
    }

    const config: MapViewConfig = {
      ...partialConfig,
      center,
      places,
      theme: themeId ? (themesMap.get(themeId) ?? null) : null,
    };

    removeOldAttributes(element);
    element.setAttribute('data-map-view-config', JSON.stringify(config));
  }

  // Return only body innerHTML, not full document
  return document.body.innerHTML;
}
