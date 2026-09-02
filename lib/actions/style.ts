'use server';

import { isConnectError } from '@/lib/api/connect-error';
import { revalidatePath } from 'next/cache';
import { timestampDate } from '@bufbuild/protobuf/wkt';
import { FilterOp, SortOrder } from '@echovisionlab/geul-proto/common/common_pb.ts';
import { createStyleClient } from '@/lib/api/server-client';
import { createLogger } from '@/lib/utils/logger';

const logger = createLogger('style-actions');

interface StyleListInput {
  search?: string;
  page?: number;
  pageSize?: number;
  sort?: { field: string; order?: 'asc' | 'desc' }[];
}

export async function listStylesAction() {
  try {
    const client = await createStyleClient();
    const response = await client.listStyles({
      pagination: { limit: 1000, offset: 0 },
    });
    return (response.styles ?? []).map((s) => ({
      id: s.id,
      name: s.name,
      slug: s.slug,
    }));
  } catch (err) {
    if (isConnectError(err)) {
      logger.error('ListStyles RPC error', { error: err.message });
    }
    return [];
  }
}

export async function listStylesAdminAction(input?: StyleListInput) {
  try {
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
  } catch (err) {
    if (isConnectError(err)) {
      logger.error('ListStylesAdmin RPC error', { error: err.message });
    }
    return { data: [], total: 0 };
  }
}

export async function createStyleAction(
  name: string,
  description?: string,
): Promise<{ data?: { id: string; name: string; slug: string }; error?: string }> {
  try {
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
  } catch (err) {
    if (isConnectError(err)) {
      return { error: err.message };
    }
    return { error: err instanceof Error ? err.message : 'Failed to create style' };
  }
}

export async function updateStyleAction(
  id: string,
  data: { name?: string; description?: string | null },
): Promise<{ success?: boolean; error?: string }> {
  try {
    const client = await createStyleClient();
    await client.updateStyle({
      id,
      name: data.name,
      description: data.description ?? undefined,
    });
    revalidatePath('/admin/styles');
    return { success: true };
  } catch (err) {
    if (isConnectError(err)) {
      return { error: err.message };
    }
    return { error: err instanceof Error ? err.message : 'Failed to update style' };
  }
}

export async function deleteStyleAction(id: string): Promise<{ success?: boolean; error?: string }> {
  try {
    const client = await createStyleClient();
    await client.deleteStyle({ id });
    revalidatePath('/admin/styles');
    return { success: true };
  } catch (err) {
    if (isConnectError(err)) {
      return { error: err.message };
    }
    return { error: err instanceof Error ? err.message : 'Failed to delete style' };
  }
}
