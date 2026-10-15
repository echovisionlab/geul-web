/**
 * One truthful save-state model for collaborative editors.
 *
 * - `saved`: the server's durable `room.persisted` ACK covers every local edit.
 * - `saving`: local edits (or a resync) are still waiting for that ACK.
 * - `offline`: the room is unreachable; edits stay in the local Y.Doc and durable journal.
 * - `error`: the room is reachable but persisting failed; it is being retried.
 * - `rejected`: the server refused some edits for good; they wait for the editor's review.
 * - `reload`: the room is loading or being rebuilt from canonical state.
 */
import type { EditorSaveState } from '@/components/core/EditorHeader/save-state';
export { type EditorSaveState, resolveTransportSaveState } from '@/components/core/EditorHeader/save-state';

export const EDITOR_SAVE_STATES: readonly EditorSaveState[] = [
  'saved',
  'saving',
  'offline',
  'error',
  'rejected',
  'reload',
];

/**
 * Transport phase of a block room.
 * - `loading`: no document has been admitted yet (first load or a new locale).
 * - `synced`: the admitted document is connected and ready.
 * - `resyncing`: the socket is back and the document is catching up.
 * - `offline`: the socket is closed or the browser reports no network.
 * - `reload`: the room is rebuilding its Y.Doc under the mounted editor.
 */
export type BlockRoomSyncPhase = 'loading' | 'synced' | 'resyncing' | 'offline' | 'reload';

export interface EditorSaveStateInput {
  phase: BlockRoomSyncPhase;
  /** Local edits or journal intents that no durable ACK covers yet. */
  hasUnsavedEdits: boolean;
  /** A persistence attempt failed and is being retried. */
  hasFailure: boolean;
  /** The server refused some edits for good. */
  hasRejected?: boolean;
}

export function resolveEditorSaveState({
  phase,
  hasUnsavedEdits,
  hasFailure,
  hasRejected = false,
}: EditorSaveStateInput): EditorSaveState {
  // Refused edits need the editor's decision whatever the transport does.
  if (hasRejected) {
    return 'rejected';
  }
  if (phase === 'loading' || phase === 'reload') {
    return 'reload';
  }
  if (phase === 'offline') {
    return 'offline';
  }
  if (hasFailure) {
    return 'error';
  }
  return phase === 'resyncing' || hasUnsavedEdits ? 'saving' : 'saved';
}

/** Recovered-edit notice raised when another tab's or session's journal was replayed. */
export interface EditorRestoredEdits {
  /** Monotonic notice identity; a new value announces a new restoration. */
  id: number;
  records: number;
}

export interface EditorSaveStatus {
  state: EditorSaveState;
  restoredEdits: EditorRestoredEdits | null;
}

/** Save-registry key of a block room; it matches the editor runtime entity key. */
export function blockRoomSaveKey(documentType: string, entityId: string): string {
  switch (documentType) {
    case 'program-event':
      return `program_event:${entityId}`;
    case 'email-template':
      return `email_template:${entityId}`;
    case 'terms-history':
      return `terms:${entityId}`;
    case 'privacy-history':
      return `privacy:${entityId}`;
    default:
      return `${documentType}:${entityId}`;
  }
}
