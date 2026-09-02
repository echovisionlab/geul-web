// @vitest-environment jsdom

import { act, useSyncExternalStore } from 'react';
import { createRoot } from 'react-dom/client';
import { MediaProcessingStatus } from '@echovisionlab/geul-proto/common/media_pb.ts';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createEditorMediaRuntimeStore } from '@/features/editor/lib/editor-media-runtime-store';
import type { EditorFileStatusSnapshot } from '@/lib/media/editor-file-status-runtime';
import { useEditorMediaRuntimeBinding } from './useEditorMediaRuntimeBinding';

const getFileStatusesAction = vi.hoisted(() => vi.fn());

vi.mock('@/lib/actions/file', () => ({ getFileStatusesAction }));

const blockId = 'c5d85d84-542b-56e0-887b-f7c5795dde42';
const fileId = 'cd205ca8-00bc-414f-9abe-17932ecefbeb';

function status(overrides: Partial<EditorFileStatusSnapshot> = {}): EditorFileStatusSnapshot {
  return {
    mimeType: 'audio/wav',
    completed: true,
    failed: false,
    unavailable: false,
    url: 'https://cdn.example.test/inline.wav',
    originalUrl: 'https://cdn.example.test/source.wav',
    waveformUrl: 'https://cdn.example.test/waveform.json',
    spectrogramUrl: 'https://cdn.example.test/spectrogram.png',
    thumbnailUrl: '',
    hlsUrl: 'https://cdn.example.test/master.m3u8',
    durationSeconds: 3685,
    processingStatus: MediaProcessingStatus.READY,
    ...overrides,
  };
}

afterEach(() => {
  getFileStatusesAction.mockReset();
  document.body.replaceChildren();
});

describe('useEditorMediaRuntimeBinding', () => {
  it('hydrates a durable File reference into the ephemeral runtime store', async () => {
    getFileStatusesAction.mockResolvedValue({ [fileId]: status() });
    const runtimeStore = createEditorMediaRuntimeStore();
    const element = document.createElement('div');
    document.body.append(element);
    const root = createRoot(element);

    function Subject() {
      const binding = useEditorMediaRuntimeBinding({ blockId, fileId, runtimeStore });
      const snapshot = useSyncExternalStore(
        (listener) => runtimeStore.subscribe(blockId, listener),
        () => runtimeStore.getSnapshot(blockId, fileId),
      );
      return (
        <output data-loading={binding.isLoading} data-mime={snapshot.file?.mimeType}>
          {snapshot.file?.hlsUrl}
        </output>
      );
    }

    await act(async () => root.render(<Subject />));
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(getFileStatusesAction).toHaveBeenCalledWith([fileId]);
    expect(element.querySelector('output')?.dataset).toMatchObject({ loading: 'false', mime: 'audio/wav' });
    expect(element.textContent).toBe('https://cdn.example.test/master.m3u8');

    await act(async () => root.unmount());
  });

  it('settles without caching a transiently unavailable delivery', async () => {
    getFileStatusesAction.mockResolvedValue({ [fileId]: status({ unavailable: true }) });
    const runtimeStore = createEditorMediaRuntimeStore();
    const element = document.createElement('div');
    document.body.append(element);
    const root = createRoot(element);

    function Subject() {
      const binding = useEditorMediaRuntimeBinding({ blockId, fileId, runtimeStore });
      return <output data-loading={binding.isLoading} />;
    }

    await act(async () => root.render(<Subject />));
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(element.querySelector('output')?.dataset.loading).toBe('false');
    expect(runtimeStore.getSnapshot(blockId, fileId).file).toBeUndefined();

    await act(async () => root.unmount());
  });

  it('revalidates a stale processing snapshot even when its MIME type is known', async () => {
    getFileStatusesAction.mockResolvedValue({ [fileId]: status() });
    const runtimeStore = createEditorMediaRuntimeStore();
    runtimeStore.patchFile(fileId, { mimeType: 'audio/wav', processingStatus: 'processing' });
    const element = document.createElement('div');
    document.body.append(element);
    const root = createRoot(element);

    function Subject() {
      useEditorMediaRuntimeBinding({ blockId, fileId, runtimeStore });
      const snapshot = useSyncExternalStore(
        (listener) => runtimeStore.subscribe(blockId, listener),
        () => runtimeStore.getSnapshot(blockId, fileId),
      );
      return <output>{snapshot.file?.processingStatus}</output>;
    }

    await act(async () => root.render(<Subject />));
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(getFileStatusesAction).toHaveBeenCalledWith([fileId]);
    expect(element.textContent).toBe('ready');

    await act(async () => root.unmount());
  });

  it('never patches a previous File delivery under a replacement File ID', async () => {
    const replacementFileId = 'a475bf93-4127-467d-9017-fa63d501c8d7';
    let resolveReplacement: ((statuses: Record<string, EditorFileStatusSnapshot>) => void) | undefined;
    getFileStatusesAction.mockImplementation((fileIds: string[]) => {
      if (fileIds[0] === fileId) {
        return Promise.resolve({ [fileId]: status() });
      }
      return new Promise((resolve) => {
        resolveReplacement = resolve;
      });
    });
    const runtimeStore = createEditorMediaRuntimeStore();
    const element = document.createElement('div');
    document.body.append(element);
    const root = createRoot(element);

    function Subject({ activeFileId }: { activeFileId: string }) {
      useEditorMediaRuntimeBinding({ blockId, fileId: activeFileId, runtimeStore });
      return null;
    }

    await act(async () => root.render(<Subject activeFileId={fileId} />));
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    expect(runtimeStore.getSnapshot(blockId, fileId).file?.hlsUrl).toBe('https://cdn.example.test/master.m3u8');

    await act(async () => root.render(<Subject activeFileId={replacementFileId} />));
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    expect(runtimeStore.getSnapshot(blockId, replacementFileId).file).toBeUndefined();

    const resolveReplacementStatus = resolveReplacement;
    if (!resolveReplacementStatus) {
      throw new Error('expected replacement File lookup to be pending');
    }
    await act(async () => {
      resolveReplacementStatus({
        [replacementFileId]: status({
          url: 'https://cdn.example.test/replacement-inline.wav',
          originalUrl: 'https://cdn.example.test/replacement-source.wav',
          hlsUrl: 'https://cdn.example.test/replacement.m3u8',
        }),
      });
      await Promise.resolve();
    });

    expect(runtimeStore.getSnapshot(blockId, replacementFileId).file?.hlsUrl).toBe(
      'https://cdn.example.test/replacement.m3u8',
    );
    await act(async () => root.unmount());
  });
});
