// @vitest-environment jsdom

import { create, toJson } from '@bufbuild/protobuf';
import { hydrateCanonicalBlockRoom } from '@echovisionlab/geul-common/collaboration/block-room-codec';
import { contentBlockCatalogFingerprint } from '@echovisionlab/geul-proto/content/block_catalog.ts';
import {
  LocalizedRichTextDocumentSchema,
  RichTextProfile,
} from '@echovisionlab/geul-proto/content/block_content_pb.ts';
import { TranscodeEntityType } from '@echovisionlab/geul-proto/secure/events_pb.ts';
import { createRoot, type Root } from 'react-dom/client';
import { act, type ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import * as Y from 'yjs';
import { BlockRoomProtocolClient } from '@/lib/collab/block-room-protocol';
import { hasPendingEditorSaves } from '@/lib/editor/editor-save-registry';
import { EditorRuntimeProvider, useOptionalEditorRuntimeContext } from '@/lib/contexts/EditorRuntimeContext';
import { createHocuspocusProviderFixture } from '@/features/editor/hocuspocusProvider.test-fixture';
import type { RichTextBlockRoomTiptapController } from '@/features/editor/tiptap/block-room-tiptap-controller';
import { LocalizedCollaborativeRichTextEditor } from './LocalizedCollaborativeRichTextEditor';

const entityId = '11111111-1111-4111-8111-111111111111';
const documentName = `post:${entityId}:ko`;
const revision = '22222222-2222-4222-8222-222222222222';
const roomEpoch = '33333333-3333-4333-8333-333333333333';
const challenge = 'post-runtime-challenge';

const { observeRuntime } = vi.hoisted(() => ({ observeRuntime: vi.fn() }));

vi.mock('@/features/editor/tiptap/TiptapEditor', async () => {
  const React = await import('react');
  const { useOptionalEditorRuntimeContext } = await import('@/lib/contexts/EditorRuntimeContext');
  return {
    TiptapEditor: () => {
      observeRuntime(useOptionalEditorRuntimeContext());
      return React.createElement('div', { 'data-testid': 'localized-rich-text-surface' });
    },
  };
});
vi.mock('@/features/editor/hooks/useEntityMediaSurface', () => ({
  useEntityMediaSurface: () => ({
    dropFilesAtBlock: vi.fn(async () => false),
    dropFilesAtTarget: vi.fn(async () => false),
    insertFilesAtSavedPosition: vi.fn(async () => []),
    selectLibraryFilesAtBlock: vi.fn(() => false),
    selectLibraryFilesAtSavedPosition: vi.fn(() => false),
    externalImageProgress: null,
    mediaTiptapExtensions: [],
    uploadProgress: null,
  }),
}));
vi.mock('@/features/editor/lib/media-block-updates', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/features/editor/lib/media-block-updates')>()),
  createTiptapEditorMediaCommandPort: () => null,
}));
vi.mock('@/features/editor/components/MediaFilePanel', () => ({ MediaFilePanel: () => null }));
vi.mock('@/features/editor/components/MediaIngestDialog', () => ({ MediaIngestDialog: () => null }));
vi.mock('@/features/editor/components/MediaIngestOverlay', () => ({ MediaIngestOverlay: () => null }));
vi.mock('@/features/editor/MapInsertModal', () => ({ MapInsertModal: () => null }));
vi.mock('@/features/editor/contexts/EditorMediaIngestContext', () => ({
  EditorMediaIngestProvider: ({ children }: { children: ReactNode }) => children,
}));
vi.mock('@mantine/notifications', () => ({ notifications: { show: vi.fn() } }));
vi.mock('next-intl', () => ({ useTranslations: () => (key: string) => key }));
vi.mock('@mantine/core', () => ({
  Box: ({ children, ...props }: { children?: ReactNode }) => <div {...props}>{children}</div>,
}));

let root: Root | null = null;
let host: HTMLDivElement | null = null;
let fixture: ReturnType<typeof createHocuspocusProviderFixture> | null = null;
let protocol: BlockRoomProtocolClient | null = null;
let seedDocument: Y.Doc | null = null;
let sendStateless: ReturnType<typeof vi.fn<(payload: string) => void>> | null = null;
let onReady: ReturnType<typeof vi.fn<() => void>> | null = null;
let onReloadRequired: ReturnType<typeof vi.fn<() => void>> | null = null;

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function createBootstrapPayload() {
  const localizedDocument = create(LocalizedRichTextDocumentSchema, {
    blockCatalogFingerprint: contentBlockCatalogFingerprint,
    profile: RichTextProfile.POST,
    locale: 'ko',
    base: { nodes: [] },
    localeOverlay: { locale: 'ko', blocks: [] },
  });
  seedDocument = new Y.Doc();
  hydrateCanonicalBlockRoom(seedDocument, 'post', 'ko', localizedDocument, []);
  const update = Y.encodeStateAsUpdate(seedDocument);

  return {
    update,
    payload: JSON.stringify({
      kind: 'block_room.bootstrap',
      protocolVersion: 2,
      bootstrapChallenge: challenge,
      documentName,
      documentType: 'post',
      document: toJson(LocalizedRichTextDocumentSchema, localizedDocument),
      documentRevision: revision,
      sourceLocale: 'ko',
      locale: 'ko',
      localeExists: true,
      presentLocaleValues: [],
      sourceMetadata: { locale: 'ko' },
      documentMetadata: {},
      metadataSequence: 0,
      localeMetadata: { locale: 'ko' },
      blockCatalogFingerprint: contentBlockCatalogFingerprint,
      serverInstanceId: 'runtime-test-server',
      roomEpoch,
      yjsBootstrapUpdate: Buffer.from(update).toString('base64'),
    }),
  };
}

