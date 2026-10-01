import { fromJson, type JsonValue } from '@bufbuild/protobuf';
import { contentBlockCatalogFingerprint } from '@echovisionlab/geul-proto/content/block_catalog.ts';
import { LocalizedPageDocumentSchema } from '@echovisionlab/geul-proto/content/block_content_pb.ts';
import {
  canonicalBlockRoomDocumentBytes,
  type CanonicalBlockRoomSnapshot,
} from '@echovisionlab/geul-common/collaboration/block-room-codec';
import { afterEach, describe, expect, it } from 'vitest';
import * as Y from 'yjs';
import {
  acknowledgeBlockRoomIntents,
  clearBlockRoomIntentChanges,
  getBlockRoomIntentChanges,
  recordBlockRoomIntent,
  replaceBlockRoomIntentChanges,
  type BlockRoomIntentChange,
  type BlockRoomIntentScope,
} from './block-room-intent-journal';

const entityId = '01b3db42-75f1-4bf1-8cb9-9b3baf57e795';
const scope: BlockRoomIntentScope = {
  documentType: 'page',
  entityId,
  locale: 'ko',
  sourceLocale: 'ko',
};

function snapshot(uri: string): CanonicalBlockRoomSnapshot {
  return {
    document: fromJson(LocalizedPageDocumentSchema, {
      blockCatalogFingerprint: contentBlockCatalogFingerprint,
      locale: 'ko',
      base: {
        nodes: [
          {
            section: { id: '019cce25-dbc0-7d12-9f1f-735b1a6c6b14', externalVideo: { props: { uri } } },
            placement: { index: 0 },
          },
        ],
      },
      localeOverlay: {
        locale: 'ko',
        sections: [{ sectionId: '019cce25-dbc0-7d12-9f1f-735b1a6c6b14', externalVideo: { props: {} } }],
      },
    } as JsonValue),
    baseNodes: [],
    localeOverlay: [],
  };
}

function clockFixture() {
  const doc = new Y.Doc();
  const text = doc.getText('journal-test');
  let deleteSet: { clients: Map<number, Array<{ clock: number; len: number }>> } = { clients: new Map() };
  doc.transact(() => {
    text.insert(0, 'x');
  });
  const insertedVector = Y.encodeStateVector(doc);
  doc.transact((transaction) => {
    text.delete(0, 1);
    deleteSet = transaction.deleteSet as typeof deleteSet;
  });
  const deleted = Object.fromEntries(
    [...deleteSet.clients.entries()].map(([client, ranges]) => [
      String(client),
      ranges.map(({ clock, len }) => ({ clock, len })),
    ]),
  );
  return { doc, insertedVector, deleted, afterDeleteVector: Y.encodeStateVector(doc) };
}

function change(overrides: Partial<BlockRoomIntentChange> = {}): BlockRoomIntentChange {
  const clocks = clockFixture();
  const result = {
    before: snapshot('https://example.com/before'),
    after: snapshot('https://example.com/after'),
    stateVector: clocks.afterDeleteVector,
    deleted: clocks.deleted,
    ...overrides,
  };
  clocks.doc.destroy();
  return result;
}

function retainedSnapshotByteCount(changes: readonly BlockRoomIntentChange[]): number {
  return changes.reduce(
    (total, entry) =>
      total +
      canonicalBlockRoomDocumentBytes(scope.documentType, entry.before.document).byteLength +
      canonicalBlockRoomDocumentBytes(scope.documentType, entry.after.document).byteLength,
    0,
  );
}

afterEach(() => {
  clearBlockRoomIntentChanges(scope);
  clearBlockRoomIntentChanges({ ...scope, locale: 'ja' });
});

