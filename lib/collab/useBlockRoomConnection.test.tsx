// @vitest-environment jsdom

import { act } from 'react';
import { fromJson, toBinary, toJson, type JsonValue } from '@bufbuild/protobuf';
import { documentBodyDigest } from '@echovisionlab/geul-common/collaboration/protocol';
import {
  LocalizedPageDocumentSchema,
  type LocalizedPageDocument,
} from '@echovisionlab/geul-proto/content/block_content_pb.ts';
import {
  decodeCanonicalBlockRoom,
  getBlockRoomCollaborativeText,
  hydrateCanonicalBlockRoom,
  materializeCanonicalBlockRoom,
} from '@echovisionlab/geul-common/collaboration/block-room-codec';
import { contentBlockCatalogFingerprint } from '@echovisionlab/geul-proto/content/block_catalog.ts';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as Y from 'yjs';
import { createBlockRoomPageSectionsController } from '@/features/page/PageEditor/block-room-page-sections';
import { clearBlockRoomIntentChanges, getBlockRoomIntentChanges } from './block-room-intent-journal';
import { attachBlockRoomLocalUndoOrigin, blockRoomUndoDepth, undoBlockRoom } from './interactive-mutation-undo';
import * as journalStoreModule from './block-room-journal-store';
import { getEditorRoomPhase } from '@/lib/editor/editor-save-registry';
import { useBlockRoomConnection } from './useBlockRoomConnection';
import type { BlockRoomProtocolClient } from './block-room-protocol';
import type { EditorSnapshot } from '@/features/editor/editor-snapshot';
import {
  getProviderAccessEnded,
  getProviderAccessLevel,
  subscribeToProviderAccessLevel,
} from './provider-control-state';

const persistNowMock = vi.hoisted(() => vi.fn(async () => undefined));
vi.mock('@/lib/collab/persist-now', () => ({ persistCollaborativeDocumentNow: persistNowMock }));

const providerState = vi.hoisted(() => ({
  instances: [] as Array<{
    configuration: {
      document: Y.Doc;
      name: string;
      websocketProvider: object;
      token?: string;
      url: string;
      onConnect?: () => void;
      onDisconnect?: () => void;
      onAuthenticationFailed?: (input: { reason: string }) => void;
      onSynced?: () => void;
      onStateless?: (input: { payload: string }) => void;
    };
    destroy: ReturnType<typeof vi.fn>;
    disconnect: ReturnType<typeof vi.fn>;
    connect: ReturnType<typeof vi.fn>;
    sendStateless: ReturnType<typeof vi.fn>;
    flushPendingUpdates: () => void;
    listeners: Map<string, Set<(event: unknown) => void>>;
    setConfiguration: ReturnType<typeof vi.fn>;
  }>,
}));

vi.mock('@hocuspocus/provider', () => ({
  MessageType: { Sync: 0, Awareness: 1 },
  HocuspocusProvider: class MockHocuspocusProvider {
    readonly configuration: (typeof providerState.instances)[number]['configuration'];
    destroy = vi.fn();
    disconnect = vi.fn();
    connect = vi.fn();
    sendStateless = vi.fn();
    readonly listeners = new Map<string, Set<(event: unknown) => void>>();
    on = vi.fn((event: string, listener: (event: unknown) => void) => {
      this.listeners.set(event, (this.listeners.get(event) ?? new Set()).add(listener));
    });
    off = vi.fn((event: string, listener: (event: unknown) => void) => {
      this.listeners.get(event)?.delete(listener);
    });
    // Like the real provider, sending buffered document updates emits an outgoing Sync message.
    flushPendingUpdates = vi.fn(() => {
      for (const listener of this.listeners.get('outgoingMessage') ?? []) {
        listener({ message: { type: 0 } });
      }
    });
    setConfiguration = vi.fn((next: { token?: string; websocketProvider?: object }) =>
      Object.assign(this.configuration, next),
    );

    constructor(configuration: Omit<(typeof providerState.instances)[number]['configuration'], 'websocketProvider'>) {
      this.configuration = { ...configuration, websocketProvider: {} };
      providerState.instances.push(this);
    }
  },
}));

const entityId = '01b3db42-75f1-4bf1-8cb9-9b3baf57e795';
const sectionAId = '01b3db42-75f1-4bf1-8cb9-9b3baf57e796';
const sectionBId = '01b3db42-75f1-4bf1-8cb9-9b3baf57e797';
const richTextSectionId = '01b3db42-75f1-4bf1-8cb9-9b3baf57e798';
const richTextBlockId = '01b3db42-75f1-4bf1-8cb9-9b3baf57e799';
let latestHook: ReturnType<typeof useBlockRoomConnection> | null = null;
let container: HTMLDivElement | null = null;
let root: Root | null = null;
const renderSnapshots: Array<{ locale: string | null; connection: ReturnType<typeof useBlockRoomConnection> }> = [];

function bootstrapMessage(
  challenge = 'challenge-1',
  sections: Array<{ id: string; uri: string }> = [],
  paragraphText?: string,
) {
  const typed = fromJson(LocalizedPageDocumentSchema, {
    blockCatalogFingerprint: contentBlockCatalogFingerprint,
    locale: 'ko',
    base: {
      nodes: [
        ...sections.map(({ id, uri }, index) => ({
          section: { id, externalVideo: { props: { uri } } },
          placement: { index },
        })),
        ...(paragraphText === undefined
          ? []
          : [
              {
                section: {
                  id: richTextSectionId,
                  richText: {
                    props: {},
                    blocks: {
                      nodes: [
                        {
                          block: { id: richTextBlockId, paragraph: { props: {} } },
                          placement: { index: 0 },
                        },
                      ],
                    },
                  },
                },
                placement: { index: sections.length },
              },
            ]),
      ],
    },
    localeOverlay: {
      locale: 'ko',
      sections: [
        ...sections.map(({ id }) => ({ sectionId: id, externalVideo: { props: {} } })),
        ...(paragraphText === undefined
          ? []
          : [
              {
                sectionId: richTextSectionId,
                richText: {
                  props: {},
                  blocks: {
                    locale: 'ko',
                    blocks: [
                      {
                        blockId: richTextBlockId,
                        paragraph: { props: {}, content: [{ text: { text: paragraphText } }] },
                      },
                    ],
                  },
                },
              },
            ]),
      ],
    },
  } as JsonValue) as LocalizedPageDocument;
  const source = new Y.Doc();
  hydrateCanonicalBlockRoom(source, 'page', 'ko', typed, []);
  const update = Y.encodeStateAsUpdate(source);
  source.destroy();
  return {
    update,
    payload: JSON.stringify({
      kind: 'room.bootstrap',
      v: 3,
      bootstrapChallenge: challenge,
      documentName: `page:${entityId}:ko`,
      documentType: 'page',
      document: toJson(LocalizedPageDocumentSchema, typed),
      documentRevision: 'b67328c4-668c-5bf2-8f1e-41465149ded6',
      sourceLocale: 'ko',
      locale: 'ko',
      localeExists: true,
      presentLocaleValues: [],
      sourceMetadata: { locale: 'ko' },
      localeMetadata: { locale: 'ko' },
      documentMetadata: {},
      metadataSequence: 0,
      blockCatalogFingerprint: contentBlockCatalogFingerprint,
      serverInstanceId: 'collab-1',
      roomEpoch: 'bdac72af-8a24-4214-999d-83727445cbd7',
      yjsBootstrapUpdate: Buffer.from(update).toString('base64'),
    }),
  };
}

