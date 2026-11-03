'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { getActiveMember, subscribeSignedOutMembers } from '@/lib/auth/active-member';
import { createBrowserLocalBackupRepository, type LocalBackup } from '@/lib/collab/local-backups';
import { useSessionContext } from '@/lib/providers/SessionProvider';
import { PageLoader } from '@/features/site/PageLoader';
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
  const active = useRef(true);
  const clearPending = useRef(false);
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
    active.current = true;
    clearPending.current = false;
    setEntries([]);
    setClearing(false);
    void refresh();
    const onFocus = () => void refresh();
    window.addEventListener('focus', onFocus);
    const timer = window.setInterval(onFocus, 15_000);
    const unsubscribe = subscribeSignedOutMembers(() => {
      generation.current += 1;
      setEntries([]);
    });
    return () => {
      active.current = false;
      generation.current += 1;
      window.removeEventListener('focus', onFocus);
      window.clearInterval(timer);
      unsubscribe();
    };
  }, [memberId, refresh]);
  const clear = async () => {
    const owner = memberRef.current;
    if (clearPending.current) {
      return;
    }
    clearPending.current = true;
    setClearing(true);
    setError(false);
    try {
      // Each discard rechecks the owner lock, so a document reopened in another tab keeps its journal.
      for (const entry of (await repository?.list()) ?? []) {
        if (!active.current || memberRef.current !== owner || getActiveMember() !== owner) {
          return;
        }
        await repository?.discard(entry);
      }
    } catch {
      if (active.current && memberRef.current === owner) {
        setError(true);
      }
    } finally {
      if (active.current && memberRef.current === owner && getActiveMember() === owner) {
        await refresh();
        clearPending.current = false;
        setClearing(false);
      }
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
      loadingSurface={<PageLoader placement="flow" size="sm" minHeight={120} />}
      error={error}
      clearing={clearing}
      unavailable={!repository || !navigator.locks}
      onRefresh={() => void refresh()}
      onClear={clear}
    />
  );
}
