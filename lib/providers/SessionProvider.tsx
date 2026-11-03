'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { SESSION_INVALIDATED_EVENT, SESSION_REVALIDATE_EVENT } from '@/lib/auth/session-events';
import { buildLoginRedirectHref } from '@/lib/auth/login-page';
import { isPageMember, isSigningOutHere, subscribeSignedOutMembers, syncActiveMember } from '@/lib/auth/active-member';
import { suspendEditorUnloadGuard } from '@/lib/editor/usePendingEditorUnload';
import { prepareToLeaveWithDurableEdits } from '@/lib/editor/leave-with-durable-edits';
import { clearUserDisplaySnapshotCookie, writeUserDisplaySnapshotCookie } from '@/lib/auth/user-display-cookie';
import type { SessionData } from '@/lib/session-data';
import { buildNicknameOnboardingHref, NICKNAME_ONBOARDING_PATH } from '@/lib/auth/onboarding-redirect';

interface SessionContextValue {
  data: SessionData | null;
  isPending: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
  refetchWithOutcome: () => Promise<SessionRefreshOutcome>;
  updateMemberSummary: (member: MemberSummarySnapshot) => void;
  completeOnboarding: (member: MemberSummarySnapshot) => void;
}

export type SessionRefreshOutcome =
  { kind: 'refreshed'; data: SessionData | null } | { kind: 'failed'; error: Error } | { kind: 'superseded' };

export interface MemberSummarySnapshot {
  id: string;
  nickname: string;
  avatarUrl: string | null;
  deleted: boolean;
}

const SessionContext = createContext<SessionContextValue | null>(null);
const SESSION_REVALIDATE_INTERVAL_MS = 60_000;
// Areas that only render for a signed-in member. A session lost there sends the member to sign in
// again instead of leaving pages whose every request now fails.
const SIGNED_IN_AREA_PREFIXES = ['/admin', '/my'];

