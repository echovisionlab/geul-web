'use server';

import { queryResult, type QueryResult } from '@/lib/api/query-result';

import { revalidatePath } from 'next/cache';
import { create } from '@bufbuild/protobuf';
import { timestampDate } from '@bufbuild/protobuf/wkt';
import {
  FilterOp,
  type FilterSpec,
  FilterSpecSchema,
  PaginationRequestSchema,
  SortOrder,
  SortSpecSchema,
} from '@echovisionlab/geul-proto/common/common_pb.ts';
import { createMemberClient } from '@/lib/api/server-client';
import type { ActionResult } from '@/lib/actions/action-result';
import { runAction } from '@/lib/actions/run-action';

const userTagFilterFields = new Set(['name', 'created_at']);

interface UserTagListInput {
  filter?: unknown;
  filterBy?: 'AND' | 'OR';
  sort?: { field: string; order?: 'asc' | 'desc' }[];
  page?: number;
  pageSize?: number;
  search?: string;
}

function userTagFilters(input: unknown): FilterSpec[] {
  if (!Array.isArray(input)) {
    return [];
  }

  const filters: FilterSpec[] = [];
  for (const candidate of input) {
    if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) {
      continue;
    }
    const field = Reflect.get(candidate, 'field');
    const value = Reflect.get(candidate, 'value');
    const op = Reflect.get(candidate, 'op');
    const mappedOp =
      op === 'ne'
        ? FilterOp.NEQ
        : op === 'gt'
          ? FilterOp.GT
          : op === 'gte'
            ? FilterOp.GTE
            : op === 'lt'
              ? FilterOp.LT
              : op === 'lte'
                ? FilterOp.LTE
                : op === 'like'
                  ? FilterOp.LIKE
                  : op === 'ilike'
                    ? FilterOp.ILIKE
                    : op === undefined || op === 'eq'
                      ? FilterOp.EQ
                      : null;
    if (
      typeof field === 'string' &&
      userTagFilterFields.has(field) &&
      mappedOp !== null &&
      (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean')
    ) {
      filters.push(create(FilterSpecSchema, { field, op: mappedOp, value: String(value) }));
    }
  }
  return filters;
}

export async function listUserTagsAdminAction(input: UserTagListInput) {
  return queryResult(async () => {
    const client = await createMemberClient();
    const { page = 1, pageSize = 20, search, sort } = input;

    const filters = search ? [create(FilterSpecSchema, { field: 'search', op: FilterOp.ILIKE, value: search })] : [];
    filters.push(...userTagFilters(input.filter));

    const response = await client.listMemberTagsAdmin({
      pagination: create(PaginationRequestSchema, {
        limit: pageSize,
        offset: (page - 1) * pageSize,
      }),
      filters,
      sorts: sort?.map((s) =>
        create(SortSpecSchema, {
          field: s.field,
          order: s.order === 'asc' ? SortOrder.ASC : SortOrder.DESC,
        }),
      ),
    });

    const total = response.pagination?.total ?? 0;

    return {
      data: (response.tags ?? []).map((t) => ({
        id: t.id,
        name: t.name,
        user_count: t.memberCount,
        created_at: t.createdAt ? timestampDate(t.createdAt) : new Date(),
      })),
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  });
}

export async function createUserTagAction(name: string): Promise<ActionResult<{ data: { id: string } }>> {
  return runAction(
    'user-tag-actions',
    'createUserTagAction',
    async () => {
      const client = await createMemberClient();
      const tag = await client.createMemberTag({ name });
      revalidatePath('/admin/user-tags');
      return { data: { id: tag.id } };
    },
    { fallback: 'Failed to create tag' },
  );
}

export async function listAllUserTagsAction(): Promise<QueryResult<{ id: string; name: string }[]>> {
  return queryResult(async () => {
    const client = await createMemberClient();
    const response = await client.listMemberTagsAdmin({
      pagination: create(PaginationRequestSchema, { limit: 500, offset: 0 }),
    });
    return (response.tags ?? []).map((t) => ({ id: t.id, name: t.name }));
  });
}

export async function deleteUserTagAction(id: string): Promise<ActionResult<{ success: true }>> {
  return runAction(
    'user-tag-actions',
    'deleteUserTagAction',
    async () => {
      const client = await createMemberClient();
      await client.deleteMemberTag({ id });
      revalidatePath('/admin/user-tags');
      return { success: true as const };
    },
    { fallback: 'Failed to delete tag' },
  );
}
