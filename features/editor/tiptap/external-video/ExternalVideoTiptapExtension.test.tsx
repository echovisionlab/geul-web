// @vitest-environment jsdom

import { act, useEffect } from 'react';
import { getSchema, type Editor } from '@tiptap/core';
import { NodeSelection, TextSelection } from '@tiptap/pm/state';
import { EditorContent, useEditor } from '@tiptap/react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ExternalVideoViewProps } from '@/features/media/ExternalVideoView';
import { createTiptapWireExtensions } from '../wire-schema';
import {
  UnsupportedTiptapExternalVideoError,
  assertTiptapExternalVideoSupport,
  createTiptapExternalVideoExtension,
  getTiptapStandaloneExternalVideos,
  updateTiptapExternalVideoLayout,
  updateTiptapExternalVideoSource,
  type TiptapExternalVideoLabels,
} from './ExternalVideoTiptapExtension';

const youtubeUrl = 'https://youtu.be/dQw4w9WgXcQ?t=1m';
const externalVideoLabels = {
  editLink: '링크 수정',
  showPreview: '미리보기 표시',
  aspectRatio: '화면 비율',
  automaticAspectRatio: '자동',
  alignLeft: '왼쪽 정렬',
  alignCenter: '가운데 정렬',
  alignRight: '오른쪽 정렬',
  youtubeTitle: 'YouTube 영상',
  vimeoTitle: 'Vimeo 영상',
} satisfies TiptapExternalVideoLabels;

function paragraph(
  id: string,
  content: Record<string, unknown> | Record<string, unknown>[],
  attrs: Record<string, unknown> = {},
) {
  return {
    type: 'blockContainer',
    attrs: { id },
    content: [
      {
        type: 'paragraph',
        attrs: { backgroundColor: 'default', textColor: 'default', textAlignment: 'left', ...attrs },
        content: Array.isArray(content) ? content : [content],
      },
    ],
  };
}

function linkedText(text: string, href = youtubeUrl, extraMarks: Record<string, unknown>[] = []) {
  return { type: 'text', text, marks: [...extraMarks, { type: 'link', attrs: { href } }] };
}

function heading(id: string, text: string) {
  return {
    type: 'blockContainer',
    attrs: { id },
    content: [
      {
        type: 'heading',
        attrs: { level: 2, textAlignment: 'left' },
        content: [{ type: 'text', text }],
      },
    ],
  };
}

function TestEditor({
  content,
  editable,
  onReady,
  videoView,
}: {
  content: Record<string, unknown>[];
  editable: boolean;
  onReady: (editor: Editor) => void;
  videoView?: React.ComponentType<ExternalVideoViewProps>;
}) {
  const editor = useEditor({
    immediatelyRender: false,
    editable,
    extensions: createTiptapWireExtensions({
      externalVideoNode: createTiptapExternalVideoExtension({ labels: externalVideoLabels, videoView }),
    }),
    content: { type: 'doc', content: [{ type: 'blockGroup', content }] },
  });
  useEffect(() => {
    if (editor) {
      onReady(editor);
    }
  }, [editor, onReady]);
  return <EditorContent editor={editor} />;
}

