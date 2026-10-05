'use client';

import dynamic from 'next/dynamic';
import type { listWorkMapFeatures } from '@/lib/queries/work-browser';
import type { MapViewConfig } from '@/lib/types/map/model';
import type { WorkType } from '@/lib/types/work/model';
import type { MapViewportRequest } from '../map-features/viewport';
import type { WorkMapProps } from './schema';

export interface WorkMapViewClientProps {
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

// SSR remains enabled so initial map data and theme keep their server-rendered content.
const RuntimeView = dynamic(() => import('./ViewClientRuntime').then((module) => module.WorkMapViewClient));

export function WorkMapViewClient(props: WorkMapViewClientProps) {
  return <RuntimeView {...props} />;
}
