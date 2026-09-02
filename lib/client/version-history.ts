import type { VersionedEntityType, VersionListResult, VersionMutationResult } from '@/lib/types/version-history';

async function requestJson<T>(input: RequestInfo, init?: RequestInit): Promise<T> {
  const response = await fetch(input, {
    ...init,
    credentials: 'same-origin',
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
  });

  const data = (await response.json()) as T & { error?: string };
  if (!response.ok && data && typeof data === 'object' && 'error' in data) {
    return data;
  }
  return data;
}

export async function listVersionsRequest(
  entityType: VersionedEntityType,
  entityId: string,
  page = 1,
  pageSize = 20,
): Promise<VersionListResult> {
  const query = new URLSearchParams({
    page: page.toString(),
    pageSize: pageSize.toString(),
  });
  return requestJson<VersionListResult>(`/api/version-history/${entityType}/${entityId}?${query}`);
}

export async function restoreVersionRequest(
  entityType: VersionedEntityType,
  entityId: string,
  versionId: string,
): Promise<VersionMutationResult> {
  return requestJson<VersionMutationResult>(`/api/version-history/${entityType}/${entityId}/restore`, {
    method: 'POST',
    body: JSON.stringify({ versionId }),
  });
}
