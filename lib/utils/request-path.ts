export interface RequestHeaderSource {
  get: (name: string) => string | null;
}

export type SearchParamRecord = Record<string, string | string[] | undefined>;

function normalizeSearch(search: string | null): string {
  if (!search) {
    return '';
  }

  return search.startsWith('?') ? search : `?${search}`;
}

export function getRequestPathnameFromHeaders(headersList: RequestHeaderSource, fallback: string): string {
  const pathname = headersList.get('x-pathname')?.trim();
  if (pathname && pathname.startsWith('/')) {
    return pathname;
  }

  return fallback;
}

export function getRequestPathWithSearchFromHeaders(headersList: RequestHeaderSource, fallback: string): string {
  const direct = headersList.get('x-path-with-search')?.trim();
  if (direct && direct.startsWith('/')) {
    return direct;
  }

  const pathname = getRequestPathnameFromHeaders(headersList, fallback);
  const search = normalizeSearch(headersList.get('x-search'));
  return `${pathname}${search}`;
}

export function buildSearchSuffix(searchParams: SearchParamRecord): string {
  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(searchParams)) {
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

  const search = params.toString();
  return search ? `?${search}` : '';
}
