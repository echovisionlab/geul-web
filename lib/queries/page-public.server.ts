import { cache } from 'react';
import { createPublicPageClient, createPublicPageClientWithAuth } from '@/lib/api/server-client';

type PublicPageClient = ReturnType<typeof createPublicPageClient>;
export type PublicPageGetResponse = Awaited<ReturnType<PublicPageClient['get']>>;

function normalizeRequestedLocale(requestedLocale: string | null | undefined): string | null {
  return requestedLocale?.trim() || null;
}

/**
 * Read a public Page by an already-decoded slug, memoized for the current React request.
 * The locale is part of the cache key so a source-locale fallback cannot affect another locale.
 */
const getPublicPageResponseCached = cache(
  async (decodedSlug: string, requestedLocale: string | null): Promise<PublicPageGetResponse> => {
    const client = requestedLocale ? await createPublicPageClientWithAuth(requestedLocale) : createPublicPageClient();
    return client.get({ slug: decodedSlug });
  },
);

export function getPublicPageResponse(
  decodedSlug: string,
  requestedLocale?: string | null,
): Promise<PublicPageGetResponse> {
  return getPublicPageResponseCached(decodedSlug, normalizeRequestedLocale(requestedLocale));
}
