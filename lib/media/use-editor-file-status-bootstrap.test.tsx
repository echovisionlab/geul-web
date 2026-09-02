// @vitest-environment jsdom

import { act } from 'react';
import { MediaProcessingStatus } from '@echovisionlab/geul-proto/common/media_pb.ts';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { getFileStatusesAction } from '@/lib/actions/file';
import type { EditorFileStatusSnapshot } from './editor-file-status-runtime';
import { useEditorFileStatusBootstrap } from './use-editor-file-status-bootstrap';

vi.mock('@/lib/actions/file', () => ({
  getFileStatusesAction: vi.fn(),
}));

const mockedGetFileStatusesAction = vi.mocked(getFileStatusesAction);

let host: HTMLDivElement | null = null;
let root: Root | null = null;

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function BootstrapProbe({ fileId, enabled = true }: { fileId?: string; enabled?: boolean }) {
  const runtimeState = useEditorFileStatusBootstrap({
    fileId,
    enabled,
    mapStatus: (status) => ({
      hlsUrl: status.hlsUrl,
      waveformUrl: status.waveformUrl,
    }),
  });

  return (
    <div
      data-hls-url={runtimeState.value?.hlsUrl || ''}
      data-waveform-url={runtimeState.value?.waveformUrl || ''}
      data-loading={runtimeState.isLoading ? 'true' : 'false'}
    />
  );
}

