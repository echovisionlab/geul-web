import type { DocumentRoomIntentChange } from './document-room-intent';
import { subscribeDocumentRoomIntentJournal } from './document-room-intent-journal';
import { getRoomJournalTitle } from './room-journal-titles';
import { createBrowserRoomJournalStore, ROOM_JOURNAL_DATABASES, type RoomJournalStore } from './room-journal-store';

/** One durable journal per document room, keyed by its document name. */
export interface DocumentRoomJournalScope {
  documentName: string;
}

/** Durable mirror of the document-room intent journal (see room-journal-store). */
export type DocumentRoomJournalStore = RoomJournalStore<DocumentRoomJournalScope, DocumentRoomIntentChange, never>;

let browserStore: DocumentRoomJournalStore | null | undefined;

/**
 * Returns the page-wide durable document-room journal, mirroring every journal mutation.
 * Resolves null where IndexedDB is unavailable (SSR, private modes, tests).
 */
export function getDocumentRoomJournalStore(): DocumentRoomJournalStore | null {
  if (browserStore !== undefined) {
    return browserStore;
  }
  browserStore = createBrowserRoomJournalStore<DocumentRoomJournalScope, DocumentRoomIntentChange, never>(
    ROOM_JOURNAL_DATABASES.documentRoom,
    ({ documentName }) => documentName,
    ({ documentName }) => {
      // `{type}:{entityId}:{locale}`: the same key the editor header registers its title under.
      const [type, entityId] = documentName.split(':');
      return type && entityId ? getRoomJournalTitle(type, entityId) : undefined;
    },
  );
  if (browserStore) {
    const store = browserStore;
    subscribeDocumentRoomIntentJournal((documentName, changes) => store.writeChanges({ documentName }, changes));
  }
  return browserStore;
}
