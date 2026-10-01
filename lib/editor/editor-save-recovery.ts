'use client';

const STORAGE_PREFIX = 'geul:editor-save-recovery:v1:';

export interface EditorSaveRecoveryEntry {
  id: string;
  document: string;
  updatedAt: number;
  patch: unknown;
}

export interface EditorSaveRecovery {
  scope: string;
  entries: EditorSaveRecoveryEntry[];
}

interface StoredEntry extends Omit<EditorSaveRecoveryEntry, 'id'> {
  queueId: string;
}

interface StoredRecovery {
  version: 1;
  scope: string;
  entries: StoredEntry[];
}

const activeQueueIds = new Set<string>();
const recoveryListeners = new Set<() => void>();
const memoryRecoveries = new Map<string, Map<string, StoredEntry>>();

function notifyRecoveryChanged() {
  for (const listener of recoveryListeners) {
    listener();
  }
}

export function subscribeToEditorSaveRecovery(listener: () => void) {
  recoveryListeners.add(listener);
  return () => {
    recoveryListeners.delete(listener);
  };
}

export function activateEditorSaveRecoveryQueue(queueId: string) {
  activeQueueIds.add(queueId);
  notifyRecoveryChanged();
}

export function deactivateEditorSaveRecoveryQueue(queueId: string) {
  activeQueueIds.delete(queueId);
  notifyRecoveryChanged();
}

function getStorage(): Storage | null {
  try {
    return typeof window === 'undefined' ? null : window.sessionStorage;
  } catch {
    return null;
  }
}

function storageKey(scope: string) {
  return `${STORAGE_PREFIX}${encodeURIComponent(scope)}`;
}

function parseSessionRecovery(scope: string): StoredRecovery | null {
  const storage = getStorage();
  if (!storage) {
    return null;
  }
  try {
    const raw = storage.getItem(storageKey(scope));
    if (!raw) {
      return null;
    }
    const value: unknown = JSON.parse(raw);
    if (
      !value ||
      typeof value !== 'object' ||
      !('version' in value) ||
      value.version !== 1 ||
      !('scope' in value) ||
      value.scope !== scope ||
      !('entries' in value) ||
      !Array.isArray(value.entries)
    ) {
      return null;
    }
    const entries = value.entries.filter(
      (entry): entry is StoredEntry =>
        Boolean(entry) &&
        typeof entry === 'object' &&
        'queueId' in entry &&
        typeof entry.queueId === 'string' &&
        'document' in entry &&
        typeof entry.document === 'string' &&
        'updatedAt' in entry &&
        typeof entry.updatedAt === 'number' &&
        'patch' in entry,
    );
    return { version: 1, scope, entries };
  } catch {
    return null;
  }
}

function parseStoredRecovery(scope: string): StoredRecovery | null {
  const session = parseSessionRecovery(scope);
  const memory = [...(memoryRecoveries.get(scope)?.values() ?? [])];
  if (!session && memory.length === 0) {
    return null;
  }
  const entries = new Map<string, StoredEntry>();
  for (const entry of session?.entries ?? []) {
    entries.set(entry.queueId, entry);
  }
  for (const entry of memory) {
    entries.set(entry.queueId, entry);
  }
  return { version: 1, scope, entries: [...entries.values()] };
}

function storedScopes(): string[] {
  const scopes = new Set(memoryRecoveries.keys());
  const storage = getStorage();
  if (!storage) {
    return [...scopes];
  }
  try {
    for (let index = 0; index < storage.length; index += 1) {
      const key = storage.key(index);
      if (!key?.startsWith(STORAGE_PREFIX)) {
        continue;
      }
      try {
        scopes.add(decodeURIComponent(key.slice(STORAGE_PREFIX.length)));
      } catch {
        // Ignore malformed keys and preserve records under valid scopes.
      }
    }
  } catch {
    // Keep the in-memory scopes available if session storage cannot be enumerated.
  }
  return [...scopes];
}

export function persistEditorSaveRecoveryEntry(
  scope: string | null,
  queueId: string,
  entry: Omit<EditorSaveRecoveryEntry, 'id'>,
): boolean {
  if (!scope) {
    return false;
  }
  const storage = getStorage();
  try {
    const serializedPatch = JSON.stringify(entry.patch);
    if (serializedPatch === undefined) {
      return false;
    }
    const safeEntry: StoredEntry = {
      queueId,
      document: entry.document,
      updatedAt: entry.updatedAt,
      patch: JSON.parse(serializedPatch) as unknown,
    };
    const memory = memoryRecoveries.get(scope) ?? new Map<string, StoredEntry>();
    memory.set(queueId, safeEntry);
    memoryRecoveries.set(scope, memory);
    const stored = parseStoredRecovery(scope) ?? { version: 1 as const, scope, entries: [] };
    const entries = stored.entries.filter((item) => item.queueId !== queueId);
    entries.push(safeEntry);
    storage?.setItem(storageKey(scope), JSON.stringify({ version: 1, scope, entries } satisfies StoredRecovery));
    notifyRecoveryChanged();
    return storage !== null;
  } catch {
    const memory = memoryRecoveries.get(scope);
    if (memory) {
      notifyRecoveryChanged();
    }
    return false;
  }
}

