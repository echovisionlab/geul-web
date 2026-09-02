import { describe, expect, it } from 'vitest';
import { getClusterLayerSizing } from './cluster-style';

describe('getClusterLayerSizing', () => {
  it('keeps desktop cluster sizes on wide viewports', () => {
    expect(getClusterLayerSizing(1280)).toEqual({
      circleRadii: [52, 64, 78, 94],
      textSizes: [13, 14, 15, 16],
    });
  });

  it('shrinks cluster circles and labels on tablet widths', () => {
    const tablet = getClusterLayerSizing(640);

    expect(tablet.circleRadii).toEqual([45, 55, 67, 81]);
    expect(tablet.textSizes).toEqual([12, 13, 14, 15]);
  });

  it('uses the smallest cluster sizing on narrow mobile widths', () => {
    const mobile = getClusterLayerSizing(390);

    expect(mobile.circleRadii).toEqual([37, 46, 56, 68]);
    expect(mobile.textSizes).toEqual([12, 13, 14, 15]);
  });
});
