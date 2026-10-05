'use client';

import { useCallback } from 'react';
import { listWorkMapFeatures } from '@/lib/queries/work-browser';
import type { WorkMapFeatureCluster, WorkMapFeatureItem, WorkMapFeatureResponse } from '@/lib/types/map/features';
import { ServerFeatureMapViewClient } from '../map-features/ServerFeatureMapViewClient';
import type { MapViewportRequest } from '../map-features/viewport';
import { buildWorkFeaturePlaces, buildWorkFeatureSourceData } from './data';

import type { WorkMapViewClientProps } from './ViewClient';

export function WorkMapViewClient({ primaryLabel, filters, ...props }: WorkMapViewClientProps) {
  const loadFeatures = useCallback(
    (viewport: MapViewportRequest) =>
      listWorkMapFeatures({
        viewport,
        types: filters.types,
        featuredOnly: filters.featuredOnly,
        sortBy: filters.sortBy,
        sortOrder: filters.sortOrder,
        requestedLocale: props.requestedLocale,
      }),
    [filters, props.requestedLocale],
  );
  const buildPlaces = useCallback(
    (items: WorkMapFeatureItem[]) => buildWorkFeaturePlaces(items, primaryLabel),
    [primaryLabel],
  );

  return (
    <ServerFeatureMapViewClient<WorkMapFeatureItem, WorkMapFeatureCluster, WorkMapFeatureResponse>
      {...props}
      queryScope="work-map-features"
      queryIdentity={filters}
      className="work-map-block"
      loadFeatures={loadFeatures}
      buildFeatureSource={buildWorkFeatureSourceData}
      buildPlaces={buildPlaces}
      getItemHref={getWorkHref}
    />
  );
}

function getWorkHref(item: WorkMapFeatureItem): string {
  return `/works/${item.primaryWorkSlug || item.primaryWorkId}`;
}
