'use client';

import { useLayoutEffect, useRef, useState } from 'react';
import type { BlockRoomRecoverySnapshot } from '@/lib/collab/block-room-recovery';
import type { PostRecoveryDraft } from './post-recovery-download';

/** Freeze local form values before room metadata effects replace them. */
export function usePostRecoveryDraft(snapshot: BlockRoomRecoverySnapshot | null, draft: PostRecoveryDraft) {
  const capturedSnapshot = useRef(snapshot);
  const [recoveryDraft, setRecoveryDraft] = useState(() => (snapshot ? draft : undefined));

  useLayoutEffect(() => {
    if (capturedSnapshot.current === snapshot) {
      return;
    }
    capturedSnapshot.current = snapshot;
    setRecoveryDraft(snapshot ? draft : undefined);
  }, [snapshot, draft.title, draft.summary, draft.commentsEnabled, draft.mapPlaceId, draft.layout]);

  return recoveryDraft;
}
