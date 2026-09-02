import type { MapRendererPlace } from '@/features/map/types';
import { resolveMapPrimaryLabel, type MapPrimaryLabelValue } from '../constants';
import type { PostMapFeatureResponse } from './viewport';

export function buildPostFeaturePlaces(
  items: PostMapFeatureResponse['items'],
  primaryLabel: MapPrimaryLabelValue,
): MapRendererPlace[] {
  return items.map((item) => ({
    id: item.placeId,
    name: resolveMapPrimaryLabel(primaryLabel, item.primaryPostTitle, item.name),
    address: item.address,
    lat: item.lat,
    lng: item.lng,
    href: `/posts/${item.primaryPostSlug || item.primaryPostId}`,
  }));
}
