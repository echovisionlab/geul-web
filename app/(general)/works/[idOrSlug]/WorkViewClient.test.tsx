import { describe, expect, it } from 'vitest';
import { formatWorkPeriodLabel } from '@/lib/utils/work-period';

describe('formatWorkPeriodLabel', () => {
  it('shows a single month when from and until are the same', () => {
    expect(formatWorkPeriodLabel(2024, 7, 2024, 7, false)).toBe('2024.07');
  });

  it('shows a closed range when until differs from from', () => {
    expect(formatWorkPeriodLabel(2024, 7, 2025, 2, false)).toBe('2024.07 - 2025.02');
  });

  it('shows present when the work is ongoing', () => {
    expect(formatWorkPeriodLabel(2024, 7, null, null, true)).toBe('2024.07 - Ongoing');
  });
});
