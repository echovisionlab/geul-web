import type { PostMapFeatureResponse } from '@/lib/types/map/features';
import { buildClusterFeatureSource } from '../map-features/feature-source';

export * from '../map-features/viewport';
export {
  getDefaultMapViewport as getDefaultPostMapViewport,
  getResponsiveMapViewport as getResponsivePostMapViewport,
} from '../map-features/viewport';
export type {
  MapViewportBounds as PostMapBounds,
  MapViewportRequest as PostMapViewportRequest,
} from '../map-features/viewport';
export type { PostMapFeatureCluster, PostMapFeatureItem, PostMapFeatureResponse } from '@/lib/types/map/features';

export function buildFeatureSourceData(response: PostMapFeatureResponse) {
  return buildClusterFeatureSource(response.clusters);
}
