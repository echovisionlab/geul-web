// @vitest-environment jsdom

import { act } from 'react';
import { Editor } from '@tiptap/core';
import { NodeSelection } from '@tiptap/pm/state';
import { describe, expect, it } from 'vitest';
import { createTiptapWireExtensions } from './tiptap/wire-schema';
import { createTiptapExternalVideoExtension, DEFAULT_TIPTAP_EXTERNAL_VIDEO_LABELS } from './tiptap/external-video';
import { replaceParagraphWithExternalVideoLink } from './external-video-insert';

function paragraph(id: string, text: string, attrs: Record<string, unknown> = {}) {
  return {
    type: 'blockContainer',
    attrs: { id },
    content: [
      {
        type: 'paragraph',
        attrs: {
          backgroundColor: 'default',
          textColor: 'default',
          textAlignment: 'left',
          previewWidth: '64',
          aspectRatio: '4:3',
          ...attrs,
        },
        content: [{ type: 'text', text }],
      },
    ],
  };
}

function createEditor() {
  const element = document.createElement('div');
  document.body.append(element);
  const editor = new Editor({
    element,
    extensions: createTiptapWireExtensions({
      externalVideoNode: createTiptapExternalVideoExtension({ labels: DEFAULT_TIPTAP_EXTERNAL_VIDEO_LABELS }),
    }),
    content: {
      type: 'doc',
      content: [
        {
          type: 'blockGroup',
          content: [
            paragraph('current', 'Keep this'),
            paragraph('captured', 'Replace this', { textAlignment: 'right' }),
          ],
        },
      ],
    },
  });
  return {
    editor,
    destroy() {
      editor.destroy();
      element.remove();
    },
  };
}

describe('replaceParagraphWithExternalVideoLink', () => {
  it('replaces the captured block paragraph with a supported linked source and preserves its layout', async () => {
    const mounted = createEditor();
    mounted.editor.commands.setTextSelection(3);

    let inserted = false;
    await act(async () => {
      inserted = replaceParagraphWithExternalVideoLink(
        mounted.editor,
        { url: ' https://youtu.be/dQw4w9WgXcQ ', label: '   ' },
        'captured',
      );
      await Promise.resolve();
    });
    expect(inserted).toBe(true);

    const blockGroup = mounted.editor.state.doc.firstChild;
    const current = blockGroup?.child(0);
    const captured = blockGroup?.child(1);
    const externalVideoNode = captured?.firstChild;
    expect(current?.textContent).toBe('Keep this');
    expect(captured?.attrs.id).toBe('captured');
    expect(externalVideoNode?.type.name).toBe('externalVideo');
    expect(externalVideoNode?.attrs).toMatchObject({
      previewWidth: '64',
      aspectRatio: '4:3',
      textAlignment: 'right',
      url: 'https://youtu.be/dQw4w9WgXcQ',
      label: 'https://youtu.be/dQw4w9WgXcQ',
    });
    expect(externalVideoNode?.attrs.sourceContent).toMatchObject([
      { type: 'text', text: 'https://youtu.be/dQw4w9WgXcQ', marks: [{ type: 'link' }] },
    ]);
    expect(mounted.editor.state.selection).toBeInstanceOf(NodeSelection);
    expect((mounted.editor.state.selection as NodeSelection).node).toBe(externalVideoNode);
    mounted.destroy();
  });

  it('uses the currently selected durable block when no captured target is supplied', () => {
    const mounted = createEditor();
    mounted.editor.commands.setTextSelection(18);

    expect(
      replaceParagraphWithExternalVideoLink(mounted.editor, {
        url: 'https://vimeo.com/123456',
        label: 'Field recording',
      }),
    ).toBe(true);

    const blockGroup = mounted.editor.state.doc.firstChild;
    expect(blockGroup?.child(0).textContent).toBe('Keep this');
    expect(blockGroup?.child(1).firstChild?.type.name).toBe('externalVideo');
    expect(blockGroup?.child(1).firstChild?.attrs).toMatchObject({
      url: 'https://vimeo.com/123456',
      label: 'Field recording',
    });
    mounted.destroy();
  });

  it('does not mutate for an unsupported URL, missing target, or read-only editor', () => {
    const mounted = createEditor();
    const before = mounted.editor.getJSON();

    expect(
      replaceParagraphWithExternalVideoLink(mounted.editor, {
        url: 'https://example.com/video',
        label: 'No provider',
      }),
    ).toBe(false);
    expect(
      replaceParagraphWithExternalVideoLink(
        mounted.editor,
        { url: 'https://vimeo.com/123456', label: 'Video' },
        'gone',
      ),
    ).toBe(false);
    mounted.editor.setEditable(false);
    expect(
      replaceParagraphWithExternalVideoLink(
        mounted.editor,
        { url: 'https://vimeo.com/123456', label: 'Video' },
        'current',
      ),
    ).toBe(false);
    expect(mounted.editor.getJSON()).toEqual(before);
    mounted.destroy();
  });
});