function TestHarness({
  id = entityId,
  locale = 'ko',
  snapshot,
}: {
  id?: string;
  locale?: string | null;
  snapshot?: EditorSnapshot;
}) {
  latestHook = useBlockRoomConnection('page', id, locale, snapshot);
  renderSnapshots.push({ locale, connection: latestHook });
  return null;
}

async function render(id = entityId, snapshot?: EditorSnapshot) {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => {
    root?.render(<TestHarness id={id} snapshot={snapshot} />);
    await Promise.resolve();
  });
}

function connection() {
  expect(latestHook).not.toBeNull();
  return latestHook as ReturnType<typeof useBlockRoomConnection>;
}

function sendBootstrap(
  instance = providerState.instances.at(-1)!,
  challenge = 'challenge-1',
  sections: Array<{ id: string; uri: string }> = [],
  paragraphText?: string,
) {
  const bootstrap = bootstrapMessage(challenge, sections, paragraphText);
  act(() => {
    instance.configuration.onStateless?.({ payload: bootstrap.payload });
  });
  return bootstrap;
}

function syncBootstrap(
  instance: (typeof providerState.instances)[number],
  bootstrap: ReturnType<typeof bootstrapMessage>,
) {
  Y.applyUpdate(instance.configuration.document, bootstrap.update);
  act(() => instance.configuration.onSynced?.());
}

function sendReady(instance: (typeof providerState.instances)[number], challenge = 'challenge-1') {
  act(() =>
    instance.configuration.onStateless?.({
      payload: JSON.stringify({
        kind: 'room.ready',
        v: 3,
        bootstrapChallenge: challenge,
      }),
    }),
  );
}

function admit(
  instance = providerState.instances.at(-1)!,
  challenge = 'challenge-1',
  sections: Array<{ id: string; uri: string }> = [],
  paragraphText?: string,
) {
  const bootstrap = sendBootstrap(instance, challenge, sections, paragraphText);
  syncBootstrap(instance, bootstrap);
  expect(instance.sendStateless).toHaveBeenCalledWith(expect.stringContaining('room.bootstrap_ack'));
  sendReady(instance, challenge);
}

function sendPersisted(
  instance: (typeof providerState.instances)[number],
  stateVector: Uint8Array,
  deleted: Record<string, Array<{ clock: number; len: number }>> = {},
) {
  act(() =>
    instance.configuration.onStateless?.({
      payload: JSON.stringify({
        kind: 'room.persisted',
        v: 3,
        documentName: instance.configuration.name,
        stateVector: Buffer.from(stateVector).toString('base64'),
        deleted,
      }),
    }),
  );
}

function deleteSetRanges(transaction: Y.Transaction): Record<string, Array<{ clock: number; len: number }>> {
  const deleteSet = transaction.deleteSet as {
    clients: Map<number, Array<{ clock: number; len: number }>>;
  };
  return Object.fromEntries(
    [...deleteSet.clients.entries()].map(([client, ranges]) => [
      String(client),
      ranges.map(({ clock, len }) => ({ clock, len })),
    ]),
  );
}

function canonicalParagraphText(document: LocalizedPageDocument): string {
  const json = toJson(LocalizedPageDocumentSchema, document) as unknown as {
    localeOverlay?: {
      sections?: Array<{
        sectionId: string;
        richText?: {
          blocks?: {
            blocks?: Array<{ paragraph?: { content?: Array<{ text?: { text?: string } }> } }>;
          };
        };
      }>;
    };
  };
  return (
    json.localeOverlay?.sections?.find(({ sectionId }) => sectionId === richTextSectionId)?.richText?.blocks
      ?.blocks?.[0]?.paragraph?.content?.[0]?.text?.text ?? ''
  );
}

function canonicalPageParagraphText(document: Y.Doc): string {
  return canonicalParagraphText(decodeCanonicalBlockRoom(document, 'page').document as LocalizedPageDocument);
}

function observeLocalDeleteSets(document: Y.Doc, provider: object) {
  let deleted: Record<string, Array<{ clock: number; len: number }>> = {};
  const listener = (transaction: Y.Transaction) => {
    if (transaction.origin !== provider) {
      deleted = deleteSetRanges(transaction);
    }
  };
  document.on('afterTransaction', listener);
  return {
    current: () => deleted,
    stop: () => document.off('afterTransaction', listener),
  };
}

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

beforeEach(() => {
  latestHook = null;
  providerState.instances.length = 0;
  renderSnapshots.length = 0;
  persistNowMock.mockClear();
  clearBlockRoomIntentChanges({ documentType: 'page', entityId, locale: 'ko', sourceLocale: 'ko' });
});

