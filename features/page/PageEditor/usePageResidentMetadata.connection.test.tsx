// @vitest-environment jsdom

import { act } from 'react';
import { usePageResidentMetadata } from './usePageResidentMetadata';
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
import { useBlockRoomConnection } from '@/lib/collab/useBlockRoomConnection';

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
let residentMetadata: ReturnType<typeof usePageResidentMetadata> | null = null;

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
      protocolVersion: 2,
      bootstrapChallenge: challenge,
      documentName: `page:${entityId}:ko`,
      documentType: 'page',
      document: toJson(LocalizedPageDocumentSchema, typed),
      documentRevision: 'b67328c4-668c-5bf2-8f1e-41465149ded6',
      sourceLocale: 'ko',
      locale: 'ko',
      localeExists: true,
      presentLocaleValues: [],
      sourceMetadata: { locale: 'ko', title: 'original', summary: 'original summary' },
      localeMetadata: { locale: 'ko', title: 'original', summary: 'original summary' },
      blockCatalogFingerprint: contentBlockCatalogFingerprint,
      serverInstanceId: 'collab-1',
      roomEpoch: 'bdac72af-8a24-4214-999d-83727445cbd7',
      yjsBootstrapUpdate: Buffer.from(update).toString('base64'),
    }),
  };
}

function TestHarness({ id = entityId, locale = 'ko' }: { id?: string; locale?: string | null }) {
  latestHook = useBlockRoomConnection('page', id, locale);
  residentMetadata = usePageResidentMetadata({
    roomIdentity: latestHook.provider,
    sessionLocale: locale,
    roomLocale: locale,
    bootstrap: latestHook.bootstrap,
    fallbackTitle: 'original',
    fallbackSummary: 'original summary',
  });
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
        protocolVersion: 2,
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
});

afterEach(() => {
  act(() => root?.unmount());
  container?.remove();
  root = null;
  container = null;
});

function metadata() {
  if (!residentMetadata) {
    throw new Error('Page metadata is unavailable');
  }
  return residentMetadata;
}

describe('Page metadata through the resident room ACK boundary', () => {
  it('keeps accepted and newer draft fields through real epoch acknowledgements', async () => {
    await render();
    admit();
    expect(metadata().title).toBe('original');
    const residentProvider = connection().provider;

    act(() => metadata().setTitle('saved new title'));
    act(() => {
      expect(
        connection().acceptEpochAck({
          documentRevision: 'e5309d1c-58bb-4d67-a5ba-6d6ed0973060',
          changed: true,
          sourceChanged: true,
          changedLocales: ['ko'],
          locale: 'ko',
        }),
      ).toBe(true);
    });
    expect(connection().provider).toBe(residentProvider);
    expect(connection().bootstrap?.localeMetadata?.title).toBe('original');
    expect(metadata().title).toBe('saved new title');

    act(() => {
      metadata().setTitle('newer pending title');
      metadata().setSummary('newer pending summary');
    });
    act(() => {
      expect(
        connection().acceptEpochAck({
          documentRevision: 'a30e359f-e0f3-467c-b5eb-cd5ef1a1bfbc',
          changed: true,
          sourceChanged: true,
          changedLocales: ['ko'],
          locale: 'ko',
        }),
      ).toBe(true);
    });
    expect(metadata()).toMatchObject({
      title: 'newer pending title',
      summary: 'newer pending summary',
    });
  });
});
