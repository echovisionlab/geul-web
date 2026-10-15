import { getActiveMember, subscribeSignedOutMembers } from '@/lib/auth/active-member';

/**
 * Durable, per-tab mirror of a room intent journal (block rooms and document rooms). The
 * in-memory journal stays the synchronous source of truth; this store only makes unacknowledged
 * intents survive a closed tab, a crash or a reload, and lets a later tab of the same member adopt
 * them exactly once.
 *
 * Every record belongs to the member who made its edits. A tab adopts only its own member's
 * records, and signing out deletes them, so a shared browser never replays one account's edits
 * under another (Notion keys its transaction outbox by user and clears it per user on logout).
 */

/** Every room journal database; sign-out clears the member's records in each, opened or not. */
export const ROOM_JOURNAL_DATABASES = {
  blockRoom: 'geul-block-room-journal',
  documentRoom: 'geul-document-room-journal',
} as const;
export type RoomJournalDatabase = (typeof ROOM_JOURNAL_DATABASES)[keyof typeof ROOM_JOURNAL_DATABASES];

/** IndexedDB schema version. Add an `oldVersion` branch in `upgradeDatabase` when it changes. */
export const ROOM_JOURNAL_DATABASE_VERSION = 1;
/** Record format version. Records written by another format are discarded, never replayed. */
export const ROOM_JOURNAL_RECORD_VERSION = 1;
const RECORD_STORE = 'records';
const SCOPE_INDEX = 'scopeKey';
const MEMBER_INDEX = 'memberId';
const TAB_LOCK_PREFIX = 'geul:room-journal:tab:';

export interface RoomJournalLimits {
  /** Upper bound of one tab's record for one room, estimated from its payload. */
  maxRecordBytes: number;
  /** Upper bound of records kept across all rooms and tabs. */
  maxRecords: number;
  /** Records older than this are discarded; their edits are presumed abandoned. */
  maxAgeMs: number;
  writeDebounceMs: number;
  heartbeatMs: number;
}

export const ROOM_JOURNAL_LIMITS: RoomJournalLimits = {
  maxRecordBytes: 8 * 1024 * 1024,
  maxRecords: 64,
  maxAgeMs: 30 * 24 * 60 * 60 * 1000,
  writeDebounceMs: 250,
  heartbeatMs: 15_000,
};

export interface RoomJournalRecord<Scope, Change, Recovery> {
  id: string;
  recordVersion: number;
  scopeKey: string;
  scope: Scope;
  /** The member whose edits these are; only that member's tabs adopt the record. */
  memberId: string;
  tabId: string;
  changes: Change[];
  recovery: Recovery | null;
  /** The record had to be compacted to stay within `maxRecordBytes`. */
  compacted: boolean;
  /** The document title the editor showed when the record was written (for local backups). */
  title?: string;
  updatedAt: number;
  heartbeatAt: number;
}

type AnyRecord = RoomJournalRecord<unknown, unknown, unknown>;

export interface RoomJournalBackend<Record extends AnyRecord = AnyRecord> {
  put: (record: Record, removeIds?: readonly string[]) => Promise<void>;
  delete: (id: string) => Promise<void>;
  listByScope: (scopeKey: string) => Promise<Record[]>;
  listAll: () => Promise<Record[]>;
  /** Deletes every record of one member, across tabs and rooms. */
  deleteMember: (memberId: string) => Promise<void>;
  /** Atomically transfers ownership; preserves data until consolidation or durable ACK. */
  take: (id: string, expectedOwner: string, newOwner: string) => Promise<Record | null>;
}

/** Read access for the device's recovery catalog; never transfers journal ownership. */
export interface RoomJournalCatalogBackend<Record extends AnyRecord = AnyRecord> extends RoomJournalBackend<Record> {
  read: (id: string) => Promise<Record | null>;
  listByMember: (memberId: string) => Promise<Record[]>;
}

export interface RoomJournalOwnerLiveness {
  /** Marks this tab alive for as long as the page lives. */
  hold: (tabId: string) => void;
  /** Runs `claim` only while the record owner is provably gone; otherwise resolves null. */
  whenOwnerGone: <T>(record: { tabId: string }, claim: () => Promise<T>) => Promise<T | null>;
}

export interface ClaimedRoomJournal<Change, Recovery> {
  changes: Change[];
  recovery: Recovery | null;
  /** Number of other tabs or sessions whose records were adopted. */
  records: number;
}

