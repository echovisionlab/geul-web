const DOMAIN_PATTERN = /^[a-z0-9.-]+\.[a-z]{2,}(?:[:/]|$)/i;

/**
 * Resolve the runtime site origin into a navigable href.
 * Falls back to "/" when not configured.
 */
export function resolveSiteHref(siteOrigin?: string | null): string {
  const trimmed = siteOrigin?.trim();
  if (!trimmed) {
    return '/';
  }

  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed;
  }

  if (trimmed.startsWith('//')) {
    return `https:${trimmed}`;
  }

  if (trimmed.startsWith('/')) {
    return trimmed;
  }

  if (DOMAIN_PATTERN.test(trimmed)) {
    return `https://${trimmed}`;
  }

  return trimmed;
}
