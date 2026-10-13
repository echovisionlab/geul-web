import { createTranslator } from 'next-intl';
import { DEFAULT_LOCALE, normalizeLocale } from '@/lib/i18n/locale';

/** Semantic play queries use the same active production messages as the rendered page. */
export async function accountAccessibilityLabels(globals: { locale?: unknown }) {
  const locale = normalizeLocale(typeof globals.locale === 'string' ? globals.locale : undefined) ?? DEFAULT_LOCALE;
  const { default: messages } = await import(`../../messages/${locale}.json`);
  return {
    common: createTranslator({ locale, messages, namespace: 'common' }),
    nickname: createTranslator({ locale, messages, namespace: 'nicknameField' }),
  };
}
