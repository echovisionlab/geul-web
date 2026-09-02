import { describe, expect, it } from 'vitest';
import { theme } from '@/theme';
import { DEFAULT_SITE_BRAND_COLOR, normalizeSiteBrandColor, siteBrandStyle } from './site-brand';

describe('site brand theme', () => {
  it('keeps Mantine interaction primary blue and all text families on CDN Noto variables', () => {
    expect(theme.primaryColor).toBe('blue');
    expect(theme.fontFamily).toBe('var(--font-family-sans), sans-serif');
    expect(theme.fontFamilyMonospace).toBe('var(--font-mono), monospace');
    expect(theme.headings?.fontFamily).toBe('var(--font-family-sans), sans-serif');
  });

  it('keeps the admin brand color separate from Mantine interaction colors', () => {
    expect(normalizeSiteBrandColor(' #A12B34 ')).toBe('#A12B34');
    expect(siteBrandStyle('#123456')).toEqual({ '--geul-brand-color': '#123456' });
  });

  it('falls back to the Geul brand red for absent or malformed projections', () => {
    expect(normalizeSiteBrandColor(null)).toBe(DEFAULT_SITE_BRAND_COLOR);
    expect(normalizeSiteBrandColor('red')).toBe(DEFAULT_SITE_BRAND_COLOR);
  });
});
