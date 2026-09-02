import { Suspense } from 'react';
import { resolvePublicMapThemeByIdAction } from '@/lib/actions/map-theme';
import { listWorkMapFeatures } from '@/lib/queries/work';
import { buildFeatureMapConfig, clampMapViewportToZoomBounds } from '../map-features/config';
import { getDefaultMapViewport } from '../map-features/viewport';
import { PostMapSkeleton } from '../post-map/Skeleton';
import type { BlockViewProps } from '../types';
import { parseWorkMapProps, parseWorkMapTypes } from './schema';
import { WorkMapViewClient } from './ViewClient';

async function WorkMapViewServer({ props, sectionId, requestedLocale }: BlockViewProps) {
  const p = parseWorkMapProps(props);

  const types = parseWorkMapTypes(p.workTypes);
  const featuredOnly = p.featuredOnly === 'true';
  const sortBy = (p.sortBy as 'published_at' | 'updated_at' | 'title') || 'published_at';
  const sortOrder = (p.sortOrder as 'asc' | 'desc') || 'desc';
  const rawInitialViewport = getDefaultMapViewport(p.aspectRatio);
  const initialViewport = clampMapViewportToZoomBounds(
    rawInitialViewport,
    buildFeatureMapConfig(p, null, rawInitialViewport),
  );

  const [initialFeatures, theme] = await Promise.all([
    listWorkMapFeatures({
      viewport: initialViewport,
      types,
      featuredOnly,
      sortBy,
      sortOrder,
      requestedLocale,
    }),
    p.themeId ? resolvePublicMapThemeByIdAction(p.themeId) : Promise.resolve(null),
  ]);
  const mapViewConfig = buildFeatureMapConfig(p, theme, initialViewport);

  return (
    <WorkMapViewClient
      sectionId={sectionId}
      mapViewConfig={mapViewConfig}
      initialViewport={initialViewport}
      initialFeatures={initialFeatures}
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

export function WorkMapViewStreaming(props: BlockViewProps) {
  return (
    <Suspense fallback={<PostMapSkeleton />}>
      <WorkMapViewServer {...props} />
    </Suspense>
  );
}
