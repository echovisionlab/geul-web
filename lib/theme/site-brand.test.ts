import { describe, expect, it } from 'vitest';
import { theme } from '@/theme';
import { primitiveTokens } from '@/components/core/design-tokens';
import { DEFAULT_SITE_BRAND_COLOR, normalizeSiteBrandColor, siteBrandInk, siteBrandStyle } from './site-brand';

describe('site brand theme', () => {
  it('keeps interaction primary neutral and all text families on CDN Noto variables', () => {
    expect(Object.values(primitiveTokens.colors.neutral)).toContain(theme.light['action-primary']);
    expect(theme.fontFamily).toBe('var(--font-family-sans), sans-serif');
    expect(theme.fontFamilyMonospace).toBe('var(--font-mono), monospace');
    expect(theme.headings?.fontFamily).toBe('var(--font-family-sans), sans-serif');
  });

  it('keeps the admin brand color separate from interaction colors', () => {
    expect(normalizeSiteBrandColor(' #A12B34 ')).toBe('#A12B34');
    expect(siteBrandStyle('#123456')).toEqual({ '--geul-brand-color': '#123456', '--geul-brand-ink': '#ffffff' });
  });

  it('picks the higher-contrast text color for the configured brand fill', () => {
    expect(siteBrandInk(DEFAULT_SITE_BRAND_COLOR)).toBe('#ffffff');
    expect(siteBrandInk('#1b1b19')).toBe('#ffffff');
    expect(siteBrandInk('#f5d547')).toBe('#1b1b19');
    expect(siteBrandStyle('#ffffff')['--geul-brand-ink']).toBe('#1b1b19');
  });

  it('falls back to the Geul brand red for absent or malformed projections', () => {
    expect(normalizeSiteBrandColor(null)).toBe(DEFAULT_SITE_BRAND_COLOR);
    expect(normalizeSiteBrandColor('red')).toBe(DEFAULT_SITE_BRAND_COLOR);
  });
});
