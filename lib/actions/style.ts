'use server';

import type { ActionResult } from '@/lib/actions/action-result';
import { runAction } from '@/lib/actions/run-action';
import { queryResult } from '@/lib/api/query-result';

import { revalidatePath } from 'next/cache';
import { timestampDate } from '@bufbuild/protobuf/wkt';
import { FilterOp, SortOrder } from '@echovisionlab/geul-proto/common/common_pb.ts';
import { createStyleClient } from '@/lib/api/server-client';

interface StyleListInput {
  search?: string;
  page?: number;
  pageSize?: number;
  sort?: { field: string; order?: 'asc' | 'desc' }[];
}

export async function listStylesAction() {
  return queryResult(async () => {
    const client = await createStyleClient();
    const response = await client.listStyles({
      pagination: { limit: 1000, offset: 0 },
    });
    return (response.styles ?? []).map((s) => ({
      id: s.id,
      name: s.name,
      slug: s.slug,
    }));
  });
}

export async function listStylesAdminAction(input?: StyleListInput) {
  return queryResult(async () => {
    const client = await createStyleClient();
    const limit = input?.pageSize ?? 20;
    const offset = ((input?.page ?? 1) - 1) * limit;

    const response = await client.listStylesAdmin({
      pagination: { limit, offset },
      filters: input?.search ? [{ field: 'search', op: FilterOp.ILIKE, value: input.search }] : undefined,
      sorts: input?.sort?.map((s) => ({
        field: s.field,
        order: s.order === 'desc' ? SortOrder.DESC : SortOrder.ASC,
      })),
    });

    const total = response.pagination?.total ?? 0;
    return {
      data: (response.styles ?? []).map((s) => ({
        id: s.style?.id ?? '',
        name: s.style?.name ?? '',
        slug: s.style?.slug ?? '',
        description: s.style?.description,
        releaseCount: s.releaseCount,
        createdAt: s.style?.createdAt ? timestampDate(s.style.createdAt) : undefined,
      })),
      total,
    };
  });
}

export async function createStyleAction(
  name: string,
  description?: string,
): Promise<ActionResult<{ data: { id: string; name: string; slug: string } }>> {
  return runAction(
    'style-actions',
    'createStyleAction',
    async () => {
      const client = await createStyleClient();
      const style = await client.createStyle({
        name,
        description,
      });
      revalidatePath('/admin/styles');
      return {
        data: {
          id: style.id,
          name: style.name,
          slug: style.slug,
        },
      };
    },
    { fallback: 'Failed to create style' },
  );
}

export async function updateStyleAction(
  id: string,
  data: { name?: string; description?: string | null },
): Promise<ActionResult<{ success: true }>> {
  return runAction(
    'style-actions',
    'updateStyleAction',
    async () => {
      const client = await createStyleClient();
      await client.updateStyle({
        id,
        ...(data.name !== undefined ? { name: data.name } : {}),
        ...(data.description !== undefined ? { description: data.description ?? '' } : {}),
      });
      revalidatePath('/admin/styles');
      return { success: true as const };
    },
    { fallback: 'Failed to update style' },
  );
}

export async function deleteStyleAction(id: string): Promise<ActionResult<{ success: true }>> {
  return runAction(
    'style-actions',
    'deleteStyleAction',
    async () => {
      const client = await createStyleClient();
      await client.deleteStyle({ id });
      revalidatePath('/admin/styles');
      return { success: true as const };
    },
    { fallback: 'Failed to delete style' },
  );
}