afterEach(() => {
  act(() => root?.unmount());
  container?.remove();
  root = null;
  container = null;
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('useBlockRoomConnection', () => {
  it('becomes ready only after same-socket bootstrap, Yjs sync, and semantic ACK', async () => {
    await render();
    const resident = providerState.instances[0]!;
    expect(resident.configuration).toMatchObject({
      name: `page:${entityId}:ko`,
      url: `${window.location.origin.replace(/^http/u, 'ws')}/collab/page/${entityId}/ko`,
    });
    expect(resident.configuration.token).toBeUndefined();
    expect(connection().doc).toBeNull();

    act(() => resident.configuration.onConnect?.());
    const bootstrap = sendBootstrap(resident);
    expect(resident.sendStateless).not.toHaveBeenCalled();
    expect(connection()).toMatchObject({ isConnected: true, isSynced: false, isLoading: true });
    expect(connection().bootstrap?.bootstrapChallenge).toBe('challenge-1');
    expect(connection().doc).toBeNull();

    syncBootstrap(resident, bootstrap);
    const ack = JSON.parse(resident.sendStateless.mock.calls[0]![0]);
    expect(ack).toEqual({
      kind: 'room.bootstrap_ack',
      v: 3,
      challenge: 'challenge-1',
      stateVector: expect.any(String),
    });
    expect(connection()).toMatchObject({ isConnected: true, isSynced: false, isLoading: true });
    expect(connection().doc).toBeNull();
    expect(resident.setConfiguration).not.toHaveBeenCalled();

    sendReady(resident);

    expect(connection()).toMatchObject({ isConnected: true, isSynced: true, isLoading: false });
    expect(connection().doc).toBe(resident.configuration.document);
    expect(resident.setConfiguration).toHaveBeenCalledWith({
      token: 'challenge-1',
      websocketProvider: resident.configuration.websocketProvider,
    });
    expect(providerState.instances).toHaveLength(1);

    act(() => resident.configuration.onDisconnect?.());
    expect(connection()).toMatchObject({
      doc: resident.configuration.document,
      isConnected: false,
      isSynced: false,
    });
    act(() => resident.configuration.onConnect?.());
    act(() => resident.configuration.onSynced?.());
    expect(providerState.instances).toHaveLength(1);
    expect(connection().doc).toBe(resident.configuration.document);
    expect(connection().isSynced).toBe(true);
  });

  it('retries without a finite attempt limit and retries immediately on focus and online', async () => {
    await render();
    const first = providerState.instances[0]!;
    expect(first.configuration).toMatchObject({
      maxAttempts: 0,
      factor: 2,
      minDelay: 1_000,
      maxDelay: 30_000,
      jitter: true,
    });
    act(() => window.dispatchEvent(new Event('focus')));
    act(() => window.dispatchEvent(new Event('online')));
    expect(first.connect).toHaveBeenCalledTimes(2);
    act(() => first.configuration.onAuthenticationFailed?.({ reason: 'permission' }));
    act(() => window.dispatchEvent(new Event('online')));
    expect(first.connect).toHaveBeenCalledTimes(2);
  });

  it('does not publish synced if IndexedDB recovery finishes after a disconnect', async () => {
    let finish!: (value: Awaited<ReturnType<journalStoreModule.BlockRoomJournalStore['claimOrphans']>>) => void;
    const store: journalStoreModule.BlockRoomJournalStore = {
      tabId: 'test',
      writeChanges: vi.fn(),
      writeRecovery: vi.fn(),
      claimOrphans: vi.fn(
        () =>
          new Promise<Awaited<ReturnType<journalStoreModule.BlockRoomJournalStore['claimOrphans']>>>((resolve) => {
            finish = resolve;
          }),
      ),
      clearMember: async () => {},
      flush: async () => {},
      isSettled: () => true,
      prune: async () => {},
      dispose: vi.fn(),
    };
    vi.spyOn(journalStoreModule, 'getBlockRoomJournalStore').mockReturnValue(store);
    await render();
    const first = providerState.instances[0]!;
    admit(first);
    act(() => first.configuration.onDisconnect?.());
    await act(async () => {
      finish({ changes: [], recovery: null, records: 0 });
    });
    expect(connection()).toMatchObject({ doc: first.configuration.document, isConnected: false, isSynced: false });
    expect(getEditorRoomPhase(`page:${entityId}`)).toBe('offline');
  });

  it('keeps the visible resident across repeated unsuccessful rebuild generations', async () => {
    await render();
    const first = providerState.instances[0]!;
    admit(first, 'challenge-1', [{ id: sectionAId, uri: 'https://example.com/before' }]);
    act(() => connection().reloadCanonical());
    const failed = providerState.instances[1]!;
    act(() =>
      failed.configuration.onStateless?.({
        payload: JSON.stringify({ v: 3, kind: 'room.reload', reloadReason: 'external_update' }),
      }),
    );
    expect(first.configuration.document.isDestroyed).toBe(false);
    expect(connection().doc).toBe(first.configuration.document);
    const controller = createBlockRoomPageSectionsController(first.configuration.document, 'ko');
    act(() => controller.update(sectionAId, { props: { url: 'https://example.com/retained' } }));
    const third = providerState.instances[2]!;
    admit(third, 'challenge-3', [{ id: sectionAId, uri: 'https://example.com/before' }]);
    expect(decodeCanonicalBlockRoom(third.configuration.document, 'page').baseNodes[0]?.payload).toMatchObject({
      props: { uri: 'https://example.com/retained' },
    });
    expect(first.configuration.document.isDestroyed).toBe(true);
  });

  it('journals edits made in the mounted old document while a deployment rebuild is pending', async () => {
    await render();
    const first = providerState.instances[0]!;
    admit(first, 'challenge-1', [{ id: sectionAId, uri: 'https://example.com/before' }]);
    act(() =>
      first.configuration.onStateless?.({
        payload: JSON.stringify({ v: 3, kind: 'room.reload', reloadReason: 'deploy_or_restart' }),
      }),
    );
    const oldController = createBlockRoomPageSectionsController(first.configuration.document, 'ko');
    act(() => oldController.update(sectionAId, { props: { url: 'https://example.com/during-reload' } }));
    expect(connection().doc).toBe(first.configuration.document);
    const second = providerState.instances[1]!;
    admit(second, 'challenge-2', [{ id: sectionAId, uri: 'https://example.com/before' }]);
    expect(decodeCanonicalBlockRoom(second.configuration.document, 'page').baseNodes[0]?.payload).toMatchObject({
      props: { uri: 'https://example.com/during-reload' },
    });
    expect(first.destroy).toHaveBeenCalledOnce();
  });

  it('routes matching interactive mutation markers to the resident provider undo boundary', async () => {
    await render();
    const resident = providerState.instances[0]!;
    admit(resident);
    const document = connection().doc!;
    const detach = attachBlockRoomLocalUndoOrigin(document, { kind: 'editor' }, () => true);
    const text = document.getText('interactive-mutation-test');
    const mutationId = '019cd2c0-0755-7ee4-8370-c583b2c4019f';

    act(() =>
      resident.configuration.onStateless?.({
        payload: JSON.stringify({ v: 3, kind: 'interactive_mutation.begin', mutationId }),
      }),
    );
    document.transact(() => text.insert(0, 'committed AI edit'), resident);
    act(() =>
      resident.configuration.onStateless?.({
        payload: JSON.stringify({ v: 3, kind: 'interactive_mutation.end', mutationId, outcome: 'accepted' }),
      }),
    );

    expect(blockRoomUndoDepth(document)).toBe(1);
    expect(undoBlockRoom(document)).toBe(true);
    expect(text.toString()).toBe('');
    detach();
  });

  it('opens a fresh resident when provider sync completes without canonical bootstrap state', async () => {
    await render();
    const first = providerState.instances[0]!;
    const destroyDoc = vi.spyOn(first.configuration.document, 'destroy');
    sendBootstrap(first);

    act(() => first.configuration.onSynced?.());
    await act(async () => Promise.resolve());

    expect(first.sendStateless).not.toHaveBeenCalled();
    expect(first.destroy).toHaveBeenCalledOnce();
    expect(destroyDoc).toHaveBeenCalledOnce();
    expect(providerState.instances).toHaveLength(2);
    expect(providerState.instances[1]!.configuration.token).toBeUndefined();
    expect(connection().recoverySnapshot).toBeNull();
  });

  it('opens a fresh resident when ready belongs to another bootstrap challenge', async () => {
    await render();
    const first = providerState.instances[0]!;
    const bootstrap = sendBootstrap(first);
    syncBootstrap(first, bootstrap);

    sendReady(first, 'another-challenge');
    await act(async () => Promise.resolve());

    expect(first.destroy).toHaveBeenCalledOnce();
    expect(providerState.instances).toHaveLength(2);
    expect(providerState.instances[1]!.configuration.token).toBeUndefined();
    expect(connection().recoverySnapshot).toBeNull();
  });

  it('retains the admitted document while a fresh resident handles reload_required', async () => {
    await render();
    const first = providerState.instances[0]!;
    const firstDoc = first.configuration.document;
    const destroyDoc = vi.spyOn(firstDoc, 'destroy');
    admit(first);
    firstDoc.getText('recovery-note').insert(0, 'local draft');
    expect(connection().doc).toBe(firstDoc);

    act(() =>
      first.configuration.onStateless?.({
        payload: JSON.stringify({ v: 3, kind: 'room.reload', reloadReason: 'external_update' }),
      }),
    );
    await act(async () => Promise.resolve());

    expect(first.disconnect).toHaveBeenCalled();
    expect(first.destroy).not.toHaveBeenCalled();
    expect(destroyDoc).not.toHaveBeenCalled();
    expect(providerState.instances).toHaveLength(2);
    expect(connection().doc).toBe(first.configuration.document);
    expect(providerState.instances[1]!.configuration.token).toBeUndefined();
    const originalSnapshot = connection().recoverySnapshot;
    expect(originalSnapshot).toMatchObject({
      documentType: 'page',
      entityId,
      locale: 'ko',
      sourceLocale: 'ko',
      documentRevision: 'b67328c4-668c-5bf2-8f1e-41465149ded6',
      capturedAt: expect.any(Number),
    });
    expect(originalSnapshot?.yjsUpdate).toBeInstanceOf(Uint8Array);

    const replayed = new Y.Doc();
    Y.applyUpdate(replayed, originalSnapshot!.yjsUpdate);
    expect(replayed.getText('recovery-note').toString()).toBe('local draft');

    const second = providerState.instances[1]!;
    admit(second);
    expect(connection().doc).toBe(second.configuration.document);
    expect(connection().doc?.getText('recovery-note').toString()).toBe('');
    expect(connection().recoverySnapshot).toBe(originalSnapshot);

    act(() =>
      second.configuration.onStateless?.({
        payload: JSON.stringify({ v: 3, kind: 'room.reload', reloadReason: 'external_update' }),
      }),
    );
    await act(async () => Promise.resolve());
    expect(connection().recoverySnapshot).toBe(originalSnapshot);

    const third = providerState.instances[2]!;
    admit(third);
    third.configuration.document.getText('recovery-note').insert(0, 'new local draft');
    act(() => connection().reloadCanonical());
    await act(async () => Promise.resolve());
    const newerSnapshot = connection().recoverySnapshot;
    expect(newerSnapshot).not.toBe(originalSnapshot);
    const replayedNewer = new Y.Doc();
    Y.applyUpdate(replayedNewer, newerSnapshot!.yjsUpdate);
    expect(replayedNewer.getText('recovery-note').toString()).toBe('new local draft');
    replayed.destroy();
    replayedNewer.destroy();
  });

  it('replays a pending Page leaf edit over fresh canonical data and waits for durable coverage', async () => {
    await render();
    const first = providerState.instances[0]!;
    admit(first, 'challenge-1', [
      { id: sectionAId, uri: 'https://example.com/original-a' },
      { id: sectionBId, uri: 'https://example.com/peer-b' },
    ]);
    const controller = createBlockRoomPageSectionsController(first.configuration.document, 'ko');
    controller.update(sectionAId, { props: { url: 'https://example.com/local-a' } });
    const capturedIntents = getBlockRoomIntentChanges({
      documentType: 'page',
      entityId,
      locale: 'ko',
      sourceLocale: 'ko',
    });
    expect(capturedIntents).toHaveLength(1);
    expect(capturedIntents[0]?.before.baseNodes.find(({ id }) => id === sectionAId)?.payload).toMatchObject({
      props: { uri: 'https://example.com/original-a' },
    });
    expect(capturedIntents[0]?.after.baseNodes.find(({ id }) => id === sectionAId)?.payload).toMatchObject({
      props: { uri: 'https://example.com/local-a' },
    });
    act(() => first.configuration.onSynced?.());
    expect(
      getBlockRoomIntentChanges({ documentType: 'page', entityId, locale: 'ko', sourceLocale: 'ko' }),
    ).toHaveLength(1);
    expect(persistNowMock).not.toHaveBeenCalled();
    expect(
      decodeCanonicalBlockRoom(first.configuration.document, 'page').baseNodes.find(({ id }) => id === sectionAId)
        ?.payload,
    ).toMatchObject({ props: { uri: 'https://example.com/local-a' } });

    act(() => connection().reloadCanonical());
    await act(async () => Promise.resolve());
    const second = providerState.instances[1]!;
    const persistedTransaction = observeLocalDeleteSets(second.configuration.document, second);
    admit(second, 'challenge-2', [{ id: sectionAId, uri: 'https://example.com/original-a' }]);

    expect(persistNowMock).toHaveBeenCalledWith(second);
    const freshPage = decodeCanonicalBlockRoom(second.configuration.document, 'page');
    expect(freshPage.baseNodes.find(({ id }) => id === sectionAId)?.payload).toMatchObject({
      props: { uri: 'https://example.com/local-a' },
    });
    expect(freshPage.baseNodes.some(({ id }) => id === sectionBId)).toBe(false);
    expect(connection().recoverySnapshot).not.toBeNull();

    sendPersisted(second, Y.encodeStateVector(second.configuration.document), persistedTransaction.current());
    expect(connection().recoverySnapshot).toBeNull();
    persistedTransaction.stop();
  });

  it('rebases a local rich-text deletion before a second canonical reload without deleting twice', async () => {
    await render();
    const first = providerState.instances[0]!;
    admit(first, 'challenge-1', [], 'a');

    const scope = { documentType: 'page', entityId, locale: 'ko', sourceLocale: 'ko' } as const;
    const localText = getBlockRoomCollaborativeText(first.configuration.document, {
      id: richTextBlockId,
      family: 'rich_text',
      locale: true,
      path: 'content[0].text.text',
    });
    first.configuration.document.transact(() => localText.delete(0, localText.length));

    const originalIntents = getBlockRoomIntentChanges(scope);
    expect(originalIntents).toHaveLength(1);
    expect(canonicalParagraphText(originalIntents[0]!.before.document as LocalizedPageDocument)).toBe('a');
    expect(canonicalParagraphText(originalIntents[0]!.after.document as LocalizedPageDocument)).toBe('');
    expect(canonicalPageParagraphText(first.configuration.document)).toBe('');

    act(() => connection().reloadCanonical());
    await act(async () => Promise.resolve());
    const second = providerState.instances[1]!;
    const secondBootstrap = sendBootstrap(second, 'challenge-2', [], 'aa');
    syncBootstrap(second, secondBootstrap);
    expect(canonicalPageParagraphText(second.configuration.document)).toBe('aa');
    sendReady(second, 'challenge-2');

    // The materialized canonical paragraph is authoritative; replay may reshape
    // Yjs inline arrays, so this avoids treating an old raw text node as content.
    expect(canonicalPageParagraphText(second.configuration.document)).toBe('a');
    expect(persistNowMock).toHaveBeenCalledOnce();

    // persist.now only accepts the request; the block-room durable ACK has not arrived.
    const rebasedIntents = getBlockRoomIntentChanges(scope);
    expect(rebasedIntents).toHaveLength(1);
    expect(canonicalParagraphText(rebasedIntents[0]!.before.document as LocalizedPageDocument)).toBe('aa');
    expect(canonicalParagraphText(rebasedIntents[0]!.after.document as LocalizedPageDocument)).toBe('a');
    expect(connection().recoverySnapshot).not.toBeNull();

    act(() => connection().reloadCanonical());
    await act(async () => Promise.resolve());
    const third = providerState.instances[2]!;
    const thirdBootstrap = sendBootstrap(third, 'challenge-3', [], 'a');
    syncBootstrap(third, thirdBootstrap);
    expect(canonicalPageParagraphText(third.configuration.document)).toBe('a');
    sendReady(third, 'challenge-3');

    expect(canonicalPageParagraphText(third.configuration.document)).toBe('a');
    expect(getBlockRoomIntentChanges(scope)).toHaveLength(0);
    expect(connection().recoverySnapshot).toBeNull();
    expect(persistNowMock).toHaveBeenCalledOnce();
  });

  it('retries failed replay persistence with backoff and waits for the durable coverage ACK', async () => {
    vi.useFakeTimers();
    await render();
    const first = providerState.instances[0]!;
    admit(first, 'challenge-1', [{ id: sectionAId, uri: 'https://example.com/original-a' }]);
    createBlockRoomPageSectionsController(first.configuration.document, 'ko').update(sectionAId, {
      props: { url: 'https://example.com/local-a' },
    });

    act(() => connection().reloadCanonical());
    await act(async () => Promise.resolve());
    const second = providerState.instances[1]!;
    const persistedTransaction = observeLocalDeleteSets(second.configuration.document, second);
    persistNowMock
      .mockRejectedValueOnce(new Error('temporary persistence failure'))
      .mockRejectedValueOnce(new Error('still unavailable'))
      .mockResolvedValueOnce(undefined);

    admit(second, 'challenge-2', [{ id: sectionAId, uri: 'https://example.com/original-a' }]);
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(persistNowMock).toHaveBeenCalledTimes(1);
    expect(persistNowMock).toHaveBeenNthCalledWith(1, second);
    expect(
      getBlockRoomIntentChanges({ documentType: 'page', entityId, locale: 'ko', sourceLocale: 'ko' }),
    ).toHaveLength(1);
    expect(connection().recoverySnapshot).not.toBeNull();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1_999);
    });
    expect(persistNowMock).toHaveBeenCalledTimes(1);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1);
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(persistNowMock).toHaveBeenCalledTimes(2);
    expect(persistNowMock).toHaveBeenNthCalledWith(2, second);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(3_999);
    });
    expect(persistNowMock).toHaveBeenCalledTimes(2);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1);
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(persistNowMock).toHaveBeenCalledTimes(3);
    expect(persistNowMock).toHaveBeenNthCalledWith(3, second);
    expect(
      getBlockRoomIntentChanges({ documentType: 'page', entityId, locale: 'ko', sourceLocale: 'ko' }),
    ).toHaveLength(1);
    expect(connection().recoverySnapshot).not.toBeNull();

    sendPersisted(second, Y.encodeStateVector(second.configuration.document), persistedTransaction.current());
    expect(
      getBlockRoomIntentChanges({ documentType: 'page', entityId, locale: 'ko', sourceLocale: 'ko' }),
    ).toHaveLength(0);
    expect(connection().recoverySnapshot).toBeNull();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(60_000);
    });
    expect(persistNowMock).toHaveBeenCalledTimes(3);
    persistedTransaction.stop();
  });

  it('cancels a replay persistence retry when its resident identity is replaced', async () => {
    vi.useFakeTimers();
    await render();
    const first = providerState.instances[0]!;
    admit(first, 'challenge-1', [{ id: sectionAId, uri: 'https://example.com/original-a' }]);
    createBlockRoomPageSectionsController(first.configuration.document, 'ko').update(sectionAId, {
      props: { url: 'https://example.com/local-a' },
    });

    act(() => connection().reloadCanonical());
    await act(async () => Promise.resolve());
    const second = providerState.instances[1]!;
    persistNowMock.mockRejectedValueOnce(new Error('temporary persistence failure'));
    admit(second, 'challenge-2', [{ id: sectionAId, uri: 'https://example.com/original-a' }]);
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(persistNowMock).toHaveBeenCalledTimes(1);

    await act(async () => {
      root?.render(<TestHarness locale="ja" />);
      await Promise.resolve();
    });
    const japaneseProvider = providerState.instances[2]!;
    expect(japaneseProvider.configuration.name).toBe(`page:${entityId}:ja`);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(60_000);
    });
    expect(persistNowMock).toHaveBeenCalledTimes(1);
    expect(persistNowMock).toHaveBeenCalledWith(second);
  });

  it('stops replay persistence retries after terminal authentication failure', async () => {
    vi.useFakeTimers();
    await render();
    const first = providerState.instances[0]!;
    admit(first, 'challenge-1', [{ id: sectionAId, uri: 'https://example.com/original-a' }]);
    createBlockRoomPageSectionsController(first.configuration.document, 'ko').update(sectionAId, {
      props: { url: 'https://example.com/local-a' },
    });

    act(() => connection().reloadCanonical());
    await act(async () => Promise.resolve());
    const second = providerState.instances[1]!;
    persistNowMock.mockRejectedValueOnce(new Error('temporary persistence failure'));
    admit(second, 'challenge-2', [{ id: sectionAId, uri: 'https://example.com/original-a' }]);
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(persistNowMock).toHaveBeenCalledTimes(1);

    act(() => second.configuration.onAuthenticationFailed?.({ reason: 'session_expired' }));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(60_000);
    });
    expect(persistNowMock).toHaveBeenCalledTimes(1);
    expect(persistNowMock).toHaveBeenCalledWith(second);
  });

  it('keeps an intent the replacement room holds but has not persisted until room.persisted covers it', async () => {
    await render();
    const first = providerState.instances[0]!;
    admit(first, 'challenge-1', [{ id: sectionAId, uri: 'https://example.com/original-a' }]);
    const persistedTransaction = observeLocalDeleteSets(first.configuration.document, first);
    const controller = createBlockRoomPageSectionsController(first.configuration.document, 'ko');
    controller.update(sectionAId, { props: { url: 'https://example.com/unpersisted-a' } });
    const scope = { documentType: 'page', entityId, locale: 'ko', sourceLocale: 'ko' } as const;
    expect(getBlockRoomIntentChanges(scope)).toHaveLength(1);

    act(() => connection().reloadCanonical());
    await act(async () => Promise.resolve());
    const second = providerState.instances[1]!;
    // The resident room received the edit, but its save failed: bootstrap carries it unpersisted.
    const residentUpdate = Y.encodeStateAsUpdate(first.configuration.document);
    const payload = JSON.parse(bootstrapMessage('challenge-2').payload);
    payload.document = toJson(
      LocalizedPageDocumentSchema,
      materializeCanonicalBlockRoom(first.configuration.document, 'page') as LocalizedPageDocument,
    );
    payload.yjsBootstrapUpdate = Buffer.from(residentUpdate).toString('base64');
    act(() => second.configuration.onStateless?.({ payload: JSON.stringify(payload) }));
    syncBootstrap(second, { update: residentUpdate, payload: JSON.stringify(payload) });
    sendReady(second, 'challenge-2');

    expect(getBlockRoomIntentChanges(scope)).toHaveLength(1);
    expect(persistNowMock).toHaveBeenCalledWith(second);
    expect(connection().recoverySnapshot).not.toBeNull();

    sendPersisted(second, Y.encodeStateVector(second.configuration.document), persistedTransaction.current());
    expect(getBlockRoomIntentChanges(scope)).toHaveLength(0);
    persistedTransaction.stop();
  });

  it('keeps a held, unpersisted intent next to the replay intent of edits the room never received', async () => {
    await render();
    const first = providerState.instances[0]!;
    admit(first, 'challenge-1', [
      { id: sectionAId, uri: 'https://example.com/original-a' },
      { id: sectionBId, uri: 'https://example.com/original-b' },
    ]);
    const controller = createBlockRoomPageSectionsController(first.configuration.document, 'ko');
    controller.update(sectionAId, { props: { url: 'https://example.com/held-a' } });
    // The provider sends the first edit; the resident room receives it but never persists it.
    // The second edit never leaves the tab.
    first.flushPendingUpdates();
    const residentUpdate = Y.encodeStateAsUpdate(first.configuration.document);
    controller.update(sectionBId, { props: { url: 'https://example.com/unsent-b' } });
    const scope = { documentType: 'page', entityId, locale: 'ko', sourceLocale: 'ko' } as const;
    expect(getBlockRoomIntentChanges(scope)).toHaveLength(2);

    act(() => connection().reloadCanonical());
    await act(async () => Promise.resolve());
    const second = providerState.instances[1]!;
    const resident = new Y.Doc();
    Y.applyUpdate(resident, residentUpdate);
    const payload = JSON.parse(bootstrapMessage('challenge-2').payload);
    payload.document = toJson(
      LocalizedPageDocumentSchema,
      materializeCanonicalBlockRoom(resident, 'page') as LocalizedPageDocument,
    );
    resident.destroy();
    payload.yjsBootstrapUpdate = Buffer.from(residentUpdate).toString('base64');
    act(() => second.configuration.onStateless?.({ payload: JSON.stringify(payload) }));
    syncBootstrap(second, { update: residentUpdate, payload: JSON.stringify(payload) });
    sendReady(second, 'challenge-2');

    const retained = getBlockRoomIntentChanges(scope);
    const sectionUri = (change: (typeof retained)[number], id: string) =>
      (change.after.baseNodes.find((node) => node.id === id)?.payload as { props?: { uri?: string } } | undefined)
        ?.props?.uri;
    expect(retained).toHaveLength(2);
    expect(sectionUri(retained[0]!, sectionAId)).toBe('https://example.com/held-a');
    expect(sectionUri(retained[1]!, sectionBId)).toBe('https://example.com/unsent-b');
    expect(persistNowMock).toHaveBeenCalledWith(second);
  });

  it('never replays held text again when a later rebuild finds the same room', async () => {
    await render();
    const first = providerState.instances[0]!;
    admit(first, 'challenge-1', [], 'x');
    const text = () =>
      getBlockRoomCollaborativeText(first.configuration.document, {
        id: richTextBlockId,
        family: 'rich_text',
        locale: true,
        path: 'content[0].text.text',
      });
    first.configuration.document.transact(() => {
      text().delete(0, 1);
      text().insert(0, 'a');
    });
    first.flushPendingUpdates();
    const heldUpdate = Y.encodeStateAsUpdate(first.configuration.document);
    first.configuration.document.transact(() => {
      text().delete(0, 1);
      text().insert(0, 'b');
    });
    expect(canonicalPageParagraphText(first.configuration.document)).toBe('b');

    const rebuildFrom = (instance: (typeof providerState.instances)[number], challenge: string, update: Uint8Array) => {
      const resident = new Y.Doc();
      Y.applyUpdate(resident, update);
      const payload = JSON.parse(bootstrapMessage(challenge).payload);
      payload.document = toJson(
        LocalizedPageDocumentSchema,
        materializeCanonicalBlockRoom(resident, 'page') as LocalizedPageDocument,
      );
      resident.destroy();
      payload.yjsBootstrapUpdate = Buffer.from(update).toString('base64');
      act(() => instance.configuration.onStateless?.({ payload: JSON.stringify(payload) }));
      syncBootstrap(instance, { update, payload: JSON.stringify(payload) });
      sendReady(instance, challenge);
    };

    act(() => connection().reloadCanonical());
    await act(async () => Promise.resolve());
    const second = providerState.instances[1]!;
    rebuildFrom(second, 'challenge-2', heldUpdate);
    expect(canonicalPageParagraphText(second.configuration.document)).toBe('b');

    // The room keeps both edits unpersisted; the next rebuild must not apply the text again.
    act(() => connection().reloadCanonical());
    await act(async () => Promise.resolve());
    const third = providerState.instances[2]!;
    rebuildFrom(third, 'challenge-3', Y.encodeStateAsUpdate(second.configuration.document));
    expect(canonicalPageParagraphText(third.configuration.document)).toBe('b');
  });

  it('seals intents before every document send, including untyped sync replies, but not awareness', async () => {
    await render();
    const first = providerState.instances[0]!;
    admit(first, 'challenge-1', [{ id: sectionAId, uri: 'https://example.com/original-a' }]);
    const controller = createBlockRoomPageSectionsController(first.configuration.document, 'ko');
    const scope = { documentType: 'page', entityId, locale: 'ko', sourceLocale: 'ko' } as const;
    const outgoing = (message: { type?: number }) => {
      for (const listener of first.listeners.get('outgoingMessage') ?? []) {
        listener({ message });
      }
    };
    controller.update(sectionAId, { props: { url: 'https://example.com/one' } });
    outgoing({ type: 1 });
    controller.update(sectionAId, { props: { url: 'https://example.com/two' } });
    expect(getBlockRoomIntentChanges(scope)).toHaveLength(1);
    // A sync step 2 reply after reconnect is sent untyped and carries the document state.
    outgoing({});
    controller.update(sectionAId, { props: { url: 'https://example.com/three' } });
    expect(getBlockRoomIntentChanges(scope)).toHaveLength(2);
  });

  it('skips replay when the local body intent was acknowledged before canonical reload', async () => {
    await render();
    const first = providerState.instances[0]!;
    admit(first, 'challenge-1', [{ id: sectionAId, uri: 'https://example.com/original-a' }]);
    const persistedTransaction = observeLocalDeleteSets(first.configuration.document, first);
    const controller = createBlockRoomPageSectionsController(first.configuration.document, 'ko');
    controller.update(sectionAId, { props: { url: 'https://example.com/durable-a' } });
    sendPersisted(first, Y.encodeStateVector(first.configuration.document), persistedTransaction.current());
    expect(connection().recoverySnapshot).toBeNull();

    act(() => connection().reloadCanonical());
    await act(async () => Promise.resolve());
    const second = providerState.instances[1]!;
    admit(second, 'challenge-2', [{ id: sectionAId, uri: 'https://example.com/durable-a' }]);

    expect(decodeCanonicalBlockRoom(second.configuration.document, 'page').baseNodes[0]?.payload).toMatchObject({
      props: { uri: 'https://example.com/durable-a' },
    });
    expect(connection().recoverySnapshot).toBeNull();
    expect(persistNowMock).not.toHaveBeenCalled();
    persistedTransaction.stop();
  });

  it('opens a fresh tokenless resident on an epoch mismatch', async () => {
    await render();
    const first = providerState.instances[0]!;
    const firstDoc = first.configuration.document;
    const destroyDoc = vi.spyOn(firstDoc, 'destroy');
    admit(first);
    firstDoc.getText('recovery-note').insert(0, 'auth reload draft');
    expect(first.configuration.token).toBe('challenge-1');

    act(() =>
      first.configuration.onStateless?.({
        payload: JSON.stringify({ v: 3, kind: 'room.reload', reloadReason: 'epoch_mismatch' }),
      }),
    );
    await act(async () => Promise.resolve());

    expect(first.disconnect).toHaveBeenCalled();
    expect(first.destroy).not.toHaveBeenCalled();
    expect(destroyDoc).not.toHaveBeenCalled();
    expect(providerState.instances).toHaveLength(2);
    expect(connection().recoverySnapshot).toMatchObject({ documentType: 'page', entityId, locale: 'ko' });
    expect(connection().doc).toBe(first.configuration.document);
    expect(providerState.instances[1]!.configuration.token).toBeUndefined();
    const replayed = new Y.Doc();
    Y.applyUpdate(replayed, connection().recoverySnapshot!.yjsUpdate);
    expect(replayed.getText('recovery-note').toString()).toBe('auth reload draft');
    replayed.destroy();
  });

  it('leaves non-epoch authentication failures to the editor interruption handler', async () => {
    await render();
    const first = providerState.instances[0]!;

    act(() => first.configuration.onAuthenticationFailed?.({ reason: 'session_expired' }));
    await act(async () => Promise.resolve());

    expect(first.destroy).not.toHaveBeenCalled();
    expect(providerState.instances).toHaveLength(1);
  });

  it('keeps the ready document until an explicit canonical reload admits its replacement', async () => {
    await render();
    const first = providerState.instances[0]!;
    const destroyDoc = vi.spyOn(first.configuration.document, 'destroy');
    admit(first);
    expect(connection().doc).toBe(first.configuration.document);

    act(() => connection().reloadCanonical());
    await act(async () => Promise.resolve());

    expect(connection().doc).toBe(first.configuration.document);
    expect(first.disconnect).toHaveBeenCalled();
    expect(first.destroy).not.toHaveBeenCalled();
    expect(destroyDoc).not.toHaveBeenCalled();
    expect(providerState.instances).toHaveLength(2);
    expect(connection().recoverySnapshot).toMatchObject({ documentType: 'page', entityId, locale: 'ko' });
  });

  it('never exposes the previous locale resident during a locale prop transition', async () => {
    await render();
    const first = providerState.instances[0]!;
    admit(first);
    first.configuration.document.getText('recovery-note').insert(0, 'local draft');
    act(() => connection().reloadCanonical());
    await act(async () => Promise.resolve());
    expect(connection().recoverySnapshot).not.toBeNull();

    const refreshed = providerState.instances[1]!;
    admit(refreshed);
    expect(connection().doc).toBe(refreshed.configuration.document);

    await act(async () => {
      root?.render(<TestHarness locale="ja" />);
      await Promise.resolve();
    });

    const firstJapaneseRender = renderSnapshots.find((snapshot) => snapshot.locale === 'ja');
    expect(firstJapaneseRender?.connection).toMatchObject({
      provider: null,
      doc: null,
      recoverySnapshot: null,
      isConnected: false,
      isSynced: false,
      isLoading: true,
    });
    expect(providerState.instances.at(-1)?.configuration.name).toBe(`page:${entityId}:ja`);
    expect(connection().doc).toBeNull();
    expect(connection().recoverySnapshot).toBeNull();
  });

  it('does not expose an entity recovery snapshot after switching entities', async () => {
    await render();
    const first = providerState.instances[0]!;
    admit(first);
    first.configuration.document.getText('recovery-note').insert(0, 'local draft');
    act(() => connection().reloadCanonical());
    await act(async () => Promise.resolve());
    expect(connection().recoverySnapshot).not.toBeNull();

    await act(async () => {
      root?.render(<TestHarness id="33333333-3333-4333-8333-333333333333" />);
      await Promise.resolve();
    });

    expect(connection().recoverySnapshot).toBeNull();
    expect(connection().doc).toBeNull();
  });

  it('accepts an ACK only for the current room locale and updates its server revisions', async () => {
    await render();
    const first = providerState.instances[0]!;
    admit(first);

    let accepted = false;
    act(() => {
      accepted = connection().acceptEpochAck({
        documentRevision: '44444444-4444-4444-8444-444444444444',
        changed: true,
        sourceChanged: true,
        changedLocales: ['ko'],
        locale: 'ko',
        metadataUpdate: { sequence: 1 },
      });
    });
    expect(accepted).toBe(true);
    expect(connection().bootstrap).toMatchObject({
      documentRevision: '44444444-4444-4444-8444-444444444444',
    });

    act(() => {
      accepted = connection().acceptEpochAck({
        documentRevision: '55555555-5555-4555-8555-555555555555',
        changed: true,
        sourceChanged: false,
        changedLocales: ['ja'],
        locale: 'ja',
        metadataUpdate: { sequence: 1 },
      });
    });
    expect(accepted).toBe(false);
    expect(connection().doc).toBe(first.configuration.document);
  });

  it('rejects a target revision on every source room, including Page', async () => {
    await render();
    const first = providerState.instances[0]!;
    admit(first);

    let accepted = true;
    act(() => {
      accepted = connection().acceptEpochAck({
        documentRevision: '44444444-4444-4444-8444-444444444444',
        targetRevision: `tr1_${'A'.repeat(43)}`,
        changed: true,
        sourceChanged: false,
        changedLocales: ['ko'],
        locale: 'ko',
        metadataUpdate: { sequence: 1 },
      });
    });

    expect(accepted).toBe(false);
    expect(connection().doc).toBe(first.configuration.document);
  });

  it('fails closed on a non-UUID entity', async () => {
    await render('legacy-page-id');
    expect(providerState.instances).toHaveLength(0);
    expect(connection().error?.message).toMatch(/must be a UUID/u);
  });
});