function isSignedInArea(pathname: string): boolean {
  return SIGNED_IN_AREA_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

// Compare the complete JSON response, including fields added by the server, so
// unchanged refreshes preserve identity without hiding authentication changes.
function equalSessionValue(left: unknown, right: unknown): boolean {
  if (Object.is(left, right)) {
    return true;
  }
  if (!left || !right || typeof left !== 'object' || typeof right !== 'object') {
    return false;
  }
  if (Array.isArray(left) !== Array.isArray(right)) {
    return false;
  }
  const leftFields = Object.keys(left);
  const rightFields = Object.keys(right);
  return (
    leftFields.length === rightFields.length &&
    leftFields.every(
      (key) =>
        Object.hasOwn(right, key) &&
        equalSessionValue((left as Record<string, unknown>)[key], (right as Record<string, unknown>)[key]),
    )
  );
}

export function SessionProvider({
  children,
  initialData,
}: {
  children: React.ReactNode;
  initialData?: SessionData | null;
}) {
  const [data, setData] = useState<SessionData | null>(initialData ?? null);
  // Unsaved-edit journals and backups belong to the signed-in member (see active-member). Synced
  // during render so editors below see it before their first journal write. A lost session keeps
  // the member; another member in this page means a reload.
  const memberSync = data?.user.id ? syncActiveMember(data.user.id) : 'unchanged';
  const memberSwitched = memberSync === 'switched';
  // The member signed out in another tab: every editor writer and replay of this page must stop
  // now (its unsaved edits were deleted from this device by that sign-out).
  useEffect(
    () =>
      subscribeSignedOutMembers((memberId) => {
        if (isSigningOutHere() || !isPageMember(memberId)) {
          return;
        }
        suspendEditorUnloadGuard();
        window.location.reload();
      }),
    [],
  );
  useEffect(() => {
    if (!memberSwitched) {
      return;
    }
    // Keep the previous member's edits on this device for their next sign-in, then drop this page.
    void prepareToLeaveWithDurableEdits().finally(() => window.location.reload());
  }, [memberSwitched]);
  const [isPending, setIsPending] = useState(initialData === undefined);
  const [error, setError] = useState<Error | null>(null);
  const requestSequenceRef = useRef(0);
  const abortControllerRef = useRef<AbortController | null>(null);
  const inFlightRef = useRef<Promise<SessionRefreshOutcome> | null>(null);
  const hasResolvedSessionRef = useRef(initialData !== undefined);

  const invalidateSession = useCallback(() => {
    requestSequenceRef.current += 1;
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
    inFlightRef.current = null;
    hasResolvedSessionRef.current = true;
    setData(null);
    setError(null);
    setIsPending(false);
    clearUserDisplaySnapshotCookie();
  }, []);

  const fetchSession = useCallback((background = false): Promise<SessionRefreshOutcome> => {
    if (background && inFlightRef.current) {
      return inFlightRef.current;
    }
    abortControllerRef.current?.abort();
    const abortController = new AbortController();
    abortControllerRef.current = abortController;
    const requestSequence = requestSequenceRef.current + 1;
    requestSequenceRef.current = requestSequence;
    if (!background || !hasResolvedSessionRef.current) {
      setIsPending(true);
    }
    setError(null);

    const request = Promise.resolve().then(async (): Promise<SessionRefreshOutcome> => {
      try {
        if (requestSequence !== requestSequenceRef.current || abortController.signal.aborted) {
          return { kind: 'superseded' };
        }
        const response = await fetch('/api/auth/session', {
          cache: 'no-store',
          signal: abortController.signal,
        });
        if (requestSequence !== requestSequenceRef.current) {
          return { kind: 'superseded' };
        }
        if (response.status === 401) {
          hasResolvedSessionRef.current = true;
          setData(null);
          return { kind: 'refreshed', data: null };
        }
        if (!response.ok) {
          throw new Error(`Session refresh failed with status ${response.status}`);
        }

        const json = (await response.json()) as SessionData | null;
        if (requestSequence !== requestSequenceRef.current || abortController.signal.aborted) {
          return { kind: 'superseded' };
        }
        hasResolvedSessionRef.current = true;
        const next = json?.user ? json : null;
        setData((current) => (equalSessionValue(current, next) ? current : next));
        return { kind: 'refreshed', data: next };
      } catch (caught) {
        if (
          requestSequence !== requestSequenceRef.current ||
          abortController.signal.aborted ||
          (caught instanceof DOMException && caught.name === 'AbortError')
        ) {
          return { kind: 'superseded' };
        }
        const refreshError = caught instanceof Error ? caught : new Error('Session refresh failed');
        setError(refreshError);
        return { kind: 'failed', error: refreshError };
      } finally {
        if (requestSequence === requestSequenceRef.current) {
          abortControllerRef.current = null;
          inFlightRef.current = null;
          setIsPending(false);
        }
      }
    });
    inFlightRef.current = request;
    return request;
  }, []);

  const refetch = useCallback(async () => {
    await fetchSession();
  }, [fetchSession]);

  const revalidateSession = useCallback(() => {
    return fetchSession(true);
  }, [fetchSession]);

  const updateMemberSummary = useCallback((member: MemberSummarySnapshot) => {
    setData((current) => {
      if (!current || current.user.id !== member.id || member.deleted) {
        return current;
      }
      return {
        ...current,
        user: {
          ...current.user,
          nickname: member.nickname,
          image: member.avatarUrl,
        },
      };
    });
  }, []);

  const completeOnboarding = useCallback((member: MemberSummarySnapshot) => {
    setData((current) => {
      if (!current || current.user.id !== member.id || member.deleted) {
        return current;
      }
      return {
        ...current,
        onboarded: true,
        nickname_suggestion: null,
        user: {
          ...current.user,
          nickname: member.nickname,
          image: member.avatarUrl,
        },
      };
    });
  }, []);

  useEffect(() => {
    if (initialData === undefined) {
      void refetch();
    }
  }, [refetch, initialData]);

  // The root layout renders again after a Server Action changes cookies or on a router refresh.
  // Its session is then the server's current answer, newer than anything fetched here before.
  const renderedSessionRef = useRef(initialData);
  useEffect(() => {
    if (renderedSessionRef.current === initialData) {
      return;
    }
    renderedSessionRef.current = initialData;
    if (initialData === undefined) {
      return;
    }
    requestSequenceRef.current += 1;
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
    inFlightRef.current = null;
    hasResolvedSessionRef.current = true;
    setData((current) => (equalSessionValue(current, initialData) ? current : initialData));
    setError(null);
    setIsPending(false);
  }, [initialData]);

  useEffect(() => {
    const handleInvalidated = () => invalidateSession();
    const handleRevalidate = () => void revalidateSession();
    window.addEventListener(SESSION_INVALIDATED_EVENT, handleInvalidated);
    window.addEventListener(SESSION_REVALIDATE_EVENT, handleRevalidate);
    return () => {
      window.removeEventListener(SESSION_INVALIDATED_EVENT, handleInvalidated);
      window.removeEventListener(SESSION_REVALIDATE_EVENT, handleRevalidate);
    };
  }, [invalidateSession, revalidateSession]);

  // Client navigation keeps the root layout, so a session that ended between pages is otherwise
  // noticed only on focus or at the next interval.
  const pathname = usePathname();
  const navigatedPathnameRef = useRef(pathname);
  useEffect(() => {
    if (navigatedPathnameRef.current === pathname) {
      return;
    }
    navigatedPathnameRef.current = pathname;
    if (data?.user.id) {
      void revalidateSession();
    }
  }, [pathname, data?.user.id, revalidateSession]);

  const signedInMemberRef = useRef(data?.user.id ?? null);
  useEffect(() => {
    const previousMember = signedInMemberRef.current;
    signedInMemberRef.current = data?.user.id ?? null;
    if (!previousMember || data?.user.id || isPending || isSigningOutHere()) {
      return;
    }
    if (!isSignedInArea(window.location.pathname)) {
      return;
    }
    const currentPath = `${window.location.pathname}${window.location.search}${window.location.hash}`;
    // Keep this member's unsaved edits on the device for their next sign-in, then sign in again.
    void prepareToLeaveWithDurableEdits().finally(() => window.location.replace(buildLoginRedirectHref(currentPath)));
  }, [data?.user.id, isPending]);

  useEffect(() => {
    const revalidate = () => void revalidateSession();
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        revalidate();
      }
    };

    window.addEventListener('focus', revalidate);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    const intervalId = data?.user.id ? window.setInterval(revalidate, SESSION_REVALIDATE_INTERVAL_MS) : null;

    return () => {
      window.removeEventListener('focus', revalidate);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (intervalId !== null) {
        window.clearInterval(intervalId);
      }
    };
  }, [data?.user.id, revalidateSession]);

  useEffect(
    () => () => {
      requestSequenceRef.current += 1;
      abortControllerRef.current?.abort();
      inFlightRef.current = null;
    },
    [],
  );

  useEffect(() => {
    if (isPending) {
      return;
    }

    if (data?.user.id && data.onboarded) {
      writeUserDisplaySnapshotCookie({
        name: data.user.nickname,
        image: data.user.image,
      });
      return;
    }

    clearUserDisplaySnapshotCookie();
  }, [data, isPending]);

  useEffect(() => {
    if (!data?.user.id || data.onboarded || window.location.pathname === NICKNAME_ONBOARDING_PATH) {
      return;
    }
    const currentPath = `${window.location.pathname}${window.location.search}${window.location.hash}`;
    window.location.replace(buildNicknameOnboardingHref(currentPath));
  }, [data]);

  const value = useMemo(
    () => ({
      data,
      isPending,
      error,
      refetch,
      refetchWithOutcome: fetchSession,
      updateMemberSummary,
      completeOnboarding,
    }),
    [data, isPending, error, refetch, fetchSession, updateMemberSummary, completeOnboarding],
  );

  // During a member switch nothing below may run: an editor would send the previous member's
  // in-memory edits with the new member's session before the reload.
  return <SessionContext.Provider value={value}>{memberSwitched ? null : children}</SessionContext.Provider>;
}

export function useSessionContext(): SessionContextValue | null {
  return useContext(SessionContext);
}
