// @vitest-environment jsdom

import { DesignSystemProvider } from '@/lib/providers/DesignSystemProvider';
import { act, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { EditorContent, useEditor } from '@tiptap/react';
import type { Editor } from '@tiptap/core';
import { NodeSelection } from '@tiptap/pm/state';

import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createEditorMediaRuntimeStore,
  type EditorMediaRuntimeStore,
} from '@/features/editor/lib/editor-media-runtime-store';
import { createTiptapWireExtensions } from './wire-schema';
import { createTiptapFileNode } from './TiptapFileBlockNodeView';
import { EditorAuthoringModeProvider } from '@/features/editor/EditorAuthoringMode';
import { createFileBlockSettingsSlot, type FileBlockSettingsSlot } from './menus/file-block-settings-slot';

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
const audioBlockId = 'c5d85d84-542b-56e0-887b-f7c5795dde42';
const audioFileId = 'cd205ca8-00bc-414f-9abe-17932ecefbeb';

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
              attrs: { id: audioBlockId },
              content: [
                {
                  type: 'file',
                  attrs: {
                    fileId: audioFileId,
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
  settingsSlot,
}: {
  editable: boolean;
  onActivate: (blockId: string) => void;
  onReady: (editor: Editor) => void;
  runtimeStore: EditorMediaRuntimeStore;
  settingsSlot?: FileBlockSettingsSlot;
}) {
  const editor = useEditor({
    immediatelyRender: false,
    editable,
    extensions: createTiptapWireExtensions({
      fileNode: createTiptapFileNode({ onActivate, runtimeStore, settingsSlot }),
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
  return (
    <>
      <EditorContent editor={editor} />
      {/* Stands in for the File menu's settings popover, which hosts the slot beside the editor. */}
      {settingsSlot ? <div ref={settingsSlot.set} data-file-block-settings="" /> : null}
    </>
  );
}

async function mountEditor({
  editable,
  onActivate,
  settingsSlot,
}: {
  editable: boolean;
  onActivate: (blockId: string) => void;
  settingsSlot?: FileBlockSettingsSlot;
}) {
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
      <DesignSystemProvider forceColorScheme="light">
        <EditorAuthoringModeProvider value={{ allowNeutralBlockEdits: true, allowLocalizedBlockEdits: true }}>
          <TestEditor
            editable={editable}
            onActivate={onActivate}
            runtimeStore={runtimeStore}
            settingsSlot={settingsSlot}
            onReady={(value) => (editor = value)}
          />
        </EditorAuthoringModeProvider>
      </DesignSystemProvider>,
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
  it('shows the same missing attachment and caption as the public renderer', async () => {
    const { editor, element, destroy } = await mountEditor({ editable: true, onActivate: vi.fn() });
    try {
      let position = -1;
      editor.state.doc.descendants((node, pos) => {
        if (position < 0 && node.type.name === 'file') {
          position = pos;
        }
      });
      await act(async () => {
        const node = editor.state.doc.nodeAt(position)!;
        editor.view.dispatch(
          editor.state.tr.setNodeMarkup(position, undefined, {
            ...node.attrs,
            fileId: '',
            attachment: { missingAttachment: { formerFileId: imageFileId, mediaKind: 'image' } },
            caption: 'Missing image caption',
          }),
        );
      });
      expect(element.querySelector('[data-media-missing-kind="image"]')?.textContent).toContain('imageDeleted');
      expect(element.querySelector('.media-missing-block .media-block__caption')?.textContent).toBe(
        'Missing image caption',
      );
      expect(element.textContent).not.toContain('Invalid File block');
    } finally {
      await destroy();
    }
  });

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

  it('keeps an audio player stable while editing an unrelated paragraph', async () => {
    const element = document.createElement('div');
    document.body.append(element);
    const root = createRoot(element);
    let editor: Editor | null = null;
    await act(async () => {
      root.render(
        <DesignSystemProvider forceColorScheme="light">
          <AudioInteractionEditor onReady={(value) => (editor = value)} />
        </DesignSystemProvider>,
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
        <DesignSystemProvider forceColorScheme="light">
          <AudioInteractionEditor onReady={(value) => (editor = value)} />
        </DesignSystemProvider>,
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
    expect(group?.child(0).attrs.id).toBe(audioBlockId);
    expect(group?.child(0).firstChild?.type.name).toBe('file');
    expect(group?.child(1).firstChild?.type.name).toBe('paragraph');
    expect(group?.child(1).textContent).toBe('New paragraph');
    expect(group?.child(2).attrs.id).toBe('4d994cea-9565-51d4-8ad0-70b26438b728');
    expect(element.querySelector('[data-audio-view]')).toBe(audio);

    await act(async () => root.unmount());
    element.remove();
  });

  it('edits a selected block in settings beside the editor, not inside its editable document', async () => {
    const { editor, element, destroy } = await mountEditor({
      editable: true,
      onActivate: vi.fn(),
      settingsSlot: createFileBlockSettingsSlot(),
    });
    let imagePosition = -1;
    editor.state.doc.descendants((node, position) => {
      if (imagePosition < 0 && node.type.name === 'file') {
        imagePosition = position;
      }
    });

    await act(async () => {
      editor.view.dispatch(editor.state.tr.setSelection(NodeSelection.create(editor.state.doc, imagePosition)));
    });

    const fields = element.querySelector<HTMLElement>('[data-file-block-metadata-fields]');
    expect(fields?.closest('[data-file-block-settings]')).not.toBeNull();
    expect(editor.view.dom.contains(fields)).toBe(false);
    const name = fields!.querySelector<HTMLInputElement>('input')!;
    await act(async () => {
      name.focus();
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(name, 'cover-final.png');
      name.dispatchEvent(new Event('input', { bubbles: true }));
    });
    expect(editor.state.doc.nodeAt(imagePosition)?.attrs.name).toBe('cover-final.png');

    await act(async () => {
      editor.commands.setTextSelection(1);
    });
    expect(element.querySelector('[data-file-block-metadata-fields]')).toBeNull();
    await destroy();
  });
});
