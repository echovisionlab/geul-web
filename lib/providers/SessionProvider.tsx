'use client';

import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
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

  const invalidateSession = useCallback(() => {
    requestSequenceRef.current += 1;
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
    setData(null);
    setError(null);
    setIsPending(false);
    clearUserDisplaySnapshotCookie();
  }, []);

  const fetchSession = useCallback(async () => {
    abortControllerRef.current?.abort();
    const abortController = new AbortController();
    abortControllerRef.current = abortController;
    const requestSequence = requestSequenceRef.current + 1;
    requestSequenceRef.current = requestSequence;
    setIsPending(true);
    setError(null);

    try {
      const response = await fetch('/api/auth/session', {
        cache: 'no-store',
        signal: abortController.signal,
      });
      if (requestSequence !== requestSequenceRef.current) {
        return;
      }
      if (response.status === 401) {
        setData(null);
        return;
      }
      if (!response.ok) {
        throw new Error(`Session refresh failed with status ${response.status}`);
      }

      const json = (await response.json()) as SessionData | null;
      setData(json?.user ? json : null);
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
        setIsPending(false);
      }
    }
  }, []);

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
      void fetchSession();
    }
  }, [fetchSession, initialData]);

  useEffect(() => {
    const handleInvalidated = () => invalidateSession();
    window.addEventListener(SESSION_INVALIDATED_EVENT, handleInvalidated);
    return () => window.removeEventListener(SESSION_INVALIDATED_EVENT, handleInvalidated);
  }, [invalidateSession]);

  useEffect(() => {
    const revalidate = () => void fetchSession();
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
  }, [data?.user.id, fetchSession]);

  useEffect(
    () => () => {
      requestSequenceRef.current += 1;
      abortControllerRef.current?.abort();
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

  return (
    <SessionContext.Provider
      value={{ data, isPending, error, refetch: fetchSession, updateMemberSummary, completeOnboarding }}
    >
      {children}
    </SessionContext.Provider>
  );
}

export function useSessionContext(): SessionContextValue | null {
  return useContext(SessionContext);
}
