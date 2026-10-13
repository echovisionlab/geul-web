import { createTranslator } from 'next-intl';
import { DEFAULT_LOCALE, normalizeLocale } from '@/lib/i18n/locale';

/** Play queries follow the toolbar locale and production messages; authored fixture content keeps its language. */
export async function publicAccessibilityLabels(globals: { locale?: unknown }) {
  const locale = normalizeLocale(typeof globals.locale === 'string' ? globals.locale : undefined) ?? DEFAULT_LOCALE;
  const { default: messages } = await import(`../../messages/${locale}.json`);
  return createTranslator({ locale, messages });
}