export interface RoomJournalStore<Scope, Change, Recovery> {
  readonly tabId: string;
  writeChanges: (scope: Scope, changes: readonly Change[]) => void;
  writeRecovery: (scope: Scope, recovery: Recovery | null) => void;
  /** Adopts unacknowledged intents the same member left for this room in closed tabs or sessions. */
  claimOrphans: (scope: Scope) => Promise<ClaimedRoomJournal<Change, Recovery>>;
  /** Deletes every durable record of `memberId` (sign-out). */
  clearMember: (memberId: string) => Promise<void>;
  flush: () => Promise<void>;
  /**
   * True when every room of this tab is written exactly as the in-memory journal holds it: no
   * write is scheduled or running, and none failed or was withheld (no or another member).
   */
  isSettled: () => boolean;
  prune: () => Promise<void>;
  dispose: () => void;
}

interface OwnRoomState<Scope, Change, Recovery> {
  scope: Scope;
  /** The member whose edits this tab's room state holds. */
  memberId: string | null;
  changes: Change[];
  recovery: Recovery | null;
}

function estimateBytes(value: unknown, seen = new Set<object>()): number {
  if (value === null || value === undefined) {
    return 0;
  }
  switch (typeof value) {
    case 'string':
      return value.length * 2;
    case 'number':
    case 'bigint':
      return 8;
    case 'boolean':
      return 4;
    case 'object':
      break;
    default:
      return 0;
  }
  if (ArrayBuffer.isView(value)) {
    return value.byteLength;
  }
  if (value instanceof ArrayBuffer) {
    return value.byteLength;
  }
  const object = value as object;
  if (seen.has(object)) {
    return 0;
  }
  seen.add(object);
  let total = 0;
  if (Array.isArray(object)) {
    for (const item of object) {
      total += estimateBytes(item, seen);
    }
    return total;
  }
  for (const [key, child] of Object.entries(object)) {
    total += key.length * 2 + estimateBytes(child, seen);
  }
  return total;
}

/**
 * Keeps a record within `maxBytes`: the recovery snapshot is dropped first, a journal that is
 * still too large is not written. Contiguous compaction belongs to the in-memory journal, so peer
 * discontinuities are preserved; the in-memory journal remains authoritative for this tab.
 */
export function boundRoomJournalRecord<Change, Recovery>(
  input: { changes: readonly Change[]; recovery: Recovery | null },
  maxBytes: number,
): { changes: Change[]; recovery: Recovery | null; compacted: boolean } | null {
  const changes = [...input.changes];
  const changeBytes = estimateBytes(changes);
  if (changeBytes + estimateBytes(input.recovery) <= maxBytes) {
    return { changes, recovery: input.recovery, compacted: false };
  }
  return changeBytes <= maxBytes ? { changes, recovery: null, compacted: false } : null;
}

function recordId(scopeKey: string, tabId: string): string {
  return `${scopeKey}\u0000${tabId}`;
}

function isUsableRecord(record: AnyRecord, now: number, limits: RoomJournalLimits): boolean {
  return (
    record.recordVersion === ROOM_JOURNAL_RECORD_VERSION &&
    typeof record.memberId === 'string' &&
    record.memberId.length > 0 &&
    Array.isArray(record.changes) &&
    now - record.updatedAt <= limits.maxAgeMs
  );
}

