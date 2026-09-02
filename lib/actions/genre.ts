'use server';

import { isConnectError } from '@/lib/api/connect-error';
import { revalidatePath } from 'next/cache';
import { timestampDate } from '@bufbuild/protobuf/wkt';
import { FilterOp, SortOrder } from '@echovisionlab/geul-proto/common/common_pb.ts';
import { createGenreClient } from '@/lib/api/server-client';
import { createLogger } from '@/lib/utils/logger';

const logger = createLogger('genre-actions');

interface GenreListInput {
  search?: string;
  page?: number;
  pageSize?: number;
  sort?: { field: string; order?: 'asc' | 'desc' }[];
}

export async function listGenresAction() {
  try {
    const client = await createGenreClient();
    const response = await client.listGenres({
      pagination: { limit: 1000, offset: 0 },
    });
    return (response.genres ?? []).map((g) => ({
      id: g.id,
      name: g.name,
      slug: g.slug,
    }));
  } catch (err) {
    if (isConnectError(err)) {
      logger.error('ListGenres RPC error', { error: err.message });
    }
    return [];
  }
}

export async function listGenresAdminAction(input: GenreListInput) {
  try {
    const client = await createGenreClient();
    const limit = input.pageSize ?? 20;
    const offset = ((input.page ?? 1) - 1) * limit;

    const response = await client.listGenresAdmin({
      pagination: { limit, offset },
      filters: input.search ? [{ field: 'search', op: FilterOp.ILIKE, value: input.search }] : undefined,
      sorts: input.sort?.map((s) => ({
        field: s.field,
        order: s.order === 'desc' ? SortOrder.DESC : SortOrder.ASC,
      })),
    });

    const total = response.pagination?.total ?? 0;
    return {
      data: (response.genres ?? []).map((g) => ({
        id: g.genre?.id ?? '',
        name: g.genre?.name ?? '',
        slug: g.genre?.slug ?? '',
        description: g.genre?.description,
        releaseCount: g.releaseCount,
        createdAt: g.genre?.createdAt ? timestampDate(g.genre.createdAt) : undefined,
      })),
      total,
      page: input.page ?? 1,
      pageSize: limit,
      totalPages: Math.ceil(total / limit),
    };
  } catch (err) {
    if (isConnectError(err)) {
      logger.error('ListGenresAdmin RPC error', { error: err.message });
    }
    return { data: [], total: 0, page: 1, pageSize: 20, totalPages: 0 };
  }
}

export async function createGenreAction(
  name: string,
  description?: string,
): Promise<{ data?: { id: string; name: string; slug: string }; error?: string }> {
  try {
    const client = await createGenreClient();
    const genre = await client.createGenre({
      name,
      description,
    });
    revalidatePath('/admin/genres');
    return {
      data: {
        id: genre.id,
        name: genre.name,
        slug: genre.slug,
      },
    };
  } catch (err) {
    if (isConnectError(err)) {
      return { error: err.message };
    }
    return { error: err instanceof Error ? err.message : 'Failed to create genre' };
  }
}

export async function updateGenreAction(
  id: string,
  data: { name?: string; description?: string | null },
): Promise<{ success?: boolean; error?: string }> {
  try {
    const client = await createGenreClient();
    await client.updateGenre({
      id,
      name: data.name,
      description: data.description ?? undefined,
    });
    revalidatePath('/admin/genres');
    return { success: true };
  } catch (err) {
    if (isConnectError(err)) {
      return { error: err.message };
    }
    return { error: err instanceof Error ? err.message : 'Failed to update genre' };
  }
}

export async function deleteGenreAction(id: string): Promise<{ success?: boolean; error?: string }> {
  try {
    const client = await createGenreClient();
    await client.deleteGenre({ id });
    revalidatePath('/admin/genres');
    return { success: true };
  } catch (err) {
    if (isConnectError(err)) {
      return { error: err.message };
    }
    return { error: err instanceof Error ? err.message : 'Failed to delete genre' };
  }
}
