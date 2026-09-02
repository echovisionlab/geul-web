// @vitest-environment jsdom

import { act, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { EditorContent, useEditor } from '@tiptap/react';
import type { Editor } from '@tiptap/core';
import { NodeSelection } from '@tiptap/pm/state';
import { MantineProvider } from '@mantine/core';
import { MediaProcessingStatus } from '@echovisionlab/geul-proto/common/media_pb.ts';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createEditorMediaRuntimeStore,
  type EditorMediaRuntimeStore,
} from '@/features/editor/lib/editor-media-runtime-store';
import { createTiptapWireExtensions } from './wire-schema';
import { createTiptapFileNode } from './TiptapFileBlockNodeView';

const getFileStatusesAction = vi.hoisted(() => vi.fn());
const audioMediaViewRender = vi.hoisted(() => vi.fn());

vi.mock('@/lib/actions/file', () => ({ getFileStatusesAction }));

vi.mock('@/features/media/AudioMediaView', () => ({
  AudioMediaView: (props: unknown) => {
    audioMediaViewRender(props);
    return <div data-audio-view="" />;
  },
}));

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}));

const imageBlockId = '01b3db42-75f1-4bf1-8cb9-9b3baf57e795';
const imageFileId = 'b67328c4-668c-5bf2-8f1e-41465149ded6';
const documentBlockId = '8929fbc6-0a08-46f0-8fec-3dc7dbfaf784';
const documentFileId = 'bdac72af-8a24-4214-999d-83727445cbd7';
const coldAudioFiles = [
  ['c5d85d84-542b-56e0-887b-f7c5795dde42', 'cd205ca8-00bc-414f-9abe-17932ecefbeb'],
  ['65e2e8bc-94f1-565b-8ed1-c40519d7bb92', 'a475bf93-4127-467d-9017-fa63d501c8d7'],
  ['c23b701f-f287-5907-b13a-9d444853f9ef', '14d72606-e5be-4d1b-b139-107667e7db1c'],
  ['e5da9d77-cf24-5251-a088-1422076f6930', 'c3d0d044-66c5-40b2-8d60-d6d124983faa'],
  ['c73f3358-20d0-5c25-ac04-7fa5f17bf8d6', 'b97782d2-4612-44d6-acd6-949c0eb57d10'],
] as const;

beforeEach(() => {
  getFileStatusesAction.mockReset();
  getFileStatusesAction.mockResolvedValue({});
  audioMediaViewRender.mockReset();
});

function AudioInteractionEditor({ onReady }: { onReady: (editor: Editor) => void }) {
  const editor = useEditor({
    immediatelyRender: false,
    extensions: createTiptapWireExtensions({ fileNode: createTiptapFileNode() }),
    content: {
      type: 'doc',
      content: [
        {
          type: 'blockGroup',
          content: [
            {
              type: 'blockContainer',
              attrs: { id: coldAudioFiles[0][0] },
              content: [
                {
                  type: 'file',
                  attrs: {
                    fileId: coldAudioFiles[0][1],
                    mimeType: 'audio/wav',
                    name: 'field-recording.wav',
                    originalUrl: 'https://cdn.example.test/field-recording.wav',
                    waveformUrl: 'https://cdn.example.test/field-recording.json',
                    processingStatus: 'ready',
                  },
                },
              ],
            },
            {
              type: 'blockContainer',
              attrs: { id: '4d994cea-9565-51d4-8ad0-70b26438b728' },
              content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Notes' }] }],
            },
          ],
        },
      ],
    },
  });
  useEffect(() => {
    if (editor) {
      onReady(editor);
    }
  }, [editor, onReady]);
  return <EditorContent editor={editor} />;
}