function persistedMessage(document: Y.Doc): string {
  const update = Y.decodeUpdate(Y.encodeStateAsUpdate(document));
  return JSON.stringify({
    kind: 'block_room.persisted',
    protocolVersion: 2,
    documentName,
    stateVector: Buffer.from(Y.encodeStateVector(document)).toString('base64'),
    deleted: Object.fromEntries(update.ds.clients),
  });
}

async function renderEditor() {
  fixture = createHocuspocusProviderFixture(documentName);
  sendStateless = vi.fn<(payload: string) => void>();
  onReady = vi.fn<() => void>();
  onReloadRequired = vi.fn<() => void>();
  protocol = new BlockRoomProtocolClient({
    documentType: 'post',
    entityId,
    locale: 'ko',
    document: fixture.provider.document,
    sendStateless,
    setResumeToken: vi.fn(),
    onBootstrap: vi.fn(),
    onReady,
    onReloadRequired,
  });
  const bootstrap = createBootstrapPayload();
  protocol.handleStateless(bootstrap.payload);
  Y.applyUpdate(fixture.provider.document, bootstrap.update);
  protocol.handleProviderSynced();
  protocol.handleStateless(
    JSON.stringify({ kind: 'block_room.ready', protocolVersion: 2, bootstrapChallenge: challenge }),
  );

  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  await act(async () => {
    root?.render(
      <EditorRuntimeProvider
        provider={fixture!.provider}
        entityType="post"
        entityId={entityId}
        blockRoomProtocol={protocol}
      >
        <LocalizedCollaborativeRichTextEditor
          provider={fixture!.provider}
          blockRoomController={{ connected: false, paragraphExternalVideo: false } as RichTextBlockRoomTiptapController}
          userName="editor"
          entityId={entityId}
          entityType={TranscodeEntityType.POST}
        />
      </EditorRuntimeProvider>,
    );
    await Promise.resolve();
  });
}

afterEach(() => {
  act(() => root?.unmount());
  host?.remove();
  root = null;
  host = null;
  protocol?.destroy();
  protocol = null;
  fixture?.destroy();
  fixture = null;
  seedDocument?.destroy();
  seedDocument = null;
  sendStateless = null;
  onReady = null;
  onReloadRequired = null;
  observeRuntime.mockClear();
});

describe('localized editor runtime inheritance', () => {
  it('uses the parent Block-room saver and clears pending unload state only on a covering ACK', async () => {
    await renderEditor();

    const runtime = observeRuntime.mock.lastCall?.[0] as ReturnType<typeof useOptionalEditorRuntimeContext> | undefined;
    expect(runtime).not.toBeNull();
    expect(runtime).toMatchObject({ provider: fixture!.provider, entityType: 'post', entityId });
    expect(onReady).toHaveBeenCalledOnce();
    expect(onReloadRequired).not.toHaveBeenCalled();

    const document = fixture!.provider.document;
    const staleStateVector = Y.encodeStateVector(document);
    document.getMap('local-authoring').set('body', 'Return and text input');
    expect(hasPendingEditorSaves(`post:${entityId}`)).toBe(true);

    protocol!.handleStateless(
      JSON.stringify({
        kind: 'block_room.persisted',
        protocolVersion: 2,
        documentName,
        stateVector: Buffer.from(staleStateVector).toString('base64'),
        deleted: {},
      }),
    );
    expect(hasPendingEditorSaves(`post:${entityId}`)).toBe(true);

    protocol!.handleStateless(persistedMessage(document));
    expect(hasPendingEditorSaves(`post:${entityId}`)).toBe(false);

    const snapshotPromise = runtime!.getBlockRoomSnapshot();
    const requestPayload = sendStateless!.mock.calls
      .map(([payload]) => JSON.parse(payload) as Record<string, unknown>)
      .find((message) => message.kind === 'block_room.snapshot');
    expect(requestPayload?.requestId).toEqual(expect.any(String));
    protocol!.handleStateless(
      JSON.stringify({
        kind: 'block_room.snapshot_result',
        protocolVersion: 2,
        requestId: requestPayload!.requestId,
        ok: true,
        snapshot: { documentRevision: revision, sourceLocale: 'ko', locale: 'ko', localeExists: true },
      }),
    );
    await expect(snapshotPromise).resolves.toEqual({
      documentRevision: revision,
      sourceLocale: 'ko',
      locale: 'ko',
      localeExists: true,
    });
  });
});
