// @vitest-environment jsdom

import { act, type ReactNode } from 'react';
import type { EditorRuntimeEvent } from '@echovisionlab/geul-common/collaboration/runtime-events';
import type { HocuspocusProvider } from '@hocuspocus/provider';
import type { BlockRoomDurabilityState } from '@/lib/collab/block-room-durability';
import type { BlockRoomProtocolTransport } from '@/lib/collab/block-room-protocol';
import * as Y from 'yjs';
import { MediaProcessingStatus } from '@echovisionlab/geul-proto/common/media_pb.ts';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { getFileStatusesAction } from '@/lib/actions/file';
import { hasPendingEditorSaves } from '@/lib/editor/editor-save-registry';
import { useEditorRuntimeEvents } from '@/lib/hooks/useEditorRuntimeEvents';
import { useEditorFileStatusBootstrap } from '@/lib/media/use-editor-file-status-bootstrap';
import type { EditorFileStatusSnapshot } from '@/lib/media/editor-file-status-runtime';
import { EditorRuntimeProvider, useOptionalEditorRuntimeContext } from './EditorRuntimeContext';

vi.mock('@/lib/actions/file', () => ({
  getFileStatusesAction: vi.fn(),
}));

const mockedGetFileStatusesAction = vi.mocked(getFileStatusesAction);

let host: HTMLDivElement | null = null;
let root: Root | null = null;
const documents: Y.Doc[] = [];

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function status(fileId: string): EditorFileStatusSnapshot {
  return {
    completed: true,
    failed: false,
    unavailable: false,
    url: '',
    originalUrl: '',
    waveformUrl: '',
    spectrogramUrl: '',
    thumbnailUrl: '',
    hlsUrl: `https://cdn.example.com/${fileId}.m3u8`,
    durationSeconds: 0,
    processingStatus: MediaProcessingStatus.READY,
    processingPercentage: undefined,
  };
}

const documentEntityId = '11111111-1111-4111-8111-111111111111';

function createProvider(documentName = `post:${documentEntityId}:en`) {
  const document = new Y.Doc();
  documents.push(document);
  let statelessHandler: ((input: { payload: string }) => void) | null = null;
  const provider = {
    document,
    isSynced: true,
    hasUnsyncedChanges: false,
    configuration: { name: documentName },
    on: vi.fn((event: string, handler: (input: { payload: string }) => void) => {
      if (event === 'stateless') {
        statelessHandler = handler;
      }
    }),
    off: vi.fn(),
  };

  return {
    provider: provider as unknown as HocuspocusProvider,
    emit: (event: EditorRuntimeEvent) => statelessHandler?.({ payload: JSON.stringify(event) }),
    on: provider.on,
    off: provider.off,
  };
}

function BootstrapProbe({ fileId }: { fileId: string }) {
  const state = useEditorFileStatusBootstrap({
    fileId,
    mapStatus: (snapshot) => snapshot.hlsUrl,
  });
  return <div data-file-id={fileId} data-url={state.value || ''} />;
}

function RuntimeEventProbe({ entityId, onEvent }: { entityId: string; onEvent: (event: EditorRuntimeEvent) => void }) {
  useEditorRuntimeEvents(null, onEvent, { entityType: 'post', entityId });
  return null;
}

function RuntimeContextProbe({
  onReady,
}: {
  onReady: (runtime: ReturnType<typeof useOptionalEditorRuntimeContext>) => void;
}) {
  const runtime = useOptionalEditorRuntimeContext();
  onReady(runtime);
  return null;
}

async function render(
  children: ReactNode,
  provider: HocuspocusProvider,
  entityType: 'post' | 'page' | 'menu' | 'series' | 'email_layout' = 'post',
  entityId = 'post-1',
  blockRoomProtocol?: BlockRoomProtocolTransport | null,
) {
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);

  await act(async () => {
    root?.render(
      <EditorRuntimeProvider
        provider={provider}
        entityType={entityType}
        entityId={entityId}
        blockRoomProtocol={blockRoomProtocol}
      >
        {children}
      </EditorRuntimeProvider>,
    );
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
  });
}

afterEach(() => {
  act(() => {
    root?.unmount();
  });
  host?.remove();
  root = null;
  host = null;
  documents.splice(0).forEach((document) => document.destroy());
  mockedGetFileStatusesAction.mockReset();
});