function TestEditor({
  editable,
  onActivate,
  onReady,
  runtimeStore,
}: {
  editable: boolean;
  onActivate: (blockId: string) => void;
  onReady: (editor: Editor) => void;
  runtimeStore: EditorMediaRuntimeStore;
}) {
  const editor = useEditor({
    immediatelyRender: false,
    editable,
    extensions: createTiptapWireExtensions({
      fileNode: createTiptapFileNode({ onActivate, runtimeStore }),
    }),
    content: {
      type: 'doc',
      content: [
        {
          type: 'blockGroup',
          content: [
            {
              type: 'blockContainer',
              attrs: { id: imageBlockId },
              content: [
                {
                  type: 'file',
                  attrs: {
                    fileId: imageFileId,
                    name: 'cover.png',
                  },
                },
              ],
            },
            {
              type: 'blockContainer',
              attrs: { id: documentBlockId },
              content: [
                {
                  type: 'file',
                  attrs: {
                    fileId: documentFileId,
                    name: 'field-notes.pdf',
                    caption: 'Field recording notes',
                  },
                },
              ],
            },
          ],
        },
      ],
    },
  });
  useEffect(() => {
    if (editor) {
      onReady(editor);
    }
  }, [editor, onReady]);
  return <EditorContent editor={editor} />;
}

function ColdAudioEditor({ runtimeStore }: { runtimeStore: EditorMediaRuntimeStore }) {
  const editor = useEditor({
    immediatelyRender: false,
    extensions: createTiptapWireExtensions({
      fileNode: createTiptapFileNode({ runtimeStore }),
    }),
    content: {
      type: 'doc',
      content: [
        {
          type: 'blockGroup',
          content: coldAudioFiles.map(([blockId, fileId], index) => ({
            type: 'blockContainer',
            attrs: { id: blockId },
            content: [
              {
                type: 'file',
                attrs: { fileId, name: `field-recording-${index + 1}` },
              },
            ],
          })),
        },
      ],
    },
  });
  return <EditorContent editor={editor} />;
}

async function mountEditor({ editable, onActivate }: { editable: boolean; onActivate: (blockId: string) => void }) {
  const element = document.createElement('div');
  document.body.append(element);
  const root = createRoot(element);
  const runtimeStore = createEditorMediaRuntimeStore();
  runtimeStore.bindFile(imageBlockId, imageFileId);
  runtimeStore.patchFile(imageFileId, { mimeType: 'image/png', url: 'https://example.test/cover.png' });
  runtimeStore.bindFile(documentBlockId, documentFileId);
  runtimeStore.patchFile(documentFileId, {
    mimeType: 'application/pdf',
    size: '2048',
    processingStatus: 'ready',
  });
  let editor: Editor | null = null;
  await act(async () => {
    root.render(
      <MantineProvider>
        <TestEditor
          editable={editable}
          onActivate={onActivate}
          runtimeStore={runtimeStore}
          onReady={(value) => (editor = value)}
        />
      </MantineProvider>,
    );
  });
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
  if (!editor) {
    throw new Error('Tiptap editor did not mount');
  }
  return {
    editor: editor as Editor,
    element,
    async destroy() {
      await act(async () => root.unmount());
      element.remove();
    },
  };
}

