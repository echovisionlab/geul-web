import { DEFAULT_LOCALE, normalizeLocale, type SupportedLocale } from '@/lib/i18n/locale';

export const CONTENT_LANGUAGE_QUERY_PARAM = 'lang';

type QueryLike = Record<string, string | string[] | undefined> | undefined;

function getQueryValue(query: QueryLike, key: string): string | null {
  const value = query?.[key];
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }
  return typeof value === 'string' ? value : null;
}

export function readContentLocaleOverride(query: QueryLike): SupportedLocale | null {
  return normalizeLocale(getQueryValue(query, CONTENT_LANGUAGE_QUERY_PARAM));
}

export function resolveContentRequestedLocale(
  routeOrRequestLocale: string | null | undefined,
  query: QueryLike,
): SupportedLocale {
  return readContentLocaleOverride(query) ?? normalizeLocale(routeOrRequestLocale) ?? DEFAULT_LOCALE;
}

export function buildContentLanguageHref(
  pathname: string,
  query: QueryLike,
  options: {
    requestedLocale?: string | null;
  },
): string {
  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(query ?? {})) {
    if (key === 'view' || key === CONTENT_LANGUAGE_QUERY_PARAM) {
      continue;
    }

    if (Array.isArray(value)) {
      for (const item of value) {
        if (typeof item === 'string') {
          params.append(key, item);
        }
      }
      continue;
    }

    if (typeof value === 'string') {
      params.set(key, value);
    }
  }

  const requestedLocale = normalizeLocale(options.requestedLocale);
  if (requestedLocale) {
    params.set(CONTENT_LANGUAGE_QUERY_PARAM, requestedLocale);
  }

  const search = params.toString();
  return search ? `${pathname}?${search}` : pathname;
}
