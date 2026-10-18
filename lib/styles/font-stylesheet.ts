import type { LocaleFontProfile } from '@/lib/i18n/locale';
import { geulFontStylesheets } from './geul-fonts.generated';

export function buildFontStylesheetHref(fontBaseUrl: string, fontProfile: LocaleFontProfile): string {
  return `${fontBaseUrl.replace(/\/+$/, '')}/${geulFontStylesheets[fontProfile]}`;
}