describe('block-room local intent journal', () => {
  it('records immutable canonical before/after changes under an exact locale and source scope', () => {
    const entry = change();
    expect(recordBlockRoomIntent(scope, entry)).toBe(true);
    entry.before.document.locale = 'mutated';
    entry.stateVector.fill(0);

    const stored = getBlockRoomIntentChanges(scope);
    expect(stored).toHaveLength(1);
    expect(stored[0]?.before.document.locale).toBe('ko');
    expect(Y.decodeStateVector(stored[0]!.stateVector).size).toBeGreaterThan(0);
    expect(getBlockRoomIntentChanges({ ...scope, locale: 'ja' })).toHaveLength(0);
    expect(getBlockRoomIntentChanges({ ...scope, sourceLocale: 'ja' })).toHaveLength(0);
  });

  it('requires both persisted state-vector coverage and the full delete-set range', () => {
    const entry = change();
    recordBlockRoomIntent(scope, entry);
    const onlyVector = acknowledgeBlockRoomIntents(scope, {
      stateVector: entry.stateVector,
      deleted: {},
    });
    expect(onlyVector).toEqual({ acknowledged: 0, pending: 1 });

    expect(
      acknowledgeBlockRoomIntents(scope, {
        stateVector: entry.stateVector,
        deleted: entry.deleted,
      }),
    ).toEqual({ acknowledged: 1, pending: 0 });
    expect(getBlockRoomIntentChanges(scope)).toHaveLength(0);
  });

  it('keeps local intents separate across peer body changes and acknowledges by clocks', () => {
    const doc = new Y.Doc();
    const text = doc.getText('journal-prefix');
    text.insert(0, 'a');
    const firstStateVector = Y.encodeStateVector(doc);
    const first = change({ stateVector: firstStateVector, deleted: {} });
    first.before = snapshot('https://example.com/a');
    first.after = snapshot('https://example.com/b');
    recordBlockRoomIntent(scope, first);

    text.insert(1, 'b');
    const second = change({ stateVector: Y.encodeStateVector(doc), deleted: {} });
    second.before = snapshot('https://example.com/peer-edit');
    second.after = snapshot('https://example.com/c');
    recordBlockRoomIntent(scope, second);
    expect(getBlockRoomIntentChanges(scope)).toHaveLength(2);

    expect(acknowledgeBlockRoomIntents(scope, { stateVector: firstStateVector, deleted: {} })).toEqual({
      acknowledged: 1,
      pending: 1,
    });
    expect(getBlockRoomIntentChanges(scope)).toHaveLength(1);
    expect(getBlockRoomIntentChanges(scope)[0]?.after.document.base).toEqual(second.after.document.base);
    doc.destroy();
  });

  it('coalesces a contiguous 200-edit burst and retains only the first and latest snapshots', () => {
    const doc = new Y.Doc();
    const text = doc.getText('journal-burst');
    const uncoalesced: BlockRoomIntentChange[] = [];
    for (let index = 0; index < 200; index += 1) {
      text.insert(index, 'x');
      const entry: BlockRoomIntentChange = {
        before: snapshot(`https://example.com/${index}`),
        after: snapshot(`https://example.com/${index + 1}`),
        stateVector: Y.encodeStateVector(doc),
        deleted: {},
      };
      uncoalesced.push(entry);
      expect(recordBlockRoomIntent(scope, entry)).toBe(true);
    }

    const retained = getBlockRoomIntentChanges(scope);
    const beforeBytes = retainedSnapshotByteCount(uncoalesced);
    const afterBytes = retainedSnapshotByteCount(retained);
    expect({ entries: uncoalesced.length, snapshotBytes: beforeBytes }).toEqual({
      entries: 200,
      snapshotBytes: 77_782,
    });
    expect({ entries: retained.length, snapshotBytes: afterBytes }).toEqual({ entries: 1, snapshotBytes: 388 });
    expect(retained).toHaveLength(1);
    expect(retained[0]?.before.document.base).toEqual(uncoalesced[0]?.before.document.base);
    expect(retained[0]?.after.document.base).toEqual(uncoalesced.at(-1)?.after.document.base);
    expect(retained[0]?.stateVector).toEqual(uncoalesced.at(-1)?.stateVector);
    expect(afterBytes).toBeLessThan(beforeBytes);
    const retainedStateVector = Uint8Array.from(retained[0]!.stateVector);
    const retainedLocale = retained[0]!.after.document.locale;
    uncoalesced.at(-1)!.after.document.locale = 'mutated';
    uncoalesced.at(-1)!.stateVector.fill(0);
    expect(retained[0]?.after.document.locale).toBe(retainedLocale);
    expect(retained[0]?.stateVector).toEqual(retainedStateVector);
    doc.destroy();
  });

  it('keeps a coalesced deletion burst through partial ACK and clears it only after complete coverage', () => {
    const doc = new Y.Doc();
    const text = doc.getText('journal-delete-burst');
    text.insert(0, 'a');
    const firstStateVector = Y.encodeStateVector(doc);
    let firstDeleteSet: { clients: Map<number, Array<{ clock: number; len: number }>> } = { clients: new Map() };
    doc.transact((transaction) => {
      text.delete(0, 1);
      firstDeleteSet = transaction.deleteSet as typeof firstDeleteSet;
    });
    const firstDeleted = Object.fromEntries(
      [...firstDeleteSet.clients.entries()].map(([client, ranges]) => [
        String(client),
        ranges.map(({ clock, len }) => ({ clock, len })),
      ]),
    );
    const first = change({
      before: snapshot('https://example.com/a'),
      after: snapshot('https://example.com/b'),
      stateVector: firstStateVector,
      deleted: firstDeleted,
    });
    recordBlockRoomIntent(scope, first);

    text.insert(0, 'b');
    const latestStateVector = Y.encodeStateVector(doc);
    let secondDeleteSet: { clients: Map<number, Array<{ clock: number; len: number }>> } = { clients: new Map() };
    doc.transact((transaction) => {
      text.delete(0, 1);
      secondDeleteSet = transaction.deleteSet as typeof secondDeleteSet;
    });
    const secondDeleted = Object.fromEntries(
      [...secondDeleteSet.clients.entries()].map(([client, ranges]) => [
        String(client),
        ranges.map(({ clock, len }) => ({ clock, len })),
      ]),
    );
    const second = change({
      before: snapshot('https://example.com/b'),
      after: snapshot('https://example.com/c'),
      stateVector: latestStateVector,
      deleted: secondDeleted,
    });
    recordBlockRoomIntent(scope, second);

    const [merged] = getBlockRoomIntentChanges(scope);
    expect(getBlockRoomIntentChanges(scope)).toHaveLength(1);
    expect(merged?.before.document.base).toEqual(first.before.document.base);
    expect(merged?.after.document.base).toEqual(second.after.document.base);
    expect(merged?.stateVector).toEqual(latestStateVector);
    expect(Object.values(merged?.deleted ?? {}).flat()).toEqual([{ clock: 0, len: 2 }]);
    expect(acknowledgeBlockRoomIntents(scope, { stateVector: latestStateVector, deleted: firstDeleted })).toEqual({
      acknowledged: 0,
      pending: 1,
    });
    expect(getBlockRoomIntentChanges(scope)).toHaveLength(1);
    expect(
      acknowledgeBlockRoomIntents(scope, {
        stateVector: latestStateVector,
        deleted: merged!.deleted,
      }),
    ).toEqual({ acknowledged: 1, pending: 0 });
    expect(getBlockRoomIntentChanges(scope)).toHaveLength(0);
    doc.destroy();
  });

  it('does not let a state vector alone acknowledge a pure deletion', () => {
    const clocks = clockFixture();
    expect([...clocks.insertedVector]).toEqual([...clocks.afterDeleteVector]);
    const deletionOnlyChange = change({
      stateVector: clocks.afterDeleteVector,
      deleted: clocks.deleted,
    });
    recordBlockRoomIntent(scope, deletionOnlyChange);

    expect(
      acknowledgeBlockRoomIntents(scope, {
        stateVector: clocks.afterDeleteVector,
        deleted: {},
      }),
    ).toEqual({ acknowledged: 0, pending: 1 });
    const [client, ranges] = Object.entries(clocks.deleted)[0]!;
    const firstRange = ranges[0]!;
    const partial = acknowledgeBlockRoomIntents(scope, {
      stateVector: clocks.afterDeleteVector,
      deleted: { [client]: [{ clock: firstRange.clock, len: firstRange.len - 1 }] },
    });
    expect(partial).toEqual({ acknowledged: 0, pending: 1 });
    expect(
      acknowledgeBlockRoomIntents(scope, {
        stateVector: clocks.afterDeleteVector,
        deleted: clocks.deleted,
      }),
    ).toEqual({ acknowledged: 1, pending: 0 });
    clocks.doc.destroy();
  });

  it('can replace old-epoch stamps with the fresh clocks generated by semantic replay', () => {
    const previous = change();
    recordBlockRoomIntent(scope, previous);
    const replayDoc = new Y.Doc();
    replayDoc.getText('fresh-replay').insert(0, 'x');
    const replayStateVector = Y.encodeStateVector(replayDoc);
    const replayed = change({ stateVector: replayStateVector, deleted: {} });
    replaceBlockRoomIntentChanges(scope, [replayed]);

    expect(getBlockRoomIntentChanges(scope)).toMatchObject([{ stateVector: replayStateVector, deleted: {} }]);
    expect(
      acknowledgeBlockRoomIntents(scope, {
        stateVector: previous.stateVector,
        deleted: previous.deleted,
      }),
    ).toEqual({ acknowledged: 0, pending: 1 });
    replayDoc.destroy();
  });

  it('ignores a before/after pair whose canonical body is unchanged', () => {
    expect(recordBlockRoomIntent(scope, change({ after: snapshot('https://example.com/before') }))).toBe(false);
    expect(getBlockRoomIntentChanges(scope)).toHaveLength(0);
  });
});