it('sends the SSR revision and body digest as connection parameters and admits the omitted body', async () => {
  const bootstrap = bootstrapMessage();
  const message = JSON.parse(bootstrap.payload);
  const snapshot: EditorSnapshot = {
    document: fromJson(LocalizedPageDocumentSchema, message.document),
    locale: 'ko',
    sourceLocale: 'ko',
    localeExists: true,
    documentRevision: message.documentRevision,
    editable: true,
    title: '',
    summary: '',
  };
  await render(entityId, snapshot);
  const resident = providerState.instances[0]!;
  const query = new URL(resident.configuration.url).searchParams;
  expect(query.get('knownDocumentRevision')).toBe(message.documentRevision);
  expect(query.get('knownDocumentDigest')).toBe(
    documentBodyDigest(toBinary(LocalizedPageDocumentSchema, snapshot.document as LocalizedPageDocument)),
  );
  expect(resident.configuration).toMatchObject({ flushDelay: 250 });
  delete message.document;
  act(() => resident.configuration.onStateless?.({ payload: JSON.stringify(message) }));
  syncBootstrap(resident, bootstrap);
  sendReady(resident);
  await act(async () => Promise.resolve());
  expect(connection().bootstrap?.document).toBe(snapshot.document);
  expect(connection().isSynced).toBe(true);
});

