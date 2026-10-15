'use client';

import { flushAllEditorSaves, hasUnsavedEditorEdits } from './editor-save-registry';

/**
 * Tries to save every pending edit before signing out. Resolves true when nothing unsaved is left;
 * false means signing out would delete unsaved edits from this device, which needs the editor's
 * consent.
 */
export async function settleEditsBeforeSignOut(timeoutMs = 3_000): Promise<boolean> {
  // Parked (read-only) and refused edits are unsaved too: signing out deletes them from this device.
  const unsaved = () => hasUnsavedEditorEdits();
  if (!unsaved()) {
    return true;
  }
  await Promise.race([
    flushAllEditorSaves().catch(() => false),
    new Promise((resolve) => setTimeout(resolve, timeoutMs)),
  ]);
  return !unsaved();
}
