import { describe, expect, it } from 'vitest';
import { normalizeMeshOptimizationTargetRatioPercent } from './mesh-optimization';

describe('mesh optimization types', () => {
  it('normalizes target mesh ratio to a clamped one-percent integer', () => {
    expect(normalizeMeshOptimizationTargetRatioPercent(71.2)).toBe(71);
    expect(normalizeMeshOptimizationTargetRatioPercent(71.6)).toBe(72);
    expect(normalizeMeshOptimizationTargetRatioPercent(0)).toBe(1);
    expect(normalizeMeshOptimizationTargetRatioPercent(1)).toBe(1);
    expect(normalizeMeshOptimizationTargetRatioPercent(101)).toBe(100);
    expect(normalizeMeshOptimizationTargetRatioPercent(Number.NaN)).toBe(70);
  });
});
