import { createPageClient } from '@/lib/api/browser-client';
import { getPageSlugValidationReason, type PageSlugValidationReason } from '@/lib/utils/page-route';

export type PageSlugAvailabilityReason = PageSlugValidationReason | 'alreadyExists' | 'checkFailed';

export interface PageSlugAvailabilityResult {
  available: boolean;
  reason?: PageSlugAvailabilityReason;
}

/**
 * Check if a page slug is available.
 */
export async function checkPageSlugAvailable(
  slug: string,
  excludePageId?: string,
): Promise<PageSlugAvailabilityResult> {
  const validationReason = getPageSlugValidationReason(slug);
  try {
    const client = createPageClient();
    const response = await client.checkPageSlugAvailable({
      slug,
      excludeId: excludePageId,
    });
    if (response.available) {
      return { available: true };
    }
    return { available: false, reason: validationReason ?? 'alreadyExists' };
  } catch {
    return { available: false, reason: validationReason ?? 'checkFailed' };
  }
}
