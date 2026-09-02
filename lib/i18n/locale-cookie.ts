import { LOCALE_COOKIE_NAME, normalizeLocale, type SupportedLocale } from './locale';

export function readLocaleCookie(cookieHeader: string): SupportedLocale | null {
  const match = cookieHeader
    .split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${LOCALE_COOKIE_NAME}=`));

  if (!match) {
    return null;
  }

  return normalizeLocale(decodeURIComponent(match.slice(LOCALE_COOKIE_NAME.length + 1)));
}

export function writeLocaleCookie(locale: SupportedLocale) {
  if (typeof document === 'undefined') {
    return;
  }

  const secure = window.location.protocol === 'https:' ? '; Secure' : '';
  document.cookie = `${LOCALE_COOKIE_NAME}=${encodeURIComponent(locale)}; Path=/; Max-Age=${60 * 60 * 24 * 365}; SameSite=Lax${secure}`;
}
