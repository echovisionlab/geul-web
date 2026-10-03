import { describe, expect, it } from 'vitest';
import {
  buildBoundsFromViewport,
  clampMapViewportToZoomBounds,
  getDefaultMapViewport,
  getFullWorldZoomForDimensions,
  getResponsiveMapViewport,
  parseViewportFromQuery,
} from './viewport';

// Independent fixtures generated with installed MapLibre GL 6.4 MercatorTransform:
// resize(width, height, false), setZoom(zoom), setCenter(new LngLat(lng, lat)), getBounds().
// This is the transform used by Map.project, rather than this module's conversion math.
const MAPLIBRE_BOUNDS_FIXTURES = [
  {
    center: { lng: 15, lat: 20 },
    zoom: 3.25,
    width: 640,
    height: 360,
    bounds: { west: -8.650211679011221, south: 7.097518273221851, east: 38.65021167901028, north: 31.928595199123507 },
  },
  {
    center: { lng: 127.1, lat: 37.5 },
    zoom: 5,
    width: 960,
    height: 540,
    bounds: { west: 116.55312499999832, south: 32.64755338983181, east: 137.6468749999989, north: 42.05650457879895 },
  },
];

describe('MapLibre feature viewport coordinates', () => {
  it.each(MAPLIBRE_BOUNDS_FIXTURES)(
    'matches independent renderer bounds for $width × $height at zoom $zoom',
    ({ center, zoom, width, height, bounds }) => {
      const actual = buildBoundsFromViewport(center, zoom, width, height);
      expect(actual.west).toBeCloseTo(bounds.west, 8);
      expect(actual.east).toBeCloseTo(bounds.east, 8);
      expect(actual.south).toBeCloseTo(bounds.south, 8);
      expect(actual.north).toBeCloseTo(bounds.north, 8);
    },
  );

  it('fits the vertical world extent instead of cropping it to latitude 66.51 at the old zoom', () => {
    // MapLibre reference at 1280 × 720: old zoom 1.491853 -> ±66.513260443 latitude,
    // corrected zoom 0.491853 -> ±85.05112878, the full Web Mercator latitude extent.
    expect(getFullWorldZoomForDimensions(1280, 720)).toBeCloseTo(0.4918530963296747, 12);
    const viewport = getDefaultMapViewport('16:9');
    expect(viewport.bounds).toEqual({ west: -180, south: -85, east: 180, north: 85 });
    const mobile = getResponsiveMapViewport(viewport, 390, 219);
    expect(mobile.zoom).toBeCloseTo(-1.2252129403988266, 10);
    expect(mobile.bounds).toEqual({ west: -180, south: -85, east: 180, north: 85 });
  });

  it('keeps explicit zoom bounds and explicit query zoom while avoiding false full-world bounds', () => {
    const viewport = parseViewportFromQuery(
      'map',
      {
        pm_map_b: '-112.5,-66.513260443,112.5,66.513260443',
        pm_map_z: '1',
        pm_map_w: '640',
        pm_map_h: '512',
      },
      '16:9',
    );
    // MapLibre world width at zoom 1 is 1024px: this 640px viewport does not wrap.
    expect(viewport.zoom).toBe(1);
    expect(viewport.bounds.west).toBe(-112.5);
    expect(viewport.bounds.east).toBe(112.5);
    expect(viewport.bounds.north).toBeCloseTo(66.513260443, 8);
    expect(clampMapViewportToZoomBounds(getDefaultMapViewport('16:9'), { minZoom: 2, maxZoom: 18 }).zoom).toBe(2);
  });
  it('recomputes the actual renderer bounds when the world fit is constrained by min zoom', () => {
    const mobile = getResponsiveMapViewport(getDefaultMapViewport('16:9'), 390, 219);
    const clampedMobile = clampMapViewportToZoomBounds(mobile, { minZoom: 0, maxZoom: 18 });
    expect(clampedMobile.zoom).toBe(0);
    // Independent MapLibre getBounds at zoom 0, center [0,0], 390 × 219.
    expect(clampedMobile.bounds.west).toBeCloseTo(-137.109375, 8);
    expect(clampedMobile.bounds.east).toBeCloseTo(137.109375, 8);
    expect(clampedMobile.bounds.south).toBeCloseTo(-60.75915950227015, 8);
    expect(clampedMobile.bounds.north).toBeCloseTo(60.75915950226977, 8);
    const desktop = clampMapViewportToZoomBounds(getDefaultMapViewport('16:9'), { minZoom: 2, maxZoom: 18 });
    expect(desktop.bounds.west).toBeCloseTo(-112.5, 8);
    expect(desktop.bounds.east).toBeCloseTo(112.5, 8);
    expect(desktop.bounds.south).toBeCloseTo(-53.330872983017144, 8);
    expect(desktop.bounds.north).toBeCloseTo(53.33087298301635, 8);
  });
});
