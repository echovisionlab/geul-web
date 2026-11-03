'use server';

import { queryResult } from '@/lib/api/query-result';

import { create } from '@bufbuild/protobuf';
import { timestampDate } from '@bufbuild/protobuf/wkt';
import {
  FilterOp,
  FilterSpecSchema,
  PaginationRequestSchema,
  SortOrder,
  SortSpecSchema,
} from '@echovisionlab/geul-proto/common/common_pb.ts';
import {
  MemberCriteriaConfigSchema,
  MemberCriteriaConfigSnapshotSchema,
  MemberCriteriaKind,
  type MemberCriteria,
  type MemberCriteriaConfig,
} from '@echovisionlab/geul-proto/secure/member_criteria_pb.ts';
import { AuthorizationRole } from '@echovisionlab/geul-proto/policy/access_pb.ts';
import type { ActionResult } from '@/lib/actions/action-result';
import { createCommittedMutationRevalidator } from '@/lib/actions/revalidate-after-commit';
import { runAction } from '@/lib/actions/run-action';
import { createMemberCriteriaClient } from '@/lib/api/server-client';
import { createLogger } from '@/lib/utils/logger';

const logger = createLogger('criteria-actions');
const revalidateCriteriaAfterCommit = createCommittedMutationRevalidator('criteria-actions', 'criteria');
const ACTIVE_CRITERIA_PAGE_SIZE = 100;

interface CriteriaListInput {
  filter?: unknown;
  filterBy?: 'AND' | 'OR';
  sort?: { field: string; order?: 'asc' | 'desc' }[];
  page?: number;
  pageSize?: number;
  search?: string;
  includeArchived?: boolean;
}

