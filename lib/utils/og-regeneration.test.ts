import { describe, expect, it } from 'vitest';
import { normalizeOgRegenerationLocale } from './og-regeneration';

describe('normalizeOgRegenerationLocale', () => {
  it('keeps manual regeneration unavailable until an active locale is resolved', () => {
    expect(normalizeOgRegenerationLocale(null)).toBeNull();
    expect(normalizeOgRegenerationLocale(undefined)).toBeNull();
    expect(normalizeOgRegenerationLocale('   ')).toBeNull();
  });

  it('returns the normalized active locale for a scoped regeneration', () => {
    expect(normalizeOgRegenerationLocale(' ko ')).toBe('ko');
  });
});
