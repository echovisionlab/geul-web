import { Suspense } from 'react';
import { resolvePublicMapThemeByIdAction } from '@/lib/actions/map-theme';
import { listPostMapFeatures } from '@/lib/queries/post';
import type { BlockViewProps } from '../types';
import { parsePostMapProps } from './schema';
import { buildPostMapConfig, clampPostMapViewportToZoomBounds } from './shared';
import { PostMapSkeleton } from './Skeleton';
import { PostMapViewClient } from './ViewClient';
import { getDefaultPostMapViewport } from './viewport';

async function PostMapViewServer({ props, sectionId, requestedLocale }: BlockViewProps) {
  const p = parsePostMapProps(props);

  const categoryIds = p.categoryIds ? p.categoryIds.split(',').filter(Boolean) : undefined;
  const tagIds = p.tagIds ? p.tagIds.split(',').filter(Boolean) : undefined;
  const authorIds = p.authorIds ? p.authorIds.split(',').filter(Boolean) : undefined;
  const seriesId = p.seriesId || undefined;
  const sortBy = (p.sortBy as 'published_at' | 'updated_at' | 'title') || 'published_at';
  const sortOrder = (p.sortOrder as 'asc' | 'desc') || 'desc';
  const rawInitialViewport = getDefaultPostMapViewport(p.aspectRatio);
  const initialViewport = clampPostMapViewportToZoomBounds(
    rawInitialViewport,
    buildPostMapConfig(p, null, rawInitialViewport),
  );

  const [initialFeatures, theme] = await Promise.all([
    listPostMapFeatures({
      viewport: initialViewport,
      categoryIds,
      tagIds,
      authorIds,
      seriesId,
      requirePlace: p.requirePlace !== 'false',
      sortBy,
      sortOrder,
      requestedLocale,
    }),
    p.themeId ? resolvePublicMapThemeByIdAction(p.themeId) : Promise.resolve(null),
  ]);
  const mapViewConfig = buildPostMapConfig(p, theme, initialViewport);

  return (
    <PostMapViewClient
      sectionId={sectionId}
      mapViewConfig={mapViewConfig}
      initialViewport={initialViewport}
      initialFeatures={initialFeatures}
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

export function PostMapViewStreaming(props: BlockViewProps) {
  return (
    <Suspense fallback={<PostMapSkeleton />}>
      <PostMapViewServer {...props} />
    </Suspense>
  );
}
