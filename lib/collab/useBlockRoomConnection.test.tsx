// @vitest-environment jsdom

import { act } from 'react';
import { create, toJson } from '@bufbuild/protobuf';
import {
  LocalizedPageDocumentSchema,
  type LocalizedPageDocument,
} from '@echovisionlab/geul-proto/content/block_content_pb.ts';
import { hydrateCanonicalBlockRoom } from '@echovisionlab/geul-common/collaboration/block-room-codec';
import { contentBlockCatalogFingerprint } from '@echovisionlab/geul-proto/content/block_catalog.ts';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as Y from 'yjs';
import { attachBlockRoomLocalUndoOrigin, blockRoomUndoDepth, undoBlockRoom } from './interactive-mutation-undo';
import { useBlockRoomConnection } from './useBlockRoomConnection';

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
    sendStateless: ReturnType<typeof vi.fn>;
    setConfiguration: ReturnType<typeof vi.fn>;
  }>,
}));

vi.mock('@hocuspocus/provider', () => ({
  HocuspocusProvider: class MockHocuspocusProvider {
    readonly configuration: (typeof providerState.instances)[number]['configuration'];
    destroy = vi.fn();
    sendStateless = vi.fn();
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
let latestHook: ReturnType<typeof useBlockRoomConnection> | null = null;
let container: HTMLDivElement | null = null;
let root: Root | null = null;
const renderSnapshots: Array<{ locale: string | null; connection: ReturnType<typeof useBlockRoomConnection> }> = [];

function bootstrapMessage(challenge = 'challenge-1') {
  const typed: LocalizedPageDocument = create(LocalizedPageDocumentSchema, {
    blockCatalogFingerprint: contentBlockCatalogFingerprint,
    locale: 'ko',
    base: { nodes: [] },
    localeOverlay: { locale: 'ko', sections: [] },
  });
  const source = new Y.Doc();
  hydrateCanonicalBlockRoom(source, 'page', 'ko', typed, []);
  const update = Y.encodeStateAsUpdate(source);
  source.destroy();
  return {
    update,
    payload: JSON.stringify({
      kind: 'block_room.bootstrap',
      protocolVersion: 1,
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
      blockCatalogFingerprint: contentBlockCatalogFingerprint,
      serverInstanceId: 'collab-1',
      roomEpoch: 'bdac72af-8a24-4214-999d-83727445cbd7',
      yjsBootstrapUpdate: Buffer.from(update).toString('base64'),
    }),
  };
}

function TestHarness({ id = entityId, locale = 'ko' }: { id?: string; locale?: string | null }) {
  latestHook = useBlockRoomConnection('page', id, locale);
  renderSnapshots.push({ locale, connection: latestHook });
  return null;
}

async function render(id = entityId) {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => {
    root?.render(<TestHarness id={id} />);
    await Promise.resolve();
  });
}

function connection() {
  expect(latestHook).not.toBeNull();
  return latestHook as ReturnType<typeof useBlockRoomConnection>;
}

function sendBootstrap(instance = providerState.instances.at(-1)!, challenge = 'challenge-1') {
  const bootstrap = bootstrapMessage(challenge);
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
        kind: 'block_room.ready',
        protocolVersion: 1,
        bootstrapChallenge: challenge,
      }),
    }),
  );
}

function admit(instance = providerState.instances.at(-1)!, challenge = 'challenge-1') {
  const bootstrap = sendBootstrap(instance, challenge);
  syncBootstrap(instance, bootstrap);
  expect(instance.sendStateless).toHaveBeenCalledWith(expect.stringContaining('block_room.bootstrap_ack'));
  sendReady(instance, challenge);
}

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

beforeEach(() => {
  latestHook = null;
  providerState.instances.length = 0;
  renderSnapshots.length = 0;
});