export function createRoomJournalStore<Scope, Change, Recovery extends { capturedAt: number }>(options: {
  backend: RoomJournalBackend<RoomJournalRecord<Scope, Change, Recovery>>;
  liveness: RoomJournalOwnerLiveness;
  tabId: string;
  scopeKey: (scope: Scope) => string;
  /** The signed-in member, or null while unknown; nothing is persisted without one. */
  memberId: () => string | null;
  /** The document title an open editor shows for this room, if known. */
  titleOf?: (scope: Scope) => string | undefined;
  limits?: Partial<RoomJournalLimits>;
  now?: () => number;
  onError?: (error: unknown) => void;
  onWrite?: () => void;
}): RoomJournalStore<Scope, Change, Recovery> {
  type Record = RoomJournalRecord<Scope, Change, Recovery>;
  const { backend, liveness, tabId } = options;
  const limits = { ...ROOM_JOURNAL_LIMITS, ...options.limits };
  const now = options.now ?? Date.now;
  const report = (error: unknown) => options.onError?.(error);
  const rooms = new Map<string, OwnRoomState<Scope, Change, Recovery>>();
  const dirty = new Set<string>();
  const written = new Set<string>();
  const adoptedIds = new Map<string, Set<string>>();
  let timer: ReturnType<typeof setTimeout> | null = null;
  let heartbeat: ReturnType<typeof setInterval> | null = null;
  let chain: Promise<void> = Promise.resolve();
  let disposed = false;
  let running = 0;
  // Rooms whose current state is not on disk: a write failed or was withheld.
  const undurable = new Set<string>();

  liveness.hold(tabId);

  const titleField = (scope: Scope): { title?: string } => {
    const title = options.titleOf?.(scope);
    return title ? { title } : {};
  };

  const isEmpty = (room: OwnRoomState<Scope, Change, Recovery> | undefined) =>
    !room || (room.changes.length === 0 && room.recovery === null);

  const persistRoom = async (scopeKey: string) => {
    const room = rooms.get(scopeKey);
    const id = recordId(scopeKey, tabId);
    undurable.add(scopeKey);
    if (isEmpty(room)) {
      if (written.has(scopeKey)) {
        await backend.delete(id);
      }
      for (const adoptedId of adoptedIds.get(scopeKey) ?? []) {
        await backend.delete(adoptedId);
      }
      // Keep bookkeeping on any failed deletion so retries cannot strand stale intents.
      written.delete(scopeKey);
      adoptedIds.delete(scopeKey);
      // A local edit may have arrived while IndexedDB was deleting the old record.
      if (rooms.get(scopeKey) === room && isEmpty(room)) {
        rooms.delete(scopeKey);
      }
      undurable.delete(scopeKey);
      options.onWrite?.();
      return;
    }
    // Edits are durable only under the member who made them. While the member is unknown, or the
    // tab now belongs to another member, they stay in memory only.
    if (!room!.memberId || room!.memberId !== options.memberId()) {
      return;
    }
    const bounded = boundRoomJournalRecord(room!, limits.maxRecordBytes);
    if (!bounded) {
      throw new Error('Room journal exceeds its durable size bound.');
    }
    const timestamp = now();
    await backend.put(
      {
        id,
        recordVersion: ROOM_JOURNAL_RECORD_VERSION,
        scopeKey,
        scope: room!.scope,
        memberId: room!.memberId,
        tabId,
        changes: bounded.changes,
        recovery: bounded.recovery,
        compacted: bounded.compacted,
        ...titleField(room!.scope),
        updatedAt: timestamp,
        heartbeatAt: timestamp,
      },
      [...(adoptedIds.get(scopeKey) ?? [])],
    );
    adoptedIds.delete(scopeKey);
    written.add(scopeKey);
    undurable.delete(scopeKey);
    options.onWrite?.();
  };

  const updateHeartbeat = () => {
    if (written.size === 0 && dirty.size === 0) {
      if (heartbeat !== null) {
        clearInterval(heartbeat);
        heartbeat = null;
      }
      return;
    }
    if (heartbeat === null) {
      heartbeat = setInterval(() => {
        for (const scopeKey of written) {
          dirty.add(scopeKey);
        }
        void flush();
      }, limits.heartbeatMs);
    }
  };

  const flush = (): Promise<void> => {
    if (timer !== null) {
      clearTimeout(timer);
      timer = null;
    }
    const scopeKeys = [...dirty];
    dirty.clear();
    running += 1;
    chain = chain
      .then(async () => {
        for (const scopeKey of scopeKeys) {
          try {
            await persistRoom(scopeKey);
          } catch (error) {
            dirty.add(scopeKey);
            report(error);
          }
        }
        updateHeartbeat();
      })
      .finally(() => {
        running -= 1;
      });
    return chain;
  };

  const schedule = (scopeKey: string) => {
    if (disposed) {
      return;
    }
    dirty.add(scopeKey);
    if (timer === null) {
      timer = setTimeout(() => {
        timer = null;
        void flush();
      }, limits.writeDebounceMs);
    }
  };

  const ownRoom = (scope: Scope): [string, OwnRoomState<Scope, Change, Recovery>] => {
    const scopeKey = options.scopeKey(scope);
    let room = rooms.get(scopeKey);
    if (!room) {
      room = { scope: { ...scope }, memberId: null, changes: [], recovery: null };
      rooms.set(scopeKey, room);
    }
    if (isEmpty(room)) {
      room.memberId = options.memberId();
    }
    return [scopeKey, room];
  };

  return {
    tabId,
    writeChanges: (scope, changes) => {
      const [scopeKey, room] = ownRoom(scope);
      room.changes = [...changes];
      schedule(scopeKey);
    },
    writeRecovery: (scope, recovery) => {
      const [scopeKey, room] = ownRoom(scope);
      room.recovery = recovery;
      schedule(scopeKey);
    },
    claimOrphans: (scope) => {
      const operation = chain.then(async () => {
        const scopeKey = options.scopeKey(scope);
        const claimed: ClaimedRoomJournal<Change, Recovery> = { changes: [], recovery: null, records: 0 };
        const memberId = options.memberId();
        if (!memberId) {
          return claimed;
        }
        let records: Record[];
        try {
          records = await backend.listByScope(scopeKey);
        } catch (error) {
          report(error);
          return claimed;
        }
        const timestamp = now();
        const candidates = records
          .filter((record) => record.tabId !== tabId && record.memberId === memberId)
          .sort((left, right) => left.updatedAt - right.updatedAt);
        for (const candidate of candidates) {
          try {
            if (!isUsableRecord(candidate, timestamp, limits)) {
              await liveness.whenOwnerGone(candidate, () => backend.delete(candidate.id));
              continue;
            }
            // Taking the record is one IndexedDB read-write transaction, so two
            // tabs racing for the same orphan can never both receive it.
            const record = await liveness.whenOwnerGone(candidate, () =>
              backend.take(candidate.id, candidate.tabId, tabId),
            );
            if (!record || !isUsableRecord(record, timestamp, limits) || record.memberId !== memberId) {
              continue;
            }
            const ids = adoptedIds.get(scopeKey) ?? new Set<string>();
            ids.add(record.id);
            adoptedIds.set(scopeKey, ids);
            claimed.records += 1;
            claimed.changes.push(...record.changes);
            if (record.recovery && (!claimed.recovery || record.recovery.capturedAt > claimed.recovery.capturedAt)) {
              claimed.recovery = record.recovery;
            }
          } catch (error) {
            report(error);
          }
        }
        // The member may have signed out or switched while storage was read: their journals must
        // not reach this page's editors any more.
        if (options.memberId() !== memberId) {
          return { changes: [], recovery: null, records: 0 };
        }
        if (claimed.records) {
          const [, room] = ownRoom(scope);
          room.changes.push(...claimed.changes);
          room.recovery = claimed.recovery ?? room.recovery;
          try {
            await persistRoom(scopeKey);
          } catch (error) {
            dirty.add(scopeKey);
            report(error);
            updateHeartbeat();
          }
        }
        return claimed;
      });
      chain = operation.then(() => undefined);
      return operation;
    },
    clearMember: (memberId) => {
      const operation = chain.then(async () => {
        for (const [scopeKey, room] of rooms) {
          if (room.memberId === memberId) {
            rooms.delete(scopeKey);
            dirty.delete(scopeKey);
            written.delete(scopeKey);
            adoptedIds.delete(scopeKey);
          }
        }
        await backend.deleteMember(memberId);
      });
      chain = operation.catch(report);
      return operation;
    },
    flush,
    isSettled: () => dirty.size === 0 && timer === null && running === 0 && undurable.size === 0,
    prune: async () => {
      try {
        const timestamp = now();
        const records = await backend.listAll();
        const usable: Record[] = [];
        for (const record of records) {
          if (record.tabId === tabId) {
            continue;
          }
          if (!isUsableRecord(record, timestamp, limits)) {
            await liveness.whenOwnerGone(record, () => backend.delete(record.id));
          } else {
            usable.push(record);
          }
        }
        const overflow = records.length - limits.maxRecords;
        if (overflow > 0) {
          usable.sort((left, right) => left.updatedAt - right.updatedAt);
          for (const record of usable.slice(0, overflow)) {
            await liveness.whenOwnerGone(record, () => backend.delete(record.id));
          }
        }
      } catch (error) {
        report(error);
      }
    },
    dispose: () => {
      disposed = true;
      if (timer !== null) {
        clearTimeout(timer);
        timer = null;
      }
      if (heartbeat !== null) {
        clearInterval(heartbeat);
        heartbeat = null;
      }
    },
  };
}

