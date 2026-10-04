import { cache } from 'react';
import { createPublicWorkClientWithAuth } from '@/lib/api/server-client';

type PublicWorkClient = Awaited<ReturnType<typeof createPublicWorkClientWithAuth>>;
export type PublicWorkGetResponse = Awaited<ReturnType<PublicWorkClient['get']>>;

/**
 * Share ordinary Work reads within the current React request. The decoded slug
 * and normalized locale identify the response; optional authentication remains
 * unchanged even without an explicit locale. Token/password reads stay outside.
 */
const getPublicWorkResponseCached = cache(
  async (decodedSlug: string, requestedLocale: string | null): Promise<PublicWorkGetResponse> => {
    const client = await createPublicWorkClientWithAuth(requestedLocale);
    return client.get({ slug: decodedSlug });
  },
);

export function getPublicWorkResponse(
  decodedSlug: string,
  requestedLocale?: string | null,
): Promise<PublicWorkGetResponse> {
  return getPublicWorkResponseCached(decodedSlug, requestedLocale?.trim() || null);
}
