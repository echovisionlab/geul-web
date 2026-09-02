'use server';

import { create } from '@bufbuild/protobuf';
import { Code, ConnectError } from '@connectrpc/connect';
import { FilterOp, FilterSpecSchema, PaginationRequestSchema } from '@echovisionlab/geul-proto/common/common_pb.ts';
import type { AudienceSegmentSummary as ProtoAudienceSegmentSummary } from '@echovisionlab/geul-proto/secure/audience_pb.ts';
import { TranscodeEntityType } from '@echovisionlab/geul-proto/secure/events_pb.ts';
import {
  FileDownloadAudience as ProtoFileDownloadAudience,
  type FileDownloadPolicy,
} from '@echovisionlab/geul-proto/secure/file_pb.ts';
import { createAudienceClient, createFileClient } from '@/lib/api/server-client';
import {
  isFileDownloadPolicyEntityType,
  type AudienceSegmentSummary,
  type FileDownloadActionResult,
  type FileDownloadAudience,
  type FileDownloadPage,
  type FileDownloadPageInput,
  type FileDownloadPolicyModel,
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

function audienceFromProto(audience: ProtoFileDownloadAudience): FileDownloadAudience {
  switch (audience) {
    case ProtoFileDownloadAudience.DISABLED:
      return 'disabled';
    case ProtoFileDownloadAudience.PUBLIC:
      return 'public';
    case ProtoFileDownloadAudience.AUTHENTICATED:
      return 'authenticated';
    case ProtoFileDownloadAudience.RESTRICTED:
      return 'restricted';
    case ProtoFileDownloadAudience.UNSPECIFIED:
    default:
      throw new Error('Invalid file download audience');
  }
}

function audienceToProto(audience: FileDownloadAudience): ProtoFileDownloadAudience {
  switch (audience) {
    case 'public':
      return ProtoFileDownloadAudience.PUBLIC;
    case 'authenticated':
      return ProtoFileDownloadAudience.AUTHENTICATED;
    case 'restricted':
      return ProtoFileDownloadAudience.RESTRICTED;
    case 'disabled':
      return ProtoFileDownloadAudience.DISABLED;
  }
}

function mapPolicy(policy: FileDownloadPolicy): FileDownloadPolicyModel {
  return {
    ...(policy.entityType !== TranscodeEntityType.UNSPECIFIED ? { entityType: policy.entityType } : {}),
    ...(policy.entityId ? { entityId: policy.entityId } : {}),
    ...(policy.blockId ? { blockId: policy.blockId } : {}),
    ...(policy.referencePath ? { referencePath: policy.referencePath } : {}),
    fileId: policy.fileId,
    audience: audienceFromProto(policy.audience),
    audienceSegments: policy.audienceSegments.map(mapAudienceSegment),
  };
}

function mapAudienceSegment(segment: ProtoAudienceSegmentSummary): AudienceSegmentSummary {
  return {
    id: segment.id,
    name: segment.name,
    description: segment.description ?? '',
    segmentType: segment.segmentType,
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
  } catch {
    return { errorCode: 'loadFailed' };
  }
}

export async function updateFileDownloadPolicyAction(
  target: FileDownloadPolicyTarget,
  audience: FileDownloadAudience,
  audienceSegmentIds: string[],
): Promise<FileDownloadActionResult<FileDownloadPolicyModel>> {
  if (!isValidTarget(target)) {
    return { errorCode: 'invalidTarget' };
  }

  const segmentIds =
    audience === 'restricted' ? Array.from(new Set(audienceSegmentIds.map((id) => id.trim()).filter(Boolean))) : [];

  try {
    const client = await createFileClient();
    const response = await client.updateFileDownloadPolicy({
      ...target,
      expectedFileId: target.expectedFileId,
      audience: audienceToProto(audience),
      audienceSegmentIds: segmentIds,
    });
    if (!response.policy) {
      return { errorCode: 'missingResponse' };
    }
    return { data: mapPolicy(response.policy) };
  } catch (error) {
    if (ConnectError.from(error).code === Code.FailedPrecondition) {
      return { errorCode: 'staleTarget' };
    }
    return { errorCode: 'saveFailed' };
  }
}

export async function listAudienceSegmentsForAuthenticatedAccessAction(
  input: FileDownloadPageInput = {},
): Promise<FileDownloadActionResult<FileDownloadPage<AudienceSegmentSummary>>> {
  const { page, pageSize, offset, search } = normalizePageInput(input);
  try {
    const client = await createAudienceClient();
    const response = await client.listSegmentsForAuthenticatedAccess({
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
      data: mapPage(response.segments.map(mapAudienceSegment), response.pagination, page, pageSize),
    };
  } catch {
    return { errorCode: 'loadFailed' };
  }
}
