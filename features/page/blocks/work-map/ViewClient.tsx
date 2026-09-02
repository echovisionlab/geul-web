'use client';

import { useCallback } from 'react';
import { listWorkMapFeatures } from '@/lib/queries/work-browser';
import type { WorkMapFeatureCluster, WorkMapFeatureItem, WorkMapFeatureResponse } from '@/lib/types/map/features';
import type { MapViewConfig } from '@/lib/types/map/model';
import type { WorkType } from '@/lib/types/work/model';
import { ServerFeatureMapViewClient } from '../map-features/ServerFeatureMapViewClient';
import type { MapViewportRequest } from '../map-features/viewport';
import { buildWorkFeaturePlaces, buildWorkFeatureSourceData } from './data';
import type { WorkMapProps } from './schema';

interface WorkMapViewClientProps {
  sectionId?: string;
  mapViewConfig: MapViewConfig;
  initialViewport: MapViewportRequest;
  initialFeatures?: Awaited<ReturnType<typeof listWorkMapFeatures>>;
  requestedLocale?: string;
  primaryLabel: NonNullable<WorkMapProps['primaryLabel']>;
  filters: {
    types?: WorkType[];
    featuredOnly: boolean;
    sortBy: NonNullable<WorkMapProps['sortBy']>;
    sortOrder: NonNullable<WorkMapProps['sortOrder']>;
  };
}

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
