import { create } from '@bufbuild/protobuf';
import { timestampDate } from '@bufbuild/protobuf/wkt';
import {
  FilterOp,
  FilterSpecSchema,
  SortSpecSchema,
  type SortOrder,
} from '@echovisionlab/geul-proto/common/common_pb.ts';
import { createPublicReleaseClient, createReleaseClient } from '@/lib/api/browser-client';
import { publicReleaseTypeToString, stringToPublicReleaseType } from '@/lib/types/release/proto';
import { createClientLogger, serializeClientLogError } from '@/lib/utils/client-logger';

const logger = createClientLogger('release-browser');

export async function listPublishedReleases(input: {
  types?: ('album' | 'ep' | 'single' | 'compilation')[];
  categoryIds?: string[];
  artistId?: string;
  labelId?: string;
  limit?: number;
  offset?: number;
  sortBy?: 'title' | 'release_date' | 'published_at';
  sortOrder?: 'asc' | 'desc';
}) {
  const client = createPublicReleaseClient();
  const filters = [];
  if (input.types && input.types.length > 0) {
    filters.push(
      create(FilterSpecSchema, {
        field: 'type',
        op: FilterOp.IN,
        values: input.types.map((t) => String(stringToPublicReleaseType(t))),
      }),
    );
  }
  if (input.artistId) {
    filters.push(create(FilterSpecSchema, { field: 'artist_id', op: FilterOp.EQ, value: input.artistId }));
  }
  if (input.categoryIds && input.categoryIds.length > 0) {
    filters.push(
      create(FilterSpecSchema, {
        field: 'category_id',
        op: FilterOp.IN,
        values: input.categoryIds,
      }),
    );
  }
  if (input.labelId) {
    filters.push(create(FilterSpecSchema, { field: 'label_id', op: FilterOp.EQ, value: input.labelId }));
  }
  const limit = input.limit ?? 20;
  const offset = input.offset ?? 0;
  const response = await client.list({
    pagination: { limit, offset },
    filters,
    sorts: input.sortBy
      ? [
          create(SortSpecSchema, {
            field: input.sortBy,
            order: (input.sortOrder === 'asc' ? 1 : 2) as SortOrder,
          }),
        ]
      : undefined,
  });

  return {
    releases: (response.releases ?? []).map((r) => ({
      id: r.id,
      title: r.title,
      slug: r.slug ?? null,
      type: publicReleaseTypeToString(r.type),
      ogImageUrl: r.artworkAsset?.url ?? null,
      artworkUrl: r.artworkAsset?.url ?? null,
      releaseDate: r.releaseDate ? timestampDate(r.releaseDate) : null,
      publishedAt: r.publishedAt ? timestampDate(r.publishedAt) : null,
      artists: (r.artists ?? []).map((a) => ({
        id: a.id,
        name: a.name,
        slug: a.slug ?? null,
        role: a.role,
        imageUrl: a.imageAsset?.url ?? null,
      })),
    })),
    pagination: {
      total: response.pagination?.total ?? 0,
      limit,
      offset,
    },
  };
}

export async function checkReleaseSlugAvailable(
  slug: string,
  excludeReleaseId?: string,
): Promise<{ available: boolean }> {
  try {
    const client = createReleaseClient();
    const response = await client.checkReleaseSlugAvailable({
      slug,
      excludeReleaseId,
    });
    return { available: response.available };
  } catch (err) {
    logger.error('Failed to check release slug', { error: serializeClientLogError(err) });
    return { available: false };
  }
}
