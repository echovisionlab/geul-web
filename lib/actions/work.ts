'use server';

import { isConnectErrorCode } from '@/lib/api/connect-error';
import { revalidatePath } from 'next/cache';
import { create, type JsonObject } from '@bufbuild/protobuf';
import { timestampDate } from '@bufbuild/protobuf/wkt';
import { Code } from '@connectrpc/connect';
import {
  FilterOp,
  FilterSpecSchema,
  SortSpecSchema,
  type SortOrder,
} from '@echovisionlab/geul-proto/common/common_pb.ts';
import { ShareLinkEntityType, type ShareLinkItem } from '@echovisionlab/geul-proto/secure/share_link_pb.ts';
import {
  MyCreditedWorkCreditType,
  WorkClientsUpdateSchema,
  WorkStatus,
  WorkType,
} from '@echovisionlab/geul-proto/secure/work_pb.ts';
import { createShareLinkAction, deleteShareLinkAction, listShareLinksAction } from '@/lib/actions/share-link';
import { createArtistClient, createPublicWorkClient, createWorkClient } from '@/lib/api/server-client';
import { regenerateOgImageAction as requestOgImageRegeneration } from '@/lib/actions/og-generation';
import { createCommittedMutationRevalidator } from '@/lib/actions/revalidate-after-commit';
import { filterOpFromString } from '@/lib/types/common/proto-filter';
import { WORK_TYPE_FILTER_VALUES } from '@/lib/types/work/model';
import {
  publicWorkTypeToString,
  stringToWorkStatus,
  stringToWorkType,
  workStatusToString,
  workTypeToString,
} from '@/lib/types/work/proto';
import { mapWorkCredits } from '@/lib/types/work/credit';
import { createLogger } from '@/lib/utils/logger';
import { toSlugInputValue } from '@/lib/utils/slug';

const logger = createLogger('work-actions');
const revalidateWorkAfterCommit = createCommittedMutationRevalidator('work-actions', 'work');

interface WorkListInput {
  filter?: unknown;
  filterBy?: 'AND' | 'OR';
  sort?: { field: string; order?: 'asc' | 'desc' }[];
  page?: number;
  pageSize?: number;
  search?: string;
  type?: 'music_project' | 'portfolio' | 'article' | 'contribution';
  status?: 'draft' | 'published' | 'archived';
}

interface LocalFilterSpec {
  field: string;
  op: string;
  value: unknown;
}

function toLocalFilterSpecs(rawFilter: unknown): LocalFilterSpec[] {
  if (!Array.isArray(rawFilter)) {
    return [];
  }

  return rawFilter
    .filter((item): item is Record<string, unknown> => item !== null && typeof item === 'object')
    .map((item) => ({
      field: typeof item.field === 'string' ? item.field : '',
      op: typeof item.op === 'string' ? item.op : 'eq',
      value: item.value,
    }))
    .filter((item) => item.field.length > 0);
}

