'use client';

import { useBlockRoomConnection } from '@/lib/collab/useBlockRoomConnection';

export interface PageEditorCollaborationResult {
  provider: ReturnType<typeof useBlockRoomConnection>['provider'];
  doc: ReturnType<typeof useBlockRoomConnection>['doc'];
  bootstrap: ReturnType<typeof useBlockRoomConnection>['bootstrap'];
  protocol: ReturnType<typeof useBlockRoomConnection>['protocol'];
  isConnected: boolean;
  isSynced: boolean;
  reloadCanonical: ReturnType<typeof useBlockRoomConnection>['reloadCanonical'];
  acceptEpochAck: ReturnType<typeof useBlockRoomConnection>['acceptEpochAck'];
}

export function usePageEditorCollaboration(pageId: string, locale: string | null): PageEditorCollaborationResult {
  return useBlockRoomConnection('page', pageId, locale);
}
