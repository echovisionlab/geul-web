'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getActiveMember, subscribeSignedOutMembers } from '@/lib/auth/active-member';
import { createBrowserLocalBackupRepository, type LocalBackup } from '@/lib/collab/local-backups';
import { buildLocalBackupEditorRoute } from '@/lib/utils/local-backup-route';
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
  const router = useRouter();
  const [entries, setEntries] = useState<LocalBackup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [pendingId, setPendingId] = useState<string | null>(null);
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
  const operate = async (entry: LocalBackup, action: 'open' | 'discard') => {
    setPendingId(`${entry.database}:${entry.id}`);
    setError(false);
    try {
      // Revalidate ownership just before acting; another tab may have reopened the room.
      const current = (await repository?.list()) ?? [];
      if (
        !current.some((item) => item.database === entry.database && item.id === entry.id && item.tabId === entry.tabId)
      ) {
        await refresh();
        return;
      }
      if (action === 'discard') {
        await repository?.discard(entry);
        await refresh();
      } else {
        const actor = memberRef.current;
        const href = buildLocalBackupEditorRoute(entry);
        if (actor && memberRef.current === actor && getActiveMember() === actor) {
          router.push(href);
        }
      }
    } catch {
      setError(true);
    } finally {
      setPendingId(null);
    }
  };
  if (!memberId || getActiveMember() !== memberId) {
    return null;
  }
  return (
    <LocalBackupsView
      entries={entries}
      loading={loading}
      error={error}
      pendingId={pendingId}
      unavailable={!repository || !navigator.locks}
      onRefresh={() => void refresh()}
      onOpen={(entry) => void operate(entry, 'open')}
      onDiscard={(entry) => operate(entry, 'discard')}
    />
  );
}