function toStringValue(value: unknown): string | null {
  if (typeof value === 'string') {
    return value;
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  return null;
}

function creditedWorkCreditTypeToString(creditType: MyCreditedWorkCreditType): 'artist' | 'member' | 'name' {
  switch (creditType) {
    case MyCreditedWorkCreditType.ARTIST:
      return 'artist';
    case MyCreditedWorkCreditType.MEMBER:
      return 'member';
    case MyCreditedWorkCreditType.NAME:
      return 'name';
    default:
      return 'name';
  }
}

// === List Actions ===

export async function listWorksPublishedAction(options?: {
  types?: ('music_project' | 'portfolio' | 'article' | 'contribution')[];
  featured?: boolean;
  limit?: number;
  offset?: number;
  sortBy?: 'title' | 'published_at' | 'updated_at';
  sortOrder?: 'asc' | 'desc';
}) {
  try {
    const client = createPublicWorkClient();
    const filters = [];
    if (options?.types && options.types.length > 0) {
      filters.push(
        create(FilterSpecSchema, {
          field: 'type',
          op: FilterOp.IN,
          values: options.types.map((type) => WORK_TYPE_FILTER_VALUES[type]),
        }),
      );
    }
    if (options?.featured !== undefined) {
      filters.push(
        create(FilterSpecSchema, {
          field: 'featured',
          op: FilterOp.EQ,
          value: String(options.featured),
        }),
      );
    }
    const limit = options?.limit ?? 20;
    const offset = options?.offset ?? 0;
    const response = await client.list({
      pagination: { limit, offset },
      filters,
      sorts: options?.sortBy
        ? [
            create(SortSpecSchema, {
              field: options.sortBy,
              order: (options.sortOrder === 'asc' ? 1 : 2) as SortOrder,
            }),
          ]
        : undefined,
    });

    return {
      works: (response.works ?? []).map((w) => ({
        id: w.id,
        title: w.title,
        slug: w.slug ?? null,
        type: publicWorkTypeToString(w.type),
        summary: w.summary ?? null,
        featuredImageUrl: w.featuredImageAsset?.url ?? null,
        featured: w.featured,
        mapPlaceId: w.mapPlaceId ?? null,
        publishedAt: w.publishedAt ? timestampDate(w.publishedAt) : null,
      })),
      pagination: {
        total: response.pagination?.total ?? 0,
        limit,
        offset,
      },
    };
  } catch (err) {
    logger.error('Failed to list published works', { error: err });
    return {
      works: [],
      pagination: {
        total: 0,
        limit: options?.limit ?? 20,
        offset: options?.offset ?? 0,
      },
    };
  }
}

export async function listWorksAdminAction(input: WorkListInput) {
  try {
    const client = await createWorkClient();
    const limit = input.pageSize ?? 20;
    const page = input.page ?? 1;
    const offset = (page - 1) * limit;

    const sorts = input.sort?.map((s) => ({
      field: s.field,
      order: (s.order === 'desc' ? 2 : 1) as SortOrder,
    }));

    const filters = [];
    const workType = stringToWorkType(input.type);
    if (workType !== WorkType.UNSPECIFIED) {
      filters.push(create(FilterSpecSchema, { field: 'type', op: FilterOp.EQ, value: String(workType) }));
    }
    const workStatus = stringToWorkStatus(input.status);
    if (workStatus !== WorkStatus.UNSPECIFIED) {
      filters.push(create(FilterSpecSchema, { field: 'status', op: FilterOp.EQ, value: String(workStatus) }));
    }
    if (input.search) {
      filters.push(create(FilterSpecSchema, { field: 'search', op: FilterOp.ILIKE, value: input.search }));
    }
    const response = await client.listWorksAdmin({
      pagination: { limit, offset },
      filters,
      sorts,
    });

    const total = response.pagination?.total ?? 0;

    return {
      data: (response.works ?? []).map((wws) => ({
        id: wws.work?.id ?? '',
        title: wws.work?.title ?? '',
        slug: wws.work?.slug ?? null,
        type: workTypeToString(wws.work?.type ?? WorkType.MUSIC_PROJECT),
        featuredImageUrl: wws.work?.featuredImageAsset?.url ?? null,
        featured: wws.work?.featured ?? false,
        status: workStatusToString(wws.work?.status ?? WorkStatus.DRAFT),
        creditCount: wws.creditCount,
        clientCount: wws.clientCount,
        createdAt: wws.work?.createdAt ? timestampDate(wws.work.createdAt) : null,
        updatedAt: wws.work?.updatedAt ? timestampDate(wws.work.updatedAt) : null,
      })),
      total,
      page,
      pageSize: limit,
      totalPages: Math.ceil(total / limit),
    };
  } catch (err) {
    logger.error('Failed to list works admin', { error: err });
    return { data: [], total: 0, page: 1, pageSize: 20, totalPages: 0 };
  }
}

// === CRUD Actions ===

export async function createWorkAction(data: {
  title: string;
  type: 'music_project' | 'portfolio' | 'article' | 'contribution';
  year: number;
  month: number;
  untilYear: number | null;
  untilMonth: number | null;
  isPresent: boolean;
  summary?: string;
  metadata?: Record<string, unknown>;
  featured?: boolean;
}): Promise<{ data?: { id: string }; error?: string }> {
  try {
    const client = await createWorkClient();
    const work = await client.createWork({
      title: data.title,
      type: stringToWorkType(data.type),
      year: data.year,
      month: data.month,
      untilYear: data.untilYear ?? undefined,
      untilMonth: data.untilMonth ?? undefined,
      isPresent: data.isPresent,
      summary: data.summary,
      metadata: data.metadata as JsonObject,
      featured: data.featured,
    });
    revalidatePath('/admin/works');
    return { data: { id: work.id } };
  } catch (err) {
    if (isConnectErrorCode(err, Code.Unauthenticated)) {
      return { error: 'Unauthorized' };
    }
    return { error: err instanceof Error ? err.message : 'Failed to create work' };
  }
}

export async function deleteWorkAction(id: string): Promise<{ success?: boolean; error?: string }> {
  try {
    const client = await createWorkClient();
    await client.deleteWork({ id });
    revalidateWorkAfterCommit('/admin/works');
    return { success: true };
  } catch (err) {
    if (isConnectErrorCode(err, Code.Unauthenticated)) {
      return { error: 'Unauthorized' };
    }
    return { error: err instanceof Error ? err.message : 'Failed to delete work' };
  }
}

// === Status Actions ===

export async function publishWorkAction(id: string): Promise<{ success?: boolean; error?: string }> {
  try {
    const client = await createWorkClient();
    await client.publishWork({ id });
    revalidatePath('/admin/works');
    revalidatePath(`/works/${id}`);
    return { success: true };
  } catch (err) {
    if (isConnectErrorCode(err, Code.Unauthenticated)) {
      return { error: 'Unauthorized' };
    }
    if (isConnectErrorCode(err, Code.NotFound)) {
      return { error: 'Work not found' };
    }
    return { error: err instanceof Error ? err.message : 'Failed to publish work' };
  }
}

export async function unpublishWorkAction(id: string): Promise<{ success?: boolean; error?: string }> {
  try {
    const client = await createWorkClient();
    await client.unpublishWork({ id });
    revalidatePath('/admin/works');
    revalidatePath(`/works/${id}`);
    return { success: true };
  } catch (err) {
    if (isConnectErrorCode(err, Code.Unauthenticated)) {
      return { error: 'Unauthorized' };
    }
    if (isConnectErrorCode(err, Code.NotFound)) {
      return { error: 'Work not found' };
    }
    return { error: err instanceof Error ? err.message : 'Failed to unpublish work' };
  }
}

// === Slug Actions ===

export async function updateWorkSlugAction(
  id: string,
  slug: string | null,
): Promise<{ success?: boolean; slug?: string | null; error?: string }> {
  try {
    const client = await createWorkClient();
    await client.updateWork({
      id,
      slug: toSlugInputValue(slug),
    });
    return { success: true, slug };
  } catch (err) {
    if (isConnectErrorCode(err, Code.PermissionDenied)) {
      return { error: 'No permission to edit this work' };
    }
    return { error: err instanceof Error ? err.message : 'Failed to update slug' };
  }
}

export async function updateWorkAction(
  id: string,
  data: {
    mapPlaceId?: string | null;
  },
): Promise<{ success?: boolean; error?: string }> {
  try {
    const client = await createWorkClient();
    const request: { id: string; mapPlaceId?: string } = { id };
    if ('mapPlaceId' in data) {
      request.mapPlaceId = data.mapPlaceId ?? '';
    }
    await client.updateWork(request);
    revalidateWorkAfterCommit(`/works/${id}`);
    return { success: true };
  } catch (err) {
    if (isConnectErrorCode(err, Code.PermissionDenied)) {
      return { error: 'No permission to edit this work' };
    }
    return { error: err instanceof Error ? err.message : 'Failed to update work' };
  }
}

export async function updateWorkFieldsAction(
  id: string,
  data: {
    type?: string;
    metadata?: Record<string, unknown>;
    featured?: boolean;
    clients?: readonly string[];
    year?: number;
    month?: number;
    untilYear?: number | null;
    untilMonth?: number | null;
    isPresent?: boolean;
  },
): Promise<{ success?: boolean; error?: string }> {
  try {
    const client = await createWorkClient();
    await client.updateWork({
      id,
      type: data.type === undefined ? undefined : stringToWorkType(data.type),
      metadata: data.metadata as JsonObject | undefined,
      featured: data.featured,
      clients:
        data.clients === undefined ? undefined : create(WorkClientsUpdateSchema, { clientIds: [...data.clients] }),
      year: data.year,
      month: data.month,
      untilYear: data.untilYear ?? undefined,
      untilMonth: data.untilMonth ?? undefined,
      isPresent: data.isPresent,
    });
    revalidateWorkAfterCommit(`/works/${id}`);
    return { success: true };
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Failed to update work fields' };
  }
}

// === Featured Image Actions ===

export async function setWorkFeaturedImageAction(
  workId: string,
  fileId: string,
): Promise<{ success?: boolean; imageUrl?: string; ogGenerationRunId?: string; error?: string }> {
  try {
    const client = await createWorkClient();
    const response = await client.setWorkFeaturedImage({ workId, fileId });
    const result = {
      success: true,
      imageUrl: response.imageAsset?.url,
    };
    return response.ogGenerationRunId ? { ...result, ogGenerationRunId: response.ogGenerationRunId } : result;
  } catch (err) {
    if (isConnectErrorCode(err, Code.Unauthenticated)) {
      return { error: 'Unauthorized' };
    }
    if (isConnectErrorCode(err, Code.NotFound)) {
      return { error: 'Work or file not found' };
    }
    if (isConnectErrorCode(err, Code.PermissionDenied)) {
      return { error: 'No permission to edit this work' };
    }
    return { error: err instanceof Error ? err.message : 'Failed to set featured image' };
  }
}

export async function removeWorkFeaturedImageAction(
  workId: string,
): Promise<{ success?: boolean; ogGenerationRunId?: string; error?: string }> {
  try {
    const client = await createWorkClient();
    const result = await client.deleteWorkFeaturedImage({ workId });
    return result.ogGenerationRunId
      ? { success: true, ogGenerationRunId: result.ogGenerationRunId }
      : { success: true };
  } catch (err) {
    if (isConnectErrorCode(err, Code.Unauthenticated)) {
      return { error: 'Unauthorized' };
    }
    return { error: err instanceof Error ? err.message : 'Failed to remove featured image' };
  }
}

// === Credit Actions ===

export async function getWorkGroupsWithCreditsAction(workId: string) {
  try {
    const client = await createWorkClient();
    const response = await client.getWorkCredits({ workId });

    return {
      groups: (response.groups ?? []).map((g, sortOrder) => ({
        id: g.id,
        workId: g.workId,
        name: g.name,
        sortOrder,
      })),
      credits: mapWorkCredits(response.credits ?? []),
    };
  } catch (err) {
    logger.error('Failed to get work credits', { error: err });
    return { groups: [], credits: [] };
  }
}

export async function addWorkCreditAction(data: {
  workId: string;
  groupId?: string | null;
  artistId?: string;
  memberId?: string;
  name?: string;
  creditRole?: string | null;
}): Promise<{ success?: boolean; creditId?: string; error?: string }> {
  try {
    const client = await createWorkClient();
    const credit = await client.addWorkCredit({
      workId: data.workId,
      groupId: data.groupId ?? undefined,
      artistId: data.artistId,
      memberId: data.memberId,
      name: data.name,
      creditRole: data.creditRole ?? undefined,
    });
    return { success: true, creditId: credit.id };
  } catch (err) {
    if (isConnectErrorCode(err, Code.Unauthenticated)) {
      return { error: 'Unauthorized' };
    }
    if (isConnectErrorCode(err, Code.PermissionDenied)) {
      return { error: 'No permission to edit this work' };
    }
    return { error: err instanceof Error ? err.message : 'Failed to add credit' };
  }
}

export async function updateWorkCreditAction(
  creditId: string,
  data: { groupId?: string | null; creditRole?: string | null },
): Promise<{ success?: boolean; error?: string }> {
  try {
    const client = await createWorkClient();
    await client.updateWorkCredit({
      creditId,
      groupId: data.groupId === null ? '' : data.groupId,
      creditRole: data.creditRole ?? undefined,
    });
    return { success: true };
  } catch (err) {
    if (isConnectErrorCode(err, Code.Unauthenticated)) {
      return { error: 'Unauthorized' };
    }
    if (isConnectErrorCode(err, Code.PermissionDenied)) {
      return { error: 'No permission to edit this work' };
    }
    return { error: err instanceof Error ? err.message : 'Failed to update credit' };
  }
}

export async function removeWorkCreditAction(creditId: string): Promise<{ success?: boolean; error?: string }> {
  try {
    const client = await createWorkClient();
    await client.deleteWorkCredit({ creditId });
    return { success: true };
  } catch (err) {
    if (isConnectErrorCode(err, Code.Unauthenticated)) {
      return { error: 'Unauthorized' };
    }
    if (isConnectErrorCode(err, Code.PermissionDenied)) {
      return { error: 'No permission to edit this work' };
    }
    return { error: err instanceof Error ? err.message : 'Failed to remove credit' };
  }
}

export async function regenerateWorkOgImageAction(
  workId: string,
  locale: string,
): Promise<{ success?: boolean; runId?: string; generationId?: string; error?: string }> {
  const result = await requestOgImageRegeneration({
    entityType: 'work',
    entityId: workId,
    selection: { type: 'locale', locale },
  });
  if (result.error) {
    return { error: result.error };
  }
  return { success: true, runId: result.runId, generationId: result.generationIds?.[0] };
}

export async function createWorkCreditGroupAction(_data: {
  workId: string;
  name: string;
}): Promise<{ success?: boolean; group?: { id: string; name: string }; error?: string }> {
  try {
    const client = await createWorkClient();
    const group = await client.createWorkCreditGroup({
      workId: _data.workId,
      name: _data.name,
    });
    return {
      success: true,
      group: {
        id: group.id,
        name: group.name,
      },
    };
  } catch (err) {
    if (isConnectErrorCode(err, Code.Unauthenticated)) {
      return { error: 'Unauthorized' };
    }
    if (isConnectErrorCode(err, Code.PermissionDenied)) {
      return { error: 'No permission to edit this work' };
    }
    if (isConnectErrorCode(err, Code.NotFound)) {
      return { error: 'Work not found' };
    }
    return { error: err instanceof Error ? err.message : 'Failed to create credit group' };
  }
}

export async function updateWorkCreditGroupAction(
  groupId: string,
  data: { name?: string },
): Promise<{ success?: boolean; error?: string }> {
  try {
    const client = await createWorkClient();
    await client.updateWorkCreditGroup({
      groupId,
      name: data.name,
    });
    return { success: true };
  } catch (err) {
    if (isConnectErrorCode(err, Code.Unauthenticated)) {
      return { error: 'Unauthorized' };
    }
    if (isConnectErrorCode(err, Code.PermissionDenied)) {
      return { error: 'No permission to edit this work' };
    }
    if (isConnectErrorCode(err, Code.NotFound)) {
      return { error: 'Credit group not found' };
    }
    return { error: err instanceof Error ? err.message : 'Failed to update credit group' };
  }
}

export async function deleteWorkCreditGroupAction(groupId: string): Promise<{ success?: boolean; error?: string }> {
  try {
    const client = await createWorkClient();
    await client.deleteWorkCreditGroup({ groupId });
    return { success: true };
  } catch (err) {
    if (isConnectErrorCode(err, Code.Unauthenticated)) {
      return { error: 'Unauthorized' };
    }
    if (isConnectErrorCode(err, Code.PermissionDenied)) {
      return { error: 'No permission to edit this work' };
    }
    if (isConnectErrorCode(err, Code.NotFound)) {
      return { error: 'Credit group not found' };
    }
    return { error: err instanceof Error ? err.message : 'Failed to delete credit group' };
  }
}

export async function searchArtistsForCreditAction(_workId: string, _query: string) {
  const query = _query.trim();
  if (!query) {
    return [];
  }

  try {
    const client = await createArtistClient();
    const response = await client.listArtists({
      pagination: { limit: 10, offset: 0 },
      filters: [create(FilterSpecSchema, { field: 'search', op: FilterOp.ILIKE, value: query })],
      sorts: [{ field: 'name', order: 1 as SortOrder }],
    });

    return (response.artists ?? []).map((artist) => ({
      id: artist.id,
      name: artist.name,
      imageUrl: artist.imageAsset?.url ?? null,
    }));
  } catch (err) {
    logger.error('Failed to search artists for work credit', { error: err });
    return [];
  }
}

// Share link operations - uses generic ShareLinkService
export async function listWorkShareLinksAction(workId: string): Promise<ShareLinkItem[]> {
  return listShareLinksAction(ShareLinkEntityType.WORK, workId);
}

export async function createWorkShareLinkAction(data: {
  workId: string;
  label?: string;
  expiresAt?: Date;
  password?: string;
}): Promise<{ shareLink?: ShareLinkItem; error?: string }> {
  return createShareLinkAction(ShareLinkEntityType.WORK, data.workId, {
    label: data.label,
    expiresAt: data.expiresAt,
    password: data.password,
  });
}

export async function deleteWorkShareLinkAction(id: string): Promise<{ success?: boolean; error?: string }> {
  return deleteShareLinkAction(id);
}

export async function listMyCreditedWorksAction(input: WorkListInput) {
  const limit = input.pageSize ?? 20;
  const page = input.page ?? 1;
  const offset = (page - 1) * limit;

  try {
    const client = await createWorkClient();

    const sorts = input.sort?.map((s) => ({
      field: s.field,
      order: (s.order === 'desc' ? 2 : 1) as SortOrder,
    }));

    const filters: Array<{
      field: string;
      op: FilterOp;
      value?: string;
      values?: string[];
    }> = [];

    if (input.search?.trim()) {
      filters.push({
        field: 'search',
        op: FilterOp.ILIKE,
        value: input.search.trim(),
      });
    }

    if (input.type) {
      filters.push({
        field: 'type',
        op: FilterOp.EQ,
        value: String(stringToWorkType(input.type)),
      });
    }

    if (input.status) {
      filters.push({
        field: 'status',
        op: FilterOp.EQ,
        value: String(stringToWorkStatus(input.status)),
      });
    }

    const uiFilters = toLocalFilterSpecs(input.filter);
    for (const filter of uiFilters) {
      if (filter.field !== 'title' && filter.field !== 'type' && filter.field !== 'status') {
        continue;
      }

      const mappedOp = filterOpFromString(filter.op, filter.value);
      if (!mappedOp) {
        continue;
      }

      if (mappedOp === FilterOp.IS_NULL || mappedOp === FilterOp.IS_NOT_NULL) {
        filters.push({ field: filter.field, op: mappedOp });
        continue;
      }

      if (mappedOp === FilterOp.IN) {
        if (!Array.isArray(filter.value)) {
          continue;
        }
        const values = filter.value
          .map((value) => toStringValue(value))
          .filter((value): value is string => value !== null);
        if (values.length === 0) {
          continue;
        }
        filters.push({
          field: filter.field,
          op: mappedOp,
          values,
        });
        continue;
      }

      const value = toStringValue(filter.value);
      if (value === null) {
        continue;
      }
      filters.push({
        field: filter.field,
        op: mappedOp,
        value,
      });
    }

    const response = await client.listMyCreditedWorks({
      pagination: { limit, offset },
      filters: filters.length > 0 ? filters : undefined,
      sorts,
    });

    const total = response.pagination?.total ?? 0;

    return {
      data: (response.works ?? []).map((work) => ({
        id: work.workId,
        title: work.title,
        slug: work.slug ?? null,
        type: workTypeToString(work.type),
        status: workStatusToString(work.status),
        creditId: work.creditId,
        creditRole: work.creditRole ?? null,
        creditType: creditedWorkCreditTypeToString(work.creditType),
        creditedAs: work.creditedAs,
        creditedAsImage: work.creditedAsImageAsset?.url ?? null,
      })),
      total,
      page,
      pageSize: limit,
      totalPages: Math.ceil(total / limit),
    };
  } catch (err) {
    logger.error('Failed to list my credited works', { error: err });
    return { data: [], total: 0, page, pageSize: limit, totalPages: 0 };
  }
}
