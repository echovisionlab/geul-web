import * as Y from 'yjs';
import {
  canonicalBlockRoomDocumentBytes,
  type CanonicalBlockRoomSnapshot,
  type BlockRoomDocumentType,
} from '@echovisionlab/geul-common/collaboration/block-room-codec';

export interface BlockRoomIntentScope {
  documentType: BlockRoomDocumentType;
  entityId: string;
  locale: string;
  sourceLocale: string;
}

export interface BlockRoomDeleteRange {
  clock: number;
  len: number;
}

export type BlockRoomDeleteSet = Record<string, BlockRoomDeleteRange[]>;

export interface BlockRoomIntentChange {
  before: CanonicalBlockRoomSnapshot;
  after: CanonicalBlockRoomSnapshot;
  stateVector: Uint8Array;
  deleted: BlockRoomDeleteSet;
}

export interface BlockRoomIntentAcknowledgement {
  stateVector: Uint8Array;
  deleted: BlockRoomDeleteSet;
}

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

function mergeDeleteRanges(ranges: readonly BlockRoomDeleteRange[]): BlockRoomDeleteRange[] {
  const ordered = ranges.map(({ clock, len }) => ({ clock, len })).sort((left, right) => left.clock - right.clock);
  const merged: BlockRoomDeleteRange[] = [];
  for (const range of ordered) {
    const previous = merged.at(-1);
    if (
      previous &&
      Number.isSafeInteger(previous.clock) &&
      previous.clock >= 0 &&
      Number.isSafeInteger(previous.len) &&
      previous.len > 0 &&
      Number.isSafeInteger(range.clock) &&
      range.clock >= 0 &&
      Number.isSafeInteger(range.len) &&
      range.len > 0 &&
      range.clock <= previous.clock + previous.len
    ) {
      previous.len = Math.max(previous.clock + previous.len, range.clock + range.len) - previous.clock;
    } else {
      merged.push(range);
    }
  }
  return merged;
}

function mergeDeleteSets(left: BlockRoomDeleteSet, right: BlockRoomDeleteSet): BlockRoomDeleteSet {
  const clients = new Set([...Object.keys(left), ...Object.keys(right)]);
  return Object.fromEntries(
    [...clients].map((client) => [client, mergeDeleteRanges([...(left[client] ?? []), ...(right[client] ?? [])])]),
  );
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

function stateVectorCovers(actualBytes: Uint8Array, expectedBytes: Uint8Array): boolean {
  const actual = Y.decodeStateVector(actualBytes);
  const expected = Y.decodeStateVector(expectedBytes);
  for (const [client, clock] of expected) {
    if ((actual.get(client) ?? 0) < clock) {
      return false;
    }
  }
  return true;
}

function deleteRangesCover(actual: readonly BlockRoomDeleteRange[], expected: BlockRoomDeleteRange): boolean {
  const expectedEnd = expected.clock + expected.len;
  const ranges = [...actual]
    .filter(({ clock, len }) => Number.isSafeInteger(clock) && clock >= 0 && Number.isSafeInteger(len) && len > 0)
    .sort((left, right) => left.clock - right.clock);
  let coveredUntil = expected.clock;
  for (const range of ranges) {
    const rangeEnd = range.clock + range.len;
    if (rangeEnd <= coveredUntil) {
      continue;
    }
    if (range.clock > coveredUntil) {
      return false;
    }
    coveredUntil = rangeEnd;
    if (coveredUntil >= expectedEnd) {
      return true;
    }
  }
  return coveredUntil >= expectedEnd;
}

function acknowledgementCoversChange(
  acknowledgement: BlockRoomIntentAcknowledgement,
  change: BlockRoomIntentChange,
): boolean {
  if (!stateVectorCovers(acknowledgement.stateVector, change.stateVector)) {
    return false;
  }
  return Object.entries(change.deleted).every(([client, expectedRanges]) => {
    const actualRanges = acknowledgement.deleted[client] ?? [];
    return expectedRanges.every((range) => deleteRangesCover(actualRanges, range));
  });
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
