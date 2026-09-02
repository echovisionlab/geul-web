import { normalizeLocale } from '@/lib/i18n/locale';

export interface MenuTranslationItem {
  id: string;
  label: string;
  linkType: string;
  url?: string;
  targetId?: string;
  targetSlug?: string;
  openInNewTab?: boolean;
  localizationMode?: 'translated' | 'fixed_locale';
  fixedLocale?: string;
  visibility?: {
    mode: string;
    roles?: string[];
  };
  children?: MenuTranslationItem[];
}

export function isMenuItemLabelApplicableToLocale(item: MenuTranslationItem, locale: string): boolean {
  if (item.localizationMode !== 'fixed_locale' && !item.fixedLocale) {
    return true;
  }
  const normalizedLocale = normalizeLocale(locale);
  const normalizedFixedLocale = normalizeLocale(item.fixedLocale ?? null);
  return normalizedLocale && normalizedFixedLocale
    ? normalizedLocale === normalizedFixedLocale
    : Boolean(item.fixedLocale && item.fixedLocale === locale);
}