describe('EditorRuntimeProvider', () => {
  it('coalesces media bootstrap requests and duplicate file IDs into one bulk action', async () => {
    const runtimeProvider = createProvider();
    mockedGetFileStatusesAction.mockImplementation(async (fileIds) =>
      Object.fromEntries(fileIds.map((fileId) => [fileId, status(fileId)])),
    );

    await render(
      <>
        <BootstrapProbe fileId="file-a" />
        <BootstrapProbe fileId="file-b" />
        <BootstrapProbe fileId="file-a" />
      </>,
      runtimeProvider.provider,
    );
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(mockedGetFileStatusesAction).toHaveBeenCalledTimes(1);
    expect(mockedGetFileStatusesAction).toHaveBeenCalledWith(['file-a', 'file-b']);
    expect(host?.querySelectorAll('[data-url="https://cdn.example.com/file-a.m3u8"]')).toHaveLength(2);
    expect(host?.querySelectorAll('[data-url="https://cdn.example.com/file-b.m3u8"]')).toHaveLength(1);
  });

  it('uses one runtime event listener and dispatches one parsed event through subscriber filters', async () => {
    const runtimeProvider = createProvider();
    const firstListener = vi.fn();
    const secondListener = vi.fn();

    await render(
      <>
        <RuntimeEventProbe entityId="post-1" onEvent={firstListener} />
        <RuntimeEventProbe entityId="post-2" onEvent={secondListener} />
      </>,
      runtimeProvider.provider,
    );

    expect(runtimeProvider.on.mock.calls.filter(([event]) => event === 'stateless')).toHaveLength(1);

    act(() => {
      runtimeProvider.emit({
        version: 1,
        kind: 'media.processing.lifecycle',
        entityType: 'post',
        entityId: 'post-1',
        correlationId: 'job-1',
        sequence: 1,
        timestampMs: 1_700_000_000_000,
        payload: {
          fileId: 'file-a',
          status: 'processing',
          percentage: 25,
        },
      });
    });

    expect(firstListener).toHaveBeenCalledTimes(1);
    expect(secondListener).not.toHaveBeenCalled();

    act(() => {
      root?.unmount();
    });
    root = null;
    expect(runtimeProvider.off.mock.calls.filter(([event]) => event === 'stateless')).toHaveLength(1);
  });

  it('registers local provider document edits as a save for the owning entity', async () => {
    const runtimeProvider = createProvider();
    await render(null, runtimeProvider.provider);

    runtimeProvider.provider.document.getMap('content').set('title', 'Local edit');

    expect(hasPendingEditorSaves('post:post-1')).toBe(true);
  });

  it('clears block-room body intent only after a canonical persisted acknowledgement', async () => {
    const runtimeProvider = createProvider();
    const listeners = new Set<(state: BlockRoomDurabilityState) => void>();
    const protocol: BlockRoomProtocolTransport = {
      updateMetadata: vi.fn(),
      getSnapshot: vi.fn(),
      subscribePersisted: (listener: (state: BlockRoomDurabilityState) => void) => {
        listeners.add(listener);
        return () => listeners.delete(listener);
      },
    };
    await render(null, runtimeProvider.provider, 'post', 'post-1', protocol);

    const document = runtimeProvider.provider.document;
    document.getMap('content').set('body', 'Local body');
    expect(hasPendingEditorSaves('post:post-1')).toBe(true);

    listeners.forEach((listener) => listener({ stateVector: Y.encodeStateVector(document), deleted: {} }));
    expect(hasPendingEditorSaves('post:post-1')).toBe(false);
  });

  it.each(['page', 'menu', 'series', 'email_layout'] as const)(
    'leaves %s document durability to its connection save registration',
    async (entityType) => {
      const runtimeProvider = createProvider();
      await render(null, runtimeProvider.provider, entityType, 'entity-1');
      runtimeProvider.provider.document.getMap('content').set('title', 'Local edit');

      expect(hasPendingEditorSaves(`${entityType}:entity-1`)).toBe(false);
    },
  );

  it('uses the validated document snapshot for runtime series documents', async () => {
    const documentName = `post-series:${documentEntityId}:ko`;
    const runtimeProvider = createProvider(documentName);
    const revision = '22222222-2222-4222-8222-222222222222';
    const targetRevision = '33333333-3333-4333-8333-333333333333';
    const metadata = runtimeProvider.provider.document.getMap<string | boolean>('collaboration-revision');
    metadata.set('documentName', documentName);
    metadata.set('documentRevision', revision);
    metadata.set('sourceLocale', 'en');
    metadata.set('locale', 'ko');
    metadata.set('localeExists', true);
    metadata.set('targetRevision', targetRevision);

    const runtime: { current: ReturnType<typeof useOptionalEditorRuntimeContext> } = { current: null };
    await render(
      <RuntimeContextProbe onReady={(value) => (runtime.current = value)} />,
      runtimeProvider.provider,
      'series',
      documentEntityId,
    );

    expect(runtime.current).not.toBeNull();
    await expect(runtime.current!.getBlockRoomSnapshot()).resolves.toEqual({
      documentRevision: revision,
      sourceLocale: 'en',
      locale: 'ko',
      localeExists: true,
      targetRevision,
    });

    runtimeProvider.provider.document.getMap('content').set('title', 'Series edit');
    expect(hasPendingEditorSaves(`post_series:${documentEntityId}`)).toBe(false);
    expect(hasPendingEditorSaves(`series:${documentEntityId}`)).toBe(false);
  });
});
