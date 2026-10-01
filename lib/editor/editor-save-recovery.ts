'use client';

const STORAGE_PREFIX = 'geul:editor-save-recovery:v1:';

export interface EditorSaveRecoveryEntry {
  id: string;
  document: string;
  updatedAt: number;
  patch: unknown;
  recoveryKey?: string;
}

export interface EditorSaveRecovery {
  scope: string;
  entries: EditorSaveRecoveryEntry[];
}

export interface EditorSaveRecoveryIdentity {
  scope: string | null;
  key?: string;
}

interface StoredEntry extends Omit<EditorSaveRecoveryEntry, 'id'> {
  queueId: string;
  recoveredQueueIds?: string[];
}

interface StoredRecovery {
  version: 1;
  scope: string;
  entries: StoredEntry[];
  /** Unrecognized entry shapes are carried through unrelated writes without being replayed. */
  opaqueEntries?: unknown[];
}

const activeQueueIds = new Set<string>();
const claimedQueueIds = new Map<string, string>();
const memoryRecoveries = new Map<string, Map<string, StoredEntry>>();
const latestPersistedAtByScope = new Map<string, number>();

export function activateEditorSaveRecoveryQueue(queueId: string) {
  activeQueueIds.add(queueId);
}

export function deactivateEditorSaveRecoveryQueue(queueId: string) {
  activeQueueIds.delete(queueId);
  releaseEditorSaveRecoveryClaims(queueId);
}

function releaseEditorSaveRecoveryClaims(ownerQueueId: string) {
  for (const [queueId, owner] of claimedQueueIds) {
    if (owner === ownerQueueId) {
      claimedQueueIds.delete(queueId);
    }
  }
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
    const entries: StoredEntry[] = [];
    const opaqueEntries: unknown[] = [];
    for (const entry of value.entries) {
      if (
        !entry ||
        typeof entry !== 'object' ||
        !('queueId' in entry) ||
        typeof entry.queueId !== 'string' ||
        !('document' in entry) ||
        typeof entry.document !== 'string' ||
        !('updatedAt' in entry) ||
        typeof entry.updatedAt !== 'number' ||
        !Number.isFinite(entry.updatedAt) ||
        !('patch' in entry)
      ) {
        opaqueEntries.push(entry);
        continue;
      }
      const recoveryKey =
        'recoveryKey' in entry && typeof entry.recoveryKey === 'string' ? entry.recoveryKey : undefined;
      const recoveredQueueIds =
        'recoveredQueueIds' in entry &&
        Array.isArray(entry.recoveredQueueIds) &&
        entry.recoveredQueueIds.every((queueId: unknown) => typeof queueId === 'string')
          ? [...entry.recoveredQueueIds]
          : undefined;
      entries.push({
        queueId: entry.queueId,
        document: entry.document,
        updatedAt: entry.updatedAt,
        patch: entry.patch,
        ...(recoveryKey === undefined ? {} : { recoveryKey }),
        ...(recoveredQueueIds === undefined ? {} : { recoveredQueueIds }),
      });
    }
    return { version: 1, scope, entries, opaqueEntries };
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
  return { version: 1, scope, entries: [...entries.values()], opaqueEntries: session?.opaqueEntries ?? [] };
}

function serializedRecovery(scope: string, entries: StoredEntry[], opaqueEntries: unknown[] = []) {
  return JSON.stringify({ version: 1, scope, entries: [...opaqueEntries, ...entries] });
}

