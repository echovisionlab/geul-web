'use client';

import { useCallback } from 'react';
import { listPostMapFeatures } from '@/lib/queries/post-browser';
import type { PostMapFeatureCluster, PostMapFeatureItem, PostMapFeatureResponse } from '@/lib/types/map/features';
import { ServerFeatureMapViewClient } from '../map-features/ServerFeatureMapViewClient';
import { buildPostFeaturePlaces } from './data';
import { buildFeatureSourceData, type PostMapViewportRequest } from './viewport';

import type { PostMapViewClientProps } from './ViewClient';

export function PostMapViewClient({ primaryLabel, filters, ...props }: PostMapViewClientProps) {
  const loadFeatures = useCallback(
    (viewport: PostMapViewportRequest) =>
      listPostMapFeatures({
        viewport,
        categoryIds: filters.categoryIds,
        tagIds: filters.tagIds,
        authorIds: filters.authorIds,
        seriesId: filters.seriesId,
        requirePlace: filters.requirePlace,
        sortBy: filters.sortBy,
        sortOrder: filters.sortOrder,
        requestedLocale: props.requestedLocale,
      }),
    [filters, props.requestedLocale],
  );
  const buildPlaces = useCallback(
    (items: PostMapFeatureItem[]) => buildPostFeaturePlaces(items, primaryLabel),
    [primaryLabel],
  );

  return (
    <ServerFeatureMapViewClient<PostMapFeatureItem, PostMapFeatureCluster, PostMapFeatureResponse>
      {...props}
      queryScope="post-map-features"
      queryIdentity={filters}
      className="post-map-block"
      loadFeatures={loadFeatures}
      buildFeatureSource={buildFeatureSourceData}
      buildPlaces={buildPlaces}
      getItemHref={getPostHref}
    />
  );
}

function getPostHref(item: PostMapFeatureItem): string {
  return `/posts/${item.primaryPostSlug || item.primaryPostId}`;
}
