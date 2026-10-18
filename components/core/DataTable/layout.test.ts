import { describe, expect, it } from 'vitest';
import { getReservedTableContentMinHeight } from './layout';

function reserved(rowCount: number): number {
  const height = getReservedTableContentMinHeight(rowCount);
  if (height === undefined) {
    throw new Error(`expected a reserved height for ${rowCount} rows`);
  }
  return height;
}

describe('getReservedTableContentMinHeight', () => {
  it('returns undefined when the reserved row count is missing or invalid', () => {
    expect(getReservedTableContentMinHeight()).toBeUndefined();
    expect(getReservedTableContentMinHeight(0)).toBeUndefined();
    expect(getReservedTableContentMinHeight(-2)).toBeUndefined();
    expect(getReservedTableContentMinHeight(Number.NaN)).toBeUndefined();
  });

  it('reserves a whole row for a fractional row count', () => {
    expect(reserved(10.2)).toBe(reserved(11));
  });

  it('grows by the same positive row height per row on top of a header', () => {
    const rowStep = reserved(2) - reserved(1);
    expect(rowStep).toBeGreaterThan(0);
    for (let rowCount = 1; rowCount < 10; rowCount += 1) {
      expect(reserved(rowCount + 1) - reserved(rowCount)).toBe(rowStep);
    }
    expect(reserved(1)).toBeGreaterThan(rowStep);
  });
});
