import type { MapRendererPlace } from '@/features/map/types';
import type { listWorkMapFeatures } from '@/lib/queries/work-browser';
import { resolveMapPrimaryLabel, type MapPrimaryLabelValue } from '../constants';
import { buildClusterFeatureSource } from '../map-features/feature-source';

export type WorkMapFeatureResponse = Awaited<ReturnType<typeof listWorkMapFeatures>>;

export function buildWorkFeatureSourceData(response: WorkMapFeatureResponse) {
  return buildClusterFeatureSource(response.clusters);
}

export function buildWorkFeaturePlaces(
  items: WorkMapFeatureResponse['items'],
  primaryLabel: MapPrimaryLabelValue,
): MapRendererPlace[] {
  return items.map((item) => ({
    id: item.placeId,
    name: resolveMapPrimaryLabel(primaryLabel, item.primaryWorkTitle, item.name),
    address: item.address,
    lat: item.lat,
    lng: item.lng,
    href: `/works/${item.primaryWorkSlug || item.primaryWorkId}`,
  }));
}