/* ------------------------------------------------------------------------ */
/* Browser adapters                                                          */
/* ------------------------------------------------------------------------ */

function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('IndexedDB request failed.'));
  });
}

function transactionDone(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error ?? new Error('IndexedDB transaction failed.'));
    transaction.onabort = () => reject(transaction.error ?? new Error('IndexedDB transaction aborted.'));
  });
}

function upgradeDatabase(database: IDBDatabase, oldVersion: number): void {
  if (oldVersion < 1) {
    const store = database.createObjectStore(RECORD_STORE, { keyPath: 'id' });
    store.createIndex(SCOPE_INDEX, 'scopeKey', { unique: false });
    store.createIndex(MEMBER_INDEX, 'memberId', { unique: false });
  }
}

export function createIndexedDbRoomJournalBackend<Record extends AnyRecord>(
  factory: IDBFactory,
  databaseName: string,
): RoomJournalCatalogBackend<Record> {
  let database: Promise<IDBDatabase> | null = null;
  const open = () => {
    database ??= new Promise<IDBDatabase>((resolve, reject) => {
      const request = factory.open(databaseName, ROOM_JOURNAL_DATABASE_VERSION);
      request.onupgradeneeded = (event) => upgradeDatabase(request.result, event.oldVersion);
      request.onsuccess = () => {
        const opened = request.result;
        // Let a newer tab upgrade the schema instead of blocking it.
        opened.onversionchange = () => {
          opened.close();
          database = null;
        };
        resolve(opened);
      };
      request.onerror = () => {
        database = null;
        reject(request.error ?? new Error('IndexedDB open failed.'));
      };
    });
    return database;
  };
  const store = async (mode: IDBTransactionMode) => {
    const transaction = (await open()).transaction(RECORD_STORE, mode);
    return { transaction, store: transaction.objectStore(RECORD_STORE) };
  };

  return {
    read: async (id) => {
      const { store: records } = await store('readonly');
      return ((await requestResult(records.get(id))) as Record | undefined) ?? null;
    },
    listByMember: async (memberId) => {
      const { store: records } = await store('readonly');
      return requestResult(records.index(MEMBER_INDEX).getAll(IDBKeyRange.only(memberId))) as Promise<Record[]>;
    },
    put: async (record, removeIds = []) => {
      const { transaction, store: records } = await store('readwrite');
      const existing = await requestResult(records.getKey(record.id));
      if (
        existing === undefined &&
        (await requestResult(records.count())) >= ROOM_JOURNAL_LIMITS.maxRecords &&
        removeIds.length === 0
      ) {
        throw new Error('Room journal record limit reached.');
      }
      records.put(record);
      for (const id of removeIds) {
        if (id !== record.id) {
          records.delete(id);
        }
      }
      await transactionDone(transaction);
    },
    delete: async (id) => {
      const { transaction, store: records } = await store('readwrite');
      records.delete(id);
      await transactionDone(transaction);
    },
    listByScope: async (scopeKey) => {
      const { store: records } = await store('readonly');
      return requestResult(records.index(SCOPE_INDEX).getAll(IDBKeyRange.only(scopeKey))) as Promise<Record[]>;
    },
    listAll: async () => {
      const { store: records } = await store('readonly');
      return requestResult(records.getAll()) as Promise<Record[]>;
    },
    deleteMember: async (memberId) => {
      const { transaction, store: records } = await store('readwrite');
      const keys = await requestResult(records.index(MEMBER_INDEX).getAllKeys(IDBKeyRange.only(memberId)));
      for (const key of keys) {
        records.delete(key);
      }
      await transactionDone(transaction);
    },
    take: async (id, expectedOwner, newOwner) => {
      const { transaction, store: records } = await store('readwrite');
      const record = (await requestResult(records.get(id))) as Record | undefined;
      if (!record || record.tabId !== expectedOwner) {
        return null;
      }
      const adopted = { ...record, tabId: newOwner, heartbeatAt: Date.now() };
      records.put(adopted);
      await transactionDone(transaction);
      return adopted;
    },
  };
}

