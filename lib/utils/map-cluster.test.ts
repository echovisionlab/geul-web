import { describe, expect, it } from 'vitest';
import { getMapClusterRadiusPxForZoom } from './map-cluster';

describe('map-cluster spec', () => {
  it('shrinks the viewport cluster radius on narrower widths and higher zooms', () => {
    expect(getMapClusterRadiusPxForZoom(1.5, 390)).toBeLessThan(getMapClusterRadiusPxForZoom(1.5, 1280));
    expect(getMapClusterRadiusPxForZoom(5, 390)).toBeLessThan(getMapClusterRadiusPxForZoom(5, 1280));
    expect(getMapClusterRadiusPxForZoom(9, 1280)).toBeLessThan(getMapClusterRadiusPxForZoom(2, 1280));
  });

  it('uses exact mobile, tablet, and desktop breakpoint radii', () => {
    expect(getMapClusterRadiusPxForZoom(1.5, 480)).toBe(36);
    expect(getMapClusterRadiusPxForZoom(1.5, 768)).toBe(46);
    expect(getMapClusterRadiusPxForZoom(1.5, 769)).toBe(56);
    expect(getMapClusterRadiusPxForZoom(9, 480)).toBe(18);
    expect(getMapClusterRadiusPxForZoom(9, 768)).toBe(20);
    expect(getMapClusterRadiusPxForZoom(9, 769)).toBe(14);
  });

  it('falls back to the shared desktop default when width is zero or negative', () => {
    expect(getMapClusterRadiusPxForZoom(1.5, 0)).toBe(56);
    expect(getMapClusterRadiusPxForZoom(1.5, -200)).toBe(56);
    expect(getMapClusterRadiusPxForZoom(9, 0)).toBe(14);
  });
});
