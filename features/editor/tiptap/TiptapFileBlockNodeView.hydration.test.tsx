// @vitest-environment jsdom

import { EditorContent, useEditor } from '@tiptap/react';
import { MediaProcessingStatus } from '@echovisionlab/geul-proto/common/media_pb.ts';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { act, render, screen, waitFor, within } from '@/test/render';
import { createEditorMediaRuntimeStore, type EditorMediaRuntimeStore } from '../lib/editor-media-runtime-store';
import { getFileStatusesAction } from '@/lib/actions/file';
import type { EditorFileStatusSnapshot } from '@/lib/media/editor-file-status-runtime';
import { createTiptapWireExtensions } from './wire-schema';
import { createTiptapFileNode } from './TiptapFileBlockNodeView';

vi.mock('@/lib/actions/file', () => ({ getFileStatusesAction: vi.fn() }));
vi.mock('wavesurfer.js', () => ({
  default: {
    create: () => ({
      on: (event: string, callback: () => void) => {
        if (event === 'ready') {
          queueMicrotask(callback);
        }
        return () => undefined;
      },
      getDuration: () => 60,
      setTime: () => undefined,
      setOptions: () => undefined,
      destroy: () => undefined,
    }),
  },
}));

const blockId = 'c5d85d84-542b-56e0-887b-f7c5795dde42';
const fileId = 'cd205ca8-00bc-414f-9abe-17932ecefbeb';

function ColdFileEditor({ runtimeStore }: { runtimeStore: EditorMediaRuntimeStore }) {
  const editor = useEditor({
    immediatelyRender: false,
    extensions: createTiptapWireExtensions({ fileNode: createTiptapFileNode({ runtimeStore }) }),
    content: {
      type: 'doc',
      content: [
        {
          type: 'blockGroup',
          content: [
            {
              type: 'blockContainer',
              attrs: { id: blockId },
              content: [{ type: 'file', attrs: { fileId, name: 'field-recording.wav' } }],
            },
          ],
        },
      ],
    },
  });
  return <EditorContent editor={editor} />;
}

beforeEach(() => {
  vi.spyOn(HTMLMediaElement.prototype, 'canPlayType').mockReturnValue('probably');
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  vi.mocked(getFileStatusesAction).mockReset();
});

it('replaces a cold File loading surface with a ready audio player after bootstrap metadata arrives', async () => {
  let finish!: (statuses: Record<string, EditorFileStatusSnapshot>) => void;
  vi.mocked(getFileStatusesAction).mockReturnValue(
    new Promise((resolve) => {
      finish = resolve;
    }),
  );
  render(<ColdFileEditor runtimeStore={createEditorMediaRuntimeStore()} />);

  expect(await screen.findByText('Loading...')).toBeInTheDocument();
  expect(screen.queryByRole('group', { name: 'field-recording.wav' })).not.toBeInTheDocument();

  await act(async () =>
    finish({
      [fileId]: {
        mimeType: 'audio/wav',
        completed: true,
        failed: false,
        unavailable: false,
        url: 'https://cdn.example.test/field-recording.wav',
        originalUrl: 'https://cdn.example.test/field-recording.wav',
        waveformUrl: '',
        spectrogramUrl: '',
        thumbnailUrl: '',
        hlsUrl: 'https://cdn.example.test/field-recording.m3u8',
        durationSeconds: 60,
        processingStatus: MediaProcessingStatus.READY,
      },
    }),
  );

  const audio = await screen.findByRole('group', { name: 'field-recording.wav' });
  await waitFor(() => expect(within(audio).getByRole('button', { name: 'Play audio' })).toBeEnabled());
  expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
});