export function removeEditorSaveRecoveryEntry(scope: string | null, queueId: string) {
  if (!scope) {
    return;
  }
  const storage = getStorage();
  const memory = memoryRecoveries.get(scope);
  memory?.delete(queueId);
  if (memory?.size === 0) {
    memoryRecoveries.delete(scope);
  }
  const stored = parseSessionRecovery(scope);
  if (!storage || !stored) {
    notifyRecoveryChanged();
    return;
  }
  try {
    const entries = stored.entries.filter((entry) => entry.queueId !== queueId);
    if (entries.length === 0) {
      storage.removeItem(storageKey(scope));
    } else {
      storage.setItem(storageKey(scope), JSON.stringify({ ...stored, entries }));
    }
    notifyRecoveryChanged();
  } catch {
    // A recovery cleanup failure leaves a downloadable copy in session storage.
  }
}

export function readEditorSaveRecovery(scope: string): EditorSaveRecovery | null {
  const stored = parseStoredRecovery(scope);
  const entries = stored?.entries.filter((entry) => !activeQueueIds.has(entry.queueId)) ?? [];
  if (entries.length === 0) {
    return null;
  }
  return {
    scope,
    entries: entries.map(({ queueId, document, updatedAt, patch }) => ({ id: queueId, document, updatedAt, patch })),
  };
}

export function listEditorSaveRecoveries(document: string): EditorSaveRecovery[] {
  const recoveries: EditorSaveRecovery[] = [];
  try {
    for (const scope of storedScopes()) {
      const recovery = readEditorSaveRecovery(scope);
      const entries = recovery?.entries.filter((entry) => entry.document === document) ?? [];
      if (recovery && entries.length > 0) {
        recoveries.push({ scope, entries });
      }
    }
  } catch {
    return recoveries;
  }
  return recoveries;
}

export function hasEditorSaveRecovery(document?: string): boolean {
  try {
    for (const scope of storedScopes()) {
      const recovery = readEditorSaveRecovery(scope);
      if (recovery?.entries.some((entry) => document === undefined || entry.document === document)) {
        return true;
      }
    }
  } catch {
    return false;
  }
  return false;
}

export function exportEditorSaveRecovery(scope: string): string | null {
  const recovery = readEditorSaveRecovery(scope);
  return recovery ? JSON.stringify(recovery, null, 2) : null;
}

export function exportEditorSaveRecoveries(document: string): string | null {
  const recoveries = listEditorSaveRecoveries(document);
  return recoveries.length > 0 ? JSON.stringify({ document, recoveries }, null, 2) : null;
}

/** Removes a recovery copy only after an explicit user action. */
export function clearEditorSaveRecovery(scope: string, queueIds?: readonly string[]) {
  const storage = getStorage();
  const stored = parseStoredRecovery(scope);
  if (!stored) {
    return;
  }
  try {
    const queueIdSet = queueIds ? new Set(queueIds) : null;
    const keptEntries = stored.entries.filter(
      (entry) => activeQueueIds.has(entry.queueId) || (queueIdSet ? !queueIdSet.has(entry.queueId) : false),
    );
    const memory = memoryRecoveries.get(scope);
    if (memory) {
      const keptIds = new Set(keptEntries.map((entry) => entry.queueId));
      for (const queueId of memory.keys()) {
        if (!keptIds.has(queueId)) {
          memory.delete(queueId);
        }
      }
      if (memory.size === 0) {
        memoryRecoveries.delete(scope);
      }
    }
    if (storage) {
      const sessionEntries = parseSessionRecovery(scope)?.entries ?? [];
      const sessionKept = sessionEntries.filter((entry) => keptEntries.some((kept) => kept.queueId === entry.queueId));
      if (sessionKept.length === 0) {
        storage.removeItem(storageKey(scope));
      } else {
        storage.setItem(storageKey(scope), JSON.stringify({ ...stored, entries: sessionKept }));
      }
    }
    notifyRecoveryChanged();
  } catch {
    // Keep the record if storage refuses the explicit cleanup.
  }
}
