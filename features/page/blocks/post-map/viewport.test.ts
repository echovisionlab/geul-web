import { describe, expect, it } from 'vitest';
import {
  buildBoundsFromViewport,
  buildFeatureSourceData,
  getCenterFromBounds,
  getClusterRadiusPxForZoom,
  getDefaultPostMapViewport,
  getFullWorldZoomForDimensions,
  getResponsivePostMapViewport,
  parseViewportFromQuery,
  stripViewportSearchParams,
  writeViewportToSearchParams,
} from './viewport';

describe('post-map viewport normalization', () => {
  it('uses full-world longitude for default world view', () => {
    const viewport = getDefaultPostMapViewport('16:9');

    expect(viewport.zoom).toBeCloseTo(getFullWorldZoomForDimensions(1280, 720), 3);
    expect(viewport.bounds.west).toBe(-180);
    expect(viewport.bounds.south).toBe(-85);
    expect(viewport.bounds.east).toBe(180);
    expect(viewport.bounds.north).toBe(85);
  });

  it('normalizes wrapped world-view query bounds back to full-world longitude', () => {
    const viewport = parseViewportFromQuery(
      'section-1',
      {
        'pm_section-1_b': '-54.67106,-61.14290,54.67106,61.64470',
        'pm_section-1_z': '1.50',
        'pm_section-1_w': '1888',
        'pm_section-1_h': '630',
        'pm_section-1_r': '56',
        'pm_section-1_m': '2',
      },
      '16:9',
    );

    expect(viewport.bounds.west).toBe(-180);
    expect(viewport.bounds.east).toBe(180);
    expect(viewport.bounds.south).toBeCloseTo(-61.1429);
    expect(viewport.bounds.north).toBeCloseTo(61.6447);
  });

  it('writes full-world longitude for world-wrapping viewports', () => {
    const params = writeViewportToSearchParams(new URLSearchParams(), 'section-1', {
      bounds: {
        west: -54.67106,
        south: -61.1429,
        east: 54.67106,
        north: 61.6447,
      },
      zoom: 1.5,
      widthPx: 1888,
      heightPx: 630,
      clusterRadiusPx: 56,
      minClusterPoints: 2,
    });

    expect(params.get('pm_section-1_b')).toBe('-180.00000,-61.14290,180.00000,61.64470');
  });

  it('removes legacy viewport query params from the URL', () => {
    const params = new URLSearchParams(
      'foo=bar&pm_section-1_b=-180.00000%2C-85.00000%2C180.00000%2C85.00000&pm_section-1_z=1.49',
    );

    expect(stripViewportSearchParams(params).toString()).toBe('foo=bar');
  });

  it('fits world-view zoom to the measured width', () => {
    const desktopViewport = getDefaultPostMapViewport('16:9');
    const responsiveViewport = getResponsivePostMapViewport(desktopViewport, 390, 219);

    expect(desktopViewport.zoom).toBeCloseTo(getFullWorldZoomForDimensions(1280, 720), 3);
    expect(responsiveViewport.zoom).toBeCloseTo(getFullWorldZoomForDimensions(390, 219), 3);
    expect(responsiveViewport.bounds.west).toBe(-180);
    expect(responsiveViewport.bounds.south).toBe(-85);
    expect(responsiveViewport.bounds.east).toBe(180);
    expect(responsiveViewport.bounds.north).toBe(85);
    expect(responsiveViewport.widthPx).toBe(390);
    expect(responsiveViewport.heightPx).toBe(219);
  });

  it('uses a smaller cluster radius on narrow mobile widths', () => {
    expect(getClusterRadiusPxForZoom(1.5, 390)).toBeLessThan(getClusterRadiusPxForZoom(1.5, 1280));
    expect(getClusterRadiusPxForZoom(5, 390)).toBeLessThan(getClusterRadiusPxForZoom(5, 1280));
  });

  it('falls back to desktop cluster sizing when viewport width has not been measured yet', () => {
    expect(getClusterRadiusPxForZoom(1.5, 0)).toBe(56);
    expect(getClusterRadiusPxForZoom(9, 0)).toBe(14);
  });

  it('restores the original mercator center from viewport bounds', () => {
    const bounds = buildBoundsFromViewport({ lat: 20, lng: 15 }, 3.25, 640, 360);
    const center = getCenterFromBounds(bounds);

    expect(center.lat).toBeCloseTo(20, 5);
    expect(center.lng).toBeCloseTo(15, 5);
  });

  it('keeps only cluster features in map source data and leaves item rendering to callouts', () => {
    const source = buildFeatureSourceData({
      clusters: [
        {
          id: 'cluster-1',
          lat: 10,
          lng: 20,
          placeCount: 3,
          postCount: 3,
          bounds: { west: 19, south: 9, east: 21, north: 11 },
        },
      ],
      items: [
        {
          placeId: 'place-1',
          name: 'Seoul',
          address: 'Seoul',
          lat: 37.5,
          lng: 127,
          postCount: 1,
          primaryPostId: 'post-1',
          primaryPostSlug: null,
          primaryPostTitle: 'Post 1',
        },
      ],
    });

    expect(source.features).toHaveLength(1);
    expect(source.features[0]?.properties).toMatchObject({
      kind: 'cluster',
      id: 'cluster-1',
      count: 3,
    });
  });
});
