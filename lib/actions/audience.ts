'use server';

import { isConnectError } from '@/lib/api/connect-error';
import { create } from '@bufbuild/protobuf';
import { timestampDate } from '@bufbuild/protobuf/wkt';
import {
  FilterOp,
  FilterSpecSchema,
  PaginationRequestSchema,
  SortOrder,
  SortSpecSchema,
} from '@echovisionlab/geul-proto/common/common_pb.ts';
import { SegmentConfigSchema, SegmentType, type SegmentConfig } from '@echovisionlab/geul-proto/secure/audience_pb.ts';
import { AuthorizationRole } from '@echovisionlab/geul-proto/policy/access_pb.ts';
import { createCommittedMutationRevalidator } from '@/lib/actions/revalidate-after-commit';
import { createAudienceClient } from '@/lib/api/server-client';
import { createLogger } from '@/lib/utils/logger';

const logger = createLogger('audience-actions');
const revalidateAudienceAfterCommit = createCommittedMutationRevalidator('audience-actions', 'audience');
const ACTIVE_SEGMENT_PAGE_SIZE = 100;

interface SegmentListInput {
  filter?: unknown;
  filterBy?: 'AND' | 'OR';
  sort?: { field: string; order?: 'asc' | 'desc' }[];
  page?: number;
  pageSize?: number;
  search?: string;
  includeArchived?: boolean;
}

function segmentTypeToLabel(type: SegmentType): string {
  switch (type) {
    case SegmentType.ALL_MEMBERS:
      return 'All Users';
    case SegmentType.MEMBER_TAGS:
      return 'User Tags';
    case SegmentType.MEMBERS_BY_FILTER:
      return 'Users by Filter';
    default:
      return 'Unknown';
  }
}

function accountRoleToValue(role: AuthorizationRole): string | null {
  switch (role) {
    case AuthorizationRole.ADMIN:
      return 'admin';
    case AuthorizationRole.AUTHOR:
      return 'author';
    case AuthorizationRole.USER:
      return 'user';
    case AuthorizationRole.UNSPECIFIED:
    default:
      return null;
  }
}

