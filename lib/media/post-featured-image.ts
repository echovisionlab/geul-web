import type { MediaDelivery } from '@echovisionlab/geul-proto/common/media_pb.ts';

export function resolveFeaturedImageDeliveryUrl(delivery?: MediaDelivery): string | null {
  return delivery?.thumbnail?.url || delivery?.asset?.url || delivery?.inline?.url || null;
}

export const resolvePostFeaturedImageUrl = resolveFeaturedImageDeliveryUrl;
