'use client';

import { useCallback, useSyncExternalStore } from 'react';
import {
  getEditorRoomPhase,
  hasEditorSaveFailure,
  hasPendingEditorSaves,
  hasRejectedEditorSaves,
  subscribeToEditorSaveState,
} from './editor-save-registry';
import { resolveEditorSaveState, resolveTransportSaveState, type EditorSaveState } from './editor-save-state';

export function useEditorSaveState(
  document: string | undefined,
  isConnected: boolean,
  isSynced: boolean,
): EditorSaveState {
  const subscribe = useCallback((listener: () => void) => subscribeToEditorSaveState(document, listener), [document]);
  const snapshot = useCallback(() => {
    if (!document) {
      return resolveTransportSaveState(isConnected, isSynced);
    }
    const phase = getEditorRoomPhase(document) ?? (isConnected ? (isSynced ? 'synced' : 'resyncing') : 'offline');
    return resolveEditorSaveState({
      phase,
      hasUnsavedEdits: hasPendingEditorSaves(document),
      hasFailure: hasEditorSaveFailure(document),
      hasRejected: hasRejectedEditorSaves(document),
    });
  }, [document, isConnected, isSynced]);
  return useSyncExternalStore(subscribe, snapshot, snapshot);
}