export async function listSegmentsAdminAction(input: SegmentListInput) {
  try {
    const client = await createAudienceClient();
    const { page = 1, pageSize = 20, search, sort, includeArchived = false } = input;

    const response = await client.listSegmentsAdmin({
      pagination: create(PaginationRequestSchema, {
        limit: pageSize,
        offset: (page - 1) * pageSize,
      }),
      filters: search ? [create(FilterSpecSchema, { field: 'search', op: FilterOp.ILIKE, value: search })] : undefined,
      sorts: sort?.map((s) =>
        create(SortSpecSchema, {
          field: s.field,
          order: s.order === 'asc' ? SortOrder.ASC : SortOrder.DESC,
        }),
      ),
      includeArchived,
    });

    const total = response.pagination?.total ?? 0;

    return {
      data: (response.segments ?? []).map((s) => ({
        id: s.id,
        name: s.name,
        description: s.description ?? '',
        segment_type: s.segmentType,
        segment_type_label: segmentTypeToLabel(s.segmentType),
        estimated_count: s.estimatedCount ?? null,
        campaign_count: s.campaignCount,
        delivery_run_count: s.deliveryRunCount,
        download_policy_reference_count: s.downloadPolicyReferenceCount,
        archived_at: s.archivedAt ? timestampDate(s.archivedAt) : null,
        created_at: s.createdAt ? timestampDate(s.createdAt) : new Date(),
      })),
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  } catch (err) {
    if (isConnectError(err)) {
      logger.error('ListSegments RPC error', { error: err.message });
    }
    return { data: [], total: 0, page: 1, pageSize: 20, totalPages: 0 };
  }
}

export async function createSegmentAction(input: {
  name: string;
  description?: string;
  segmentType: SegmentType;
  config?: SegmentConfig;
}): Promise<{ data?: { id: string }; error?: string }> {
  try {
    const client = await createAudienceClient();
    const segment = await client.createSegment({
      name: input.name,
      description: input.description,
      segmentType: input.segmentType,
      config: input.config ?? create(SegmentConfigSchema, {}),
    });
    revalidateAudienceAfterCommit('/admin/audience-segments');
    revalidateAudienceAfterCommit('/admin/campaigns');
    return { data: { id: segment.id } };
  } catch (err) {
    if (isConnectError(err)) {
      return { error: err.message };
    }
    return { error: err instanceof Error ? err.message : 'Failed to create segment' };
  }
}

export async function archiveSegmentAction(id: string): Promise<{ success?: boolean; error?: string }> {
  try {
    const client = await createAudienceClient();
    await client.archiveSegment({ id });
    revalidateAudienceAfterCommit('/admin/audience-segments');
    revalidateAudienceAfterCommit('/admin/campaigns');
    return { success: true };
  } catch (err) {
    if (isConnectError(err)) {
      return { error: err.message };
    }
    return { error: err instanceof Error ? err.message : 'Failed to archive segment' };
  }
}

export async function restoreSegmentAction(id: string): Promise<{ success?: boolean; error?: string }> {
  try {
    const client = await createAudienceClient();
    await client.restoreSegment({ id });
    revalidateAudienceAfterCommit('/admin/audience-segments');
    revalidateAudienceAfterCommit('/admin/campaigns');
    return { success: true };
  } catch (err) {
    if (isConnectError(err)) {
      return { error: err.message };
    }
    return { error: err instanceof Error ? err.message : 'Failed to restore segment' };
  }
}

export async function listActiveSegmentsAction(): Promise<{ id: string; name: string; segmentTypeLabel: string }[]> {
  try {
    const client = await createAudienceClient();
    const segmentsById = new Map<string, { id: string; name: string; segmentTypeLabel: string }>();
    let offset = 0;

    for (;;) {
      const response = await client.listSegmentsAdmin({
        pagination: create(PaginationRequestSchema, {
          limit: ACTIVE_SEGMENT_PAGE_SIZE,
          offset,
        }),
        includeArchived: false,
      });
      const pageSegments = response.segments ?? [];
      for (const segment of pageSegments) {
        segmentsById.set(segment.id, {
          id: segment.id,
          name: segment.name,
          segmentTypeLabel: segmentTypeToLabel(segment.segmentType),
        });
      }

      const nextOffset = offset + pageSegments.length;
      const total = response.pagination?.total ?? nextOffset;
      const hasMore = Boolean(response.pagination?.hasMore) || nextOffset < total;
      if (!hasMore) {
        break;
      }
      if (pageSegments.length === 0) {
        throw new Error('Audience pagination did not advance');
      }
      offset = nextOffset;
    }

    return Array.from(segmentsById.values());
  } catch (err) {
    logger.error('Failed to load active Audience options', {
      error: err instanceof Error ? err.message : String(err),
    });
    throw new Error('Unable to load active Audience options');
  }
}

export async function getSegmentAction(id: string): Promise<{
  data?: {
    id: string;
    name: string;
    description: string;
    segmentType: SegmentType;
    config: {
      memberTagIds: string[];
      accountRoles: string[];
      createdAfter?: string;
      createdBefore?: string;
    };
    estimatedCount: number | null;
    archivedAt: Date | null;
  };
  error?: string;
}> {
  try {
    const client = await createAudienceClient();
    const segment = await client.getSegment({ id });
    return {
      data: {
        id: segment.id,
        name: segment.name,
        description: segment.description ?? '',
        segmentType: segment.segmentType,
        config: {
          memberTagIds: segment.config?.memberTagIds ?? [],
          accountRoles:
            segment.config?.accountRoles.flatMap((role) => {
              const mapped = accountRoleToValue(role);
              return mapped === null ? [] : [mapped];
            }) ?? [],
          createdAfter: segment.config?.createdAfter
            ? timestampDate(segment.config.createdAfter).toISOString()
            : undefined,
          createdBefore: segment.config?.createdBefore
            ? timestampDate(segment.config.createdBefore).toISOString()
            : undefined,
        },
        estimatedCount: segment.estimatedCount ?? null,
        archivedAt: segment.archivedAt ? timestampDate(segment.archivedAt) : null,
      },
    };
  } catch (err) {
    if (isConnectError(err)) {
      return { error: err.message };
    }
    return { error: err instanceof Error ? err.message : 'Failed to get segment' };
  }
}

export async function updateSegmentAction(input: {
  id: string;
  name?: string;
  description?: string;
  segmentType?: SegmentType;
  config?: SegmentConfig;
}): Promise<{ data?: { id: string }; error?: string }> {
  try {
    const client = await createAudienceClient();
    const segment = await client.updateSegment({
      id: input.id,
      name: input.name,
      description: input.description,
      segmentType: input.segmentType,
      config: input.config,
    });
    revalidateAudienceAfterCommit('/admin/audience-segments');
    revalidateAudienceAfterCommit('/admin/campaigns');
    return { data: { id: segment.id } };
  } catch (err) {
    if (isConnectError(err)) {
      return { error: err.message };
    }
    return { error: err instanceof Error ? err.message : 'Failed to update segment' };
  }
}

export async function estimateSegmentCountAction(input: {
  segmentType: SegmentType;
  config?: SegmentConfig;
}): Promise<{ count?: number; error?: string }> {
  try {
    const client = await createAudienceClient();
    const response = await client.estimateSegmentCount({
      segmentType: input.segmentType,
      config: input.config ?? create(SegmentConfigSchema, {}),
    });
    return { count: response.count };
  } catch (err) {
    if (isConnectError(err)) {
      return { error: err.message };
    }
    return { error: err instanceof Error ? err.message : 'Failed to estimate count' };
  }
}