async function flushEditor() {
  await act(async () => {
    await Promise.resolve();
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

async function mountEditor(
  content: Record<string, unknown>[],
  videoView?: React.ComponentType<ExternalVideoViewProps>,
  editable = true,
) {
  const element = document.createElement('div');
  document.body.append(element);
  const root = createRoot(element);
  let editor: Editor | null = null;
  await act(async () => {
    root.render(
      <TestEditor content={content} editable={editable} videoView={videoView} onReady={(value) => (editor = value)} />,
    );
  });
  await flushEditor();
  if (!editor) {
    throw new Error('Tiptap editor did not mount.');
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

function paragraphPositions(editor: Editor): number[] {
  const positions: number[] = [];
  editor.state.doc.descendants((node, position) => {
    if (node.type.name === 'paragraph') {
      positions.push(position);
    }
  });
  return positions;
}

beforeEach(() => {
  Object.defineProperty(document, 'elementFromPoint', { configurable: true, value: () => null });
});

afterEach(() => {
  Reflect.deleteProperty(document, 'elementFromPoint');
  vi.unstubAllGlobals();
});

describe('Tiptap external-video atom', () => {
  it('promotes only a root standalone provider link, renders it, and preserves the exact source content', async () => {
    const sourceContent = [linkedText('Field ', youtubeUrl, [{ type: 'bold' }]), linkedText('recording')];
    const mounted = await mountEditor([
      paragraph('video', sourceContent, {
        previewWidth: '64',
        textAlignment: 'center',
        aspectRatio: '4:3',
      }),
      paragraph('ordinary-link', [linkedText('Video'), { type: 'text', text: ' detail' }]),
      {
        type: 'blockContainer',
        attrs: { id: 'parent' },
        content: [
          {
            type: 'paragraph',
            attrs: { backgroundColor: 'default', textColor: 'default', textAlignment: 'left' },
            content: [linkedText('Nested')],
          },
          { type: 'blockGroup', content: [paragraph('child', linkedText('Child'))] },
        ],
      },
    ]);

    const videos = getTiptapStandaloneExternalVideos(mounted.editor.view);
    expect(videos).toHaveLength(1);
    expect(videos[0]).toMatchObject({
      blockId: 'video',
      url: youtubeUrl,
      previewWidth: '64',
      textAlignment: 'center',
      aspectRatio: '4:3',
    });
    expect(videos[0]?.node.attrs.sourceContent).toEqual(sourceContent);
    expect(videos[0]?.node.type.name).toBe('externalVideo');
    const iframe = mounted.element.querySelector<HTMLIFrameElement>('[data-tiptap-external-video-widget] iframe');
    expect(iframe?.getAttribute('src')).toContain('www.youtube-nocookie.com/embed/dQw4w9WgXcQ');
    expect(iframe?.getAttribute('src')).toContain('start=60');
    expect(mounted.element.querySelector('[data-id="ordinary-link"] [data-tiptap-external-video-widget]')).toBeNull();
    expect(mounted.element.querySelector('[data-id="parent"] [data-tiptap-external-video-widget]')).toBeNull();

    await mounted.destroy();
  });

  it('uses the injected provider title when the standalone label is the raw URL', async () => {
    const mounted = await mountEditor([paragraph('video', linkedText(youtubeUrl))]);

    const iframe = mounted.element.querySelector<HTMLIFrameElement>('[data-tiptap-external-video-widget] iframe');
    expect(iframe?.getAttribute('title')).toBe(externalVideoLabels.youtubeTitle);
    expect(getTiptapStandaloneExternalVideos(mounted.editor.view, externalVideoLabels)[0]?.title).toBe(
      externalVideoLabels.youtubeTitle,
    );

    await mounted.destroy();
  });

  it('keeps the same player mounted when it is clicked, selected, and updated in place', async () => {
    const mounts = vi.fn();
    const unmounts = vi.fn();
    function TrackedVideo({ title, url }: ExternalVideoViewProps) {
      useEffect(() => {
        mounts();
        return () => unmounts();
      }, []);
      return <iframe data-testid="tracked-video" data-url={url} title={title} />;
    }
    const mounted = await mountEditor([paragraph('video', linkedText('Field recording'))], TrackedVideo);
    const host = mounted.element.querySelector<HTMLElement>('[data-tiptap-external-video-widget]');
    const iframe = mounted.element.querySelector<HTMLIFrameElement>('[data-testid="tracked-video"]');
    const selectionShield = mounted.element.querySelector<HTMLButtonElement>('button[aria-label="Field recording"]');

    await act(async () => {
      selectionShield?.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, detail: 1 }));
    });
    await flushEditor();
    expect(mounted.editor.state.selection).toBeInstanceOf(NodeSelection);
    expect(mounted.element.querySelector('[data-tiptap-external-video-widget]')).toBe(host);
    expect(mounted.element.querySelector('[data-testid="tracked-video"]')).toBe(iframe);
    expect(mounts).toHaveBeenCalledTimes(1);
    expect(unmounts).not.toHaveBeenCalled();

    expect(
      updateTiptapExternalVideoSource(
        mounted.editor,
        { url: 'https://vimeo.com/123456', label: 'Updated field recording' },
        'video',
      ),
    ).toBe(true);
    await flushEditor();
    expect(mounted.element.querySelector('[data-tiptap-external-video-widget]')).toBe(host);
    expect(mounted.element.querySelector('[data-testid="tracked-video"]')).toBe(iframe);
    expect(iframe?.dataset.url).toBe('https://vimeo.com/123456');
    expect(mounts).toHaveBeenCalledTimes(1);
    expect(unmounts).not.toHaveBeenCalled();
    expect(getTiptapStandaloneExternalVideos(mounted.editor.view)[0]?.node.attrs.sourceContent).toMatchObject([
      {
        type: 'text',
        text: 'Updated field recording',
        marks: [{ type: 'link', attrs: { href: 'https://vimeo.com/123456' } }],
      },
    ]);

    await mounted.destroy();
    expect(unmounts).toHaveBeenCalledTimes(1);
  });

  it('does not remount the player when an unrelated paragraph is edited or split with Enter', async () => {
    const mounts = vi.fn();
    const unmounts = vi.fn();
    function TrackedVideo({ title }: ExternalVideoViewProps) {
      useEffect(() => {
        mounts();
        return () => unmounts();
      }, []);
      return <iframe data-testid="tracked-video" title={title} />;
    }
    const mounted = await mountEditor(
      [paragraph('video', linkedText('Field recording')), paragraph('notes', { type: 'text', text: 'Notes' })],
      TrackedVideo,
    );
    const host = mounted.element.querySelector<HTMLElement>('[data-tiptap-external-video-widget]');
    const iframe = mounted.element.querySelector<HTMLIFrameElement>('[data-testid="tracked-video"]');
    const [notesPosition] = paragraphPositions(mounted.editor);

    await act(async () => {
      mounted.editor.commands.setTextSelection(notesPosition + 3);
      mounted.editor.commands.insertContent('!');
      mounted.editor.view.dom.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }),
      );
    });
    await flushEditor();

    expect(mounted.element.querySelector('[data-tiptap-external-video-widget]')).toBe(host);
    expect(mounted.element.querySelector('[data-testid="tracked-video"]')).toBe(iframe);
    expect(mounts).toHaveBeenCalledTimes(1);
    expect(unmounts).not.toHaveBeenCalled();
    expect(mounted.editor.state.doc.firstChild?.childCount).toBe(3);

    await mounted.destroy();
  });

  it('creates a writable Paragraph after the selected preview without remounting its player', async () => {
    const mounts = vi.fn();
    const unmounts = vi.fn();
    function TrackedVideo({ title }: ExternalVideoViewProps) {
      useEffect(() => {
        mounts();
        return () => unmounts();
      }, []);
      return <iframe data-testid="tracked-video" title={title} />;
    }
    const mounted = await mountEditor(
      [paragraph('video', linkedText('Field recording')), paragraph('tail', { type: 'text', text: 'Tail' })],
      TrackedVideo,
    );
    const host = mounted.element.querySelector<HTMLElement>('[data-tiptap-external-video-widget]');
    const iframe = mounted.element.querySelector<HTMLIFrameElement>('[data-testid="tracked-video"]');
    const selectionShield = mounted.element.querySelector<HTMLButtonElement>('button[aria-label="Field recording"]');
    const videoBefore = mounted.editor.state.doc.firstChild?.firstChild?.toJSON();

    await act(async () => {
      selectionShield?.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, detail: 1 }));
    });
    await flushEditor();
    const enter = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true });
    await act(async () => {
      mounted.editor.view.dom.dispatchEvent(enter);
      mounted.editor.commands.insertContent('New paragraph');
    });
    await flushEditor();

    const group = mounted.editor.state.doc.firstChild;
    expect(enter.defaultPrevented).toBe(true);
    expect(group?.childCount).toBe(3);
    expect(group?.child(0).toJSON()).toEqual(videoBefore);
    expect(group?.child(1).firstChild?.type.name).toBe('paragraph');
    expect(group?.child(1).textContent).toBe('New paragraph');
    expect(group?.child(2).attrs.id).toBe('tail');
    expect(mounted.element.querySelector('[data-tiptap-external-video-widget]')).toBe(host);
    expect(mounted.element.querySelector('[data-testid="tracked-video"]')).toBe(iframe);
    expect(mounts).toHaveBeenCalledTimes(1);
    expect(unmounts).not.toHaveBeenCalled();

    await mounted.destroy();
  });

  it('keeps the preview mounted and resizable after deleting an adjacent paragraph', async () => {
    const mounted = await mountEditor([
      heading('footage', 'Footage'),
      paragraph('spacer', []),
      paragraph('video', linkedText('Field recording')),
    ]);
    const preview = mounted.element.querySelector<HTMLElement>('[data-external-video-editor-preview]');
    const selectionShield = preview?.querySelector<HTMLButtonElement>('button[aria-label="Field recording"]');
    expect(preview).toBeTruthy();
    expect(selectionShield).toBeTruthy();

    await act(async () => {
      selectionShield?.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, detail: 1 }));
    });
    await flushEditor();
    expect(mounted.element.querySelectorAll('[data-resize-handle]')).toHaveLength(2);

    const blockGroup = mounted.editor.state.doc.firstChild;
    if (!blockGroup) {
      throw new Error('Expected the root block group.');
    }
    const spacerPosition = 1 + blockGroup.child(0).nodeSize;
    const spacerSize = blockGroup.child(1).nodeSize;
    await act(async () => {
      mounted.editor.view.dispatch(mounted.editor.state.tr.delete(spacerPosition, spacerPosition + spacerSize));
    });
    await flushEditor();

    const frame = mounted.element.querySelector<HTMLElement>('[data-selected="true"]');
    const resizeHandle = frame?.querySelector<HTMLElement>('[data-resize-direction="right"]');
    const editorContent = frame?.closest('[data-node-type="blockContainer"]')?.parentElement;
    if (!frame || !resizeHandle || !editorContent) {
      throw new Error('Expected the selected preview resize surface.');
    }
    Object.defineProperty(editorContent, 'getBoundingClientRect', {
      configurable: true,
      value: () => ({ width: 1000 }),
    });
    Object.defineProperty(frame, 'getBoundingClientRect', {
      configurable: true,
      value: () => ({ width: 1000 }),
    });
    const pointerDown = new MouseEvent('pointerdown', { bubbles: true, cancelable: true, clientX: 1000 });
    Object.defineProperty(pointerDown, 'pointerId', { value: 7 });
    const pointerMove = new MouseEvent('pointermove', { bubbles: true, cancelable: true, clientX: 700 });
    Object.defineProperty(pointerMove, 'pointerId', { value: 7 });
    const pointerUp = new MouseEvent('pointerup', { bubbles: true, cancelable: true, clientX: 700 });
    Object.defineProperty(pointerUp, 'pointerId', { value: 7 });
    await act(async () => {
      resizeHandle.dispatchEvent(pointerDown);
      frame.dispatchEvent(pointerMove);
      frame.dispatchEvent(pointerUp);
    });
    await flushEditor();

    expect(getTiptapStandaloneExternalVideos(mounted.editor.view)[0]?.previewWidth).toBe('70');
    expect(mounted.element.querySelector('[data-external-video-editor-preview]')).toBeTruthy();

    await mounted.destroy();
  });

  it('persists layout and blocks all source/layout mutations when read-only', async () => {
    const mounted = await mountEditor([
      paragraph('video', linkedText('Source label')),
      paragraph('notes', { type: 'text', text: 'Notes' }),
    ]);
    const before = getTiptapStandaloneExternalVideos(mounted.editor.view)[0];
    mounted.editor.view.dispatch(
      mounted.editor.state.tr.setSelection(NodeSelection.create(mounted.editor.state.doc, before.blockPosition)),
    );

    expect(
      updateTiptapExternalVideoLayout(mounted.editor, {
        previewWidth: '44',
        textAlignment: 'right',
        aspectRatio: '1:1',
      }),
    ).toBe(true);
    expect(getTiptapStandaloneExternalVideos(mounted.editor.view)[0]).toMatchObject({
      url: youtubeUrl,
      title: 'Source label',
      previewWidth: '44',
      textAlignment: 'right',
      aspectRatio: '1:1',
    });

    mounted.editor.setEditable(false);
    expect(updateTiptapExternalVideoSource(mounted.editor, { url: youtubeUrl, label: 'No change' }, 'video')).toBe(
      false,
    );
    expect(updateTiptapExternalVideoLayout(mounted.editor, { previewWidth: '70' }, 'video')).toBe(false);
    const [notesPosition] = paragraphPositions(mounted.editor);
    mounted.editor.commands.setTextSelection(notesPosition + 1);
    await flushEditor();
    const readOnlyPointer = new MouseEvent('mousedown', { bubbles: true, cancelable: true });
    mounted.element.querySelector('[data-external-video-editor-preview]')?.dispatchEvent(readOnlyPointer);
    expect(readOnlyPointer.defaultPrevented).toBe(false);
    expect(mounted.editor.state.selection).toBeInstanceOf(TextSelection);

    await mounted.destroy();
  });

  it('turns a pasted provider URL in an empty root paragraph into one selected atom', async () => {
    const mounted = await mountEditor([paragraph('empty', [])]);
    const [position] = paragraphPositions(mounted.editor);
    mounted.editor.commands.setTextSelection(position + 1);
    const paste = new Event('paste', { bubbles: true, cancelable: true });
    Object.defineProperty(paste, 'clipboardData', {
      value: { getData: (type: string) => (type === 'text/plain' ? youtubeUrl : '') },
    });

    await act(async () => {
      mounted.editor.view.dom.dispatchEvent(paste);
    });
    await flushEditor();

    expect(paste.defaultPrevented).toBe(true);
    expect(getTiptapStandaloneExternalVideos(mounted.editor.view)).toHaveLength(1);
    expect(mounted.editor.state.selection).toBeInstanceOf(NodeSelection);
    expect(mounted.element.querySelector('[data-tiptap-external-video-widget] iframe')).toBeTruthy();

    await mounted.destroy();
  });

  it('fails explicitly when integrated without the paragraph compatibility attributes', () => {
    const schema = getSchema(createTiptapWireExtensions());
    expect(() => assertTiptapExternalVideoSupport({ schema })).toThrow(UnsupportedTiptapExternalVideoError);
  });
});
