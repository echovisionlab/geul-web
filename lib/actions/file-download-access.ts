'use server';

import { logServerFailure } from '@/lib/logging/logger';

import { create } from '@bufbuild/protobuf';
import { Code, ConnectError } from '@connectrpc/connect';
import { FilterOp, FilterSpecSchema, PaginationRequestSchema } from '@echovisionlab/geul-proto/common/common_pb.ts';
import type { MemberCriteriaSummary as ProtoMemberCriteriaSummary } from '@echovisionlab/geul-proto/secure/member_criteria_pb.ts';
import { TranscodeEntityType } from '@echovisionlab/geul-proto/secure/events_pb.ts';
import {
  FileDownloadAccess as ProtoFileDownloadAccess,
  type FileDownloadPolicy,
} from '@echovisionlab/geul-proto/secure/file_pb.ts';
import { createMemberCriteriaClient, createFileClient } from '@/lib/api/server-client';
import {
  isFileDownloadPolicyEntityType,
  type MemberCriteriaSummary,
  type FileDownloadActionResult,
  type FileDownloadAccess,
  type FileDownloadPage,
  type FileDownloadPageInput,
  type FileDownloadPolicyModel,
  type FileDownloadPolicyObservedState,
  type FileDownloadPolicyTarget,
} from '@/lib/types/file-download-access';

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

function normalizePageInput(input: FileDownloadPageInput = {}): {
  page: number;
  pageSize: number;
  offset: number;
  search: string;
} {
  const page = Number.isInteger(input.page) && Number(input.page) > 0 ? Number(input.page) : 1;
  const requestedPageSize =
    Number.isInteger(input.pageSize) && Number(input.pageSize) > 0 ? Number(input.pageSize) : DEFAULT_PAGE_SIZE;
  const pageSize = Math.min(requestedPageSize, MAX_PAGE_SIZE);
  return {
    page,
    pageSize,
    offset: (page - 1) * pageSize,
    search: input.search?.trim() ?? '',
  };
}

function mapPage<T>(
  items: T[],
  pagination: { total: number; hasMore: boolean } | undefined,
  page: number,
  pageSize: number,
): FileDownloadPage<T> {
  const total = pagination?.total ?? items.length;
  return {
    items,
    page,
    pageSize,
    total,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
    hasMore: pagination?.hasMore ?? page * pageSize < total,
  };
}

function isValidTarget(target: FileDownloadPolicyTarget): boolean {
  if (!isFileDownloadPolicyEntityType(target.entityType) || !target.entityId.trim() || !target.expectedFileId.trim()) {
    return false;
  }
  if (target.entityType === TranscodeEntityType.TRACK) {
    return target.blockId === undefined && target.referencePath === undefined;
  }
  return Boolean(target.blockId?.trim() && target.referencePath?.trim());
}

function accessFromProto(access: ProtoFileDownloadAccess): FileDownloadAccess {
  switch (access) {
    case ProtoFileDownloadAccess.DISABLED:
      return 'disabled';
    case ProtoFileDownloadAccess.PUBLIC:
      return 'public';
    case ProtoFileDownloadAccess.AUTHENTICATED:
      return 'authenticated';
    case ProtoFileDownloadAccess.RESTRICTED:
      return 'restricted';
    case ProtoFileDownloadAccess.UNSPECIFIED:
    default:
      throw new Error('Invalid file download access');
  }
}

function accessToProto(access: FileDownloadAccess): ProtoFileDownloadAccess {
  switch (access) {
    case 'public':
      return ProtoFileDownloadAccess.PUBLIC;
    case 'authenticated':
      return ProtoFileDownloadAccess.AUTHENTICATED;
    case 'restricted':
      return ProtoFileDownloadAccess.RESTRICTED;
    case 'disabled':
      return ProtoFileDownloadAccess.DISABLED;
  }
}

function isFileDownloadAccess(value: unknown): value is FileDownloadAccess {
  return value === 'disabled' || value === 'public' || value === 'authenticated' || value === 'restricted';
}

function isObservedPolicy(value: unknown): value is FileDownloadPolicyObservedState {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const candidate = value as Partial<FileDownloadPolicyObservedState>;
  return (
    isFileDownloadAccess(candidate.access) &&
    Array.isArray(candidate.memberCriteriaIds) &&
    candidate.memberCriteriaIds.every((id) => typeof id === 'string')
  );
}

