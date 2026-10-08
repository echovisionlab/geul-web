import { getLocale } from 'next-intl/server';
import { ApplicationErrorPage } from '@/features/application-error/ApplicationErrorPage';
import { DEFAULT_LOCALE, normalizeLocale } from '@/lib/i18n/locale';

export default async function NotFound() {
  const locale = normalizeLocale(await getLocale()) ?? DEFAULT_LOCALE;
  return <ApplicationErrorPage status={404} locale={locale} />;
}