interface LockManagerLike {
  request: (
    name: string,
    options: { ifAvailable?: boolean; mode?: 'exclusive' | 'shared' },
    callback: (lock: unknown) => unknown,
  ) => Promise<unknown>;
}

/** Web Locks prove that a tab is closed; without them an owner is never presumed dead. */
export function createRoomJournalOwnerLiveness(options: { locks?: LockManagerLike | null }): RoomJournalOwnerLiveness {
  const locks = options.locks ?? null;
  return {
    hold: (tabId) => {
      if (!locks) {
        return;
      }
      void locks
        .request(`${TAB_LOCK_PREFIX}${tabId}`, { mode: 'exclusive' }, () => new Promise<never>(() => undefined))
        .catch(() => undefined);
    },
    whenOwnerGone: async (record, claim) => {
      if (!locks) {
        // A suspended/background tab is not proof of a dead owner. Keep its data.
        return null;
      }
      let result: Awaited<ReturnType<typeof claim>> | null = null;
      await locks.request(
        `${TAB_LOCK_PREFIX}${record.tabId}`,
        { ifAvailable: true, mode: 'exclusive' },
        async (lock) => {
          if (lock) {
            result = await claim();
          }
        },
      );
      return result;
    },
  };
}

/**
 * Writes every room journal of this page now (before leaving for sign-in or reloading). Resolves
 * true only when every journal finished within `timeoutMs` with all of its rooms on disk.
 */
