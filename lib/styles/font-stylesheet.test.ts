import { describe, expect, it } from 'vitest';
import type { LocaleFontProfile } from '@/lib/i18n/locale';
import { buildFontStylesheetHref } from './font-stylesheet';

const PROFILE_FAMILY: Record<LocaleFontProfile, string | null> = {
  latin: null,
  korean: 'Noto+Sans+KR',
  japanese: 'Noto+Sans+JP',
  'chinese-simplified': 'Noto+Sans+SC',
  'chinese-traditional': 'Noto+Sans+TC',
  arabic: 'Noto+Sans+Arabic',
};

const LOCALE_FAMILIES = ['Noto+Sans+KR', 'Noto+Sans+JP', 'Noto+Sans+SC', 'Noto+Sans+TC', 'Noto+Sans+Arabic'] as const;

describe('buildFontStylesheetHref', () => {
  it.each(Object.entries(PROFILE_FAMILY) as Array<[LocaleFontProfile, string | null]>)(
    'requests only the base and %s profile font families',
    (profile, expectedLocaleFamily) => {
      const href = buildFontStylesheetHref('https://cdn.example.com/', profile);

      expect(href.startsWith('https://cdn.example.com/fonts/css2?')).toBe(true);
      expect(href).toContain('family=Noto+Sans:wght@100..900');
      expect(href).toContain('family=Noto+Sans+Mono:wght@100..900');
      expect(href).toContain('family=Noto+Color+Emoji');
      expect(href.endsWith('&display=swap')).toBe(true);

      for (const localeFamily of LOCALE_FAMILIES) {
        if (localeFamily === expectedLocaleFamily) {
          expect(href).toContain(`family=${localeFamily}:wght@100..900`);
        } else {
          expect(href).not.toContain(`family=${localeFamily}:wght@100..900`);
        }
      }
    },
  );
});
