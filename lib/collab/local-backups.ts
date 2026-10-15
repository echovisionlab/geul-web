import { parseDocumentName, CollaborativeDocumentType } from '@echovisionlab/geul-common/collaboration/document';
import {
  createIndexedDbRoomJournalBackend,
  createRoomJournalOwnerLiveness,
  ROOM_JOURNAL_DATABASES,
  ROOM_JOURNAL_LIMITS,
  ROOM_JOURNAL_RECORD_VERSION,
  type RoomJournalCatalogBackend,
  type RoomJournalDatabase,
  type RoomJournalOwnerLiveness,
  type RoomJournalRecord,
} from './room-journal-store';

export const localBackupDocumentKinds = {
  [CollaborativeDocumentType.POST]: 'post',
  [CollaborativeDocumentType.PAGE]: 'page',
  [CollaborativeDocumentType.WORK]: 'work',
  [CollaborativeDocumentType.CAMPAIGN]: 'campaign',
  [CollaborativeDocumentType.EMAIL_TEMPLATE]: 'email-template',
  [CollaborativeDocumentType.EMAIL_LAYOUT]: 'email-layout',
  [CollaborativeDocumentType.TERMS_HISTORY]: 'terms-history',
  [CollaborativeDocumentType.PRIVACY_HISTORY]: 'privacy-history',
  [CollaborativeDocumentType.ARTIST]: 'artist',
  [CollaborativeDocumentType.RELEASE]: 'release',
  [CollaborativeDocumentType.LABEL]: 'label',
  [CollaborativeDocumentType.FORM]: 'form',
  [CollaborativeDocumentType.MAP_THEME]: 'map-theme',
  [CollaborativeDocumentType.PROGRAM_EVENT]: 'program-event',
  [CollaborativeDocumentType.MENU]: 'menu',
  [CollaborativeDocumentType.POST_SERIES]: 'post-series',
} as const;
export type LocalBackupDocumentKind = (typeof localBackupDocumentKinds)[keyof typeof localBackupDocumentKinds];
export interface LocalBackup {
  database: RoomJournalDatabase;
  id: string;
  tabId: string;
  documentKind: LocalBackupDocumentKind;
  entityId: string;
  locale: string;
  /** Title the editor showed when the backup was written, when known. */
  title?: string;
  updatedAt: number;
}
type Record = RoomJournalRecord<unknown, unknown, unknown>;

function backupFromRecord(database: RoomJournalDatabase, record: Record, now: number): LocalBackup | null {
  if (
    record.recordVersion !== ROOM_JOURNAL_RECORD_VERSION ||
    typeof record.id !== 'string' ||
    !record.id ||
    typeof record.tabId !== 'string' ||
    !record.tabId ||
    !Number.isFinite(record.updatedAt) ||
    now - record.updatedAt > ROOM_JOURNAL_LIMITS.maxAgeMs ||
    !Array.isArray(record.changes) ||
    (record.changes.length === 0 && record.recovery === null) ||
    !record.scope ||
    typeof record.scope !== 'object'
  ) {
    return null;
  }
  try {
    const scope = record.scope;
    const name =
      database === ROOM_JOURNAL_DATABASES.documentRoom && 'documentName' in scope
        ? scope.documentName
        : 'documentType' in scope && 'entityId' in scope && 'locale' in scope
          ? `${scope.documentType}:${scope.entityId}:${scope.locale}`
          : null;
    if (typeof name !== 'string') {
      return null;
    }
    const parsed = parseDocumentName(name);
    const documentKind = localBackupDocumentKinds[parsed.type as keyof typeof localBackupDocumentKinds];
    if (!documentKind) {
      return null;
    }
    return {
      database,
      id: record.id,
      tabId: record.tabId,
      documentKind,
      entityId: parsed.entityId,
      locale: parsed.locale,
      ...(typeof record.title === 'string' && record.title.trim() ? { title: record.title.trim() } : {}),
      updatedAt: record.updatedAt,
    };
  } catch {
    return null;
  }
}

/** Listing does not claim, replay or update a journal. The editor's claimOrphans owns recovery. */
export function createLocalBackupRepository(options: {
  backends: ReadonlyMap<RoomJournalDatabase, RoomJournalCatalogBackend>;
  liveness: RoomJournalOwnerLiveness;
  memberId: () => string | null;
  now?: () => number;
}) {
  return {
    async list(): Promise<LocalBackup[]> {
      const memberId = options.memberId();
      if (!memberId) {
        return [];
      }
      const backups: LocalBackup[] = [];
      for (const [database, backend] of options.backends) {
        for (const record of await backend.listByMember(memberId)) {
          if (record.memberId !== memberId) {
            continue;
          }
          const backup = backupFromRecord(database, record, (options.now ?? Date.now)());
          if (!backup) {
            continue;
          }
          const current = await options.liveness.whenOwnerGone(record, async () => {
            const latest = await backend.read(record.id);
            return latest?.memberId === memberId && latest.tabId === record.tabId
              ? backupFromRecord(database, latest, (options.now ?? Date.now)())
              : null;
          });
          if (current) {
            backups.push(current);
          }
        }
      }
      return options.memberId() === memberId ? backups.sort((a, b) => b.updatedAt - a.updatedAt) : [];
    },
    async discard(backup: LocalBackup): Promise<boolean> {
      const memberId = options.memberId();
      const backend = options.backends.get(backup.database);
      if (!memberId || !backend) {
        return false;
      }
      // Recheck under the same owner lock used by adoption: a stale row must never delete a
      // journal that another editor already claimed, or a different member's record.
      return (
        (await options.liveness.whenOwnerGone(backup, async () => {
          const record = await backend.read(backup.id);
          if (
            !record ||
            record.memberId !== memberId ||
            record.tabId !== backup.tabId ||
            options.memberId() !== memberId
          ) {
            return false;
          }
          await backend.delete(record.id);
          return true;
        })) ?? false
      );
    },
  };
}
export type LocalBackupRepository = ReturnType<typeof createLocalBackupRepository>;

export function createBrowserLocalBackupRepository(memberId: () => string | null): LocalBackupRepository | null {
  if (typeof indexedDB === 'undefined' || !indexedDB) {
    return null;
  }
  return createLocalBackupRepository({
    backends: new Map(
      Object.values(ROOM_JOURNAL_DATABASES).map((database) => [
        database,
        createIndexedDbRoomJournalBackend(indexedDB, database),
      ]),
    ),
    liveness: createRoomJournalOwnerLiveness({ locks: navigator.locks }),
    memberId,
  });
}