function kindToLabel(type: MemberCriteriaKind): string {
  switch (type) {
    case MemberCriteriaKind.ALL_MEMBERS:
      return 'All Users';
    case MemberCriteriaKind.MEMBER_TAGS:
      return 'User Tags';
    case MemberCriteriaKind.FILTER:
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

export async function listMemberCriteriaAdminAction(input: CriteriaListInput) {
  return queryResult(async () => {
    const client = await createMemberCriteriaClient();
    const { page = 1, pageSize = 20, search, sort, includeArchived = false } = input;

    const response = await client.listMemberCriteriaAdmin({
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
      data: (response.memberCriteria ?? []).map((s) => ({
        id: s.id,
        name: s.name,
        description: s.description ?? '',
        criteria_type: s.kind,
        criteria_type_label: kindToLabel(s.kind),
        estimated_count: s.matchingMemberCount ?? null,
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
  });
}

export async function createMemberCriteriaAction(input: {
  name: string;
  description?: string;
  kind: MemberCriteriaKind;
  config?: MemberCriteriaConfig;
}): Promise<ActionResult<{ data: { id: string } }>> {
  return runAction(
    'criteria-actions',
    'createMemberCriteriaAction',
    async () => {
      const client = await createMemberCriteriaClient();
      const criteria = await client.createMemberCriteria({
        name: input.name,
        description: input.description,
        kind: input.kind,
        config: input.config ?? create(MemberCriteriaConfigSchema, {}),
      });
      revalidateCriteriaAfterCommit('/admin/member-criteria');
      revalidateCriteriaAfterCommit('/admin/campaigns');
      return { data: { id: criteria.id } };
    },
    { fallback: 'Failed to create criteria' },
  );
}

export async function archiveMemberCriteriaAction(id: string): Promise<ActionResult<{ success: true }>> {
  return runAction(
    'criteria-actions',
    'archiveMemberCriteriaAction',
    async () => {
      const client = await createMemberCriteriaClient();
      await client.archiveMemberCriteria({ id });
      revalidateCriteriaAfterCommit('/admin/member-criteria');
      revalidateCriteriaAfterCommit('/admin/campaigns');
      return { success: true as const };
    },
    { fallback: 'Failed to archive criteria' },
  );
}

export async function restoreMemberCriteriaAction(id: string): Promise<ActionResult<{ success: true }>> {
  return runAction(
    'criteria-actions',
    'restoreMemberCriteriaAction',
    async () => {
      const client = await createMemberCriteriaClient();
      await client.restoreMemberCriteria({ id });
      revalidateCriteriaAfterCommit('/admin/member-criteria');
      revalidateCriteriaAfterCommit('/admin/campaigns');
      return { success: true as const };
    },
    { fallback: 'Failed to restore criteria' },
  );
}

export async function listActiveMemberCriteriaAction(): Promise<{ id: string; name: string; kindLabel: string }[]> {
  try {
    const client = await createMemberCriteriaClient();
    const criteriaListById = new Map<string, { id: string; name: string; kindLabel: string }>();
    let offset = 0;

    for (;;) {
      const response = await client.listMemberCriteriaAdmin({
        pagination: create(PaginationRequestSchema, {
          limit: ACTIVE_CRITERIA_PAGE_SIZE,
          offset,
        }),
        includeArchived: false,
      });
      const pageCriteriaList = response.memberCriteria ?? [];
      for (const criteria of pageCriteriaList) {
        criteriaListById.set(criteria.id, {
          id: criteria.id,
          name: criteria.name,
          kindLabel: kindToLabel(criteria.kind),
        });
      }

      const nextOffset = offset + pageCriteriaList.length;
      const total = response.pagination?.total ?? nextOffset;
      const hasMore = Boolean(response.pagination?.hasMore) || nextOffset < total;
      if (!hasMore) {
        break;
      }
      if (pageCriteriaList.length === 0) {
        throw new Error('MemberCriteria pagination did not advance');
      }
      offset = nextOffset;
    }

    return Array.from(criteriaListById.values());
  } catch (err) {
    logger.error('Failed to load active MemberCriteria options', {
      error: err,
    });
    throw new Error('Unable to load active Member criteria options');
  }
}

export async function getMemberCriteriaAction(id: string): Promise<
  ActionResult<{
    data: {
      id: string;
      name: string;
      description: string;
      kind: MemberCriteriaKind;
      config: {
        memberTagIds: string[];
        accountRoles: string[];
        createdAfter?: string;
        createdBefore?: string;
      };
      estimatedCount: number | null;
      archivedAt: Date | null;
    };
  }>
> {
  return runAction(
    'criteria-actions',
    'getMemberCriteriaAction',
    async () => {
      const client = await createMemberCriteriaClient();
      const criteria = await client.getMemberCriteria({ id });
      return {
        data: {
          id: criteria.id,
          name: criteria.name,
          description: criteria.description ?? '',
          kind: criteria.kind,
          config: {
            memberTagIds: criteria.config?.memberTagIds ?? [],
            accountRoles:
              criteria.config?.accountRoles.flatMap((role) => {
                const mapped = accountRoleToValue(role);
                return mapped === null ? [] : [mapped];
              }) ?? [],
            createdAfter: criteria.config?.createdAfter
              ? timestampDate(criteria.config.createdAfter).toISOString()
              : undefined,
            createdBefore: criteria.config?.createdBefore
              ? timestampDate(criteria.config.createdBefore).toISOString()
              : undefined,
          },
          estimatedCount: criteria.matchingMemberCount ?? null,
          archivedAt: criteria.archivedAt ? timestampDate(criteria.archivedAt) : null,
        },
      };
    },
    { fallback: 'Failed to get criteria' },
  );
}

export async function updateMemberCriteriaAction(input: {
  id: string;
  name?: string;
  description?: string;
  kind?: MemberCriteriaKind;
  config?: MemberCriteriaConfig;
  observed?: { kind: MemberCriteriaKind; config: MemberCriteriaConfig };
}): Promise<ActionResult<{ data: ReturnType<typeof mapUpdatedCriteria> }>> {
  return runAction(
    'criteria-actions',
    'updateMemberCriteriaAction',
    async () => {
      const client = await createMemberCriteriaClient();
      const criteria = await client.updateMemberCriteria({
        id: input.id,
        name: input.name,
        description: input.description,
        kind: input.kind,
        config: input.config,
        observed: input.observed
          ? create(MemberCriteriaConfigSnapshotSchema, {
              kind: input.observed.kind,
              config: input.observed.config,
            })
          : undefined,
      });
      revalidateCriteriaAfterCommit('/admin/member-criteria');
      revalidateCriteriaAfterCommit('/admin/campaigns');
      return { data: mapUpdatedCriteria(criteria) };
    },
    { fallback: 'Failed to update criteria' },
  );
}

function mapUpdatedCriteria(criteria: MemberCriteria) {
  return {
    id: criteria.id,
    name: criteria.name,
    description: criteria.description ?? '',
    kind: criteria.kind,
    config: {
      memberTagIds: criteria.config?.memberTagIds ?? [],
      accountRoles:
        criteria.config?.accountRoles.flatMap((role) => {
          const mapped = accountRoleToValue(role);
          return mapped === null ? [] : [mapped];
        }) ?? [],
      createdAfter: criteria.config?.createdAfter
        ? timestampDate(criteria.config.createdAfter).toISOString()
        : undefined,
      createdBefore: criteria.config?.createdBefore
        ? timestampDate(criteria.config.createdBefore).toISOString()
        : undefined,
      excludeMemberIds: criteria.config?.excludeMemberIds ?? [],
    },
    estimatedCount: criteria.matchingMemberCount ?? null,
    archivedAt: criteria.archivedAt ? timestampDate(criteria.archivedAt) : null,
  };
}

export async function countMatchingMembersAction(input: {
  kind: MemberCriteriaKind;
  config?: MemberCriteriaConfig;
}): Promise<ActionResult<{ count: number }>> {
  return runAction(
    'criteria-actions',
    'countMatchingMembersAction',
    async () => {
      const client = await createMemberCriteriaClient();
      const response = await client.countMatchingMembers({
        kind: input.kind,
        config: input.config ?? create(MemberCriteriaConfigSchema, {}),
      });
      return { count: response.count };
    },
    { fallback: 'Failed to estimate count' },
  );
}
