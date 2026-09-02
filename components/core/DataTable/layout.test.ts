import { describe, expect, it } from 'vitest';
import { getReservedTableContentMinHeight } from './layout';

describe('getReservedTableContentMinHeight', () => {
  it('returns undefined when the reserved row count is missing or invalid', () => {
    expect(getReservedTableContentMinHeight()).toBeUndefined();
    expect(getReservedTableContentMinHeight(0)).toBeUndefined();
    expect(getReservedTableContentMinHeight(-2)).toBeUndefined();
    expect(getReservedTableContentMinHeight(Number.NaN)).toBeUndefined();
  });

  it('returns a stable content height based on the reserved row count', () => {
    expect(getReservedTableContentMinHeight(1)).toBe(104);
    expect(getReservedTableContentMinHeight(10)).toBe(644);
    expect(getReservedTableContentMinHeight(10.2)).toBe(704);
  });
});