export async function flushRoomJournals(timeoutMs = 3_000): Promise<boolean> {
  const stores = [...pageStores.values()];
  const flushed = Promise.allSettled(stores.map((store) => store.flush())).then(() => true);
  const finished = await Promise.race([
    flushed,
    new Promise<false>((resolve) => setTimeout(() => resolve(false), timeoutMs)),
  ]);
  return finished && stores.every((store) => store.isSettled());
}

/* ------------------------------------------------------------------------ */
/* Page-wide state shared by every room journal of this tab                  */
/* ------------------------------------------------------------------------ */

let pageTabId: string | undefined;
let pageLiveness: RoomJournalOwnerLiveness | undefined;
let storageFailed = false;
const storageListeners = new Set<() => void>();
const pageStores = new Map<
  RoomJournalDatabase,
  Pick<RoomJournalStore<unknown, unknown, never>, 'clearMember' | 'flush' | 'isSettled'>
>();

/**
 * Deletes every durable journal record of `memberId` (signing out); resolves within `timeoutMs`.
 * Other tabs drop their in-memory copies when they observe the sign-out (see active-member).
 */
export async function clearRoomJournalsForSignOut(memberId: string, timeoutMs = 1_000): Promise<void> {
  const cleared = Promise.allSettled(
    Object.values(ROOM_JOURNAL_DATABASES).map((databaseName) => {
      const store = pageStores.get(databaseName);
      if (store) {
        return store.clearMember(memberId);
      }
      return typeof indexedDB === 'undefined' || !indexedDB
        ? Promise.resolve()
        : createIndexedDbRoomJournalBackend(indexedDB, databaseName).deleteMember(memberId);
    }),
  );
  await Promise.race([cleared, new Promise((resolve) => setTimeout(resolve, timeoutMs))]);
}

export function hasRoomJournalStorageFailure(): boolean {
  return storageFailed;
}

export function subscribeRoomJournalStorage(listener: () => void): () => void {
  storageListeners.add(listener);
  return () => {
    storageListeners.delete(listener);
  };
}

function setStorageFailure(failed: boolean) {
  if (storageFailed === failed) {
    return;
  }
  storageFailed = failed;
  for (const listener of storageListeners) {
    listener();
  }
}

function createTabId(): string {
  return typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

/**
 * Creates this page's durable journal for one room kind, flushed on page hide. Returns null where
 * IndexedDB is unavailable (SSR, private modes, tests).
 */
export function createBrowserRoomJournalStore<Scope, Change, Recovery extends { capturedAt: number }>(
  databaseName: RoomJournalDatabase,
  scopeKey: (scope: Scope) => string,
  titleOf?: (scope: Scope) => string | undefined,
): RoomJournalStore<Scope, Change, Recovery> | null {
  if (typeof window === 'undefined' || typeof indexedDB === 'undefined' || !indexedDB) {
    return null;
  }
  pageTabId ??= createTabId();
  pageLiveness ??= createRoomJournalOwnerLiveness({
    locks: (navigator as Navigator & { locks?: LockManagerLike }).locks ?? null,
  });
  const store = createRoomJournalStore<Scope, Change, Recovery>({
    backend: createIndexedDbRoomJournalBackend(indexedDB, databaseName),
    liveness: pageLiveness,
    tabId: pageTabId,
    scopeKey,
    titleOf,
    memberId: getActiveMember,
    onError: () => setStorageFailure(true),
    onWrite: () => setStorageFailure(false),
  });
  pageStores.set(databaseName, store);
  // A member signed out here or in another tab: drop and never write their records again.
  subscribeSignedOutMembers((memberId) => void store.clearMember(memberId));
  const flushNow = () => {
    void store.flush();
  };
  window.addEventListener('pagehide', flushNow);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      flushNow();
    }
  });
  void store.prune();
  return store;
}
