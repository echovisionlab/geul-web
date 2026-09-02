// @vitest-environment jsdom

import { act, type ReactNode } from 'react';
import type { EditorRuntimeEvent } from '@echovisionlab/geul-common/collaboration/runtime-events';
import type { HocuspocusProvider } from '@hocuspocus/provider';
import { MediaProcessingStatus } from '@echovisionlab/geul-proto/common/media_pb.ts';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { getFileStatusesAction } from '@/lib/actions/file';
import { useEditorRuntimeEvents } from '@/lib/hooks/useEditorRuntimeEvents';
import { useEditorFileStatusBootstrap } from '@/lib/media/use-editor-file-status-bootstrap';
import type { EditorFileStatusSnapshot } from '@/lib/media/editor-file-status-runtime';
import { EditorRuntimeProvider } from './EditorRuntimeContext';

vi.mock('@/lib/actions/file', () => ({
  getFileStatusesAction: vi.fn(),
}));

const mockedGetFileStatusesAction = vi.mocked(getFileStatusesAction);

let host: HTMLDivElement | null = null;
let root: Root | null = null;

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

function createProvider() {
  let statelessHandler: ((input: { payload: string }) => void) | null = null;
  const provider = {
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

async function render(children: ReactNode, provider: HocuspocusProvider) {
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);

  await act(async () => {
    root?.render(
      <EditorRuntimeProvider provider={provider} entityType="post" entityId="post-1">
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

  it('uses one provider listener and dispatches one parsed event through subscriber filters', async () => {
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

    expect(runtimeProvider.on).toHaveBeenCalledTimes(1);

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
    expect(runtimeProvider.off).toHaveBeenCalledTimes(1);
  });
});
