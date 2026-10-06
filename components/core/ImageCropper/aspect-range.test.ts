import { describe, expect, it } from 'vitest';
import type { PercentCrop } from 'react-image-crop';
import { clampToAspectRange } from './aspect-range';

const range = { min: 9 / 16, max: 16 / 9 };

describe('crop aspect range', () => {
  it.each([
    [1000, 1000, { x: 0, y: 90, width: 80, height: 5 }],
    [1000, 1000, { x: 90, y: 90, width: 10, height: 1 }],
    [600, 1800, { x: 80, y: 60, width: 20, height: 40 }],
    [2400, 600, { x: 60, y: 80, width: 40, height: 20 }],
  ])('keeps an edge selection in bounds and within range on a %sx%s image', (width, height, selection) => {
    const crop = clampToAspectRange({ unit: '%', ...selection } as PercentCrop, width, height, range);
    const aspect = (crop.width * width) / (crop.height * height);

    expect(aspect).toBeGreaterThanOrEqual(range.min - 1e-10);
    expect(aspect).toBeLessThanOrEqual(range.max + 1e-10);
    expect(crop.x).toBe(selection.x);
    expect(crop.y).toBe(selection.y);
    expect(crop.x + crop.width).toBeLessThanOrEqual(100 + 1e-10);
    expect(crop.y + crop.height).toBeLessThanOrEqual(100 + 1e-10);
  });

  it('reduces width when the bottom edge leaves too little height', () => {
    const crop = clampToAspectRange({ unit: '%', x: 0, y: 90, width: 80, height: 5 }, 1000, 1000, range);
    expect(crop.height).toBe(10);
    expect(crop.width).toBeCloseTo((10 * 16) / 9);
  });

  it('preserves selections already within range', () => {
    const crop: PercentCrop = { unit: '%', x: 40, y: 40, width: 50, height: 50 };
    expect(clampToAspectRange(crop, 1000, 1000, range)).toBe(crop);
  });
});
