import * as Y from 'yjs';
import type { Transaction } from 'yjs';
import type { BlockRoomProtocolTransport } from './block-room-protocol';

export interface BlockRoomDurabilityDeleteRange {
  clock: number;
  len: number;
}

export type BlockRoomDurabilityDeleteSet = Record<string, BlockRoomDurabilityDeleteRange[]>;

export interface BlockRoomDurabilityState {
  stateVector: Uint8Array;
  deleted: BlockRoomDurabilityDeleteSet;
}

export interface BlockRoomDurabilityProtocol {
  subscribePersisted: (listener: (state: BlockRoomDurabilityState) => void) => () => void;
}

export const BLOCK_ROOM_DURABILITY_ACK_TIMEOUT_MS = 8_000;

/** Fails closed if a room transport does not expose canonical persisted ACKs. */
export function requireBlockRoomDurabilityProtocol(
  protocol: Pick<BlockRoomProtocolTransport, 'subscribePersisted'>,
): BlockRoomDurabilityProtocol {
  const { subscribePersisted } = protocol;
  if (!subscribePersisted) {
    throw new Error('Block room durability requires persisted acknowledgements.');
  }
  return { subscribePersisted: subscribePersisted.bind(protocol) };
}

interface TransactionDeleteSet {
  clients: Map<number, Array<{ clock: number; len: number }>>;
}

function validRange({ clock, len }: BlockRoomDurabilityDeleteRange): boolean {
  return Number.isSafeInteger(clock) && clock >= 0 && Number.isSafeInteger(len) && len > 0;
}

function mergeRanges(ranges: readonly BlockRoomDurabilityDeleteRange[]): BlockRoomDurabilityDeleteRange[] {
  const ordered = ranges
    .filter(validRange)
    .map(({ clock, len }) => ({ clock, len }))
    .sort((a, b) => a.clock - b.clock);
  const merged: BlockRoomDurabilityDeleteRange[] = [];
  for (const range of ordered) {
    const previous = merged.at(-1);
    if (previous && range.clock <= previous.clock + previous.len) {
      previous.len = Math.max(previous.clock + previous.len, range.clock + range.len) - previous.clock;
    } else {
      merged.push(range);
    }
  }
  return merged;
}

export function mergeBlockRoomDurabilityDeleteSets(
  left: BlockRoomDurabilityDeleteSet,
  right: BlockRoomDurabilityDeleteSet,
): BlockRoomDurabilityDeleteSet {
  const clients = new Set([...Object.keys(left), ...Object.keys(right)]);
  return Object.fromEntries(
    [...clients].map((client) => [client, mergeRanges([...(left[client] ?? []), ...(right[client] ?? [])])]),
  );
}

/** Captures the local transaction's state-vector and delete-set footprint. */
export function captureBlockRoomDurabilityState(document: Y.Doc, transaction: Transaction): BlockRoomDurabilityState {
  const deleteSet = transaction.deleteSet as TransactionDeleteSet;
  return {
    stateVector: Y.encodeStateVector(document),
    deleted: Object.fromEntries(
      [...deleteSet.clients.entries()].map(([client, ranges]) => [
        String(client),
        ranges.map(({ clock, len }) => ({ clock, len })),
      ]),
    ),
  };
}

/** Keeps only the latest vector while retaining all unacknowledged delete ranges. */
export function mergeBlockRoomDurabilityStates(
  previous: BlockRoomDurabilityState | null,
  next: BlockRoomDurabilityState,
): BlockRoomDurabilityState {
  return {
    stateVector: Uint8Array.from(next.stateVector),
    deleted: previous
      ? mergeBlockRoomDurabilityDeleteSets(previous.deleted, next.deleted)
      : mergeBlockRoomDurabilityDeleteSets({}, next.deleted),
  };
}

function stateVectorCovers(actualBytes: Uint8Array, expectedBytes: Uint8Array): boolean {
  try {
    const actual = Y.decodeStateVector(actualBytes);
    const expected = Y.decodeStateVector(expectedBytes);
    for (const [client, clock] of expected) {
      if ((actual.get(client) ?? 0) < clock) {
        return false;
      }
    }
    return true;
  } catch {
    return false;
  }
}

function deleteRangesCover(
  actual: readonly BlockRoomDurabilityDeleteRange[],
  expected: BlockRoomDurabilityDeleteRange,
): boolean {
  if (!validRange(expected)) {
    return false;
  }
  const expectedEnd = expected.clock + expected.len;
  const ranges = actual.filter(validRange).sort((left, right) => left.clock - right.clock);
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

/** Requires both inserted-clock coverage and exact coverage of every local deletion. */
export function blockRoomDurabilityStateCovers(
  actual: BlockRoomDurabilityState,
  expected: BlockRoomDurabilityState,
): boolean {
  if (!stateVectorCovers(actual.stateVector, expected.stateVector)) {
    return false;
  }
  return Object.entries(expected.deleted).every(([client, ranges]) => {
    const actualRanges = actual.deleted[client] ?? [];
    return ranges.every((range) => deleteRangesCover(actualRanges, range));
  });
}

/** Waits for a matching server durability ACK; cancellation prevents a busy retry loop. */
export function waitForBlockRoomDurabilityAcknowledgement(
  protocol: BlockRoomDurabilityProtocol,
  expected: BlockRoomDurabilityState,
  options: { signal?: AbortSignal; timeoutMs?: number } = {},
): Promise<BlockRoomDurabilityState | null> {
  const timeoutMs = options.timeoutMs ?? BLOCK_ROOM_DURABILITY_ACK_TIMEOUT_MS;
  return new Promise((resolve) => {
    let settled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let unsubscribe: () => void = () => undefined;
    function cleanup() {
      unsubscribe();
      options.signal?.removeEventListener('abort', abort);
      if (timer !== null) {
        clearTimeout(timer);
        timer = null;
      }
    }
    function finish(acknowledgement: BlockRoomDurabilityState | null) {
      if (settled) {
        return;
      }
      settled = true;
      cleanup();
      resolve(acknowledgement);
    }
    function abort() {
      finish(null);
    }

    if (options.signal?.aborted) {
      resolve(null);
      return;
    }
    options.signal?.addEventListener('abort', abort, { once: true });
    unsubscribe = protocol.subscribePersisted((acknowledgement) => {
      if (blockRoomDurabilityStateCovers(acknowledgement, expected)) {
        finish(acknowledgement);
      }
    });
    if (settled) {
      unsubscribe();
      return;
    }
    timer = setTimeout(() => finish(null), timeoutMs);
  });
}
