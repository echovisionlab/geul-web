import { hasEditorSaveRecovery } from './editor-save-recovery';

type PendingSave = { flush: () => Promise<boolean>; hasPending: () => boolean };
const pendingSaves = new Map<string, Set<PendingSave>>();
const pendingSaveListeners = new Map<string | undefined, Set<() => void>>();

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
  return ![...documentsFlushed].some((flushedDocument) => hasEditorSaveRecovery(flushedDocument));
}

/** Backwards-compatible scoped flush used by locale transitions. */
export function flushEditorSaves(document: string): Promise<boolean> {
  return flushAllEditorSaves(document);
}
