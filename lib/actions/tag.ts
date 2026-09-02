'use server';

import { isConnectError } from '@/lib/api/connect-error';
import { revalidatePath } from 'next/cache';
import { timestampDate } from '@bufbuild/protobuf/wkt';
import { FilterOp, SortOrder } from '@echovisionlab/geul-proto/common/common_pb.ts';
import { createTagClient } from '@/lib/api/server-client';
import { createLogger } from '@/lib/utils/logger';

const logger = createLogger('tag-actions');

interface TagListInput {
  filter?: unknown;
  filterBy?: 'AND' | 'OR';
  sort?: { field: string; order?: 'asc' | 'desc' }[];
  page?: number;
  pageSize?: number;
  search?: string;
}

export async function listTagsAdminAction(input: TagListInput) {
  try {
    const client = await createTagClient();
    const limit = input.pageSize ?? 20;
    const offset = ((input.page ?? 1) - 1) * limit;

    const response = await client.listTagsAdmin({
      pagination: { limit, offset },
      filters: input.search ? [{ field: 'search', op: FilterOp.ILIKE, value: input.search }] : undefined,
      sorts: input.sort?.map((s) => ({
        field: s.field,
        order: s.order === 'desc' ? SortOrder.DESC : SortOrder.ASC,
      })),
    });

    const total = response.pagination?.total ?? 0;
    return {
      data: (response.tags ?? []).map((t) => ({
        id: t.tag?.id ?? '',
        name: t.tag?.name ?? '',
        slug: t.tag?.slug,
        postCount: t.postCount,
        createdAt: t.tag?.createdAt ? timestampDate(t.tag.createdAt) : undefined,
      })),
      total,
      page: input.page ?? 1,
      pageSize: limit,
      totalPages: Math.ceil(total / limit),
    };
  } catch (err) {
    if (isConnectError(err)) {
      logger.error('ListTagsAdmin RPC error', { error: err.message });
    }
    return { data: [], total: 0, page: 1, pageSize: 20, totalPages: 0 };
  }
}

export async function createTagAction(
  name: string,
): Promise<{ data?: { id: string; name: string; slug: string }; error?: string }> {
  try {
    const client = await createTagClient();
    const tag = await client.createTag({ name });
    revalidatePath('/admin/tags');
    return {
      data: {
        id: tag.id,
        name: tag.name,
        slug: tag.slug ?? '',
      },
    };
  } catch (err) {
    if (isConnectError(err)) {
      return { error: err.message };
    }
    return { error: err instanceof Error ? err.message : 'Failed to create tag' };
  }
}

export async function updateTagAction(id: string, name: string): Promise<{ success?: boolean; error?: string }> {
  try {
    const client = await createTagClient();
    await client.updateTag({ id, name });
    revalidatePath('/admin/tags');
    return { success: true };
  } catch (err) {
    if (isConnectError(err)) {
      return { error: err.message };
    }
    return { error: err instanceof Error ? err.message : 'Failed to update tag' };
  }
}

export async function deleteTagAction(id: string): Promise<{ success?: boolean; error?: string }> {
  try {
    const client = await createTagClient();
    await client.deleteTag({ id });
    revalidatePath('/admin/tags');
    return { success: true };
  } catch (err) {
    if (isConnectError(err)) {
      return { error: err.message };
    }
    return { error: err instanceof Error ? err.message : 'Failed to delete tag' };
  }
}

// Simple list for selectors (returns all tags)
export async function listTagsAction() {
  try {
    const client = await createTagClient();
    const response = await client.listTags({
      pagination: { limit: 1000, offset: 0 },
    });
    return (response.tags ?? []).map((t) => ({
      id: t.id,
      name: t.name,
      slug: t.slug,
    }));
  } catch (err) {
    if (isConnectError(err)) {
      logger.error('ListTags RPC error', { error: err.message });
    }
    return [];
  }
}
