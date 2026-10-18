import { describe, expect, it } from 'vitest';

import { PAGINATION_PAGE_SIZES, formatPaginationFooter, resolvePaginationLayout } from './pagination';

describe('pagination layout', () => {
  it('resolves page chrome for every supported orientation without persisting it', () => {
    const portrait = resolvePaginationLayout({
      enabled: true,
      pageSize: 'LETTER',
      orientation: 'portrait',
      headerText: 'Geul · Post',
      footerText: 'Preview',
    });
    const landscape = resolvePaginationLayout({
      enabled: true,
      pageSize: 'LETTER',
      orientation: 'landscape',
      headerText: 'Geul · Post',
      footerText: 'Preview',
    });

    expect(portrait).toEqual(expect.objectContaining({ width: 816, height: 1056 }));
    expect(landscape).toEqual(expect.objectContaining({ width: 1056, height: 816 }));
    expect(landscape.headerText).toBe('Geul · Post');
    expect(landscape.footerText).toBe('Preview');
    expect(formatPaginationFooter('', 2, 7)).toBe('2 / 7');
    expect(formatPaginationFooter('Preview', 2, 7)).toBe('Preview · 2 / 7');

    for (const pageSize of Object.keys(PAGINATION_PAGE_SIZES) as Array<keyof typeof PAGINATION_PAGE_SIZES>) {
      const preset = PAGINATION_PAGE_SIZES[pageSize];
      expect(resolvePaginationLayout({ enabled: true, pageSize, orientation: 'portrait' })).toEqual(
        expect.objectContaining({ width: preset.width, height: preset.height }),
      );
      expect(resolvePaginationLayout({ enabled: true, pageSize, orientation: 'landscape' })).toEqual(
        expect.objectContaining({ width: preset.height, height: preset.width }),
      );
    }
  });
});
