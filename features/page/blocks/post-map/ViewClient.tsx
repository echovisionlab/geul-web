'use client';

import dynamic from 'next/dynamic';
import type { PostMapFeatureResponse } from '@/lib/types/map/features';
import type { MapViewConfig } from '@/lib/types/map/model';
import type { PostMapProps } from './schema';
import type { PostMapViewportRequest } from './viewport';

export interface PostMapViewClientProps {
  sectionId?: string;
  mapViewConfig: MapViewConfig;
  initialViewport: PostMapViewportRequest;
  initialFeatures?: PostMapFeatureResponse;
  requestedLocale?: string;
  primaryLabel: NonNullable<PostMapProps['primaryLabel']>;
  filters: {
    categoryIds?: string[];
    tagIds?: string[];
    authorIds?: string[];
    seriesId?: string;
    requirePlace: boolean;
    sortBy: NonNullable<PostMapProps['sortBy']>;
    sortOrder: NonNullable<PostMapProps['sortOrder']>;
  };
}

// SSR remains enabled so initial map data and theme keep their server-rendered content.
const RuntimeView = dynamic(() => import('./ViewClientRuntime').then((module) => module.PostMapViewClient));

export function PostMapViewClient(props: PostMapViewClientProps) {
  return <RuntimeView {...props} />;
}
