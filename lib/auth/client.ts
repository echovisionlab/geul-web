'use client';

import { listSessionsAction, revokeOtherSessionsAction, revokeSessionAction } from '@/lib/actions/session';
import { useSessionContext } from '@/lib/providers/SessionProvider';
import type { SessionData } from '@/lib/session-data';

interface UseSessionReturn {
  data: SessionData | null;
  isPending: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
  updateMemberSummary: import('@/lib/providers/SessionProvider').MemberSummarySnapshot extends infer T
    ? (member: T) => void
    : never;
  completeOnboarding: import('@/lib/providers/SessionProvider').MemberSummarySnapshot extends infer T
    ? (member: T) => void
    : never;
}

export function useSession(): UseSessionReturn {
  const context = useSessionContext();
  if (!context) {
    throw new Error('useSession must be used within a SessionProvider');
  }
  return context;
}

/**
 * Redirect to Kratos self-service logout flow.
 */
export function signOut() {
  window.location.href = '/api/auth/logout';
}

export const authClient = {
  signOut: () => signOut(),
  useSession,
  listSessions: async () => {
    const sessions = await listSessionsAction();
    return { data: sessions };
  },
  revokeSession: async ({ token }: { token: string }) => {
    const result = await revokeSessionAction(token);
    if (result.error) {
      return { error: { message: result.error, code: result.errorCode } };
    }
    return { error: null };
  },
  revokeOtherSessions: async () => {
    const result = await revokeOtherSessionsAction();
    if (result.error) {
      return { error: { message: result.error, code: result.errorCode } };
    }
    return { error: null };
  },
};
