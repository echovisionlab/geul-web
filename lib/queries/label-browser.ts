import { createLabelClient } from '@/lib/api/browser-client';
import { createClientLogger, serializeClientLogError } from '@/lib/utils/client-logger';
import { themedAssetRefUrl } from '@/lib/utils/asset-ref';

const logger = createClientLogger('label-browser');

// ============================================
// Client Component queries for Label domain
// ============================================

// Simple list for selectors (published only)
export async function listLabelsForSelector() {
  try {
    const client = createLabelClient();
    const response = await client.listLabels({
      pagination: { limit: 100, offset: 0 },
    });
    return (response.labels ?? []).map((l) => ({
      id: l.id,
      name: l.name,
      slug: l.slug ?? null,
      imageUrl: themedAssetRefUrl(l.imageLightAsset, l.imageDarkAsset),
      imageLightUrl: l.imageLightAsset?.url ?? null,
      imageDarkUrl: l.imageDarkAsset?.url ?? null,
    }));
  } catch (err) {
    logger.error('Failed to list labels', { error: serializeClientLogError(err) });
    return [];
  }
}

export async function checkLabelSlugAvailable(slug: string, excludeLabelId?: string) {
  try {
    const client = createLabelClient();
    const response = await client.checkLabelSlugAvailable({
      slug,
      excludeLabelId,
    });
    return { available: response.available };
  } catch (err) {
    logger.error('Failed to check slug', { error: serializeClientLogError(err) });
    return { available: false };
  }
}