describe('Tiptap file node view', () => {
  it('routes durable file nodes by verified MIME and matches public attachment presentation', async () => {
    const onActivate = vi.fn();
    const { element, destroy } = await mountEditor({ editable: true, onActivate });

    const image = element.querySelector<HTMLElement>(`[data-id="${imageBlockId}"] .tiptap-file-node`);
    const document = element.querySelector<HTMLElement>(`[data-id="${documentBlockId}"] .tiptap-file-node`);
    const documentCaption = document?.querySelector<HTMLElement>('.media-block__caption');
    expect(image?.getAttribute('data-file-kind')).toBe('image');
    expect(document?.querySelector('.attachment-title')?.textContent).toBe('field-notes.pdf');
    expect(document?.querySelector('.attachment-meta')?.textContent).toBe('PDF · 2.0 KB');
    expect(document?.textContent).not.toContain('application/pdf');
    expect(documentCaption?.textContent).toBe('Field recording notes');
    expect(documentCaption?.closest('.attachment-block__surface')).not.toBeNull();

    expect(onActivate).not.toHaveBeenCalled();
    await destroy();
  });

  it('bulk-hydrates five cold durable File nodes and renders ready audio views', async () => {
    getFileStatusesAction.mockResolvedValue(
      Object.fromEntries(
        coldAudioFiles.map(([, fileId]) => [
          fileId,
          {
            mimeType: 'audio/wav',
            completed: true,
            failed: false,
            unavailable: false,
            url: `https://cdn.example.test/${fileId}.wav`,
            originalUrl: `https://cdn.example.test/${fileId}.wav`,
            waveformUrl: `https://cdn.example.test/${fileId}.json`,
            spectrogramUrl: '',
            thumbnailUrl: '',
            hlsUrl: `https://cdn.example.test/${fileId}.m3u8`,
            durationSeconds: 3685,
            processingStatus: MediaProcessingStatus.READY,
          },
        ]),
      ),
    );
    const runtimeStore = createEditorMediaRuntimeStore();
    const element = document.createElement('div');
    document.body.append(element);
    const root = createRoot(element);

    await act(async () =>
      root.render(
        <MantineProvider>
          <ColdAudioEditor runtimeStore={runtimeStore} />
        </MantineProvider>,
      ),
    );
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(getFileStatusesAction).toHaveBeenCalledTimes(1);
    expect(new Set(getFileStatusesAction.mock.calls[0]?.[0])).toEqual(
      new Set(coldAudioFiles.map(([, fileId]) => fileId)),
    );
    expect(element.querySelectorAll('[data-file-kind="audio"]')).toHaveLength(5);
    expect(element.querySelectorAll('[data-file-kind="loading"]')).toHaveLength(0);

    await act(async () => root.unmount());
    element.remove();
  });

  it('keeps an audio player stable while editing an unrelated paragraph', async () => {
    const element = document.createElement('div');
    document.body.append(element);
    const root = createRoot(element);
    let editor: Editor | null = null;
    await act(async () => {
      root.render(
        <MantineProvider>
          <AudioInteractionEditor onReady={(value) => (editor = value)} />
        </MantineProvider>,
      );
    });
    if (!editor) {
      throw new Error('Tiptap editor did not mount');
    }
    const currentEditor = editor as Editor;
    const audio = element.querySelector<HTMLElement>('[data-audio-view]');
    const renderCount = audioMediaViewRender.mock.calls.length;
    let paragraphPosition = -1;
    currentEditor.state.doc.descendants((node, position) => {
      if (paragraphPosition < 0 && node.type.name === 'paragraph') {
        paragraphPosition = position;
      }
    });

    await act(async () => {
      currentEditor.commands.setTextSelection(paragraphPosition + 3);
      currentEditor.commands.insertContent('!');
    });

    expect(element.querySelector('[data-audio-view]')).toBe(audio);
    expect(audioMediaViewRender).toHaveBeenCalledTimes(renderCount);

    await act(async () => root.unmount());
    element.remove();
  });

  it('creates a writable Paragraph after selected audio without remounting its player', async () => {
    const element = document.createElement('div');
    document.body.append(element);
    const root = createRoot(element);
    let editor: Editor | null = null;
    await act(async () => {
      root.render(
        <MantineProvider>
          <AudioInteractionEditor onReady={(value) => (editor = value)} />
        </MantineProvider>,
      );
    });
    if (!editor) {
      throw new Error('Tiptap editor did not mount');
    }
    const currentEditor = editor as Editor;
    const audio = element.querySelector<HTMLElement>('[data-audio-view]');
    let audioPosition = -1;
    currentEditor.state.doc.descendants((node, position) => {
      if (audioPosition < 0 && node.type.name === 'file') {
        audioPosition = position;
      }
    });
    currentEditor.view.dispatch(
      currentEditor.state.tr.setSelection(NodeSelection.create(currentEditor.state.doc, audioPosition)),
    );
    const enter = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true });

    await act(async () => {
      currentEditor.view.dom.dispatchEvent(enter);
      currentEditor.commands.insertContent('New paragraph');
    });

    const group = currentEditor.state.doc.firstChild;
    expect(enter.defaultPrevented).toBe(true);
    expect(group?.childCount).toBe(3);
    expect(group?.child(0).attrs.id).toBe(coldAudioFiles[0][0]);
    expect(group?.child(0).firstChild?.type.name).toBe('file');
    expect(group?.child(1).firstChild?.type.name).toBe('paragraph');
    expect(group?.child(1).textContent).toBe('New paragraph');
    expect(group?.child(2).attrs.id).toBe('4d994cea-9565-51d4-8ad0-70b26438b728');
    expect(element.querySelector('[data-audio-view]')).toBe(audio);

    await act(async () => root.unmount());
    element.remove();
  });
});