afterEach(() => {
  act(() => root?.unmount());
  container?.remove();
  root = null;
  container = null;
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
      kind: 'block_room.bootstrap_ack',
      protocolVersion: 1,
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
        payload: JSON.stringify({ kind: 'interactive_mutation.begin', mutationId }),
      }),
    );
    document.transact(() => text.insert(0, 'committed AI edit'), resident);
    act(() =>
      resident.configuration.onStateless?.({
        payload: JSON.stringify({ kind: 'interactive_mutation.end', mutationId, outcome: 'accepted' }),
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
  });

  it('destroys the resident and opens a fresh socket on reload_required', async () => {
    await render();
    const first = providerState.instances[0]!;
    const firstDoc = first.configuration.document;
    const destroyDoc = vi.spyOn(firstDoc, 'destroy');
    admit(first);
    expect(connection().doc).toBe(firstDoc);

    act(() =>
      first.configuration.onStateless?.({
        payload: JSON.stringify({ kind: 'reload_required', reason: 'reload_required' }),
      }),
    );
    await act(async () => Promise.resolve());

    expect(first.destroy).toHaveBeenCalledOnce();
    expect(destroyDoc).toHaveBeenCalledOnce();
    expect(providerState.instances).toHaveLength(2);
    expect(connection().doc).toBeNull();
    expect(providerState.instances[1]!.configuration.token).toBeUndefined();
  });

  it('opens a fresh tokenless resident when authentication rejects a stale resume token', async () => {
    await render();
    const first = providerState.instances[0]!;
    const firstDoc = first.configuration.document;
    const destroyDoc = vi.spyOn(firstDoc, 'destroy');
    admit(first);
    expect(first.configuration.token).toBe('challenge-1');

    act(() => first.configuration.onAuthenticationFailed?.({ reason: 'reload_required' }));
    await act(async () => Promise.resolve());

    expect(first.destroy).toHaveBeenCalledOnce();
    expect(destroyDoc).toHaveBeenCalledOnce();
    expect(providerState.instances).toHaveLength(2);
    expect(connection().doc).toBeNull();
    expect(providerState.instances[1]!.configuration.token).toBeUndefined();
  });

  it('leaves non-epoch authentication failures to the editor interruption handler', async () => {
    await render();
    const first = providerState.instances[0]!;

    act(() => first.configuration.onAuthenticationFailed?.({ reason: 'session_expired' }));
    await act(async () => Promise.resolve());

    expect(first.destroy).not.toHaveBeenCalled();
    expect(providerState.instances).toHaveLength(1);
  });

  it('withdraws the ready document before an explicit canonical reload replaces its resident', async () => {
    await render();
    const first = providerState.instances[0]!;
    const destroyDoc = vi.spyOn(first.configuration.document, 'destroy');
    admit(first);
    expect(connection().doc).toBe(first.configuration.document);

    act(() => connection().reloadCanonical());
    await act(async () => Promise.resolve());

    expect(connection().doc).toBeNull();
    expect(first.destroy).toHaveBeenCalledOnce();
    expect(destroyDoc).toHaveBeenCalledOnce();
    expect(providerState.instances).toHaveLength(2);
  });

  it('never exposes the previous locale resident during a locale prop transition', async () => {
    await render();
    const first = providerState.instances[0]!;
    admit(first);
    expect(connection().doc).toBe(first.configuration.document);

    await act(async () => {
      root?.render(<TestHarness locale="ja" />);
      await Promise.resolve();
    });

    const firstJapaneseRender = renderSnapshots.find((snapshot) => snapshot.locale === 'ja');
    expect(firstJapaneseRender?.connection).toMatchObject({
      provider: null,
      doc: null,
      isConnected: false,
      isSynced: false,
      isLoading: true,
    });
    expect(providerState.instances.at(-1)?.configuration.name).toBe(`page:${entityId}:ja`);
    expect(connection().doc).toBeNull();
  });

  it('rejects pending room requests when reload_required tears down the socket', async () => {
    await render();
    const first = providerState.instances[0]!;
    admit(first);
    const pending = connection().protocol!.getSnapshot();
    const rejection = expect(pending).rejects.toThrow('Block-room WebSocket was closed.');

    act(() =>
      first.configuration.onStateless?.({
        payload: JSON.stringify({ kind: 'reload_required', reason: 'reload_required' }),
      }),
    );

    await rejection;
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
      });
    });
    expect(accepted).toBe(false);
    expect(connection().doc).toBeNull();
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
      });
    });

    expect(accepted).toBe(false);
    expect(connection().doc).toBeNull();
  });

  it('fails closed on a non-UUID entity', async () => {
    await render('legacy-page-id');
    expect(providerState.instances).toHaveLength(0);
    expect(connection().error?.message).toMatch(/must be a UUID/u);
  });
});
