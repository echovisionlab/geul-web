import { isConnectErrorCode } from '@/lib/api/connect-error';
import { Code } from '@connectrpc/connect';
import { SortOrder } from '@echovisionlab/geul-proto/common/common_pb.ts';
import { createPublicCategoryClient, createPublicTagClient } from '@/lib/api/server-client';

export interface PublicCategoryTaxonomy {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  postCount: number;
}

export interface PublicTagTaxonomy {
  id: string;
  name: string;
  slug: string;
  postCount: number;
}

const TAXONOMY_PAGE_SIZE = 200;

async function listAllPublicCategories(): Promise<PublicCategoryTaxonomy[]> {
  const client = createPublicCategoryClient();
  const categories: PublicCategoryTaxonomy[] = [];
  let offset = 0;

  while (true) {
    const response = await client.list({
      pagination: { limit: TAXONOMY_PAGE_SIZE, offset },
      sorts: [{ field: 'name', order: SortOrder.ASC }],
    });

    categories.push(
      ...(response.categories ?? []).map((c) => ({
        id: c.id,
        name: c.name,
        slug: c.slug,
        description: c.description ?? null,
        postCount: c.postCount,
      })),
    );

    if (!response.pagination?.hasMore) {
      break;
    }
    offset += TAXONOMY_PAGE_SIZE;
  }

  return categories;
}

async function listAllPublicTags(): Promise<PublicTagTaxonomy[]> {
  const client = createPublicTagClient();
  const tags: PublicTagTaxonomy[] = [];
  let offset = 0;

  while (true) {
    const response = await client.list({
      pagination: { limit: TAXONOMY_PAGE_SIZE, offset },
      sorts: [{ field: 'name', order: SortOrder.ASC }],
    });

    tags.push(
      ...(response.tags ?? []).map((t) => ({
        id: t.id,
        name: t.name,
        slug: t.slug,
        postCount: t.postCount,
      })),
    );

    if (!response.pagination?.hasMore) {
      break;
    }
    offset += TAXONOMY_PAGE_SIZE;
  }

  return tags;
}

export async function listPublicCategories(): Promise<PublicCategoryTaxonomy[]> {
  return listAllPublicCategories();
}

export async function listPublicTags(): Promise<PublicTagTaxonomy[]> {
  return listAllPublicTags();
}

export async function getPublicCategoryBySlug(slug: string): Promise<PublicCategoryTaxonomy | null> {
  try {
    const categories = await listAllPublicCategories();
    return categories.find((c) => c.slug === slug) ?? null;
  } catch (err) {
    if (isConnectErrorCode(err, Code.NotFound)) {
      return null;
    }
    return null;
  }
}

export async function getPublicTagBySlug(slug: string): Promise<PublicTagTaxonomy | null> {
  try {
    const tags = await listAllPublicTags();
    return tags.find((t) => t.slug === slug) ?? null;
  } catch (err) {
    if (isConnectErrorCode(err, Code.NotFound)) {
      return null;
    }
    return null;
  }
}