it('stops offering the SSR body after collab omitted a body that did not match it', async () => {
  const message = JSON.parse(bootstrapMessage('challenge-1', [], 'resident edit').payload);
  const snapshot: EditorSnapshot = {
    document: fromJson(LocalizedPageDocumentSchema, JSON.parse(bootstrapMessage().payload).document),
    locale: 'ko',
    sourceLocale: 'ko',
    localeExists: true,
    documentRevision: message.documentRevision,
    editable: true,
    title: '',
    summary: '',
  };
  await render(entityId, snapshot);
  const first = providerState.instances[0]!;
  expect(first.configuration.url).toContain('knownDocumentDigest=');
  delete message.document;
  act(() => first.configuration.onStateless?.({ payload: JSON.stringify(message) }));
  await act(async () => Promise.resolve());
  expect(providerState.instances).toHaveLength(2);
  expect(providerState.instances[1]!.configuration.url).not.toContain('knownDocument');
});

it.each(['permission_revoked', 'session_expired'] as const)(
  'keeps local intent and reports offline on access end: %s',
  async (reason) => {
    await render();
    const resident = providerState.instances[0]!;
    admit(resident, 'challenge-1', [{ id: sectionAId, uri: 'https://example.com/original' }]);
    await act(async () => Promise.resolve());
    const controller = createBlockRoomPageSectionsController(resident.configuration.document, 'ko');
    controller.update(sectionAId, { props: { url: 'https://example.com/local' } });
    const scope = { documentType: 'page' as const, entityId, locale: 'ko', sourceLocale: 'ko' };
    const intent = getBlockRoomIntentChanges(scope);
    expect(intent).toHaveLength(1);
    act(() =>
      resident.configuration.onStateless?.({ payload: JSON.stringify({ v: 3, kind: 'room.access_ended', reason }) }),
    );
    expect(connection()).toMatchObject({ isConnected: false, isSynced: false, error: new Error(reason) });
    expect(getEditorRoomPhase(`page:${entityId}`)).toBe('offline');
    expect(getProviderAccessEnded(resident)).toBe(reason);
    expect(getBlockRoomIntentChanges(scope)).toEqual(intent);
    act(() => window.dispatchEvent(new Event('online')));
    expect(resident.connect).not.toHaveBeenCalled();
    expect(providerState.instances).toHaveLength(1);
  },
);

