import 'server-only';

import { cookies } from 'next/headers';
import Negotiator from 'negotiator';
import {
  LOCALE_COOKIE_NAME,
  resolveRequestedLocale,
  type ResolvedRequestedLocale,
  type ResolveRequestedLocaleInput,
  type SupportedLocale,
} from '@/lib/i18n/locale';
import { getRequestHeaders } from './header.server';
import { getSession } from './session.server';

/**
 * Resolve the current request locale from route, authenticated user preference,
 * locale cookie, and Accept-Language headers.
 */
export async function getRequestLocaleContext(
  input: Omit<ResolveRequestedLocaleInput, 'acceptLanguages' | 'cookieLocale'> & {
    cookieLocale?: string | null;
  } = {},
): Promise<ResolvedRequestedLocale> {
  const headersList = await getRequestHeaders();
  const acceptLanguage = headersList.get('accept-language');
  const cookieStore = await cookies();
  const session = input.userPreferenceLocale === undefined ? await getSession().catch(() => null) : null;
  const userPreferenceLocale =
    input.userPreferenceLocale === undefined ? (session?.user?.preferred_locale ?? null) : input.userPreferenceLocale;

  const acceptLanguages = acceptLanguage
    ? new Negotiator({
        headers: { 'accept-language': acceptLanguage },
      }).languages()
    : [];

  return resolveRequestedLocale({
    routeLocale: input.routeLocale,
    userPreferenceLocale,
    cookieLocale: input.cookieLocale ?? cookieStore.get(LOCALE_COOKIE_NAME)?.value ?? null,
    acceptLanguages,
  });
}

/**
 * Get the locale used to render the current request.
 */
export async function getUserLocale(): Promise<SupportedLocale> {
  const resolvedLocale = await getRequestLocaleContext();
  return resolvedLocale.locale;
}
