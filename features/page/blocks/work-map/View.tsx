'use client';

import { useQuery } from '@tanstack/react-query';
import { resolvePublicMapThemeByIdAction } from '@/lib/actions/map-theme';
import { buildFeatureMapConfig, clampMapViewportToZoomBounds } from '../map-features/config';
import { getDefaultMapViewport } from '../map-features/viewport';
import { PostMapSkeleton } from '../post-map/Skeleton';
import type { BlockViewProps } from '../types';
import { parseWorkMapProps, parseWorkMapTypes } from './schema';
import { WorkMapViewClient } from './ViewClient';

export function WorkMapView({ props, sectionId, requestedLocale }: BlockViewProps) {
  const p = parseWorkMapProps(props);

  const types = parseWorkMapTypes(p.workTypes);
  const featuredOnly = p.featuredOnly === 'true';
  const sortBy = (p.sortBy as 'published_at' | 'updated_at' | 'title') || 'published_at';
  const sortOrder = (p.sortOrder as 'asc' | 'desc') || 'desc';
  const rawInitialViewport = getDefaultMapViewport(p.aspectRatio);

  const themeQuery = useQuery({
    queryKey: ['mapTheme', p.themeId],
    queryFn: () => resolvePublicMapThemeByIdAction(p.themeId),
    enabled: Boolean(p.themeId),
  });

  if (p.themeId && themeQuery.isLoading) {
    return <PostMapSkeleton />;
  }

  const mapViewConfig = buildFeatureMapConfig(p, themeQuery.data ?? null, rawInitialViewport);
  const initialViewport = clampMapViewportToZoomBounds(rawInitialViewport, mapViewConfig);

  return (
    <WorkMapViewClient
      sectionId={sectionId}
      mapViewConfig={mapViewConfig}
      initialViewport={initialViewport}
      requestedLocale={requestedLocale}
      primaryLabel={p.primaryLabel}
      filters={{
        types,
        featuredOnly,
        sortBy,
        sortOrder,
      }}
    />
  );
}
