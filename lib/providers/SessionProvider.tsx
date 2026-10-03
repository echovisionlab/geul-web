'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { SESSION_INVALIDATED_EVENT } from '@/lib/auth/session-events';
import { clearUserDisplaySnapshotCookie, writeUserDisplaySnapshotCookie } from '@/lib/auth/user-display-cookie';
import type { SessionData } from '@/lib/session-data';
import { buildNicknameOnboardingHref, NICKNAME_ONBOARDING_PATH } from '@/lib/auth/onboarding-redirect';

interface SessionContextValue {
  data: SessionData | null;
  isPending: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
  updateMemberSummary: (member: MemberSummarySnapshot) => void;
  completeOnboarding: (member: MemberSummarySnapshot) => void;
}

export interface MemberSummarySnapshot {
  id: string;
  nickname: string;
  avatarUrl: string | null;
  deleted: boolean;
}

const SessionContext = createContext<SessionContextValue | null>(null);
const SESSION_REVALIDATE_INTERVAL_MS = 60_000;

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
  const [isPending, setIsPending] = useState(initialData === undefined);
  const [error, setError] = useState<Error | null>(null);
  const requestSequenceRef = useRef(0);
  const abortControllerRef = useRef<AbortController | null>(null);
  const inFlightRef = useRef<Promise<void> | null>(null);
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

  const fetchSession = useCallback((background = false): Promise<void> => {
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

    const request = Promise.resolve().then(async () => {
      try {
        if (requestSequence !== requestSequenceRef.current || abortController.signal.aborted) {
          return;
        }
        const response = await fetch('/api/auth/session', {
          cache: 'no-store',
          signal: abortController.signal,
        });
        if (requestSequence !== requestSequenceRef.current) {
          return;
        }
        if (response.status === 401) {
          hasResolvedSessionRef.current = true;
          setData(null);
          return;
        }
        if (!response.ok) {
          throw new Error(`Session refresh failed with status ${response.status}`);
        }

        const json = (await response.json()) as SessionData | null;
        if (requestSequence !== requestSequenceRef.current || abortController.signal.aborted) {
          return;
        }
        hasResolvedSessionRef.current = true;
        const next = json?.user ? json : null;
        setData((current) => (equalSessionValue(current, next) ? current : next));
      } catch (caught) {
        if (caught instanceof DOMException && caught.name === 'AbortError') {
          return;
        }
        if (requestSequence === requestSequenceRef.current) {
          setError(caught instanceof Error ? caught : new Error('Session refresh failed'));
        }
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

  const refetch = useCallback(() => {
    return fetchSession();
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

  useEffect(() => {
    const handleInvalidated = () => invalidateSession();
    window.addEventListener(SESSION_INVALIDATED_EVENT, handleInvalidated);
    return () => window.removeEventListener(SESSION_INVALIDATED_EVENT, handleInvalidated);
  }, [invalidateSession]);

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
    () => ({ data, isPending, error, refetch, updateMemberSummary, completeOnboarding }),
    [data, isPending, error, refetch, updateMemberSummary, completeOnboarding],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSessionContext(): SessionContextValue | null {
  return useContext(SessionContext);
}
