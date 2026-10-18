// @vitest-environment jsdom

import { renderToReadableStream } from 'react-dom/server.browser';
import { describe, expect, it, vi } from 'vitest';
import type { MapViewportRequest } from '../map-features/viewport';
import type { MapViewConfig } from '@/lib/types/map/model';
import { PostMapViewClient } from './ViewClient';
import { WorkMapViewClient } from '../work-map/ViewClient';

const mocks = vi.hoisted(() => ({
  postImports: 0,
  workImports: 0,
  listPost: vi.fn(async () => ({ clusters: [], items: [] })),
  listWork: vi.fn(async () => ({ clusters: [], items: [] })),
  received: [] as Array<Record<string, unknown>>,
}));

// Use App Router's actual lazy SSR implementation, rather than a synchronous loader mock.
vi.mock('next/dynamic', async () => {
  const { default: dynamic } = await vi.importActual<{ default: typeof import('next/dynamic').default }>(
    'next/dist/shared/lib/app-dynamic.js',
  );
  return { default: dynamic };
});
vi.mock('@/lib/queries/post-browser', () => {
  mocks.postImports += 1;
  return { listPostMapFeatures: mocks.listPost };
});
vi.mock('@/lib/queries/work-browser', () => {
  mocks.workImports += 1;
  return { listWorkMapFeatures: mocks.listWork };
});
vi.mock('../map-features/ServerFeatureMapViewClient', () => ({
  ServerFeatureMapViewClient: (props: Record<string, unknown>) => {
    mocks.received.push(props);
    return <section data-map-scope={props.queryScope as string}>{props.requestedLocale as string}</section>;
  },
}));

const viewport: MapViewportRequest = {
  bounds: { west: -180, south: -85, east: 180, north: 85 },
  zoom: 0.4918530963296747,
  widthPx: 1280,
  heightPx: 720,
  clusterRadiusPx: 56,
  minClusterPoints: 2,
};
const mapViewConfig = {
  center: { lat: 0, lng: 0 },
  zoom: viewport.zoom,
  places: [],
  theme: null,
} as unknown as MapViewConfig;
const initialFeatures = { clusters: [], items: [] };

describe('post/work map client runtime boundaries', () => {
  it('defers browser query modules until a used map while preserving default SSR and initial props', async () => {
    // Importing the public wrapper alone must leave both API descriptor ingress modules unloaded.
    expect(mocks.postImports).toBe(0);
    expect(mocks.workImports).toBe(0);
    const postFilters = { requirePlace: true, sortBy: 'published_at', sortOrder: 'desc' } as const;
    const workFilters = { featuredOnly: true, sortBy: 'title', sortOrder: 'asc' } as const;
    const stream = await renderToReadableStream(
      <>
        <PostMapViewClient
          sectionId="posts"
          mapViewConfig={mapViewConfig}
          initialViewport={viewport}
          initialFeatures={initialFeatures}
          requestedLocale="ko"
          primaryLabel="content_title"
          filters={postFilters}
        />
        <WorkMapViewClient
          sectionId="works"
          mapViewConfig={mapViewConfig}
          initialViewport={viewport}
          initialFeatures={initialFeatures}
          requestedLocale="en"
          primaryLabel="content_title"
          filters={workFilters}
        />
      </>,
    );
    await stream.allReady;
    const html = await new Response(stream).text();
    expect(html).toContain('data-map-scope="post-map-features"');
    expect(html).toContain('data-map-scope="work-map-features"');
    expect(mocks.postImports).toBe(1);
    expect(mocks.workImports).toBe(1);
    const post = mocks.received.find((props) => props.queryScope === 'post-map-features')!;
    const work = mocks.received.find((props) => props.queryScope === 'work-map-features')!;
    for (const props of [post, work]) {
      expect(props.mapViewConfig).toBe(mapViewConfig);
      expect(props.initialViewport).toBe(viewport);
      expect(props.initialFeatures).toBe(initialFeatures);
    }
    expect(post.queryIdentity).toBe(postFilters);
    expect(work.queryIdentity).toBe(workFilters);
    expect(mocks.listPost).not.toHaveBeenCalled();
    expect(mocks.listWork).not.toHaveBeenCalled();

    await (post.loadFeatures as (viewport: MapViewportRequest) => Promise<unknown>)(viewport);
    await (work.loadFeatures as (viewport: MapViewportRequest) => Promise<unknown>)(viewport);
    expect(mocks.listPost).toHaveBeenCalledWith(
      expect.objectContaining({ viewport, requestedLocale: 'ko', ...postFilters }),
    );
    expect(mocks.listWork).toHaveBeenCalledWith(
      expect.objectContaining({ viewport, requestedLocale: 'en', ...workFilters }),
    );
  });
});
