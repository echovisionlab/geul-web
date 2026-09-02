// @vitest-environment jsdom

import { act } from 'react';
import type { EditorRuntimeEvent } from '@echovisionlab/geul-common/collaboration/runtime-events';
import { MediaProcessingStatus } from '@echovisionlab/geul-proto/common/media_pb.ts';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { getFileStatusAction } from '@/lib/actions/file';
import { useMediaProcessingRuntimeState } from './use-media-processing-runtime-state';

const runtimeEventMock = vi.hoisted(() => ({
  handler: null as ((event: EditorRuntimeEvent) => void) | null,
}));
const getFileStatusActionMock = vi.hoisted(() => vi.fn());

vi.mock('@/lib/actions/file', () => ({
  getFileStatusAction: getFileStatusActionMock,
  getFileStatusesAction: async (fileIds: string[]) =>
    Object.fromEntries(
      await Promise.all(fileIds.map(async (fileId) => [fileId, await getFileStatusActionMock(fileId)] as const)),
    ),
}));

vi.mock('@/lib/hooks/useEditorRuntimeEvents', () => ({
  useEditorRuntimeEvents: vi.fn((_provider, onEvent: (event: EditorRuntimeEvent) => void) => {
    runtimeEventMock.handler = onEvent;
  }),
}));

const mockedGetFileStatusAction = vi.mocked(getFileStatusAction);

let host: HTMLDivElement | null = null;
let root: Root | null = null;

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function RuntimeProbe(props: {
  fileId?: string;
  pendingUploadFileId?: string;
  mediaSlotId?: string;
  mediaAttemptId?: string;
  trackId?: string;
  enabled?: boolean;
}) {
  const runtimeState = useMediaProcessingRuntimeState({
    ...props,
    mapStatus: (status) => ({
      hlsUrl: status.hlsUrl,
      waveformUrl: status.waveformUrl,
      status: String(status.processingStatus),
      percentage: String(status.processingPercentage ?? ''),
    }),
  });

  return (
    <div
      data-hls-url={runtimeState.value?.hlsUrl || ''}
      data-waveform-url={runtimeState.value?.waveformUrl || ''}
      data-status={runtimeState.value?.status || ''}
      data-percentage={runtimeState.value?.percentage || ''}
      data-loading={runtimeState.isLoading ? 'true' : 'false'}
    />
  );
}

async function renderProbe(props: {
  fileId?: string;
  pendingUploadFileId?: string;
  mediaSlotId?: string;
  mediaAttemptId?: string;
  trackId?: string;
  enabled?: boolean;
}) {
  if (!host) {
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
  }

  act(() => {
    root?.render(<RuntimeProbe {...props} />);
  });

  await flushEffects();
}