async function renderProbe(props: { fileId?: string; enabled?: boolean }) {
  if (!host) {
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
  }

  act(() => {
    root?.render(<BootstrapProbe {...props} />);
  });

  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

async function flushEffects() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

afterEach(() => {
  vi.useRealTimers();
  act(() => {
    root?.unmount();
  });
  host?.remove();
  root = null;
  host = null;
  mockedGetFileStatusesAction.mockReset();
});

describe('useEditorFileStatusBootstrap', () => {
  it('bootstraps fresh runtime media from fileId for completed editor blocks', async () => {
    mockedGetFileStatusesAction.mockResolvedValue({
      'file-123': {
        completed: true,
        failed: false,
        unavailable: false,
        url: 'https://cdn.example.com/original.mp3',
        originalUrl: 'https://cdn.example.com/original.mp3',
        waveformUrl: 'https://cdn.example.com/waveform.json',
        spectrogramUrl: '',
        thumbnailUrl: '',
        hlsUrl: 'https://cdn.example.com/fresh.m3u8',
        durationSeconds: 42,
        processingStatus: MediaProcessingStatus.READY,
        processingPercentage: undefined,
      },
    });

    await renderProbe({ fileId: 'file-123', enabled: true });

    expect(mockedGetFileStatusesAction).toHaveBeenCalledWith(['file-123']);
    const node = host?.querySelector('div');
    expect(node?.getAttribute('data-hls-url')).toBe('https://cdn.example.com/fresh.m3u8');
    expect(node?.getAttribute('data-waveform-url')).toBe('https://cdn.example.com/waveform.json');
    expect(node?.getAttribute('data-loading')).toBe('false');
  });

  it('skips bootstrap when runtime refresh is disabled', async () => {
    await renderProbe({ fileId: 'file-123', enabled: false });

    expect(mockedGetFileStatusesAction).not.toHaveBeenCalled();
    const node = host?.querySelector('div');
    expect(node?.getAttribute('data-hls-url')).toBe('');
    expect(node?.getAttribute('data-loading')).toBe('false');
  });

  it('passes failed file-status responses through the mapper', async () => {
    mockedGetFileStatusesAction.mockResolvedValue({
      'file-123': {
        completed: true,
        failed: true,
        unavailable: false,
        url: 'https://cdn.example.com/original.mp3',
        originalUrl: 'https://cdn.example.com/original.mp3',
        waveformUrl: 'https://cdn.example.com/waveform.json',
        spectrogramUrl: '',
        thumbnailUrl: '',
        hlsUrl: 'https://cdn.example.com/fresh.m3u8',
        durationSeconds: 42,
        processingStatus: MediaProcessingStatus.FAILED,
        processingPercentage: undefined,
      },
    });

    await renderProbe({ fileId: 'file-123', enabled: true });

    const node = host?.querySelector('div');
    expect(node?.getAttribute('data-hls-url')).toBe('https://cdn.example.com/fresh.m3u8');
    expect(node?.getAttribute('data-waveform-url')).toBe('https://cdn.example.com/waveform.json');
    expect(node?.getAttribute('data-loading')).toBe('false');
  });

  it('falls back to persisted values when bootstrap request rejects', async () => {
    mockedGetFileStatusesAction.mockRejectedValue(new Error('network down'));

    await renderProbe({ fileId: 'file-123', enabled: true });

    expect(mockedGetFileStatusesAction).toHaveBeenCalledWith(['file-123']);
    const node = host?.querySelector('div');
    expect(node?.getAttribute('data-hls-url')).toBe('');
    expect(node?.getAttribute('data-waveform-url')).toBe('');
    expect(node?.getAttribute('data-loading')).toBe('false');
  });

  it('ignores stale bootstrap responses after the fileId changes', async () => {
    let resolveFirst: ((value: Record<string, EditorFileStatusSnapshot>) => void) | undefined;
    let resolveSecond: ((value: Record<string, EditorFileStatusSnapshot>) => void) | undefined;

    mockedGetFileStatusesAction.mockImplementation((fileIds: string[]) => {
      if (fileIds[0] === 'file-123') {
        return new Promise<Record<string, EditorFileStatusSnapshot>>((resolve) => {
          resolveFirst = resolve;
        });
      }
      return new Promise<Record<string, EditorFileStatusSnapshot>>((resolve) => {
        resolveSecond = resolve;
      });
    });

    await renderProbe({ fileId: 'file-123', enabled: true });
    await renderProbe({ fileId: 'file-456', enabled: true });

    if (!resolveFirst) {
      throw new Error('expected first bootstrap request to be pending');
    }

    resolveFirst({
      'file-123': {
        completed: true,
        failed: false,
        unavailable: false,
        url: 'https://cdn.example.com/original-a.mp3',
        originalUrl: 'https://cdn.example.com/original-a.mp3',
        waveformUrl: 'https://cdn.example.com/waveform-a.json',
        spectrogramUrl: '',
        thumbnailUrl: '',
        hlsUrl: 'https://cdn.example.com/stale-a.m3u8',
        durationSeconds: 42,
        processingStatus: MediaProcessingStatus.READY,
        processingPercentage: undefined,
      },
    });
    await flushEffects();

    let node = host?.querySelector('div');
    expect(node?.getAttribute('data-hls-url')).toBe('');
    expect(node?.getAttribute('data-loading')).toBe('true');

    if (!resolveSecond) {
      throw new Error('expected second bootstrap request to be pending');
    }

    resolveSecond({
      'file-456': {
        completed: true,
        failed: false,
        unavailable: false,
        url: 'https://cdn.example.com/original-b.mp3',
        originalUrl: 'https://cdn.example.com/original-b.mp3',
        waveformUrl: 'https://cdn.example.com/waveform-b.json',
        spectrogramUrl: '',
        thumbnailUrl: '',
        hlsUrl: 'https://cdn.example.com/fresh-b.m3u8',
        durationSeconds: 84,
        processingStatus: MediaProcessingStatus.READY,
        processingPercentage: undefined,
      },
    });
    await flushEffects();

    node = host?.querySelector('div');
    expect(node?.getAttribute('data-hls-url')).toBe('https://cdn.example.com/fresh-b.m3u8');
    expect(node?.getAttribute('data-waveform-url')).toBe('https://cdn.example.com/waveform-b.json');
    expect(node?.getAttribute('data-loading')).toBe('false');
  });
});
