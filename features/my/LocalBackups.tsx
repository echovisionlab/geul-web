'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { getActiveMember, subscribeSignedOutMembers } from '@/lib/auth/active-member';
import { createBrowserLocalBackupRepository, type LocalBackup } from '@/lib/collab/local-backups';
import { useSessionContext } from '@/lib/providers/SessionProvider';
import { LocalBackupsView } from './LocalBackupsView';

export function LocalBackups() {
  const session = useSessionContext();
  const memberId = session?.data?.user.id ?? null;
  const memberRef = useRef(memberId);
  memberRef.current = memberId;
  const repository = useMemo(
    () =>
      createBrowserLocalBackupRepository(() => {
        const member = memberRef.current;
        return member && getActiveMember() === member ? member : null;
      }),
    [],
  );
  const [entries, setEntries] = useState<LocalBackup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [clearing, setClearing] = useState(false);
  const generation = useRef(0);
  const refresh = useCallback(async () => {
    const request = ++generation.current;
    setLoading(true);
    setError(false);
    try {
      const result = (await repository?.list()) ?? [];
      if (request === generation.current) {
        setEntries(result);
      }
    } catch {
      if (request === generation.current) {
        setError(true);
      }
    } finally {
      if (request === generation.current) {
        setLoading(false);
      }
    }
  }, [repository]);
  useEffect(() => {
    setEntries([]);
    void refresh();
    const onFocus = () => void refresh();
    window.addEventListener('focus', onFocus);
    const timer = window.setInterval(onFocus, 15_000);
    const unsubscribe = subscribeSignedOutMembers(() => {
      generation.current += 1;
      setEntries([]);
    });
    return () => {
      generation.current += 1;
      window.removeEventListener('focus', onFocus);
      window.clearInterval(timer);
      unsubscribe();
    };
  }, [memberId, refresh]);
  const clear = async () => {
    setClearing(true);
    setError(false);
    try {
      // Each discard rechecks the owner lock, so a document reopened in another tab keeps its journal.
      for (const entry of (await repository?.list()) ?? []) {
        await repository?.discard(entry);
      }
    } catch {
      setError(true);
    } finally {
      await refresh();
      setClearing(false);
    }
  };
  if (!memberId || getActiveMember() !== memberId) {
    return null;
  }
  return (
    <LocalBackupsView
      count={entries.length}
      bytes={entries.reduce((total, entry) => total + entry.bytes, 0)}
      loading={loading}
      error={error}
      clearing={clearing}
      unavailable={!repository || !navigator.locks}
      onRefresh={() => void refresh()}
      onClear={clear}
    />
  );
}