export function persistEditorSaveRecoveryEntry(
  scope: string | null,
  queueId: string,
  entry: Omit<EditorSaveRecoveryEntry, 'id'> & { recoveredQueueIds?: readonly string[] },
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
    const existing = parseStoredRecovery(scope)?.entries ?? [];
    const latestPersistedAt = Math.max(
      latestPersistedAtByScope.get(scope) ?? Number.NEGATIVE_INFINITY,
      ...existing.map((storedEntry) => storedEntry.updatedAt),
    );
    const updatedAt = Math.max(entry.updatedAt, latestPersistedAt + 1);
    latestPersistedAtByScope.set(scope, updatedAt);
    const safeEntry: StoredEntry = {
      queueId,
      document: entry.document,
      updatedAt,
      patch: JSON.parse(serializedPatch) as unknown,
      ...(typeof entry.recoveryKey === 'string' ? { recoveryKey: entry.recoveryKey } : {}),
      ...(entry.recoveredQueueIds?.length ? { recoveredQueueIds: [...new Set(entry.recoveredQueueIds)] } : {}),
    };
    const memory = memoryRecoveries.get(scope) ?? new Map<string, StoredEntry>();
    memory.set(queueId, safeEntry);
    memoryRecoveries.set(scope, memory);
    const stored = parseStoredRecovery(scope) ?? { version: 1 as const, scope, entries: [] };
    const entries = stored.entries.filter((item) => item.queueId !== queueId);
    entries.push(safeEntry);
    if (storage) {
      const sessionStored = parseSessionRecovery(scope);
      // Keep malformed/unknown envelopes intact. The in-memory copy remains usable for this session.
      const rawSession = storage.getItem(storageKey(scope));
      if (!rawSession || sessionStored) {
        storage.setItem(storageKey(scope), serializedRecovery(scope, entries, sessionStored?.opaqueEntries));
      }
    }
    return true;
  } catch {
    return false;
  }
}

export function removeEditorSaveRecoveryEntry(scope: string | null, queueId: string) {
  if (!scope) {
    return;
  }
  const queueIdsToRemove = new Set([queueId]);
  for (const [claimedId, owner] of claimedQueueIds) {
    if (owner === queueId && !activeQueueIds.has(claimedId)) {
      queueIdsToRemove.add(claimedId);
    }
  }
  for (const claimedId of queueIdsToRemove) {
    claimedQueueIds.delete(claimedId);
  }
  const storage = getStorage();
  const memory = memoryRecoveries.get(scope);
  for (const id of queueIdsToRemove) {
    memory?.delete(id);
  }
  if (memory?.size === 0) {
    memoryRecoveries.delete(scope);
  }
  const stored = parseSessionRecovery(scope);
  if (!storage || !stored) {
    return;
  }
  try {
    const entries = stored.entries.filter((entry) => !queueIdsToRemove.has(entry.queueId));
    if (entries.length === 0 && stored.opaqueEntries?.length === 0) {
      storage.removeItem(storageKey(scope));
    } else {
      storage.setItem(storageKey(scope), serializedRecovery(scope, entries, stored.opaqueEntries));
    }
  } catch {
    // Keep the recovery entry when storage cleanup fails.
  }
}

export function readEditorSaveRecovery(scope: string): EditorSaveRecovery | null {
  const stored = parseStoredRecovery(scope);
  const absorbedQueueIds = new Map<string, Set<string>>();
  for (const entry of stored?.entries ?? []) {
    if (!entry.recoveryKey) {
      continue;
    }
    const identity = JSON.stringify([entry.document, entry.recoveryKey]);
    const queueIds = absorbedQueueIds.get(identity) ?? new Set<string>();
    for (const recoveredQueueId of entry.recoveredQueueIds ?? []) {
      queueIds.add(recoveredQueueId);
    }
    absorbedQueueIds.set(identity, queueIds);
  }
  const entries =
    stored?.entries.filter(
      (entry) =>
        !activeQueueIds.has(entry.queueId) &&
        !claimedQueueIds.has(entry.queueId) &&
        !absorbedQueueIds.get(JSON.stringify([entry.document, entry.recoveryKey]))?.has(entry.queueId),
    ) ?? [];
  if (entries.length === 0) {
    return null;
  }
  return {
    scope,
    entries: entries.map(({ queueId, document, updatedAt, patch, recoveryKey }) => ({
      id: queueId,
      document,
      updatedAt,
      patch,
      ...(recoveryKey === undefined ? {} : { recoveryKey }),
    })),
  };
}

export interface ClaimedEditorSaveRecoveryEntry extends EditorSaveRecoveryEntry {
  recoveredQueueIds: string[];
}

