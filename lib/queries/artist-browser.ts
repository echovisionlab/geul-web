import { createArtistClient } from '@/lib/api/browser-client';
import { createClientLogger, serializeClientLogError } from '@/lib/utils/client-logger';

const logger = createClientLogger('artist-browser');

export async function checkArtistSlugAvailable(
  slug: string,
  excludeArtistId?: string,
): Promise<{ available: boolean }> {
  try {
    const client = createArtistClient();
    const response = await client.checkArtistSlugAvailable({
      slug,
      excludeArtistId,
    });
    return { available: response.available };
  } catch (err) {
    logger.error('Failed to check artist slug', { error: serializeClientLogError(err) });
    return { available: false };
  }
}
