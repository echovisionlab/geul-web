import { cache } from 'react';
import { createPublicPageClient, createPublicPageClientWithAuth } from '@/lib/api/server-client';

type PublicPageClient = ReturnType<typeof createPublicPageClient>;
export type PublicPageGetResponse = Awaited<ReturnType<PublicPageClient['get']>>;
export type PublicPageAuthPolicy = 'public' | 'authenticated';

function normalizeRequestedLocale(requestedLocale: string | null | undefined): string | null {
  return requestedLocale?.trim() || null;
}

/**
 * Read a public Page by an already-decoded slug, memoized for the current React request.
 * Locale and auth policy are cache keys: source-locale fallbacks and anonymous
 * reads must not replace responses obtained with the request's optional auth.
 */
const getPublicPageResponseCached = cache(
  async (
    decodedSlug: string,
    requestedLocale: string | null,
    authPolicy: PublicPageAuthPolicy,
  ): Promise<PublicPageGetResponse> => {
    const client =
      authPolicy === 'authenticated' ? await createPublicPageClientWithAuth(requestedLocale) : createPublicPageClient();
    return client.get({ slug: decodedSlug });
  },
);

export function getPublicPageResponse(
  decodedSlug: string,
  requestedLocale?: string | null,
  authPolicy?: PublicPageAuthPolicy,
): Promise<PublicPageGetResponse> {
  const locale = normalizeRequestedLocale(requestedLocale);
  // Existing metadata/home callers use optional auth only for an explicit locale.
  return getPublicPageResponseCached(decodedSlug, locale, authPolicy ?? (locale ? 'authenticated' : 'public'));
}
