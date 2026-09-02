import { getRequestConfig } from 'next-intl/server';
import { getMessagesForLocale } from '@/lib/i18n/messages';
import { resolveRequestTimeZone } from '@/lib/i18n/request-time-zone';
import { getRequestLocaleContext } from '@/lib/utils/language.server';
import { getSession } from '@/lib/utils/session.server';

export default getRequestConfig(async () => {
  // This app does not use locale-prefixed routes yet.
  // Use the shared request resolver so SSR and client hydration agree on the same locale.
  const [localeContext, session] = await Promise.all([getRequestLocaleContext(), getSession()]);

  return {
    locale: localeContext.locale,
    messages: await getMessagesForLocale(localeContext.locale),
    timeZone: resolveRequestTimeZone(session?.geo?.timeZone),
  };
});
