'use client';

import { areUnsavedEditorEditsDurable } from './editor-save-registry';
import { suspendEditorUnloadGuard } from './usePendingEditorUnload';

/**
 * Prepares a deliberate full-page navigation (sign-in after an expired session, a member switch):
 * writes every room journal now and suspends the unsaved-edits prompt only when every pending save
 * confirms its state is on this device. Edits then come back after the same member signs in
 * again: room journals by adoption, field backups by this tab's session storage.
 *
 * Refused edits, memory-only saves (for example rooms without a journal), a journal write that
 * failed or did not finish in time all keep the prompt.
 */
export async function prepareToLeaveWithDurableEdits(): Promise<void> {
  // Loaded on demand: the same module instance editors registered their journals with.
  const { flushRoomJournals } = await import('@/lib/collab/room-journal-store');
  const journalsWritten = await flushRoomJournals();
  if (journalsWritten && areUnsavedEditorEditsDurable()) {
    suspendEditorUnloadGuard();
  }
}

/**
 * Runs a full-page `navigate` and calls `onStayed` when the page is still here shortly after: the
 * editor cancelled the browser's leave prompt, so the action that started leaving must work again.
 */
export function leaveOrResume(navigate: () => void, onStayed: () => void, settleMs = 2_000): void {
  let left = false;
  const markLeft = () => {
    left = true;
  };
  window.addEventListener('pagehide', markLeft, { once: true });
  navigate();
  setTimeout(() => {
    window.removeEventListener('pagehide', markLeft);
    if (!left) {
      onStayed();
    }
  }, settleMs);
}
