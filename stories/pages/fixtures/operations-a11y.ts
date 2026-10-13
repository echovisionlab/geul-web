import { createTranslator } from 'next-intl';
import { DEFAULT_LOCALE, normalizeLocale } from '@/lib/i18n/locale';

/** Use the active production locale for semantic queries, including non-English previews. */
export async function operationsLabels(globals: { locale?: unknown }) {
  const locale = normalizeLocale(typeof globals.locale === 'string' ? globals.locale : undefined) ?? DEFAULT_LOCALE;
  const { default: messages } = await import(`../../../messages/${locale}.json`);
  return {
    common: createTranslator({ locale, messages, namespace: 'common' }),
    reorder: createTranslator({ locale, messages, namespace: 'pageEditor.a11y' }),
    menus: createTranslator({ locale, messages, namespace: 'adminList.menus' }),
    jobs: createTranslator({ locale, messages, namespace: 'translationJobsPage' }),
    providers: createTranslator({ locale, messages, namespace: 'translationSettingsPage' }),
    site: createTranslator({ locale, messages, namespace: 'adminSettings.site' }),
    og: createTranslator({ locale, messages, namespace: 'ogImageSettings' }),
    mail: createTranslator({ locale, messages, namespace: 'adminSettings.mail' }),
    mapTheme: createTranslator({ locale, messages, namespace: 'adminList.mapThemes.editor' }),
    map: createTranslator({ locale, messages, namespace: 'mapControls' }),
    dataTable: createTranslator({ locale, messages, namespace: 'dataTable' }),
  };
}
