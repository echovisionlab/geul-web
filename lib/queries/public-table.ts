import { create } from '@bufbuild/protobuf';
import { FilterOp, FilterSpecSchema, SortOrder, SortSpecSchema } from '@echovisionlab/geul-proto/common/common_pb.ts';
import type { FilterOperator } from '@/lib/types/common/filter';
import type { PaginatedQuery } from '@/lib/types/common/query';

interface PublicTableFilterSeed {
  field: string;
  op: FilterOp;
  value?: string;
  values?: string[];
}

export interface PublicTableFilterFieldSpec {
  field: string;
  operators?: readonly FilterOperator[];
}

export interface PublicTableSortFieldSpec {
  field: string;
}

export class InvalidPublicTableQueryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidPublicTableQueryError';
  }
}

interface BuildPublicTableRequestInput {
  query: PaginatedQuery;
  defaultPageSize: number;
  allowedFilterFields: readonly PublicTableFilterFieldSpec[];
  allowedSortFields: readonly PublicTableSortFieldSpec[];
  baseFilters?: PublicTableFilterSeed[];
  rejectInvalidQuery?: boolean;
}

function clampPageSize(pageSize: number): number {
  return Math.max(1, Math.min(100, Math.round(pageSize)));
}

function toScalarString(value: unknown): string | null {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  return String(value);
}

function buildSeedFilter(seed: PublicTableFilterSeed) {
  return create(FilterSpecSchema, {
    field: seed.field,
    op: seed.op,
    value: seed.value,
    values: seed.values,
  });
}

function buildQueryFilters(
  query: PaginatedQuery,
  allowedFilterFields: readonly PublicTableFilterFieldSpec[],
  rejectInvalidQuery: boolean,
) {
  const allowedFields = new Map(allowedFilterFields.map((field) => [field.field, field]));
  const filters = [];

  if (query.search?.trim()) {
    filters.push(
      create(FilterSpecSchema, {
        field: 'search',
        op: FilterOp.ILIKE,
        value: query.search.trim(),
      }),
    );
  }

  for (const filter of query.filters ?? []) {
    const allowedField = allowedFields.get(filter.field);
    if (!allowedField) {
      if (rejectInvalidQuery) {
        throw new InvalidPublicTableQueryError(`Unsupported filter field: ${filter.field}`);
      }
      continue;
    }

    if (allowedField.operators && !allowedField.operators.includes(filter.op)) {
      if (rejectInvalidQuery) {
        throw new InvalidPublicTableQueryError(`Unsupported filter operator for ${filter.field}: ${filter.op}`);
      }
      continue;
    }

    switch (filter.op) {
      case 'eq': {
        const value = toScalarString(filter.value);
        if (value !== null) {
          filters.push(
            create(FilterSpecSchema, {
              field: filter.field,
              op: FilterOp.EQ,
              value,
            }),
          );
        }
        break;
      }
      case 'ne': {
        const value = toScalarString(filter.value);
        if (value !== null) {
          filters.push(
            create(FilterSpecSchema, {
              field: filter.field,
              op: FilterOp.NEQ,
              value,
            }),
          );
        }
        break;
      }
      case 'gt':
      case 'gte':
      case 'lt':
      case 'lte': {
        const value = toScalarString(filter.value);
        const opMap: Record<'gt' | 'gte' | 'lt' | 'lte', FilterOp> = {
          gt: FilterOp.GT,
          gte: FilterOp.GTE,
          lt: FilterOp.LT,
          lte: FilterOp.LTE,
        };
        if (value !== null) {
          filters.push(
            create(FilterSpecSchema, {
              field: filter.field,
              op: opMap[filter.op],
              value,
            }),
          );
        }
        break;
      }
      case 'ilike': {
        const value = toScalarString(filter.value);
        if (value !== null) {
          filters.push(
            create(FilterSpecSchema, {
              field: filter.field,
              op: FilterOp.ILIKE,
              value,
            }),
          );
        }
        break;
      }
      case 'in': {
        if (!Array.isArray(filter.value)) {
          break;
        }
        const values = filter.value.map(toScalarString).filter((value): value is string => value !== null);
        if (values.length > 0) {
          filters.push(
            create(FilterSpecSchema, {
              field: filter.field,
              op: FilterOp.IN,
              values,
            }),
          );
        }
        break;
      }
      case 'between': {
        if (!Array.isArray(filter.value)) {
          break;
        }
        const [from, to] = filter.value;
        const fromValue = toScalarString(from);
        const toValue = toScalarString(to);
        if (fromValue !== null) {
          filters.push(
            create(FilterSpecSchema, {
              field: filter.field,
              op: FilterOp.GTE,
              value: fromValue,
            }),
          );
        }
        if (toValue !== null) {
          filters.push(
            create(FilterSpecSchema, {
              field: filter.field,
              op: FilterOp.LTE,
              value: toValue,
            }),
          );
        }
        break;
      }
      case 'isNull': {
        filters.push(
          create(FilterSpecSchema, {
            field: filter.field,
            op: filter.value === false ? FilterOp.IS_NOT_NULL : FilterOp.IS_NULL,
          }),
        );
        break;
      }
      default:
        break;
    }
  }

  return filters;
}

function buildSorts(
  query: PaginatedQuery,
  allowedSortFields: readonly PublicTableSortFieldSpec[],
  rejectInvalidQuery: boolean,
) {
  const allowedFields = new Set(allowedSortFields.map((field) => field.field));
  const sortCandidates = query.sorts ?? [];

  for (const sort of sortCandidates) {
    if (!allowedFields.has(sort.field) && rejectInvalidQuery) {
      throw new InvalidPublicTableQueryError(`Unsupported sort field: ${sort.field}`);
    }
  }

  return sortCandidates
    .filter((sort) => allowedFields.has(sort.field))
    .map((sort) =>
      create(SortSpecSchema, {
        field: sort.field,
        order: sort.direction === 'asc' ? SortOrder.ASC : SortOrder.DESC,
      }),
    );
}

export function buildPublicTableRequest({
  query,
  defaultPageSize,
  allowedFilterFields,
  allowedSortFields,
  baseFilters = [],
  rejectInvalidQuery = false,
}: BuildPublicTableRequestInput) {
  const page = Math.max(1, Math.round(query.page ?? 1));
  const pageSize = clampPageSize(query.pageSize ?? defaultPageSize);
  const offset = (page - 1) * pageSize;

  return {
    pagination: {
      limit: pageSize,
      offset,
    },
    filters: [
      ...baseFilters.map(buildSeedFilter),
      ...buildQueryFilters(query, allowedFilterFields, rejectInvalidQuery),
    ],
    sorts: buildSorts(query, allowedSortFields, rejectInvalidQuery),
    page,
    pageSize,
  };
}