function mapPolicy(policy: FileDownloadPolicy): FileDownloadPolicyModel {
  return {
    ...(policy.entityType !== TranscodeEntityType.UNSPECIFIED ? { entityType: policy.entityType } : {}),
    ...(policy.entityId ? { entityId: policy.entityId } : {}),
    ...(policy.blockId ? { blockId: policy.blockId } : {}),
    ...(policy.referencePath ? { referencePath: policy.referencePath } : {}),
    fileId: policy.fileId,
    access: accessFromProto(policy.access),
    memberCriteria: policy.memberCriteria.map(mapMemberCriteria),
  };
}

function mapMemberCriteria(criteria: ProtoMemberCriteriaSummary): MemberCriteriaSummary {
  return {
    id: criteria.id,
    name: criteria.name,
    description: criteria.description ?? '',
    kind: criteria.kind,
  };
}

export async function getFileDownloadPolicyAction(
  target: FileDownloadPolicyTarget,
): Promise<FileDownloadActionResult<FileDownloadPolicyModel>> {
  if (!isValidTarget(target)) {
    return { errorCode: 'invalidTarget' };
  }

  try {
    const client = await createFileClient();
    const response = await client.getFileDownloadPolicy({
      entityType: target.entityType,
      entityId: target.entityId,
      blockId: target.blockId,
      referencePath: target.referencePath,
    });
    if (!response.policy) {
      return { errorCode: 'missingResponse' };
    }
    return { data: mapPolicy(response.policy) };
  } catch (error) {
    logServerFailure('file-download-access-actions', 'getFileDownloadPolicyAction', error);
    return { errorCode: 'loadFailed' };
  }
}

export async function updateFileDownloadPolicyAction(
  target: FileDownloadPolicyTarget,
  access: FileDownloadAccess,
  memberCriteriaIds: string[],
  observedPolicy: FileDownloadPolicyObservedState,
  editorOrigin?: string,
): Promise<FileDownloadActionResult<FileDownloadPolicyModel>> {
  if (!isValidTarget(target)) {
    return { errorCode: 'invalidTarget' };
  }
  if (!isObservedPolicy(observedPolicy)) {
    return { errorCode: 'invalidPolicyBaseline' };
  }

  const criteriaIds =
    access === 'restricted' ? Array.from(new Set(memberCriteriaIds.map((id) => id.trim()).filter(Boolean))) : [];
  const observedCriteriaIds = Array.from(
    new Set(observedPolicy.memberCriteriaIds.map((id) => id.trim()).filter(Boolean)),
  ).sort();

  try {
    const client = await createFileClient(editorOrigin);
    const response = await client.updateFileDownloadPolicy({
      ...target,
      expectedFileId: target.expectedFileId,
      access: accessToProto(access),
      memberCriteriaIds: criteriaIds,
      observedPolicy: {
        access: accessToProto(observedPolicy.access),
        memberCriteriaIds: observedCriteriaIds,
      },
    });
    if (!response.policy) {
      return { errorCode: 'missingResponse' };
    }
    return { data: mapPolicy(response.policy) };
  } catch (error) {
    logServerFailure('file-download-access-actions', 'updateFileDownloadPolicyAction', error);
    if (ConnectError.from(error).code === Code.FailedPrecondition) {
      return { errorCode: 'staleTarget' };
    }
    return { errorCode: 'saveFailed' };
  }
}

export async function listMemberCriteriaForAuthenticatedAccessAction(
  input: FileDownloadPageInput = {},
): Promise<FileDownloadActionResult<FileDownloadPage<MemberCriteriaSummary>>> {
  const { page, pageSize, offset, search } = normalizePageInput(input);
  try {
    const client = await createMemberCriteriaClient();
    const response = await client.listMemberCriteriaForAuthenticatedAccess({
      pagination: create(PaginationRequestSchema, { limit: pageSize, offset }),
      filters: search
        ? [
            create(FilterSpecSchema, {
              field: 'search',
              op: FilterOp.ILIKE,
              value: search,
            }),
          ]
        : [],
    });
    return {
      data: mapPage(response.memberCriteria.map(mapMemberCriteria), response.pagination, page, pageSize),
    };
  } catch (error) {
    logServerFailure('file-download-access-actions', 'listMemberCriteriaForAuthenticatedAccessAction', error);
    return { errorCode: 'loadFailed' };
  }
}
