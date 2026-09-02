'use server';

import { isConnectError } from '@/lib/api/connect-error';
import { revalidatePath } from 'next/cache';
import { timestampDate } from '@bufbuild/protobuf/wkt';
import { FilterOp, SortOrder } from '@echovisionlab/geul-proto/common/common_pb.ts';
import { createCategoryClient } from '@/lib/api/server-client';
import { createLogger } from '@/lib/utils/logger';

const logger = createLogger('category-actions');

interface CategoryListInput {
  filter?: unknown;
  filterBy?: 'AND' | 'OR';
  sort?: { field: string; order?: 'asc' | 'desc' }[];
  page?: number;
  pageSize?: number;
  search?: string;
}

export async function listCategoriesAdminAction(input: CategoryListInput) {
  try {
    const client = await createCategoryClient();
    const limit = input.pageSize ?? 20;
    const offset = ((input.page ?? 1) - 1) * limit;

    const response = await client.listCategoriesAdmin({
      pagination: { limit, offset },
      filters: input.search ? [{ field: 'search', op: FilterOp.ILIKE, value: input.search }] : undefined,
      sorts: input.sort?.map((s) => ({
        field: s.field,
        order: s.order === 'desc' ? SortOrder.DESC : SortOrder.ASC,
      })),
    });

    const total = response.pagination?.total ?? 0;
    return {
      data: (response.categories ?? []).map((c) => ({
        id: c.category?.id ?? '',
        name: c.category?.name ?? '',
        slug: c.category?.slug,
        description: c.category?.description,
        postCount: c.postCount,
        createdAt: c.category?.createdAt ? timestampDate(c.category.createdAt) : undefined,
        updatedAt: c.category?.updatedAt ? timestampDate(c.category.updatedAt) : undefined,
      })),
      total,
      page: input.page ?? 1,
      pageSize: limit,
      totalPages: Math.ceil(total / limit),
    };
  } catch (err) {
    if (isConnectError(err)) {
      logger.error('ListCategoriesAdmin RPC error', { error: err.message });
    }
    return { data: [], total: 0, page: 1, pageSize: 20, totalPages: 0 };
  }
}

export async function createCategoryAction(data: {
  name: string;
  description?: string;
}): Promise<{ data?: { id: string; name: string; slug: string }; error?: string }> {
  try {
    const client = await createCategoryClient();
    const category = await client.createCategory({
      name: data.name,
      description: data.description,
    });
    revalidatePath('/admin/categories');
    return {
      data: {
        id: category.id,
        name: category.name,
        slug: category.slug ?? '',
      },
    };
  } catch (err) {
    if (isConnectError(err)) {
      return { error: err.message };
    }
    return { error: err instanceof Error ? err.message : 'Failed to create category' };
  }
}

export async function updateCategoryAction(
  id: string,
  data: { name?: string; description?: string },
): Promise<{ success?: boolean; error?: string }> {
  try {
    const client = await createCategoryClient();
    await client.updateCategory({
      id,
      name: data.name,
      description: data.description,
    });
    revalidatePath('/admin/categories');
    return { success: true };
  } catch (err) {
    if (isConnectError(err)) {
      return { error: err.message };
    }
    return { error: err instanceof Error ? err.message : 'Failed to update category' };
  }
}

export async function deleteCategoryAction(id: string): Promise<{ success?: boolean; error?: string }> {
  try {
    const client = await createCategoryClient();
    await client.deleteCategory({ id });
    revalidatePath('/admin/categories');
    return { success: true };
  } catch (err) {
    if (isConnectError(err)) {
      return { error: err.message };
    }
    return { error: err instanceof Error ? err.message : 'Failed to delete category' };
  }
}

// Simple list for selectors (returns all categories)
export async function listCategoriesAction() {
  try {
    const client = await createCategoryClient();
    const response = await client.listCategories({
      pagination: { limit: 1000, offset: 0 },
    });
    return (response.categories ?? []).map((c) => ({
      id: c.id,
      name: c.name,
      slug: c.slug,
    }));
  } catch (err) {
    if (isConnectError(err)) {
      logger.error('ListCategories RPC error', { error: err.message });
    }
    return [];
  }
}