function sendAccess(instance: (typeof providerState.instances)[number], access: 'view' | 'edit') {
  act(() =>
    instance.configuration.onStateless?.({ payload: JSON.stringify({ v: 3, kind: 'room.access_changed', access }) }),
  );
}

function emitProviderEvent(instance: (typeof providerState.instances)[number], event: string) {
  act(() => {
    for (const listener of [...(instance.listeners.get(event) ?? [])]) {
      listener({});
    }
  });
}

it.each(['permission_revoked', 'session_expired'] as const)(
  'stops retrying and keeps local intent when a readmission is refused: %s',
  async (reason) => {
    await render();
    const resident = providerState.instances[0]!;
    admit(resident, 'challenge-1', [{ id: sectionAId, uri: 'https://example.com/original' }]);
    await act(async () => Promise.resolve());
    createBlockRoomPageSectionsController(resident.configuration.document, 'ko').update(sectionAId, {
      props: { url: 'https://example.com/local' },
    });
    const scope = { documentType: 'page' as const, entityId, locale: 'ko', sourceLocale: 'ko' };
    const intent = getBlockRoomIntentChanges(scope);
    act(() => resident.configuration.onAuthenticationFailed?.({ reason }));
    expect(resident.disconnect).toHaveBeenCalled();
    expect(getProviderAccessEnded(resident)).toBe(reason);
    expect(getEditorRoomPhase(`page:${entityId}`)).toBe('offline');
    expect(getBlockRoomIntentChanges(scope)).toEqual(intent);
    act(() => window.dispatchEvent(new Event('online')));
    expect(resident.connect).not.toHaveBeenCalled();
  },
);

