import {
  canonicalBlockRoomDocumentBytes,
  type CanonicalBlockRoomSnapshot,
  type BlockRoomDocumentType,
} from '@echovisionlab/geul-common/collaboration/block-room-codec';
import {
  blockRoomDurabilityStateCovers,
  mergeBlockRoomDurabilityDeleteSets,
  type BlockRoomDurabilityState,
  type BlockRoomDurabilityDeleteRange,
  type BlockRoomDurabilityDeleteSet,
} from './block-room-durability';

export interface BlockRoomIntentScope {
  documentType: BlockRoomDocumentType;
  entityId: string;
  locale: string;
  sourceLocale: string;
}

export type BlockRoomDeleteRange = BlockRoomDurabilityDeleteRange;

export type BlockRoomDeleteSet = BlockRoomDurabilityDeleteSet;

export interface BlockRoomIntentChange {
  before: CanonicalBlockRoomSnapshot;
  after: CanonicalBlockRoomSnapshot;
  stateVector: Uint8Array;
  deleted: BlockRoomDeleteSet;
}

export interface BlockRoomIntentAcknowledgement extends BlockRoomDurabilityState {}

const intentJournals = new Map<string, BlockRoomIntentChange[]>();
/**
 * Leading entries of each journal that later intents must not merge into. An entry is sealed once
 * the server may hold it, so an intent it received stays separate from one it did not: a rebuild
 * then keeps the held entry as is and rebases only the rest. Sealing only stops merging, so
 * sealing more than necessary is always safe.
 */
const sealedEntries = new Map<string, number>();

function sealAll(key: string): void {
  const length = intentJournals.get(key)?.length ?? 0;
  if (length) {
    sealedEntries.set(key, length);
  } else {
    sealedEntries.delete(key);
  }
}

/** Marks every current intent as possibly received by the server (its sync was acknowledged). */
export function sealBlockRoomIntents(scope: BlockRoomIntentScope): void {
  sealAll(scopeKey(scope));
}

export type BlockRoomIntentJournalListener = (scope: BlockRoomIntentScope, changes: BlockRoomIntentChange[]) => void;

const journalListeners = new Set<BlockRoomIntentJournalListener>();

function scopeKey(scope: BlockRoomIntentScope): string {
  return blockRoomIntentScopeKey(scope);
}

/** Stable identity of one journal; the source locale is part of it so role transitions never mix intents. */
export function blockRoomIntentScopeKey(scope: BlockRoomIntentScope): string {
  return [scope.documentType, scope.entityId, scope.locale, scope.sourceLocale].join('\u0000');
}

function emitJournalChange(scope: BlockRoomIntentScope): void {
  if (journalListeners.size === 0) {
    return;
  }
  const changes = getBlockRoomIntentChanges(scope);
  const normalizedScope: BlockRoomIntentScope = {
    documentType: scope.documentType,
    entityId: scope.entityId,
    locale: scope.locale,
    sourceLocale: scope.sourceLocale,
  };
  for (const listener of journalListeners) {
    listener(normalizedScope, changes);
  }
}

/** Observes every journal mutation, e.g. to mirror it into durable browser storage. */
export function subscribeBlockRoomIntentJournal(listener: BlockRoomIntentJournalListener): () => void {
  journalListeners.add(listener);
  return () => {
    journalListeners.delete(listener);
  };
}

export function hasBlockRoomIntentChanges(scope: BlockRoomIntentScope): boolean {
  return (intentJournals.get(scopeKey(scope))?.length ?? 0) > 0;
}

function cloneSnapshot(snapshot: CanonicalBlockRoomSnapshot): CanonicalBlockRoomSnapshot {
  return structuredClone(snapshot);
}

function cloneDeleteSet(deleted: BlockRoomDeleteSet): BlockRoomDeleteSet {
  return Object.fromEntries(
    Object.entries(deleted).map(([client, ranges]) => [client, ranges.map(({ clock, len }) => ({ clock, len }))]),
  );
}

function mergeDeleteSets(left: BlockRoomDeleteSet, right: BlockRoomDeleteSet): BlockRoomDeleteSet {
  return mergeBlockRoomDurabilityDeleteSets(left, right);
}

function cloneChange(change: BlockRoomIntentChange): BlockRoomIntentChange {
  return {
    before: cloneSnapshot(change.before),
    after: cloneSnapshot(change.after),
    stateVector: Uint8Array.from(change.stateVector),
    deleted: cloneDeleteSet(change.deleted),
  };
}

