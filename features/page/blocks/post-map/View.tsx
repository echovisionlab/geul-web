'use client';

import { useQuery } from '@tanstack/react-query';
import { resolvePublicMapThemeByIdAction } from '@/lib/actions/map-theme';
import type { BlockViewProps } from '../types';
import { parsePostMapProps } from './schema';
import { buildPostMapConfig, clampPostMapViewportToZoomBounds } from './shared';
import { PostMapSkeleton } from './Skeleton';
import { PostMapViewClient } from './ViewClient';
import { getDefaultPostMapViewport } from './viewport';

export function PostMapView({ props, sectionId, requestedLocale }: BlockViewProps) {
  const p = parsePostMapProps(props);

  const categoryIds = p.categoryIds ? p.categoryIds.split(',').filter(Boolean) : undefined;
  const tagIds = p.tagIds ? p.tagIds.split(',').filter(Boolean) : undefined;
  const authorIds = p.authorIds ? p.authorIds.split(',').filter(Boolean) : undefined;
  const seriesId = p.seriesId || undefined;
  const sortBy = (p.sortBy as 'published_at' | 'updated_at' | 'title') || 'published_at';
  const sortOrder = (p.sortOrder as 'asc' | 'desc') || 'desc';
  const rawInitialViewport = getDefaultPostMapViewport(p.aspectRatio);

  const themeQuery = useQuery({
    queryKey: ['mapTheme', p.themeId],
    queryFn: () => resolvePublicMapThemeByIdAction(p.themeId),
    enabled: Boolean(p.themeId),
  });

  if (!!p.themeId && themeQuery.isLoading) {
    return <PostMapSkeleton />;
  }

  const mapViewConfig = buildPostMapConfig(p, themeQuery.data ?? null, rawInitialViewport);
  const initialViewport = clampPostMapViewportToZoomBounds(rawInitialViewport, mapViewConfig);

  return (
    <PostMapViewClient
      sectionId={sectionId}
      mapViewConfig={mapViewConfig}
      initialViewport={initialViewport}
      requestedLocale={requestedLocale}
      primaryLabel={p.primaryLabel}
      filters={{
        categoryIds,
        tagIds,
        authorIds,
        seriesId,
        requirePlace: p.requirePlace !== 'false',
        sortBy,
        sortOrder,
      }}
    />
  );
}