it('readmits the open room once its socket has closed when edit access is granted', async () => {
  await render();
  const resident = providerState.instances[0]!;
  admit(resident);
  sendAccess(resident, 'view');
  expect(getProviderAccessLevel(resident)).toBe('view');

  sendAccess(resident, 'edit');
  expect(getProviderAccessLevel(resident)).toBe('edit');
  expect(resident.disconnect).toHaveBeenCalledOnce();
  // connect() before the close event would be a no-op on the still-open socket.
  expect(resident.connect).not.toHaveBeenCalled();
  emitProviderEvent(resident, 'disconnect');
  expect(resident.connect).toHaveBeenCalledOnce();
  emitProviderEvent(resident, 'disconnect');
  expect(resident.connect).toHaveBeenCalledOnce();
});

it('drops a pending readmission when access ends before the socket closes', async () => {
  await render();
  const resident = providerState.instances[0]!;
  admit(resident);
  sendAccess(resident, 'view');
  sendAccess(resident, 'edit');
  act(() =>
    resident.configuration.onStateless?.({
      payload: JSON.stringify({ v: 3, kind: 'room.access_ended', reason: 'permission_revoked' }),
    }),
  );
  emitProviderEvent(resident, 'disconnect');
  expect(resident.connect).not.toHaveBeenCalled();
});

