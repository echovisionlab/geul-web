import { create } from '@bufbuild/protobuf';
import { FilterOp, FilterSpecSchema, SortOrder, SortSpecSchema } from '@echovisionlab/geul-proto/common/common_pb.ts';
import type {
  MapFeatureBounds,
  MapFeatureViewportRequest,
  PostMapFeatureResponse,
  WorkMapFeatureResponse,
} from '@/lib/types/map/features';
import { WORK_TYPE_FILTER_VALUES, type WorkType } from '@/lib/types/work/model';

type MapFeatureSortField = 'published_at' | 'updated_at' | 'title';
type MapFeatureSortOrder = 'asc' | 'desc';

export interface PostMapFeatureRequestInput {
  viewport: MapFeatureViewportRequest;
  categoryIds?: string[];
  tagIds?: string[];
  authorIds?: string[];
  seriesId?: string;
  mapPlaceIds?: string[];
  requirePlace?: boolean;
  sortBy?: MapFeatureSortField;
  sortOrder?: MapFeatureSortOrder;
}

export interface WorkMapFeatureRequestInput {
  viewport: MapFeatureViewportRequest;
  types?: WorkType[];
  featuredOnly?: boolean;
  sortBy?: MapFeatureSortField;
  sortOrder?: MapFeatureSortOrder;
}

function buildViewport(viewport: MapFeatureViewportRequest) {
  return {
    bounds: { ...viewport.bounds },
    zoom: viewport.zoom,
    widthPx: Math.round(viewport.widthPx),
    heightPx: Math.round(viewport.heightPx),
    clusterRadiusPx: Math.round(viewport.clusterRadiusPx),
    minClusterPoints: Math.round(viewport.minClusterPoints),
  };
}

export function buildPostMapFeatureRequest(input: PostMapFeatureRequestInput) {
  const filters = [];

  if (input.categoryIds?.length) {
    filters.push(create(FilterSpecSchema, { field: 'category_id', op: FilterOp.IN, values: input.categoryIds }));
  }
  if (input.tagIds?.length) {
    filters.push(create(FilterSpecSchema, { field: 'tag_id', op: FilterOp.IN, values: input.tagIds }));
  }
  if (input.authorIds?.length) {
    filters.push(create(FilterSpecSchema, { field: 'author_id', op: FilterOp.IN, values: input.authorIds }));
  }
  if (input.seriesId) {
    filters.push(create(FilterSpecSchema, { field: 'series_id', op: FilterOp.EQ, value: input.seriesId }));
  }
  if (input.mapPlaceIds?.length) {
    filters.push(create(FilterSpecSchema, { field: 'map_place_id', op: FilterOp.IN, values: input.mapPlaceIds }));
  } else if (input.requirePlace) {
    filters.push(create(FilterSpecSchema, { field: 'map_place_id', op: FilterOp.IS_NOT_NULL }));
  }

  const sortField = input.sortBy === 'updated_at' ? 'published_at' : input.sortBy;
  const sorts = sortField
    ? [
        create(SortSpecSchema, {
          field: sortField,
          order: input.sortOrder === 'desc' ? SortOrder.DESC : SortOrder.ASC,
        }),
      ]
    : [];

  return { viewport: buildViewport(input.viewport), filters, sorts };
}

export function buildWorkMapFeatureRequest(input: WorkMapFeatureRequestInput) {
  const filters = [];

  if (input.types?.length) {
    filters.push(
      create(FilterSpecSchema, {
        field: 'type',
        op: FilterOp.IN,
        values: input.types.map((type) => WORK_TYPE_FILTER_VALUES[type]),
      }),
    );
  }
  if (input.featuredOnly) {
    filters.push(create(FilterSpecSchema, { field: 'featured', op: FilterOp.EQ, value: 'true' }));
  }

  const sorts = input.sortBy
    ? [
        create(SortSpecSchema, {
          field: input.sortBy,
          order: input.sortOrder === 'asc' ? SortOrder.ASC : SortOrder.DESC,
        }),
      ]
    : [];

  return { viewport: buildViewport(input.viewport), filters, sorts };
}

interface MapFeatureClusterSource {
  id: string;
  lat: number;
  lng: number;
  placeCount: number;
  minBreakoutZoom?: number;
  bounds?: Partial<MapFeatureBounds>;
}

function mapClusterBounds(cluster: MapFeatureClusterSource): MapFeatureBounds {
  return {
    west: cluster.bounds?.west ?? cluster.lng,
    south: cluster.bounds?.south ?? cluster.lat,
    east: cluster.bounds?.east ?? cluster.lng,
    north: cluster.bounds?.north ?? cluster.lat,
  };
}

export function mapPostMapFeatureResponse(response: {
  clusters?: Array<MapFeatureClusterSource & { postCount: number }>;
  items?: Array<{
    placeId: string;
    name: string;
    address: string;
    lat: number;
    lng: number;
    postCount: number;
    primaryPostId: string;
    primaryPostSlug?: string;
    primaryPostTitle: string;
  }>;
}): PostMapFeatureResponse {
  return {
    clusters: (response.clusters ?? []).map((cluster) => ({
      id: cluster.id,
      lat: cluster.lat,
      lng: cluster.lng,
      placeCount: cluster.placeCount,
      postCount: cluster.postCount,
      minBreakoutZoom: cluster.minBreakoutZoom ?? null,
      bounds: mapClusterBounds(cluster),
    })),
    items: (response.items ?? []).map((item) => ({ ...item, primaryPostSlug: item.primaryPostSlug ?? null })),
  };
}

export function mapWorkMapFeatureResponse(response: {
  clusters?: Array<MapFeatureClusterSource & { workCount: number }>;
  items?: Array<{
    placeId: string;
    name: string;
    address: string;
    lat: number;
    lng: number;
    workCount: number;
    primaryWorkId: string;
    primaryWorkSlug?: string;
    primaryWorkTitle: string;
  }>;
}): WorkMapFeatureResponse {
  return {
    clusters: (response.clusters ?? []).map((cluster) => ({
      id: cluster.id,
      lat: cluster.lat,
      lng: cluster.lng,
      placeCount: cluster.placeCount,
      workCount: cluster.workCount,
      minBreakoutZoom: cluster.minBreakoutZoom ?? null,
      bounds: mapClusterBounds(cluster),
    })),
    items: (response.items ?? []).map((item) => ({ ...item, primaryWorkSlug: item.primaryWorkSlug ?? null })),
  };
}
