import { FilterOp, SortOrder } from '@echovisionlab/geul-proto/common/common_pb.ts';
import { describe, expect, it } from 'vitest';
import {
  buildPostMapFeatureRequest,
  buildWorkMapFeatureRequest,
  mapPostMapFeatureResponse,
  mapWorkMapFeatureResponse,
} from './map-features';

const viewport = {
  bounds: { west: 120, south: 30, east: 130, north: 40 },
  zoom: 8,
  widthPx: 300.4,
  heightPx: 200.6,
  clusterRadiusPx: 40.2,
  minClusterPoints: 2.6,
};

describe('map feature request builders', () => {
  it('builds the complete post request and preserves map-place precedence', () => {
    const request = buildPostMapFeatureRequest({
      viewport,
      categoryIds: ['category-1'],
      tagIds: ['tag-1'],
      authorIds: ['author-1'],
      seriesId: 'series-1',
      mapPlaceIds: ['place-1'],
      requirePlace: true,
      sortBy: 'updated_at',
      sortOrder: 'desc',
    });

    expect(request.viewport).toEqual({
      ...viewport,
      widthPx: 300,
      heightPx: 201,
      clusterRadiusPx: 40,
      minClusterPoints: 3,
    });
    expect(request.filters).toMatchObject([
      { field: 'category_id', op: FilterOp.IN, values: ['category-1'] },
      { field: 'tag_id', op: FilterOp.IN, values: ['tag-1'] },
      { field: 'author_id', op: FilterOp.IN, values: ['author-1'] },
      { field: 'series_id', op: FilterOp.EQ, value: 'series-1' },
      { field: 'map_place_id', op: FilterOp.IN, values: ['place-1'] },
    ]);
    expect(request.sorts).toMatchObject([{ field: 'published_at', order: SortOrder.DESC }]);
  });

  it('builds the required-place filter and ascending post sort defaults', () => {
    const request = buildPostMapFeatureRequest({ viewport, requirePlace: true, sortBy: 'title' });

    expect(request.filters).toMatchObject([{ field: 'map_place_id', op: FilterOp.IS_NOT_NULL }]);
    expect(request.sorts).toMatchObject([{ field: 'title', order: SortOrder.ASC }]);
    expect(buildPostMapFeatureRequest({ viewport })).toMatchObject({ filters: [], sorts: [] });
  });

  it('builds work filters and descending sort defaults', () => {
    const request = buildWorkMapFeatureRequest({
      viewport,
      types: ['portfolio', 'article'],
      featuredOnly: true,
      sortBy: 'title',
    });

    expect(request.filters).toMatchObject([
      { field: 'type', op: FilterOp.IN, values: ['WORK_TYPE_PORTFOLIO', 'WORK_TYPE_ARTICLE'] },
      { field: 'featured', op: FilterOp.EQ, value: 'true' },
    ]);
    expect(request.sorts).toMatchObject([{ field: 'title', order: SortOrder.DESC }]);
    expect(buildWorkMapFeatureRequest({ viewport, sortBy: 'published_at', sortOrder: 'asc' }).sorts).toMatchObject([
      { field: 'published_at', order: SortOrder.ASC },
    ]);
    expect(buildWorkMapFeatureRequest({ viewport })).toMatchObject({ filters: [], sorts: [] });
  });
});

describe('map feature response mappers', () => {
  it('maps post features and supplies nullable and coordinate fallbacks', () => {
    expect(
      mapPostMapFeatureResponse({
        clusters: [{ id: 'cluster-1', lat: 37, lng: 127, placeCount: 2, postCount: 5 }],
        items: [
          {
            placeId: 'place-1',
            name: 'Place',
            address: 'Seoul',
            lat: 37.5,
            lng: 127.1,
            postCount: 1,
            primaryPostId: 'post-1',
            primaryPostTitle: 'Post',
          },
        ],
      }),
    ).toEqual({
      clusters: [
        {
          id: 'cluster-1',
          lat: 37,
          lng: 127,
          placeCount: 2,
          postCount: 5,
          minBreakoutZoom: null,
          bounds: { west: 127, south: 37, east: 127, north: 37 },
        },
      ],
      items: [
        {
          placeId: 'place-1',
          name: 'Place',
          address: 'Seoul',
          lat: 37.5,
          lng: 127.1,
          postCount: 1,
          primaryPostId: 'post-1',
          primaryPostSlug: null,
          primaryPostTitle: 'Post',
        },
      ],
    });
  });

  it('maps work features with provided cluster metadata', () => {
    expect(
      mapWorkMapFeatureResponse({
        clusters: [
          {
            id: 'cluster-1',
            lat: 37,
            lng: 127,
            placeCount: 2,
            workCount: 3,
            minBreakoutZoom: 11,
            bounds: { west: 126, south: 36, east: 128, north: 38 },
          },
        ],
        items: [
          {
            placeId: 'place-1',
            name: 'Place',
            address: 'Seoul',
            lat: 37.5,
            lng: 127.1,
            workCount: 1,
            primaryWorkId: 'work-1',
            primaryWorkSlug: 'work',
            primaryWorkTitle: 'Work',
          },
        ],
      }),
    ).toMatchObject({
      clusters: [{ minBreakoutZoom: 11, bounds: { west: 126, south: 36, east: 128, north: 38 } }],
      items: [{ primaryWorkSlug: 'work' }],
    });
    expect(mapPostMapFeatureResponse({})).toEqual({ clusters: [], items: [] });
    expect(mapWorkMapFeatureResponse({})).toEqual({ clusters: [], items: [] });
  });
});
