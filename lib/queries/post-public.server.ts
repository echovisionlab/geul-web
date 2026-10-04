import { cache } from 'react';
import { createPublicPostClientWithAuth } from '@/lib/api/server-client';

type PublicPostClient = Awaited<ReturnType<typeof createPublicPostClientWithAuth>>;
export type PublicPostGetResponse = Awaited<ReturnType<PublicPostClient['get']>>;

/**
 * Share ordinary Post reads within the current React request. The decoded slug
 * and normalized locale identify the response; optional authentication remains
 * unchanged even without an explicit locale. Token/password reads stay outside.
 */
const getPublicPostResponseCached = cache(
  async (decodedSlug: string, requestedLocale: string | null): Promise<PublicPostGetResponse> => {
    const client = await createPublicPostClientWithAuth(requestedLocale);
    return client.get({ slug: decodedSlug });
  },
);

export function getPublicPostResponse(
  decodedSlug: string,
  requestedLocale?: string | null,
): Promise<PublicPostGetResponse> {
  return getPublicPostResponseCached(decodedSlug, requestedLocale?.trim() || null);
}
