'use server';

import type { ActionResult } from '@/lib/actions/action-result';
import { runAction } from '@/lib/actions/run-action';
import { queryResult } from '@/lib/api/query-result';

import { revalidatePath } from 'next/cache';
import { timestampDate } from '@bufbuild/protobuf/wkt';
import { FilterOp, SortOrder } from '@echovisionlab/geul-proto/common/common_pb.ts';
import { createGenreClient } from '@/lib/api/server-client';

interface GenreListInput {
  search?: string;
  page?: number;
  pageSize?: number;
  sort?: { field: string; order?: 'asc' | 'desc' }[];
}

export async function listGenresAction() {
  return queryResult(async () => {
    const client = await createGenreClient();
    const response = await client.listGenres({
      pagination: { limit: 1000, offset: 0 },
    });
    return (response.genres ?? []).map((g) => ({
      id: g.id,
      name: g.name,
      slug: g.slug,
    }));
  });
}

export async function listGenresAdminAction(input: GenreListInput) {
  return queryResult(async () => {
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
  });
}

export async function createGenreAction(
  name: string,
  description?: string,
): Promise<ActionResult<{ data: { id: string; name: string; slug: string } }>> {
  return runAction(
    'genre-actions',
    'createGenreAction',
    async () => {
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
    },
    { fallback: 'Failed to create genre' },
  );
}

export async function updateGenreAction(
  id: string,
  data: { name?: string; description?: string | null },
): Promise<ActionResult<{ success: true }>> {
  return runAction(
    'genre-actions',
    'updateGenreAction',
    async () => {
      const client = await createGenreClient();
      await client.updateGenre({
        id,
        ...(data.name !== undefined ? { name: data.name } : {}),
        ...(data.description !== undefined ? { description: data.description ?? '' } : {}),
      });
      revalidatePath('/admin/genres');
      return { success: true as const };
    },
    { fallback: 'Failed to update genre' },
  );
}

export async function deleteGenreAction(id: string): Promise<ActionResult<{ success: true }>> {
  return runAction(
    'genre-actions',
    'deleteGenreAction',
    async () => {
      const client = await createGenreClient();
      await client.deleteGenre({ id });
      revalidatePath('/admin/genres');
      return { success: true as const };
    },
    { fallback: 'Failed to delete genre' },
  );
}
