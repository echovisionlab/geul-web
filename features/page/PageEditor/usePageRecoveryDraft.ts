'use client';

import { useLayoutEffect, useRef, useState } from 'react';
import type { BlockRoomRecoverySnapshot } from '@/lib/collab/block-room-recovery';
import type { PageRecoveryDraft } from './page-recovery-download';

/** Freeze the local form fields before bootstrap effects replace them. */
export function usePageRecoveryDraft(snapshot: BlockRoomRecoverySnapshot | null, draft: PageRecoveryDraft) {
  const capturedSnapshot = useRef(snapshot);
  const [recoveryDraft, setRecoveryDraft] = useState(() => (snapshot ? draft : undefined));
  useLayoutEffect(() => {
    if (capturedSnapshot.current === snapshot) {
      return;
    }
    capturedSnapshot.current = snapshot;
    setRecoveryDraft(snapshot ? draft : undefined);
  }, [snapshot, draft.title, draft.summary, draft.layout]);
  return recoveryDraft;
}
