import { isConnectError } from '@/lib/api/connect-error';
import { timestampDate, type Timestamp } from '@bufbuild/protobuf/wkt';
import { Code } from '@connectrpc/connect';
import type { DocumentLayout as ProtoDocumentLayout } from '@echovisionlab/geul-proto/common/common_pb.ts';
import { createPageClient, createPostClient, createWorkClient } from '@/lib/api/server-client';
import { mapProtoDocumentLayout } from '@/lib/queries/document-layout';
import type {
  VersionedEntityType,
  VersionInfo,
  VersionListResult,
  VersionMutationResult,
} from '@/lib/types/version-history';

export async function listVersions(
  entityType: VersionedEntityType,
  entityId: string,
  page = 1,
  pageSize = 20,
): Promise<VersionListResult> {
  const limit = pageSize;
  const offset = (page - 1) * pageSize;

  if (entityType === 'post') {
    const client = await createPostClient();
    const res = await client.listPostVersions({
      postId: entityId,
      pagination: { limit, offset },
    });
    return {
      versions: res.versions.map((version) => mapVersion(version, 'post')),
      total: res.pagination?.total ?? res.versions.length,
    };
  }

  if (entityType === 'page') {
    const client = await createPageClient();
    const res = await client.listPageVersions({
      pageId: entityId,
      pagination: { limit, offset },
    });
    return {
      versions: res.versions.map((version) => mapVersion(version, 'page')),
      total: res.pagination?.total ?? res.versions.length,
    };
  }

  const client = await createWorkClient();
  const res = await client.listWorkVersions({ workId: entityId, pagination: { limit, offset } });
  return {
    versions: res.versions.map((version) => mapVersion(version, 'work')),
    total: res.pagination?.total ?? res.versions.length,
  };
}

export async function restoreVersion(
  entityType: VersionedEntityType,
  entityId: string,
  versionId: string,
): Promise<VersionMutationResult> {
  if (entityType === 'post') {
    const client = await createPostClient();
    await client.restorePostVersion({ versionId, postId: entityId });
  } else if (entityType === 'page') {
    const client = await createPageClient();
    await client.restorePageVersion({ versionId, pageId: entityId });
  } else {
    const client = await createWorkClient();
    await client.restoreWorkVersion({ versionId, workId: entityId });
  }

  return { success: true };
}

export function parseVersionEntityType(value: string): VersionedEntityType | null {
  return value === 'post' || value === 'page' || value === 'work' ? value : null;
}

export function toVersionErrorResult(
  err: unknown,
  fallback: string,
): {
  status: number;
  error: string;
} {
  if (isConnectError(err)) {
    if (err.code === Code.Unauthenticated) {
      return { status: 401, error: 'Unauthorized' };
    }
    if (err.code === Code.PermissionDenied) {
      return { status: 403, error: 'Forbidden' };
    }
    return { status: 500, error: fallback };
  }

  return {
    status: 500,
    error: fallback,
  };
}

function mapVersion(
  v: {
    id: string;
    version: number;
    title?: string;
    sourceLocale: string;
    contributors: readonly { memberId: string; nickname: string }[];
    createdAt?: Timestamp;
    documentLayout?: ProtoDocumentLayout;
  },
  entityType: VersionedEntityType,
): VersionInfo {
  return {
    id: v.id,
    version: v.version,
    title: v.title ?? '',
    sourceLocale: v.sourceLocale,
    contributors: v.contributors.map((contributor) => ({
      memberId: contributor.memberId,
      nickname: contributor.nickname,
    })),
    createdAt: v.createdAt ? timestampDate(v.createdAt).toISOString() : new Date().toISOString(),
    ...(entityType === 'page' || entityType === 'post'
      ? { documentLayout: mapProtoDocumentLayout(v.documentLayout) }
      : {}),
  };
}
