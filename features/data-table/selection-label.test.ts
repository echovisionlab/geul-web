import { describe, expect, it } from 'vitest';
import { formatSelectedCountLabel } from './selection-label';

describe('formatSelectedCountLabel', () => {
  it('formats Korean selected counts', () => {
    expect(formatSelectedCountLabel('ko', 3)).toBe('3개 선택');
  });

  it('uses the English fallback for other locales', () => {
    expect(formatSelectedCountLabel('en', 2)).toBe('2 selected');
    expect(formatSelectedCountLabel('ja', 1)).toBe('1 selected');
  });
});
