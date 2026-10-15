/** `rejected`: the server refused some edits for good; they are kept for review, never retried. */
export type EditorSaveState = 'saved' | 'saving' | 'offline' | 'error' | 'rejected' | 'reload';

/** Transport-only mapping for editors whose rooms have no durable acknowledgement. */
export function resolveTransportSaveState(isConnected: boolean, isSynced: boolean): EditorSaveState {
  return isConnected ? (isSynced ? 'saved' : 'saving') : 'offline';
}
