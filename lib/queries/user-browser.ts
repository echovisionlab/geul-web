import { isConnectError } from '@/lib/api/connect-error';
import { createMemberClient } from '@/lib/api/browser-client';
import { createClientLogger } from '@/lib/utils/client-logger';

const logger = createClientLogger('user-browser');

// ============================================
// Client Component queries for User domain
// ============================================

export async function searchMembers(
  query: string,
  excludeIds: string[] = [],
  limit: number = 10,
  effectiveAuthorsOnly: boolean = false,
) {
  try {
    const client = createMemberClient();
    const response = await client.searchMembers({
      query,
      excludeMemberIds: excludeIds,
      limit,
      ...(effectiveAuthorsOnly ? { effectiveAuthorsOnly: true } : {}),
    });
    return (response.members ?? []).map((member) => ({
      id: member.id,
      nickname: member.nickname,
      avatarUrl: member.avatarAsset?.url ?? null,
    }));
  } catch (err) {
    if (isConnectError(err)) {
      logger.error('SearchMembers RPC error', { error: err.message });
    }
    return [];
  }
}