/** Claims only inactive entries written by the same stable writer for this exact room and document. */
export function claimEditorSaveRecoveryEntries(
  scope: string | null,
  ownerQueueId: string,
  document: string,
  recoveryKey: string | undefined,
): ClaimedEditorSaveRecoveryEntry[] {
  if (!scope || !recoveryKey) {
    return [];
  }
  const stored = parseStoredRecovery(scope);
  if (!stored) {
    return [];
  }

  const matchingEntries = stored.entries.filter(
    (entry) =>
      entry.document === document &&
      entry.recoveryKey === recoveryKey &&
      entry.patch !== null &&
      typeof entry.patch === 'object' &&
      !Array.isArray(entry.patch),
  );
  const absorbedQueueIds = new Set(matchingEntries.flatMap((entry) => entry.recoveredQueueIds ?? []));
  const candidates = matchingEntries.filter((entry) => {
    if (absorbedQueueIds.has(entry.queueId)) {
      return false;
    }
    if (entry.queueId !== ownerQueueId && activeQueueIds.has(entry.queueId)) {
      return false;
    }
    const currentClaimOwner = claimedQueueIds.get(entry.queueId);
    return currentClaimOwner === undefined || currentClaimOwner === ownerQueueId;
  });
  candidates.sort((a, b) => a.updatedAt - b.updatedAt);

  const inheritedQueueIds = new Set<string>();
  for (const entry of candidates) {
    for (const inheritedId of entry.recoveredQueueIds ?? []) {
      inheritedQueueIds.add(inheritedId);
    }
    if (entry.queueId !== ownerQueueId) {
      inheritedQueueIds.add(entry.queueId);
    }
  }

  // Reserve available ancestors too, so a second mounting queue cannot replay them in parallel.
  for (const claimedId of inheritedQueueIds) {
    if (
      !activeQueueIds.has(claimedId) &&
      (claimedQueueIds.get(claimedId) === undefined || claimedQueueIds.get(claimedId) === ownerQueueId)
    ) {
      claimedQueueIds.set(claimedId, ownerQueueId);
    }
  }
  for (const entry of candidates) {
    if (entry.queueId !== ownerQueueId) {
      claimedQueueIds.set(entry.queueId, ownerQueueId);
    }
  }

  return candidates.map((entry) => ({
    id: entry.queueId,
    document: entry.document,
    updatedAt: entry.updatedAt,
    patch: entry.patch,
    ...(entry.recoveryKey === undefined ? {} : { recoveryKey: entry.recoveryKey }),
    recoveredQueueIds: [...(entry.recoveredQueueIds ?? [])],
  }));
}

/** Only an exact registered writer can keep an orphaned keyed batch navigation-blocking. */
export function hasRecoverableEditorSaveRecovery(
  identities: readonly (EditorSaveRecoveryIdentity & { document: string })[],
): boolean {
  for (const identity of identities) {
    if (!identity.scope || !identity.key) {
      continue;
    }
    const recovery = readEditorSaveRecovery(identity.scope);
    if (recovery?.entries.some((entry) => entry.document === identity.document && entry.recoveryKey === identity.key)) {
      return true;
    }
  }
  return false;
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
    if (queueIdSet) {
      for (const entry of stored.entries) {
        if (queueIdSet.has(entry.queueId)) {
          for (const recoveredQueueId of entry.recoveredQueueIds ?? []) {
            queueIdSet.add(recoveredQueueId);
          }
        }
      }
    }
    const keptEntries = stored.entries.filter(
      (entry) =>
        activeQueueIds.has(entry.queueId) ||
        claimedQueueIds.has(entry.queueId) ||
        (queueIdSet ? !queueIdSet.has(entry.queueId) : false),
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
    const sessionRecovery = parseSessionRecovery(scope);
    if (storage && sessionRecovery) {
      const sessionEntries = sessionRecovery.entries;
      const sessionKept = sessionEntries.filter((entry) => keptEntries.some((kept) => kept.queueId === entry.queueId));
      if (sessionKept.length === 0 && sessionRecovery?.opaqueEntries?.length === 0) {
        storage.removeItem(storageKey(scope));
      } else {
        storage.setItem(storageKey(scope), serializedRecovery(scope, sessionKept, sessionRecovery?.opaqueEntries));
      }
    }
  } catch {
    // Keep the record if storage refuses the explicit cleanup.
  }
}