function sameBytes(left: Uint8Array, right: Uint8Array): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function snapshotChanged(
  documentType: BlockRoomDocumentType,
  before: CanonicalBlockRoomSnapshot,
  after: CanonicalBlockRoomSnapshot,
): boolean {
  return !sameCanonicalBody(documentType, before, after);
}

function sameCanonicalBody(
  documentType: BlockRoomDocumentType,
  left: CanonicalBlockRoomSnapshot,
  right: CanonicalBlockRoomSnapshot,
): boolean {
  return sameBytes(
    canonicalBlockRoomDocumentBytes(documentType, left.document),
    canonicalBlockRoomDocumentBytes(documentType, right.document),
  );
}

export function blockRoomIntentChangesCanonicalBody(
  scope: Pick<BlockRoomIntentScope, 'documentType'>,
  change: Pick<BlockRoomIntentChange, 'before' | 'after'>,
): boolean {
  return snapshotChanged(scope.documentType, change.before, change.after);
}

function acknowledgementCoversChange(
  acknowledgement: BlockRoomIntentAcknowledgement,
  change: BlockRoomIntentChange,
): boolean {
  return blockRoomDurabilityStateCovers(acknowledgement, change);
}

/** Appends one local canonical body intent; no-op projections are deliberately ignored. */
export function recordBlockRoomIntent(scope: BlockRoomIntentScope, change: BlockRoomIntentChange): boolean {
  if (!blockRoomIntentChangesCanonicalBody(scope, change)) {
    return false;
  }
  const key = scopeKey(scope);
  const journal = intentJournals.get(key) ?? [];
  const previous = journal.length > (sealedEntries.get(key) ?? 0) ? journal.at(-1) : undefined;
  if (previous && sameCanonicalBody(scope.documentType, previous.after, change.before)) {
    journal[journal.length - 1] = cloneChange({
      before: previous.before,
      after: change.after,
      stateVector: change.stateVector,
      deleted: mergeDeleteSets(previous.deleted, change.deleted),
    });
  } else {
    journal.push(cloneChange(change));
  }
  intentJournals.set(key, journal);
  emitJournalChange(scope);
  return true;
}

/**
 * Adds intents recovered from another tab or an earlier session after this
 * tab's own intents. They are replayed semantically, so stale Yjs stamps are
 * replaced by the next replay of the scope.
 */
export function appendBlockRoomIntentChanges(
  scope: BlockRoomIntentScope,
  changes: readonly BlockRoomIntentChange[],
): void {
  const recorded = changes.filter((change) => blockRoomIntentChangesCanonicalBody(scope, change));
  if (!recorded.length) {
    return;
  }
  const key = scopeKey(scope);
  intentJournals.set(key, [...(intentJournals.get(key) ?? []), ...recorded.map(cloneChange)]);
  sealAll(key);
  emitJournalChange(scope);
}

export function getBlockRoomIntentChanges(scope: BlockRoomIntentScope): BlockRoomIntentChange[] {
  return (intentJournals.get(scopeKey(scope)) ?? []).map(cloneChange);
}

/** Replaces old-epoch stamps after semantic replay generates fresh Yjs client clocks. */
export function replaceBlockRoomIntentChanges(
  scope: BlockRoomIntentScope,
  changes: readonly BlockRoomIntentChange[],
): void {
  const key = scopeKey(scope);
  if (!changes.length) {
    sealedEntries.delete(key);
    const existed = intentJournals.delete(key);
    if (existed) {
      emitJournalChange(scope);
    }
    return;
  }
  intentJournals.set(key, changes.map(cloneChange));
  sealAll(key);
  emitJournalChange(scope);
}

/**
 * Removes intents only when the server's persisted snapshot contains both
 * their inserted clocks and their deleted ranges. Yjs deletions alone do not
 * advance a client state vector.
 */
export function acknowledgeBlockRoomIntents(
  scope: BlockRoomIntentScope,
  acknowledgement: BlockRoomIntentAcknowledgement,
): { acknowledged: number; pending: number } {
  const key = scopeKey(scope);
  const journal = intentJournals.get(key) ?? [];
  const pending = journal.filter((change) => !acknowledgementCoversChange(acknowledgement, change));
  const acknowledged = journal.length - pending.length;
  if (pending.length) {
    intentJournals.set(key, pending);
  } else {
    intentJournals.delete(key);
  }
  if (acknowledged > 0) {
    sealAll(key);
  }
  if (acknowledged > 0) {
    emitJournalChange(scope);
  }
  return { acknowledged, pending: pending.length };
}

export function clearBlockRoomIntentChanges(scope: BlockRoomIntentScope): void {
  sealedEntries.delete(scopeKey(scope));
  if (intentJournals.delete(scopeKey(scope))) {
    emitJournalChange(scope);
  }
}
