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

function scopeKey(scope: BlockRoomIntentScope): string {
  return [scope.documentType, scope.entityId, scope.locale, scope.sourceLocale].join('\u0000');
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
  const previous = journal.at(-1);
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
  return true;
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
    intentJournals.delete(key);
    return;
  }
  intentJournals.set(key, changes.map(cloneChange));
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
  return { acknowledged, pending: pending.length };
}

export function clearBlockRoomIntentChanges(scope: BlockRoomIntentScope): void {
  intentJournals.delete(scopeKey(scope));
}