it('reports an access change made while the provider was replaced', async () => {
  const changes: Array<{ access: string; provider: object; changed: boolean }> = [];
  const unsubscribe = subscribeToProviderAccessLevel((access, provider, changed) =>
    changes.push({ access, provider, changed }),
  );
  try {
    await render();
    const first = providerState.instances[0]!;
    sendAccess(first, 'view');
    admit(first);
    expect(changes).toEqual([{ access: 'view', provider: first, changed: false }]);

    act(() => connection().reloadCanonical());
    await act(async () => Promise.resolve());
    const second = providerState.instances[1]!;
    // The replacement starts at `edit`; the room's previous level makes this an upgrade.
    sendAccess(second, 'edit');
    expect(changes.at(-1)).toEqual({ access: 'edit', provider: second, changed: true });
    sendAccess(second, 'edit');
    expect(changes).toHaveLength(2);
  } finally {
    unsubscribe();
  }
});

it('replays parked intents once the refreshed snapshot reports the room editable', async () => {
  const bootstrap = bootstrapMessage('challenge-1', [{ id: sectionAId, uri: 'https://example.com/original-a' }]);
  const message = JSON.parse(bootstrap.payload);
  const snapshot = (editable: boolean): EditorSnapshot => ({
    document: fromJson(LocalizedPageDocumentSchema, message.document),
    locale: 'ko',
    sourceLocale: 'ko',
    localeExists: true,
    documentRevision: message.documentRevision,
    editable,
    title: '',
    summary: '',
  });
  await render(entityId, snapshot(false));
  const first = providerState.instances[0]!;
  admit(first, 'challenge-1', [{ id: sectionAId, uri: 'https://example.com/original-a' }]);
  createBlockRoomPageSectionsController(first.configuration.document, 'ko').update(sectionAId, {
    props: { url: 'https://example.com/local-a' },
  });

  act(() => connection().reloadCanonical());
  await act(async () => Promise.resolve());
  const second = providerState.instances[1]!;
  admit(second, 'challenge-2', [{ id: sectionAId, uri: 'https://example.com/original-a' }]);
  await act(async () => Promise.resolve());
  expect(persistNowMock).not.toHaveBeenCalled();

  await act(async () => {
    root?.render(<TestHarness id={entityId} snapshot={snapshot(true)} />);
    await Promise.resolve();
  });
  expect(persistNowMock).toHaveBeenCalledWith(second);
  expect(
    decodeCanonicalBlockRoom(second.configuration.document, 'page').baseNodes.find(({ id }) => id === sectionAId)
      ?.payload,
  ).toMatchObject({ props: { uri: 'https://example.com/local-a' } });
});

it('settles outstanding room requests when a readmission is refused', async () => {
  await render();
  const resident = providerState.instances[0]!;
  admit(resident);
  // The resident's protocol client; the public connection exposes only its transport.
  const protocol = connection().protocol as unknown as BlockRoomProtocolClient;
  const destroy = vi.spyOn(protocol, 'destroy');
  act(() => resident.configuration.onAuthenticationFailed?.({ reason: 'permission_revoked' }));
  expect(destroy).toHaveBeenCalled();
  // Later room messages no longer change access.
  sendAccess(resident, 'view');
  expect(getProviderAccessLevel(resident)).toBe('edit');
});

it('ends access for the retained resident when its replacement is refused during a rebuild', async () => {
  await render();
  const first = providerState.instances[0]!;
  admit(first);
  act(() => connection().reloadCanonical());
  await act(async () => Promise.resolve());
  const second = providerState.instances[1]!;
  expect(connection().provider).toBe(first);
  act(() => second.configuration.onAuthenticationFailed?.({ reason: 'session_expired' }));
  expect(getProviderAccessEnded(second)).toBe('session_expired');
  expect(getProviderAccessEnded(first)).toBe('session_expired');
});

it.each(['reloadCanonical', 'room.reload'] as const)(
  'opens a locale switched in the same batch as a %s fresh, without the previous room',
  async (trigger) => {
    await render();
    const korean = providerState.instances[0]!;
    admit(korean);
    await act(async () => {
      if (trigger === 'reloadCanonical') {
        connection().reloadCanonical();
      } else {
        korean.configuration.onStateless?.({
          payload: JSON.stringify({ v: 3, kind: 'room.reload', reloadReason: 'external_update' }),
        });
      }
      root?.render(<TestHarness id={entityId} locale="ja" />);
      await Promise.resolve();
    });
    const japanese = providerState.instances.at(-1)!;
    expect(japanese.configuration.name).toContain(':ja');
    expect(korean.destroy).toHaveBeenCalled();
    expect(connection().provider).not.toBe(korean);
    expect(connection().doc).not.toBe(korean.configuration.document);

    act(() => japanese.configuration.onAuthenticationFailed?.({ reason: 'permission_revoked' }));
    expect(getProviderAccessEnded(japanese)).toBe('permission_revoked');
    expect(getProviderAccessEnded(korean)).toBeUndefined();
  },
);

it.each(['service_stopping', 'authorization_unavailable'])(
  'keeps the resident room and retries a temporarily refused readmission: %s',
  async (reason) => {
    vi.useFakeTimers();
    await render();
    const resident = providerState.instances[0]!;
    admit(resident);
    act(() => resident.configuration.onAuthenticationFailed?.({ reason }));
    expect(getProviderAccessEnded(resident)).toBeUndefined();
    expect(connection().error).toBeNull();
    expect(connection().doc).toBe(resident.configuration.document);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1_000);
    });
    expect(resident.disconnect).toHaveBeenCalledOnce();
    emitProviderEvent(resident, 'disconnect');
    expect(resident.connect).toHaveBeenCalledOnce();
  },
);
