import type { RejectedPatch } from './debounced-patch';
import type { BlockRoomSyncPhase } from './editor-save-state';
import { hasRecoverableEditorSaveRecovery, type EditorSaveRecoveryIdentity } from './editor-save-recovery';

type PendingSave = {
  flush: () => Promise<boolean>;
  hasPending: () => boolean;
  getPendingPatch?: () => object | null;
  getRecoveryIdentity?: () => EditorSaveRecoveryIdentity;
  /** True while an automatic persistence attempt has failed and is being retried. */
  hasFailure?: () => boolean;
  /**
   * True when this save's unsaved state is written to this device and returns after the same
   * member signs in again. Saves that cannot tell are treated as memory-only.
   */
  isDurable?: () => boolean;
  /**
   * Unsaved edits kept while the room is read-only (downgraded to view). They are not sent, but
   * they are still the member's unsaved work: sign-out consent and unload protection count them.
   */
  hasParked?: () => boolean;
  /** Fields the server refused for good (see UnretryableSaveError). */
  getRejected?: () => RejectedPatch<object> | null;
  discardRejected?: () => void;
};

/** One save's refused fields, with the action that drops them. */
export interface RejectedEditorSave extends RejectedPatch<object> {
  discard: () => void;
}
const pendingSaves = new Map<string, Set<PendingSave>>();
const pendingSaveListeners = new Map<string | undefined, Set<() => void>>();

/** Fields with local intent still waiting for acknowledgment must survive peer updates. */
export function getPendingEditorPatch(document: string): Record<string, unknown> {
  return Object.assign({}, ...[...(pendingSaves.get(document) ?? [])].map((save) => save.getPendingPatch?.() ?? {}));
}

export function notifyEditorSaveStateChanged(document: string) {
  for (const listener of pendingSaveListeners.get(document) ?? []) {
    listener();
  }
  for (const listener of pendingSaveListeners.get(undefined) ?? []) {
    listener();
  }
}

export function subscribeToEditorSaveState(document: string | undefined, listener: () => void) {
  const listeners = pendingSaveListeners.get(document) ?? new Set<() => void>();
  listeners.add(listener);
  pendingSaveListeners.set(document, listeners);
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) {
      pendingSaveListeners.delete(document);
    }
  };
}

export function hasPendingEditorSaves(document?: string): boolean {
  const saves =
    document === undefined
      ? [...pendingSaves.values()].flatMap((set) => [...set])
      : [...(pendingSaves.get(document) ?? [])];
  return saves.some((save) => save.hasPending());
}

/** Reports whether a registered save is retrying after a persistence failure. */
export function hasEditorSaveFailure(document?: string): boolean {
  const saves =
    document === undefined
      ? [...pendingSaves.values()].flatMap((set) => [...set])
      : [...(pendingSaves.get(document) ?? [])];
  return saves.some((save) => save.hasFailure?.() ?? false);
}

function registeredSaves(document?: string): PendingSave[] {
  return document === undefined
    ? [...pendingSaves.values()].flatMap((set) => [...set])
    : [...(pendingSaves.get(document) ?? [])];
}

/** Refused fields of every registered save, for review; reading neither retries nor drops them. */
export function getRejectedEditorSaves(document?: string): RejectedEditorSave[] {
  return registeredSaves(document).flatMap((save) => {
    const rejected = save.getRejected?.();
    return rejected ? [{ ...rejected, discard: () => save.discardRejected?.() }] : [];
  });
}

/** Whether every pending save of this page would survive leaving it (see PendingSave.isDurable). */
export function areUnsavedEditorEditsDurable(document?: string): boolean {
  return registeredSaves(document).every(
    (save) => !save.getRejected?.() && (!(save.hasPending() || save.hasParked?.()) || save.isDurable?.() === true),
  );
}

/** Any unsaved work in this page: pending, refused for review, or parked while read-only. */
export function hasUnsavedEditorEdits(document?: string): boolean {
  return registeredSaves(document).some(
    (save) => save.hasPending() || save.getRejected?.() != null || save.hasParked?.() === true,
  );
}

/** Parked edits that are not on this device: leaving the page would lose them. */
export function hasParkedEditsAtRisk(document?: string): boolean {
  return registeredSaves(document).some((save) => save.hasParked?.() === true && save.isDurable?.() !== true);
}

export function hasRejectedEditorSaves(document?: string): boolean {
  return registeredSaves(document).some((save) => save.getRejected?.() != null);
}

export function registerEditorSave(document: string, save: PendingSave) {
  const saves = pendingSaves.get(document) ?? new Set<PendingSave>();
  saves.add(save);
  pendingSaves.set(document, saves);
  notifyEditorSaveStateChanged(document);
  return () => {
    saves.delete(save);
    if (saves.size === 0) {
      pendingSaves.delete(document);
    }
    notifyEditorSaveStateChanged(document);
  };
}

/** Flushes all registered saves, optionally limited to one canonical document. */
export async function flushAllEditorSaves(document?: string): Promise<boolean> {
  const documentsFlushed = new Set(document === undefined ? [] : [document]);
  do {
    const documents = document === undefined ? [...pendingSaves.keys()] : pendingSaves.has(document) ? [document] : [];
    for (const registeredDocument of documents) {
      documentsFlushed.add(registeredDocument);
      for (const save of pendingSaves.get(registeredDocument) ?? []) {
        if (!(await save.flush())) {
          if (document !== undefined) {
            notifyEditorSaveStateChanged(document);
          } else {
            for (const registeredDocument of pendingSaves.keys()) {
              notifyEditorSaveStateChanged(registeredDocument);
            }
          }
          return false;
        }
      }
    }
  } while (hasPendingEditorSaves(document));
  if (document !== undefined) {
    notifyEditorSaveStateChanged(document);
  } else {
    for (const registeredDocument of pendingSaves.keys()) {
      notifyEditorSaveStateChanged(registeredDocument);
    }
  }
  const recoveryIdentities = [...documentsFlushed].flatMap((registeredDocument) =>
    [...(pendingSaves.get(registeredDocument) ?? [])].flatMap((save) => {
      const identity = save.getRecoveryIdentity?.();
      return identity ? [{ ...identity, document: registeredDocument }] : [];
    }),
  );
  return !hasRecoverableEditorSaveRecovery(recoveryIdentities);
}

/** Backwards-compatible scoped flush used by locale transitions. */
export function flushEditorSaves(document: string): Promise<boolean> {
  return flushAllEditorSaves(document);
}

const roomPhases = new Map<string, BlockRoomSyncPhase>();
export function setEditorRoomPhase(document: string, phase: BlockRoomSyncPhase | null) {
  if (phase === null) {
    roomPhases.delete(document);
  } else {
    roomPhases.set(document, phase);
  }
  notifyEditorSaveStateChanged(document);
}
export function getEditorRoomPhase(document: string): BlockRoomSyncPhase | undefined {
  return roomPhases.get(document);
}
const restoredListeners = new Set<() => void>();
export function announceRestoredEditorEdits() {
  for (const listener of restoredListeners) {
    listener();
  }
}
export function subscribeToRestoredEditorEdits(listener: () => void) {
  restoredListeners.add(listener);
  return () => {
    restoredListeners.delete(listener);
  };
}
