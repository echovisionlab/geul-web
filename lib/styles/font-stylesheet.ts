import type { LocaleFontProfile } from '@/lib/i18n/locale';

const PROFILE_FONT_FAMILY: Partial<Record<LocaleFontProfile, string>> = {
  korean: 'Noto+Sans+KR:wght@100..900',
  japanese: 'Noto+Sans+JP:wght@100..900',
  'chinese-simplified': 'Noto+Sans+SC:wght@100..900',
  'chinese-traditional': 'Noto+Sans+TC:wght@100..900',
  arabic: 'Noto+Sans+Arabic:wght@100..900',
};

const BASE_FONT_FAMILIES = ['Noto+Sans:wght@100..900', 'Noto+Sans+Mono:wght@100..900', 'Noto+Color+Emoji'] as const;

export function buildFontStylesheetHref(cdnUrl: string, fontProfile: LocaleFontProfile): string {
  const profileFamily = PROFILE_FONT_FAMILY[fontProfile];
  const families = profileFamily
    ? [BASE_FONT_FAMILIES[0], profileFamily, ...BASE_FONT_FAMILIES.slice(1)]
    : BASE_FONT_FAMILIES;
  const baseUrl = cdnUrl.replace(/\/+$/, '');
  const familyQuery = families.map((family) => `family=${family}`).join('&');

  return `${baseUrl}/fonts/css2?${familyQuery}&display=swap`;
}
