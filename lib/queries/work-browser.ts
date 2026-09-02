import { timestampDate } from '@bufbuild/protobuf/wkt';
import { FilterOp } from '@echovisionlab/geul-proto/common/common_pb.ts';
import { WorkType as PublicWorkType } from '@echovisionlab/geul-proto/public/work_pb.ts';
import { WORK_TABLE_FILTER_FIELD_DEFINITIONS, WORK_TABLE_SORT_FIELD_DEFINITIONS } from '@/lib/types/work/table-spec';
import { createPublicWorkClient, createPublicWorkClientWithLocale, createWorkClient } from '@/lib/api/browser-client';
import {
  buildPublicTableRequest,
  type PublicTableFilterFieldSpec,
  type PublicTableSortFieldSpec,
} from '@/lib/queries/public-table';
import {
  buildWorkMapFeatureRequest,
  mapWorkMapFeatureResponse,
  type WorkMapFeatureRequestInput,
} from '@/lib/queries/map-features';
import type { PaginatedQuery } from '@/lib/types/common/query';
import { WORK_TYPE_FILTER_VALUES, type WorkType } from '@/lib/types/work/model';
import { publicWorkTypeToString } from '@/lib/types/work/proto';
import { createClientLogger, serializeClientLogError } from '@/lib/utils/client-logger';

const logger = createClientLogger('work-browser');

export interface PublicWorkTableRow {
  id: string;
  slug: string | null;
  title: string;
  type: WorkType;
  year: number;
  month: number;
  untilYear: number | null;
  untilMonth: number | null;
  isPresent: boolean;
  featured: boolean;
  publishedAt: string | null;
}

export async function checkWorkSlugAvailable(slug: string, excludeWorkId?: string): Promise<{ available: boolean }> {
  try {
    const client = createWorkClient();
    const response = await client.checkWorkSlugAvailable({
      slug,
      excludeWorkId,
    });
    return { available: response.available };
  } catch (err) {
    logger.error('Failed to check slug', { error: serializeClientLogError(err) });
    return { available: false };
  }
}

export async function listWorkMapFeatures(
  input: WorkMapFeatureRequestInput & {
    requestedLocale?: string | null;
  },
) {
  const client = input.requestedLocale
    ? createPublicWorkClientWithLocale(input.requestedLocale)
    : createPublicWorkClient();
  const response = await client.listMapFeatures(buildWorkMapFeatureRequest(input));
  return mapWorkMapFeatureResponse(response);
}

export async function listPublishedWorksTable(input: {
  query: PaginatedQuery;
  pageSize?: number;
  types?: WorkType[];
  featuredOnly?: boolean;
  statuses?: string[];
  allowedFilterFields?: readonly PublicTableFilterFieldSpec[];
  allowedSortFields?: readonly PublicTableSortFieldSpec[];
  rejectInvalidQuery?: boolean;
}) {
  const client = createPublicWorkClient();
  const request = buildPublicTableRequest({
    query: input.query,
    defaultPageSize: input.pageSize ?? 10,
    allowedFilterFields: input.allowedFilterFields ?? WORK_TABLE_FILTER_FIELD_DEFINITIONS,
    allowedSortFields: input.allowedSortFields ?? WORK_TABLE_SORT_FIELD_DEFINITIONS,
    baseFilters: [
      ...(input.statuses && input.statuses.length > 0
        ? [{ field: 'status', op: FilterOp.IN, values: input.statuses }]
        : []),
      ...(input.types && input.types.length > 0
        ? [
            {
              field: 'type',
              op: FilterOp.IN,
              values: input.types.map((type) => WORK_TYPE_FILTER_VALUES[type]),
            },
          ]
        : []),
      ...(input.featuredOnly ? [{ field: 'featured', op: FilterOp.EQ, value: 'true' }] : []),
    ],
    rejectInvalidQuery: input.rejectInvalidQuery ?? false,
  });

  const response = await client.list({
    pagination: request.pagination,
    filters: request.filters,
    sorts: request.sorts,
  });

  const total = response.pagination?.total ?? 0;

  return {
    data: (response.works ?? []).map((work): PublicWorkTableRow => ({
      id: work.id,
      slug: work.slug ?? null,
      title: work.title,
      type: publicWorkTypeToString(work.type ?? PublicWorkType.MUSIC_PROJECT),
      year: work.year,
      month: work.month,
      untilYear: work.untilYear ?? null,
      untilMonth: work.untilMonth ?? null,
      isPresent: work.isPresent,
      featured: work.featured ?? false,
      publishedAt: work.publishedAt ? timestampDate(work.publishedAt).toISOString() : null,
    })),
    total,
    page: request.page,
    pageSize: request.pageSize,
    totalPages: Math.ceil(total / request.pageSize),
  };
}
