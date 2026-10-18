import { describe, expect, it } from 'vitest';
import { getThemeDefinition, normalizeThemeId } from './themes';

describe('review theme registry', () => {
  it('rejects unknown and prototype-derived URL values rather than exposing an arbitrary theme', () => {
    for (const value of [undefined, null, '', 'sepia', 'LIGHT', 'constructor', '__proto__', {}]) {
      expect(normalizeThemeId(value)).toBe('light');
      expect(getThemeDefinition(value).id).toBe('light');
    }
    expect(normalizeThemeId('unknown', 'dark')).toBe('dark');
    expect(normalizeThemeId('ocean-dark')).toBe('ocean-dark');
  });
});
