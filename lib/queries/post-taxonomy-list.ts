import { create } from '@bufbuild/protobuf';
import { timestampDate } from '@bufbuild/protobuf/wkt';
import type { Client } from '@connectrpc/connect';
import { FilterOp, FilterSpecSchema, SortOrder, SortSpecSchema } from '@echovisionlab/geul-proto/common/common_pb.ts';
import type { PostService as PublicPostService } from '@echovisionlab/geul-proto/public/post_pb.ts';
import type { PaginatedQuery } from '@/lib/types/common/query';
import type { PaginatedQueryResult } from '@/lib/types/repository/result';

export interface TaxonomyPostRow {
  id: string;
  title: string;
  slug: string | undefined;
  summary: string | undefined;
  publishedAt: string | undefined;
  authors: { id: string; name: string | null }[];
}

function toFilterOp(op: string): FilterOp | null {
  switch (op) {
    case 'eq':
      return FilterOp.EQ;
    case 'ne':
      return FilterOp.NEQ;
    case 'gt':
      return FilterOp.GT;
    case 'gte':
      return FilterOp.GTE;
    case 'lt':
      return FilterOp.LT;
    case 'lte':
      return FilterOp.LTE;
    case 'like':
      return FilterOp.LIKE;
    case 'ilike':
      return FilterOp.ILIKE;
    case 'in':
      return FilterOp.IN;
    default:
      return null;
  }
}

function normalizeFilterValue(value: unknown): string {
  if (value instanceof Date) {
    return value.toISOString();
  }
  if (typeof value === 'string') {
    return value;
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  return '';
}

export interface PublishedPostsByTaxonomyInput {
  taxonomyType: 'category' | 'tag';
  taxonomyId: string;
  query: PaginatedQuery;
}

type PublicPostListClient = Pick<Client<typeof PublicPostService>, 'list'>;

// Shared by the browser query (`post-browser.ts`) and the server first page (`post-taxonomy-list.server.ts`).
export async function listPublishedPostsByTaxonomyWith(
  client: PublicPostListClient,
  input: PublishedPostsByTaxonomyInput,
): Promise<PaginatedQueryResult<TaxonomyPostRow>> {
  const page = Math.max(1, input.query.page ?? 1);
  const pageSize = Math.max(1, input.query.pageSize ?? 20);
  const offset = (page - 1) * pageSize;
  const filters = [];

  filters.push(
    create(FilterSpecSchema, {
      field: input.taxonomyType === 'category' ? 'category_id' : 'tag_id',
      op: FilterOp.EQ,
      value: input.taxonomyId,
    }),
  );

  const search = input.query.search?.trim();
  if (search) {
    filters.push(
      create(FilterSpecSchema, {
        field: 'search',
        op: FilterOp.ILIKE,
        value: search,
      }),
    );
  }

  // Public post list supports published_at filters; convert DataTable filter ops accordingly.
  for (const filter of input.query.filters ?? []) {
    if (filter.field !== 'published_at') {
      continue;
    }

    if (filter.op === 'between' && Array.isArray(filter.value)) {
      const from = normalizeFilterValue(filter.value[0]);
      const to = normalizeFilterValue(filter.value[1]);
      if (from) {
        filters.push(create(FilterSpecSchema, { field: 'published_at', op: FilterOp.GTE, value: from }));
      }
      if (to) {
        filters.push(create(FilterSpecSchema, { field: 'published_at', op: FilterOp.LTE, value: to }));
      }
      continue;
    }

    if (filter.op === 'isNull') {
      // List endpoint only returns published items, so published_at IS NULL is always empty.
      if (filter.value === true) {
        return { data: [], total: 0, page, pageSize, totalPages: 0 };
      }
      continue;
    }

    const mappedOp = toFilterOp(filter.op);
    if (!mappedOp) {
      continue;
    }

    if (mappedOp === FilterOp.IN && Array.isArray(filter.value)) {
      const values = filter.value.map((v) => normalizeFilterValue(v)).filter(Boolean);
      if (values.length > 0) {
        filters.push(
          create(FilterSpecSchema, {
            field: 'published_at',
            op: FilterOp.IN,
            values,
          }),
        );
      }
      continue;
    }

    const normalizedValue = normalizeFilterValue(filter.value);
    if (!normalizedValue) {
      continue;
    }
    filters.push(
      create(FilterSpecSchema, {
        field: 'published_at',
        op: mappedOp,
        value: normalizedValue,
      }),
    );
  }

  const sorts = [];
  for (const sort of input.query.sorts ?? []) {
    if (sort.field !== 'title' && sort.field !== 'published_at') {
      continue;
    }
    sorts.push(
      create(SortSpecSchema, {
        field: sort.field,
        order: sort.direction === 'asc' ? SortOrder.ASC : SortOrder.DESC,
      }),
    );
  }

  const response = await client.list({
    pagination: { limit: pageSize, offset },
    filters,
    sorts,
  });

  const data = (response.posts ?? []).map((post) => ({
    id: post.id,
    title: post.title,
    slug: post.slug,
    summary: post.summary,
    publishedAt: post.publishedAt ? timestampDate(post.publishedAt).toISOString() : undefined,
    authors: (post.authorMembers ?? []).map((a) => ({ id: a.id, name: a.nickname })),
  }));

  const total = response.pagination?.total ?? data.length;
  return {
    data,
    total,
    page:
      response.pagination?.offset !== undefined ? Math.floor((response.pagination.offset ?? 0) / pageSize) + 1 : page,
    pageSize: response.pagination?.limit ?? pageSize,
    totalPages: Math.ceil(total / pageSize),
  };
}
