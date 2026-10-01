import { afterEach, describe, expect, it } from 'vitest';
import * as Y from 'yjs';
import {
  blockRoomDurabilityStateCovers,
  captureBlockRoomDurabilityState,
  mergeBlockRoomDurabilityStates,
  type BlockRoomDurabilityState,
} from './block-room-durability';

const documents: Y.Doc[] = [];

function createDocument(): Y.Doc {
  const document = new Y.Doc();
  documents.push(document);
  return document;
}

function captureNextLocalState(document: Y.Doc, update: () => void): BlockRoomDurabilityState {
  let captured: BlockRoomDurabilityState | null = null;
  const listener = (transaction: Y.Transaction) => {
    if (transaction.local && transaction.changed.size > 0) {
      captured = captureBlockRoomDurabilityState(document, transaction);
    }
  };
  document.on('afterTransaction', listener);
  update();
  document.off('afterTransaction', listener);
  if (!captured) {
    throw new Error('Expected a local document transaction.');
  }
  return captured;
}

afterEach(() => {
  documents.splice(0).forEach((document) => document.destroy());
});

describe('block room durability coverage', () => {
  it('keeps the latest vector and accumulated local deletion ranges in one pending stamp', () => {
    const document = createDocument();
    const text = document.getText('body');
    const insertion = captureNextLocalState(document, () => text.insert(0, 'abcd'));
    const deletion = captureNextLocalState(document, () => text.delete(1, 2));
    const merged = mergeBlockRoomDurabilityStates(insertion, deletion);

    expect(merged.stateVector).toEqual(deletion.stateVector);
    expect(merged.deleted).toEqual(deletion.deleted);
    expect(blockRoomDurabilityStateCovers(insertion, merged)).toBe(false);
    expect(blockRoomDurabilityStateCovers(merged, merged)).toBe(true);
  });

  it('requires delete-set coverage when deletion does not advance the state vector', () => {
    const document = createDocument();
    const text = document.getText('body');
    captureNextLocalState(document, () => text.insert(0, 'x'));
    const beforeDelete = Y.encodeStateVector(document);
    const deletion = captureNextLocalState(document, () => text.delete(0, 1));

    expect(deletion.stateVector).toEqual(beforeDelete);
    expect(deletion.deleted).not.toEqual({});
    expect(blockRoomDurabilityStateCovers({ stateVector: beforeDelete, deleted: {} }, deletion)).toBe(false);
    expect(blockRoomDurabilityStateCovers(deletion, deletion)).toBe(true);
  });

  it('refuses an older ACK when a newer local transaction is pending', () => {
    const document = createDocument();
    const content = document.getMap('body');
    const first = captureNextLocalState(document, () => content.set('first', 'saved later'));
    const second = captureNextLocalState(document, () => content.set('second', 'still pending'));

    expect(blockRoomDurabilityStateCovers(first, second)).toBe(false);
    expect(blockRoomDurabilityStateCovers(second, second)).toBe(true);
  });
});
