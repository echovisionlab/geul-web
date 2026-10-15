import {
  blockRoomIntentScopeKey,
  subscribeBlockRoomIntentJournal,
  type BlockRoomIntentChange,
  type BlockRoomIntentScope,
} from './block-room-intent-journal';
import type { BlockRoomRecoverySnapshot } from './block-room-recovery';
import { getRoomJournalTitle } from './room-journal-titles';
import {
  createBrowserRoomJournalStore,
  ROOM_JOURNAL_DATABASES,
  hasRoomJournalStorageFailure,
  subscribeRoomJournalStorage,
  type RoomJournalStore,
} from './room-journal-store';

/** Durable mirror of the block-room intent journal and recovery snapshot (see room-journal-store). */
export const BLOCK_ROOM_JOURNAL_DATABASE = ROOM_JOURNAL_DATABASES.blockRoom;

export type BlockRoomJournalStore = RoomJournalStore<
  BlockRoomIntentScope,
  BlockRoomIntentChange,
  BlockRoomRecoverySnapshot
>;

let browserStore: BlockRoomJournalStore | null | undefined;

export const hasBlockRoomJournalStorageFailure = hasRoomJournalStorageFailure;
export const subscribeBlockRoomJournalStorage = subscribeRoomJournalStorage;

/**
 * Returns the page-wide durable block-room journal, mirroring every journal mutation.
 * Resolves null where IndexedDB is unavailable (SSR, private modes, tests).
 */
export function getBlockRoomJournalStore(): BlockRoomJournalStore | null {
  if (browserStore !== undefined) {
    return browserStore;
  }
  browserStore = createBrowserRoomJournalStore<BlockRoomIntentScope, BlockRoomIntentChange, BlockRoomRecoverySnapshot>(
    BLOCK_ROOM_JOURNAL_DATABASE,
    blockRoomIntentScopeKey,
    (scope) => getRoomJournalTitle(scope.documentType, scope.entityId),
  );
  if (browserStore) {
    const store = browserStore;
    subscribeBlockRoomIntentJournal((scope, changes) => store.writeChanges(scope, changes));
  }
  return browserStore;
}
