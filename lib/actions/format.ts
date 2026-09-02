'use server';

import { isConnectError } from '@/lib/api/connect-error';
import { revalidatePath } from 'next/cache';
import { FilterOp, SortOrder } from '@echovisionlab/geul-proto/common/common_pb.ts';
import { createFormatClient } from '@/lib/api/server-client';
import { createLogger } from '@/lib/utils/logger';

const logger = createLogger('format-actions');

interface FormatListInput {
  search?: string;
  page?: number;
  pageSize?: number;
  sort?: { field: string; order?: 'asc' | 'desc' }[];
}

export async function listFormatsAction() {
  try {
    const client = await createFormatClient();
    const response = await client.listFormats({
      pagination: { limit: 1000, offset: 0 },
    });
    return (response.formats ?? []).map((f) => ({
      id: f.id,
      name: f.name,
      slug: f.slug,
    }));
  } catch (err) {
    if (isConnectError(err)) {
      logger.error('ListFormats RPC error', { error: err.message });
    }
    return [];
  }
}

export async function listFormatsAdminAction(input: FormatListInput) {
  try {
    const client = await createFormatClient();
    const limit = input.pageSize ?? 20;
    const offset = ((input.page ?? 1) - 1) * limit;

    const response = await client.listFormatsAdmin({
      pagination: { limit, offset },
      filters: input.search ? [{ field: 'search', op: FilterOp.ILIKE, value: input.search }] : undefined,
      sorts: input.sort?.map((s) => ({
        field: s.field,
        order: s.order === 'desc' ? SortOrder.DESC : SortOrder.ASC,
      })),
    });

    const total = response.pagination?.total ?? 0;
    return {
      data: (response.formats ?? []).map((f) => ({
        id: f.format?.id ?? '',
        name: f.format?.name ?? '',
        slug: f.format?.slug ?? '',
        releaseCount: f.releaseCount,
      })),
      total,
      page: input.page ?? 1,
      pageSize: limit,
      totalPages: Math.ceil(total / limit),
    };
  } catch (err) {
    if (isConnectError(err)) {
      logger.error('ListFormatsAdmin RPC error', { error: err.message });
    }
    return { data: [], total: 0, page: 1, pageSize: 20, totalPages: 0 };
  }
}

export async function createFormatAction(
  name: string,
): Promise<{ data?: { id: string; name: string; slug: string }; error?: string }> {
  try {
    const client = await createFormatClient();
    const format = await client.createFormat({
      name,
    });
    revalidatePath('/admin/formats');
    return {
      data: {
        id: format.id,
        name: format.name,
        slug: format.slug,
      },
    };
  } catch (err) {
    if (isConnectError(err)) {
      return { error: err.message };
    }
    return { error: err instanceof Error ? err.message : 'Failed to create format' };
  }
}

export async function updateFormatAction(
  id: string,
  data: { name?: string },
): Promise<{ success?: boolean; error?: string }> {
  try {
    const client = await createFormatClient();
    await client.updateFormat({
      id,
      name: data.name,
    });
    revalidatePath('/admin/formats');
    return { success: true };
  } catch (err) {
    if (isConnectError(err)) {
      return { error: err.message };
    }
    return { error: err instanceof Error ? err.message : 'Failed to update format' };
  }
}

export async function deleteFormatAction(id: string): Promise<{ success?: boolean; error?: string }> {
  try {
    const client = await createFormatClient();
    await client.deleteFormat({ id });
    revalidatePath('/admin/formats');
    return { success: true };
  } catch (err) {
    if (isConnectError(err)) {
      return { error: err.message };
    }
    return { error: err instanceof Error ? err.message : 'Failed to delete format' };
  }
}
