import type { DocumentRoomIntentChange, DocumentRoomIntentSnapshot } from './document-room-intent';

interface JournalEntry {
  change: DocumentRoomIntentChange;
  key: string;
  sourceDocumentId: number;
}

type RoomJournal = Map<string, JournalEntry[]>;

const journals = new Map<string, RoomJournal>();
const documentIds = new WeakMap<object, number>();
let nextDocumentId = 0;

export interface DocumentRoomIntentBatch {
  changes: DocumentRoomIntentChange[];
  requiresReplay: boolean;
}

/** A non-content identity lets a fresh Y.Doc distinguish replay from current local writes. */
export function getDocumentRoomIntentDocumentId(document: object): number {
  let id = documentIds.get(document);
  if (id === undefined) {
    id = ++nextDocumentId;
    documentIds.set(document, id);
  }
  return id;
}

function authorityKey(snapshot: DocumentRoomIntentSnapshot): string {
  return JSON.stringify([
    snapshot.documentType,
    snapshot.documentName,
    snapshot.sourceLocale,
    snapshot.locale,
    snapshot.role,
  ]);
}

function changeKey(change: DocumentRoomIntentChange): string {
  return JSON.stringify(change);
}

function cloneChange(change: DocumentRoomIntentChange): DocumentRoomIntentChange {
  return JSON.parse(JSON.stringify(change)) as DocumentRoomIntentChange;
}

function hasSameAuthority(left: DocumentRoomIntentSnapshot, right: DocumentRoomIntentSnapshot): boolean {
  return authorityKey(left) === authorityKey(right);
}

function getRoomJournal(documentName: string, create: boolean): RoomJournal | undefined {
  const current = journals.get(documentName);
  if (current || !create) {
    return current;
  }
  const next: RoomJournal = new Map();
  journals.set(documentName, next);
  return next;
}

/** Record one validated local semantic change under its source/locale authority. */
export function recordDocumentRoomIntent(
  documentName: string,
  change: DocumentRoomIntentChange,
  sourceDocument: object,
): boolean {
  const { before, after } = change;
  if (
    before.documentName !== documentName ||
    after.documentName !== documentName ||
    !hasSameAuthority(before, after) ||
    changeKey(change) === changeKey({ before, after: before })
  ) {
    return false;
  }

  const journal = getRoomJournal(documentName, true)!;
  const key = authorityKey(before);
  const entries = journal.get(key) ?? [];
  entries.push({
    change: cloneChange(change),
    key: changeKey(change),
    sourceDocumentId: getDocumentRoomIntentDocumentId(sourceDocument),
  });
  journal.set(key, entries);
  return true;
}

/** Return only changes that belong to this exact canonical source/locale scope. */
export function getDocumentRoomIntents(
  documentName: string,
  current: DocumentRoomIntentSnapshot | null | undefined,
): DocumentRoomIntentChange[] {
  if (!current || current.documentName !== documentName) {
    return [];
  }
  const entries = getRoomJournal(documentName, false)?.get(authorityKey(current)) ?? [];
  return entries.map(({ change }) => cloneChange(change));
}

/** Identify whether the saved intent predates this canonical Y.Doc instance. */
export function getDocumentRoomIntentBatch(
  documentName: string,
  current: DocumentRoomIntentSnapshot | null | undefined,
  currentDocument: object,
): DocumentRoomIntentBatch {
  if (!current || current.documentName !== documentName) {
    return { changes: [], requiresReplay: false };
  }
  const entries = getRoomJournal(documentName, false)?.get(authorityKey(current)) ?? [];
  const currentDocumentId = getDocumentRoomIntentDocumentId(currentDocument);
  return {
    changes: entries.map(({ change }) => cloneChange(change)),
    requiresReplay: entries.some(({ sourceDocumentId }) => sourceDocumentId !== currentDocumentId),
  };
}

/** A differing authority stays journaled internally, but is not pending for this room. */
export function hasDocumentRoomIntents(
  documentName: string,
  current: DocumentRoomIntentSnapshot | null | undefined,
): boolean {
  if (!current || current.documentName !== documentName) {
    return (getRoomJournal(documentName, false)?.size ?? 0) > 0;
  }
  return (getRoomJournal(documentName, false)?.get(authorityKey(current))?.length ?? 0) > 0;
}

/** Remove only the exact captured prefix; changes recorded during its ACK remain queued. */
export function acknowledgeDocumentRoomIntents(
  documentName: string,
  capturedPrefix: readonly DocumentRoomIntentChange[],
): boolean {
  if (capturedPrefix.length === 0 || capturedPrefix.some((change) => change.before.documentName !== documentName)) {
    return false;
  }
  const first = capturedPrefix[0]!;
  if (capturedPrefix.some((change) => !hasSameAuthority(first.before, change.before))) {
    return false;
  }

  const journal = getRoomJournal(documentName, false);
  const key = authorityKey(first.before);
  const entries = journal?.get(key);
  if (!journal || !entries || entries.length < capturedPrefix.length) {
    return false;
  }
  for (let index = 0; index < capturedPrefix.length; index += 1) {
    if (entries[index]?.key !== changeKey(capturedPrefix[index]!)) {
      return false;
    }
  }

  entries.splice(0, capturedPrefix.length);
  if (entries.length === 0) {
    journal.delete(key);
  }
  if (journal.size === 0) {
    journals.delete(documentName);
  }
  return true;
}