async function emitRuntimeEvent(event: EditorRuntimeEvent) {
  await act(async () => {
    runtimeEventMock.handler?.(event);
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

async function flushEffects() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

function getProbeNode(): HTMLDivElement {
  const node = host?.querySelector('div');
  if (!node) {
    throw new Error('expected runtime probe to render');
  }
  return node;
}

afterEach(() => {
  act(() => {
    root?.unmount();
  });
  host?.remove();
  root = null;
  host = null;
  runtimeEventMock.handler = null;
  mockedGetFileStatusAction.mockReset();
});

describe('useMediaProcessingRuntimeState', () => {
  it('does not bootstrap file delivery from a pending upload id', async () => {
    await renderProbe({
      pendingUploadFileId: 'pending-file',
      mediaSlotId: 'slot-1',
      mediaAttemptId: 'attempt-1',
    });

    expect(mockedGetFileStatusAction).not.toHaveBeenCalled();
    expect(getProbeNode().getAttribute('data-loading')).toBe('false');
  });

  it('bootstraps backend runtime state by durable file id', async () => {
    mockedGetFileStatusAction.mockResolvedValue({
      completed: true,
      failed: false,
      unavailable: false,
      url: '',
      originalUrl: '',
      waveformUrl: 'https://cdn.example.com/waveform.json',
      spectrogramUrl: '',
      thumbnailUrl: '',
      hlsUrl: 'https://cdn.example.com/ready.m3u8',
      durationSeconds: 42,
      processingStatus: MediaProcessingStatus.READY,
      processingPercentage: undefined,
    });

    await renderProbe({ fileId: 'file-1' });

    expect(mockedGetFileStatusAction).toHaveBeenCalledWith('file-1');
    const node = getProbeNode();
    expect(node.getAttribute('data-status')).toBe(String(MediaProcessingStatus.READY));
    expect(node.getAttribute('data-hls-url')).toBe('https://cdn.example.com/ready.m3u8');
    expect(node.getAttribute('data-waveform-url')).toBe('https://cdn.example.com/waveform.json');
    expect(node.getAttribute('data-loading')).toBe('false');
  });

  it('starts processing bootstrap only after pending identity becomes a durable file id', async () => {
    mockedGetFileStatusAction.mockResolvedValue({
      completed: false,
      failed: false,
      unavailable: false,
      url: '',
      originalUrl: '',
      waveformUrl: '',
      spectrogramUrl: '',
      thumbnailUrl: '',
      hlsUrl: '',
      durationSeconds: 0,
      processingStatus: MediaProcessingStatus.PROCESSING,
      processingPercentage: 61,
    });

    await renderProbe({
      pendingUploadFileId: 'file-1',
      mediaSlotId: 'slot-1',
      mediaAttemptId: 'attempt-1',
    });

    expect(mockedGetFileStatusAction).not.toHaveBeenCalled();

    await renderProbe({ fileId: 'file-1' });

    expect(mockedGetFileStatusAction).toHaveBeenCalledWith('file-1');
    const node = getProbeNode();
    expect(node.getAttribute('data-status')).toBe(String(MediaProcessingStatus.PROCESSING));
    expect(node.getAttribute('data-percentage')).toBe('61');
    expect(node.getAttribute('data-loading')).toBe('false');
  });

  it('accepts processing events by pending slot and attempt before durable file id exists', async () => {
    await renderProbe({ mediaSlotId: 'slot-1', mediaAttemptId: 'attempt-1' });

    expect(mockedGetFileStatusAction).not.toHaveBeenCalled();

    await emitRuntimeEvent({
      version: 1,
      sequence: 1,
      kind: 'media.processing.lifecycle',
      entityType: 'post',
      entityId: 'post-1',
      timestampMs: 1_700_000_000_000,
      payload: {
        fileId: 'file-1',
        slotId: 'slot-1',
        attemptId: 'attempt-1',
        status: 'processing',
        percentage: 37,
      },
    });

    const node = getProbeNode();
    expect(node.getAttribute('data-status')).toBe(String(MediaProcessingStatus.PROCESSING));
    expect(node.getAttribute('data-percentage')).toBe('37');
  });

  it('accepts release track processing events by track id', async () => {
    await renderProbe({ trackId: 'track-1' });

    await emitRuntimeEvent({
      version: 1,
      sequence: 1,
      kind: 'media.processing.lifecycle',
      entityType: 'release',
      entityId: 'release-1',
      timestampMs: 1_700_000_000_000,
      payload: {
        fileId: 'file-1',
        trackId: 'track-1',
        status: 'processing',
        percentage: 64,
      },
    });

    const node = getProbeNode();
    expect(node.getAttribute('data-status')).toBe(String(MediaProcessingStatus.PROCESSING));
    expect(node.getAttribute('data-percentage')).toBe('64');
  });

  it('ignores stale release track processing events for another file once a file identity exists', async () => {
    mockedGetFileStatusAction.mockResolvedValue({
      completed: true,
      failed: false,
      unavailable: false,
      url: '',
      originalUrl: '',
      waveformUrl: '',
      spectrogramUrl: '',
      thumbnailUrl: '',
      hlsUrl: 'https://cdn.example.com/current.m3u8',
      durationSeconds: 120,
      processingStatus: MediaProcessingStatus.READY,
      processingPercentage: undefined,
    });

    await renderProbe({
      fileId: 'current-file',
      pendingUploadFileId: 'pending-file',
      trackId: 'track-1',
    });

    await emitRuntimeEvent({
      version: 1,
      sequence: 1,
      kind: 'media.processing.lifecycle',
      entityType: 'release',
      entityId: 'release-1',
      timestampMs: 1_700_000_000_000,
      payload: {
        fileId: 'stale-file',
        trackId: 'track-1',
        status: 'processing',
        percentage: 64,
      },
    });

    const node = getProbeNode();
    expect(node.getAttribute('data-status')).toBe(String(MediaProcessingStatus.READY));
    expect(node.getAttribute('data-hls-url')).toBe('https://cdn.example.com/current.m3u8');
    expect(node.getAttribute('data-percentage')).toBe('');
  });

  it('uses runtime ready outputs and ignores stale lower sequence updates', async () => {
    mockedGetFileStatusAction
      .mockResolvedValueOnce({
        completed: false,
        failed: false,
        unavailable: false,
        url: '',
        originalUrl: '',
        waveformUrl: '',
        spectrogramUrl: '',
        thumbnailUrl: '',
        hlsUrl: '',
        durationSeconds: 0,
        processingStatus: MediaProcessingStatus.PROCESSING,
        processingPercentage: 1,
      })
      .mockResolvedValue({
        completed: true,
        failed: false,
        unavailable: false,
        url: '',
        originalUrl: '',
        waveformUrl: 'https://cdn.example.com/fresh-waveform.json',
        spectrogramUrl: '',
        thumbnailUrl: '',
        hlsUrl: 'https://cdn.example.com/fresh.m3u8',
        durationSeconds: 0,
        processingStatus: MediaProcessingStatus.READY,
        processingPercentage: undefined,
      });

    await renderProbe({ fileId: 'file-1' });

    await emitRuntimeEvent({
      version: 1,
      sequence: 2,
      kind: 'media.processing.lifecycle',
      entityType: 'post',
      entityId: 'post-1',
      timestampMs: 1_700_000_000_100,
      payload: {
        fileId: 'file-1',
        status: 'ready',
        outputs: {
          hlsGenerationId: 'generation-fresh',
          waveformAssetId: 'asset-fresh',
        },
      },
    });

    let node = getProbeNode();
    expect(node.getAttribute('data-status')).toBe(String(MediaProcessingStatus.READY));
    expect(node.getAttribute('data-hls-url')).toBe('https://cdn.example.com/fresh.m3u8');
    expect(node.getAttribute('data-waveform-url')).toBe('https://cdn.example.com/fresh-waveform.json');

    await emitRuntimeEvent({
      version: 1,
      sequence: 1,
      kind: 'media.processing.lifecycle',
      entityType: 'post',
      entityId: 'post-1',
      timestampMs: 1_700_000_000_000,
      payload: {
        fileId: 'file-1',
        status: 'ready',
        outputs: {
          hlsGenerationId: 'generation-stale',
          waveformAssetId: 'asset-stale',
        },
      },
    });

    node = getProbeNode();
    expect(node.getAttribute('data-hls-url')).toBe('https://cdn.example.com/fresh.m3u8');
    expect(node.getAttribute('data-waveform-url')).toBe('https://cdn.example.com/fresh-waveform.json');
  });

  it('does not expose a previous file ready lookup after the identity changes', async () => {
    let fileABootstrapCount = 0;
    let resolveFileAReady: ((status: Awaited<ReturnType<typeof getFileStatusAction>>) => void) | undefined;
    mockedGetFileStatusAction.mockImplementation((requestedFileId: string) => {
      if (requestedFileId === 'file-a') {
        fileABootstrapCount += 1;
        if (fileABootstrapCount === 1) {
          return Promise.resolve({
            completed: false,
            failed: false,
            unavailable: false,
            url: '',
            originalUrl: '',
            waveformUrl: '',
            spectrogramUrl: '',
            thumbnailUrl: '',
            hlsUrl: '',
            durationSeconds: 0,
            processingStatus: MediaProcessingStatus.PROCESSING,
            processingPercentage: 10,
          });
        }
        return new Promise((resolve) => {
          resolveFileAReady = resolve;
        });
      }
      return Promise.resolve({
        completed: true,
        failed: false,
        unavailable: false,
        url: '',
        originalUrl: '',
        waveformUrl: 'https://cdn.example.com/file-b-waveform.json',
        spectrogramUrl: '',
        thumbnailUrl: '',
        hlsUrl: 'https://cdn.example.com/file-b.m3u8',
        durationSeconds: 20,
        processingStatus: MediaProcessingStatus.READY,
        processingPercentage: undefined,
      });
    });

    await renderProbe({ fileId: 'file-a' });
    await emitRuntimeEvent({
      version: 1,
      kind: 'media.processing.lifecycle',
      entityType: 'post',
      entityId: 'post-1',
      timestampMs: 1_700_000_000_000,
      payload: { fileId: 'file-a', status: 'ready' },
    });
    await renderProbe({ fileId: 'file-b' });

    let node = getProbeNode();
    expect(node.getAttribute('data-hls-url')).toBe('https://cdn.example.com/file-b.m3u8');

    if (!resolveFileAReady) {
      throw new Error('expected File A ready lookup to be pending');
    }
    resolveFileAReady({
      completed: true,
      failed: false,
      unavailable: false,
      url: '',
      originalUrl: '',
      waveformUrl: 'https://cdn.example.com/file-a-waveform.json',
      spectrogramUrl: '',
      thumbnailUrl: '',
      hlsUrl: 'https://cdn.example.com/file-a.m3u8',
      durationSeconds: 10,
      processingStatus: MediaProcessingStatus.READY,
      processingPercentage: undefined,
    });
    await flushEffects();

    node = getProbeNode();
    expect(node.getAttribute('data-hls-url')).toBe('https://cdn.example.com/file-b.m3u8');
    expect(node.getAttribute('data-waveform-url')).toBe('https://cdn.example.com/file-b-waveform.json');
  });
});
