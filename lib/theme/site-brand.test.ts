import { describe, expect, it } from 'vitest';
import { DEFAULT_SITE_BRAND_COLOR, normalizeSiteBrandColor, siteBrandStyle } from './site-brand';

describe('site brand theme', () => {
  it('keeps the admin brand color separate from interaction colors', () => {
    expect(normalizeSiteBrandColor(' #A12B34 ')).toBe('#A12B34');
    expect(siteBrandStyle('#123456')).toEqual({ '--geul-brand-color': '#123456' });
  });

  it('falls back to the Geul brand red for absent or malformed projections', () => {
    expect(normalizeSiteBrandColor(null)).toBe(DEFAULT_SITE_BRAND_COLOR);
    expect(normalizeSiteBrandColor('red')).toBe(DEFAULT_SITE_BRAND_COLOR);
  });
});
