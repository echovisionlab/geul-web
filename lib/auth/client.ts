'use client';
import { unwrapQueryResult } from '@/lib/api/query-result';
import { announceSignOut } from '@/lib/auth/active-member';
import { suspendEditorUnloadGuard } from '@/lib/editor/usePendingEditorUnload';

import { listSessionsAction, revokeOtherSessionsAction, revokeSessionAction } from '@/lib/actions/session';
import { useSessionContext } from '@/lib/providers/SessionProvider';
import type { SessionData } from '@/lib/session-data';

interface UseSessionReturn {
  data: SessionData | null;
  isPending: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
  refetchWithOutcome: () => Promise<import('@/lib/providers/SessionProvider').SessionRefreshOutcome>;
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
 * Signs out after the editor settled unsaved edits (see settleEditsBeforeSignOut): ends the member
 * in every tab of this browser, deletes their unsaved-edit journals and backups from this device,
 * then follows the Kratos self-service logout flow. Another account on this browser never adopts
 * them.
 */
export function signOut(): Promise<void> {
  const memberId = announceSignOut();
  // Unsaved edits were saved or the editor agreed to discard them.
  suspendEditorUnloadGuard();
  // Loaded on demand: journals exist only after an editor opened them, and every page ships this.
  const clearJournals = memberId
    ? import('@/lib/collab/room-journal-store').then(({ clearRoomJournalsForSignOut }) =>
        clearRoomJournalsForSignOut(memberId),
      )
    : Promise.resolve();
  return clearJournals
    .catch(() => undefined)
    .finally(() => {
      window.location.href = '/api/auth/logout';
    });
}

export const authClient = {
  signOut: () => signOut(),
  useSession,
  listSessions: async () => {
    const sessions = await listSessionsAction().then(unwrapQueryResult);
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
