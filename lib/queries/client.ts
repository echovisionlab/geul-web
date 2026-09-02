import { timestampDate } from '@bufbuild/protobuf/wkt';
import { FilterOp, type SortOrder } from '@echovisionlab/geul-proto/common/common_pb.ts';
import { createClientClient } from '@/lib/api/server-client';
import { createLogger } from '@/lib/utils/logger';
import { themedAssetRefUrl } from '@/lib/utils/asset-ref';

const logger = createLogger('client-queries');

interface ClientListInput {
  filter?: unknown;
  filterBy?: 'AND' | 'OR';
  sort?: { field: string; order?: 'asc' | 'desc' }[];
  page?: number;
  pageSize?: number;
  search?: string;
}

// Admin: list clients with stats
export async function listClientsAdmin(input: ClientListInput) {
  try {
    const client = await createClientClient();
    const limit = input.pageSize ?? 20;
    const page = input.page ?? 1;
    const offset = (page - 1) * limit;

    const sorts = input.sort?.map((s) => ({
      field: s.field,
      order: (s.order === 'desc' ? 2 : 1) as SortOrder,
    }));

    const response = await client.listClientsAdmin({
      pagination: { limit, offset },
      filters: input.search ? [{ field: 'search', op: FilterOp.ILIKE, value: input.search }] : undefined,
      sorts,
    });

    const total = response.pagination?.total ?? 0;

    return {
      data: (response.clients ?? []).map((cws) => ({
        id: cws.client?.id ?? '',
        name: cws.client?.name ?? '',
        website: cws.client?.website ?? null,
        logoUrl: themedAssetRefUrl(cws.client?.logoLightAsset, cws.client?.logoDarkAsset),
        logoLightUrl: cws.client?.logoLightAsset?.url ?? null,
        logoDarkUrl: cws.client?.logoDarkAsset?.url ?? null,
        workCount: cws.workCount,
        createdAt: cws.client?.createdAt ? timestampDate(cws.client.createdAt) : null,
      })),
      total,
      page,
      pageSize: limit,
      totalPages: Math.ceil(total / limit),
    };
  } catch (err) {
    logger.error('Failed to list clients admin', { error: err });
    return { data: [], total: 0, page: 1, pageSize: 20, totalPages: 0 };
  }
}
