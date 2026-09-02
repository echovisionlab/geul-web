// @vitest-environment jsdom

import { Editor, type Extensions, type JSONContent } from '@tiptap/core';
import { NodeSelection, TextSelection } from '@tiptap/pm/state';
import { CellSelection } from '@tiptap/pm/tables';
import { describe, expect, it } from 'vitest';
import { createP5SketchExtension } from './p5';
import { DEFAULT_P5_SKETCH_LABELS } from './p5/p5-labels.fixtures';
import { createShaderExtension } from './shader';
import { createThreeSceneExtension, DEFAULT_THREE_SCENE_LABELS } from './three';
import {
  changeCurrentBlockAlignment,
  insertParagraphAfterSelectedBlock,
  joinCurrentTextBlockBackward,
  moveCurrentBlock,
  resolveNextTextAlignment,
  setCurrentBlockAlignment,
  splitCurrentTextBlock,
} from './block-commands';
import { createTiptapWireExtensions } from './wire-schema';
import { createTiptapTableExtensions } from './table';

const defaultContent: JSONContent = {
  type: 'doc',
  content: [
    {
      type: 'blockGroup',
      content: [
        {
          type: 'blockContainer',
          attrs: { id: 'first' },
          content: [
            {
              type: 'paragraph',
              attrs: { backgroundColor: 'default', textColor: 'default', textAlignment: 'left' },
              content: [{ type: 'text', text: 'first' }],
            },
          ],
        },
        {
          type: 'blockContainer',
          attrs: { id: 'second' },
          content: [
            {
              type: 'paragraph',
              attrs: { backgroundColor: 'default', textColor: 'default', textAlignment: 'center' },
              content: [{ type: 'text', text: 'second' }],
            },
          ],
        },
      ],
    },
  ],
};

function createEditor(content: JSONContent = defaultContent, extraExtensions: Extensions = []) {
  const element = document.createElement('div');
  document.body.append(element);
  const editor = new Editor({
    element,
    extensions: [...createTiptapWireExtensions(), ...createTiptapTableExtensions(), ...extraExtensions],
    content,
  });
  return {
    editor,
    destroy() {
      editor.destroy();
      element.remove();
    },
  };
}

function positionsOf(editor: Editor, nodeName: string) {
  const positions: number[] = [];
  editor.state.doc.descendants((node, position) => {
    if (node.type.name === nodeName) {
      positions.push(position);
    }
  });
  return positions;
}

describe('Tiptap block commands', () => {
  it('creates a sibling block on Enter while preserving and splitting paragraph content', () => {
    const mounted = createEditor();
    const [paragraph] = positionsOf(mounted.editor, 'paragraph');
    mounted.editor.commands.setTextSelection(paragraph + 3);

    const enter = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true });
    mounted.editor.view.dom.dispatchEvent(enter);
    expect(enter.defaultPrevented).toBe(true);
    const group = mounted.editor.state.doc.firstChild;
    expect(group?.childCount).toBe(3);
    expect(group?.child(0).attrs.id).toBe('first');
    expect(group?.child(0).textContent).toBe('fi');
    expect(group?.child(1).attrs.id).not.toBe('first');
    expect(group?.child(1).textContent).toBe('rst');
    expect(group?.child(2).attrs.id).toBe('second');
    expect(mounted.editor.state.selection.$from.parent.type.name).toBe('paragraph');
    expect(mounted.editor.state.selection.$from.parent.textContent).toBe('rst');
    expect(mounted.editor.state.selection.$from.parentOffset).toBe(0);
    mounted.destroy();
  });

  it('replaces a selected paragraph range when creating the next block', () => {
    const mounted = createEditor();
    const [paragraph] = positionsOf(mounted.editor, 'paragraph');
    mounted.editor.view.dispatch(
      mounted.editor.state.tr.setSelection(
        TextSelection.create(mounted.editor.state.doc, paragraph + 2, paragraph + 4),
      ),
    );

    expect(splitCurrentTextBlock(mounted.editor)).toBe(true);
    const group = mounted.editor.state.doc.firstChild;
    expect(group?.child(0).textContent).toBe('f');
    expect(group?.child(1).textContent).toBe('st');
    mounted.destroy();
  });

  it.each([
    { label: 'Paragraph', type: 'paragraph', attrs: {} },
    { label: 'Heading', type: 'heading', attrs: { level: 2 } },
    { label: 'Quote', type: 'quote', attrs: {} },
    { label: 'bullet list item', type: 'bulletListItem', attrs: {} },
    { label: 'numbered list item', type: 'numberedListItem', attrs: { start: 2 } },
    { label: 'check list item', type: 'checkListItem', attrs: { checked: false } },
    { label: 'Callout', type: 'callout', attrs: { icon: '💡' } },
  ])('reuses the next empty Paragraph after a $label instead of inserting a duplicate', ({ type, attrs }) => {
    const mounted = createEditor({
      type: 'doc',
      content: [
        {
          type: 'blockGroup',
          content: [
            {
              type: 'blockContainer',
              attrs: { id: 'current' },
              content: [{ type, attrs, content: [{ type: 'text', text: 'Current' }] }],
            },
            {
              type: 'blockContainer',
              attrs: { id: 'trailing-empty' },
              content: [{ type: 'paragraph' }],
            },
          ],
        },
      ],
    });
    const [current] = positionsOf(mounted.editor, type);
    mounted.editor.commands.setTextSelection(current + 'Current'.length + 1);

    const enter = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true });
    mounted.editor.view.dom.dispatchEvent(enter);

    const group = mounted.editor.state.doc.firstChild;
    expect(enter.defaultPrevented).toBe(true);
    expect(group?.childCount).toBe(2);
    expect(group?.child(0).attrs.id).toBe('current');
    expect(group?.child(0).textContent).toBe('Current');
    expect(group?.child(1).attrs.id).toBe('trailing-empty');
    expect(group?.child(1).firstChild?.type.name).toBe('paragraph');
    expect(mounted.editor.state.selection.$from.parent).toBe(group?.child(1).firstChild);
    expect(mounted.editor.state.selection.$from.parentOffset).toBe(0);
    mounted.destroy();
  });

  it.each([
    {
      label: 'selected Map content',
      nodeType: 'map',
      node: {
        type: 'map',
        attrs: { mapPlaceIds: 'place-1', centerLat: '37.5', centerLng: '127.0', zoom: '12' },
      },
    },
    {
      label: 'selected Math content',
      nodeType: 'math',
      node: { type: 'math', attrs: { latex: 'x^2 + y^2' } },
    },
    {
      label: 'selected Code content',
      nodeType: 'codeBlock',
      node: {
        type: 'codeBlock',
        attrs: { title: 'Example', language: 'typescript' },
        content: [{ type: 'text', text: 'const value = 1;' }],
      },
    },
    {
      label: 'selected Divider content',
      nodeType: 'divider',
      node: { type: 'divider' },
    },
    {
      label: 'selected P5 content',
      nodeType: 'p5Sketch',
      node: {
        type: 'p5Sketch',
        attrs: { title: 'Sketch', mode: 'edit', previewHeight: 360, previewWidth: '100', textAlignment: 'left' },
        content: [{ type: 'text', text: 'function setup() {}' }],
      },
      extensions: [createP5SketchExtension({ labels: DEFAULT_P5_SKETCH_LABELS })],
    },
    {
      label: 'selected Three content',
      nodeType: 'threeScene',
      node: {
        type: 'threeScene',
        attrs: { title: 'Scene', mode: 'edit', previewHeight: 360, previewWidth: '100', textAlignment: 'left' },
        content: [{ type: 'text', text: 'scene.add(cube);' }],
      },
      extensions: [createThreeSceneExtension({ labels: DEFAULT_THREE_SCENE_LABELS })],
    },
    {
      label: 'selected Shader content',
      nodeType: 'shader',
      node: {
        type: 'shader',
        attrs: { title: 'Shader', mode: 'edit', previewHeight: 360, previewWidth: '100', textAlignment: 'left' },
        content: [
          { type: 'shaderCommon' },
          { type: 'shaderVertex', content: [{ type: 'text', text: 'void main() {}' }] },
          { type: 'shaderBufferA' },
          { type: 'shaderBufferB' },
          { type: 'shaderBufferC' },
          { type: 'shaderBufferD' },
          { type: 'shaderCubemap' },
          { type: 'shaderSound' },
          { type: 'shaderImage' },
        ],
      },
      extensions: [createShaderExtension()],
    },
    {
      label: 'selected Audio/File content',
      nodeType: 'file',
      node: {
        type: 'file',
        attrs: {
          fileId: '20000000-0000-4000-8000-000000000001',
          mimeType: 'audio/wav',
          name: 'local-tone.wav',
        },
      },
      selectContainer: false,
    },
    {
      label: 'selected YouTube content',
      nodeType: 'externalVideo',
      node: {
        type: 'externalVideo',
        attrs: {
          url: 'https://youtu.be/dQw4w9WgXcQ?t=60',
          label: 'Field recording',
          sourceContent: [
            {
              type: 'text',
              text: 'Field recording',
              marks: [{ type: 'link', attrs: { href: 'https://youtu.be/dQw4w9WgXcQ?t=60' } }],
            },
          ],
        },
      },
      selectContainer: false,
    },
    {
      label: 'selected outer File block',
      nodeType: 'file',
      node: { type: 'file', attrs: { name: 'attachment.pdf', mimeType: 'application/pdf' } },
      selectContainer: true,
    },
  ])(
    'creates a writable Paragraph directly after $label on Enter',
    ({ node, nodeType, extensions, selectContainer }) => {
      const mounted = createEditor(
        {
          type: 'doc',
          content: [
            {
              type: 'blockGroup',
              content: [
                { type: 'blockContainer', attrs: { id: 'media' }, content: [node] },
                {
                  type: 'blockContainer',
                  attrs: { id: 'after' },
                  content: [{ type: 'paragraph', content: [{ type: 'text', text: 'After' }] }],
                },
              ],
            },
          ],
        },
        extensions,
      );
      const mediaPosition = positionsOf(mounted.editor, selectContainer ? 'blockContainer' : nodeType)[0];
      const before = mounted.editor.state.doc.firstChild?.firstChild?.toJSON();
      const beforeNode = mounted.editor.state.doc.nodeAt(mediaPosition);
      const beforeDOM = mounted.editor.view.nodeDOM(mediaPosition);
      mounted.editor.view.dispatch(
        mounted.editor.state.tr.setSelection(NodeSelection.create(mounted.editor.state.doc, mediaPosition)),
      );

      const enter = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true });
      mounted.editor.view.dom.dispatchEvent(enter);

      const group = mounted.editor.state.doc.firstChild;
      expect(enter.defaultPrevented).toBe(true);
      expect(group?.childCount).toBe(3);
      expect(group?.child(0).attrs.id).toBe('media');
      expect(group?.child(0).toJSON()).toEqual(before);
      expect(group?.child(0).firstChild?.toJSON()).toEqual(
        selectContainer ? beforeNode?.firstChild?.toJSON() : beforeNode?.toJSON(),
      );
      expect(mounted.editor.view.nodeDOM(mediaPosition)).toBe(beforeDOM);
      expect(group?.child(1).attrs.id).toEqual(expect.any(String));
      expect(group?.child(1).attrs.id).not.toBe('media');
      expect(group?.child(1).firstChild?.type.name).toBe('paragraph');
      expect(group?.child(2).attrs.id).toBe('after');
      expect(mounted.editor.state.selection).toBeInstanceOf(TextSelection);
      expect(mounted.editor.state.selection.$from.parent).toBe(group?.child(1).firstChild);
      expect(mounted.editor.state.selection.$from.parentOffset).toBe(0);

      mounted.editor.commands.insertContent('New paragraph');
      expect(mounted.editor.state.doc.firstChild?.child(1).textContent).toBe('New paragraph');
      expect(mounted.editor.state.doc.firstChild?.child(0).toJSON()).toEqual(before);
      mounted.destroy();
    },
  );

  it('does not create a Paragraph after a selected Block in read-only mode', () => {
    const mounted = createEditor({
      type: 'doc',
      content: [
        {
          type: 'blockGroup',
          content: [
            {
              type: 'blockContainer',
              attrs: { id: 'media' },
              content: [{ type: 'file', attrs: { name: 'attachment.pdf', mimeType: 'application/pdf' } }],
            },
          ],
        },
      ],
    });
    const [file] = positionsOf(mounted.editor, 'file');
    mounted.editor.view.dispatch(
      mounted.editor.state.tr.setSelection(NodeSelection.create(mounted.editor.state.doc, file)),
    );
    mounted.editor.setEditable(false);
    const before = mounted.editor.state.doc.toJSON();

    expect(insertParagraphAfterSelectedBlock(mounted.editor)).toBe(false);
    expect(mounted.editor.state.doc.toJSON()).toEqual(before);
    mounted.destroy();
  });

  it('removes the new empty paragraph block with one Backspace and restores the previous cursor', () => {
    const mounted = createEditor();
    const [paragraph] = positionsOf(mounted.editor, 'paragraph');
    mounted.editor.commands.setTextSelection(paragraph + 6);
    const enter = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true });
    mounted.editor.view.dom.dispatchEvent(enter);
    expect(enter.defaultPrevented).toBe(true);
    expect(mounted.editor.state.doc.firstChild?.childCount).toBe(3);

    const backspace = new KeyboardEvent('keydown', { key: 'Backspace', bubbles: true, cancelable: true });
    mounted.editor.view.dom.dispatchEvent(backspace);
    expect(backspace.defaultPrevented).toBe(true);
    expect(mounted.editor.state.doc.firstChild?.childCount).toBe(2);
    expect(mounted.editor.state.doc.firstChild?.child(0).textContent).toBe('first');
    expect(mounted.editor.state.selection.$from.parent.textContent).toBe('first');
    expect(mounted.editor.state.selection.$from.parentOffset).toBe(5);
    mounted.destroy();
  });

  it('removes an empty paragraph after a heading instead of leaving Backspace stuck', () => {
    const mounted = createEditor({
      type: 'doc',
      content: [
        {
          type: 'blockGroup',
          content: [
            {
              type: 'blockContainer',
              attrs: { id: 'heading' },
              content: [{ type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: 'Hell' }] }],
            },
            {
              type: 'blockContainer',
              attrs: { id: 'empty' },
              content: [{ type: 'paragraph' }],
            },
          ],
        },
      ],
    });
    const [paragraph] = positionsOf(mounted.editor, 'paragraph');
    mounted.editor.commands.setTextSelection(paragraph + 1);

    const backspace = new KeyboardEvent('keydown', { key: 'Backspace', bubbles: true, cancelable: true });
    mounted.editor.view.dom.dispatchEvent(backspace);

    const group = mounted.editor.state.doc.firstChild;
    expect(backspace.defaultPrevented).toBe(true);
    expect(group?.childCount).toBe(1);
    expect(group?.firstChild?.attrs.id).toBe('heading');
    expect(group?.firstChild?.firstChild?.type.name).toBe('heading');
    expect(group?.firstChild?.textContent).toBe('Hell');
    expect(mounted.editor.state.selection.$from.parent.type.name).toBe('heading');
    expect(mounted.editor.state.selection.$from.parentOffset).toBe(4);
    mounted.destroy();
  });

  it('joins a non-empty paragraph into the preceding text block without changing that block type or ID', () => {
    const mounted = createEditor({
      type: 'doc',
      content: [
        {
          type: 'blockGroup',
          content: [
            {
              type: 'blockContainer',
              attrs: { id: 'heading' },
              content: [{ type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Hell' }] }],
            },
            {
              type: 'blockContainer',
              attrs: { id: 'paragraph' },
              content: [{ type: 'paragraph', content: [{ type: 'text', text: 'o' }] }],
            },
          ],
        },
      ],
    });
    const [paragraph] = positionsOf(mounted.editor, 'paragraph');
    mounted.editor.commands.setTextSelection(paragraph + 1);

    expect(joinCurrentTextBlockBackward(mounted.editor)).toBe(true);

    const block = mounted.editor.state.doc.firstChild?.firstChild;
    expect(block?.attrs.id).toBe('heading');
    expect(block?.firstChild?.type.name).toBe('heading');
    expect(block?.firstChild?.attrs.level).toBe(2);
    expect(block?.textContent).toBe('Hello');
    expect(mounted.editor.state.selection.$from.parentOffset).toBe(4);
    mounted.destroy();
  });

  it('preserves preceding nested children when removing an empty paragraph boundary', () => {
    const mounted = createEditor({
      type: 'doc',
      content: [
        {
          type: 'blockGroup',
          content: [
            {
              type: 'blockContainer',
              attrs: { id: 'parent' },
              content: [
                { type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: 'Parent' }] },
                {
                  type: 'blockGroup',
                  content: [
                    {
                      type: 'blockContainer',
                      attrs: { id: 'child' },
                      content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Child' }] }],
                    },
                  ],
                },
              ],
            },
            {
              type: 'blockContainer',
              attrs: { id: 'empty' },
              content: [{ type: 'paragraph' }],
            },
          ],
        },
      ],
    });
    const paragraphs = positionsOf(mounted.editor, 'paragraph');
    mounted.editor.commands.setTextSelection(paragraphs[1] + 1);

    expect(joinCurrentTextBlockBackward(mounted.editor)).toBe(true);

    const parent = mounted.editor.state.doc.firstChild?.firstChild;
    expect(mounted.editor.state.doc.firstChild?.childCount).toBe(1);
    expect(parent?.attrs.id).toBe('parent');
    expect(parent?.childCount).toBe(2);
    expect(parent?.child(1).firstChild?.attrs.id).toBe('child');
    expect(mounted.editor.state.selection.$from.parent.type.name).toBe('heading');
    expect(mounted.editor.state.selection.$from.parentOffset).toBe(6);
    mounted.destroy();
  });

  it('joins a non-empty paragraph block backward without changing the previous block ID', () => {
    const mounted = createEditor();
    const paragraphs = positionsOf(mounted.editor, 'paragraph');
    mounted.editor.commands.setTextSelection(paragraphs[1] + 1);

    expect(joinCurrentTextBlockBackward(mounted.editor)).toBe(true);
    const group = mounted.editor.state.doc.firstChild;
    expect(group?.childCount).toBe(1);
    expect(group?.child(0).attrs.id).toBe('first');
    expect(group?.child(0).textContent).toBe('firstsecond');
    expect(mounted.editor.state.selection.$from.parentOffset).toBe(5);
    mounted.destroy();
  });

  it.each([
    { label: 'Heading', type: 'heading', attrs: { level: 2 } },
    { label: 'Quote', type: 'quote', attrs: {} },
    { label: 'bullet list item', type: 'bulletListItem', attrs: {} },
    { label: 'numbered list item', type: 'numberedListItem', attrs: { start: 3 } },
    { label: 'check list item', type: 'checkListItem', attrs: { checked: true } },
    { label: 'Callout', type: 'callout', attrs: { icon: '💡' } },
  ])('turns a $label into a Paragraph before considering a backward join', ({ type, attrs }) => {
    const mounted = createEditor({
      type: 'doc',
      content: [
        {
          type: 'blockGroup',
          content: [
            {
              type: 'blockContainer',
              attrs: { id: 'before' },
              content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Before' }] }],
            },
            {
              type: 'blockContainer',
              attrs: { id: 'current' },
              content: [{ type, attrs, content: [{ type: 'text', text: 'Next' }] }],
            },
          ],
        },
      ],
    });
    const [current] = positionsOf(mounted.editor, type);
    mounted.editor.commands.setTextSelection(current + 1);

    const backspace = new KeyboardEvent('keydown', { key: 'Backspace', bubbles: true, cancelable: true });
    mounted.editor.view.dom.dispatchEvent(backspace);

    const group = mounted.editor.state.doc.firstChild;
    expect(backspace.defaultPrevented).toBe(true);
    expect(group?.childCount).toBe(2);
    expect(group?.child(0).attrs.id).toBe('before');
    expect(group?.child(0).textContent).toBe('Before');
    expect(group?.child(1).attrs.id).toBe('current');
    expect(group?.child(1).firstChild?.type.name).toBe('paragraph');
    expect(group?.child(1).textContent).toBe('Next');
    expect(mounted.editor.state.selection.$from.parent.type.name).toBe('paragraph');
    expect(mounted.editor.state.selection.$from.parentOffset).toBe(0);
    mounted.destroy();
  });

  it('selects and then deletes the preceding media block on repeated Backspace', () => {
    const mounted = createEditor({
      type: 'doc',
      content: [
        {
          type: 'blockGroup',
          content: [
            {
              type: 'blockContainer',
              attrs: { id: 'audio' },
              content: [{ type: 'file', attrs: { fileId: 'audio-file', mimeType: 'audio/wav' } }],
            },
            {
              type: 'blockContainer',
              attrs: { id: 'paragraph' },
              content: [{ type: 'paragraph', content: [{ type: 'text', text: 'After audio' }] }],
            },
          ],
        },
      ],
    });
    const [paragraph] = positionsOf(mounted.editor, 'paragraph');
    mounted.editor.commands.setTextSelection(paragraph + 1);

    const selectMedia = new KeyboardEvent('keydown', { key: 'Backspace', bubbles: true, cancelable: true });
    mounted.editor.view.dom.dispatchEvent(selectMedia);

    expect(selectMedia.defaultPrevented).toBe(true);
    expect(mounted.editor.state.selection).toBeInstanceOf(NodeSelection);
    expect((mounted.editor.state.selection as NodeSelection).node.type.name).toBe('blockContainer');
    expect((mounted.editor.state.selection as NodeSelection).node.attrs.id).toBe('audio');
    expect(mounted.editor.state.doc.firstChild?.childCount).toBe(2);

    const deleteMedia = new KeyboardEvent('keydown', { key: 'Backspace', bubbles: true, cancelable: true });
    mounted.editor.view.dom.dispatchEvent(deleteMedia);

    expect(deleteMedia.defaultPrevented).toBe(true);
    expect(mounted.editor.state.doc.firstChild?.childCount).toBe(1);
    expect(mounted.editor.state.doc.firstChild?.firstChild?.attrs.id).toBe('paragraph');
    expect(mounted.editor.state.selection).toBeInstanceOf(TextSelection);
    expect(mounted.editor.state.selection.$from.parent.type.name).toBe('paragraph');
    expect(mounted.editor.state.selection.$from.parentOffset).toBe(0);
    mounted.destroy();
  });

  it('matches the established clamped alignment shortcut order', () => {
    expect(resolveNextTextAlignment('left', 'backward')).toBe('left');
    expect(resolveNextTextAlignment('left', 'forward')).toBe('center');
    expect(resolveNextTextAlignment('center', 'forward')).toBe('right');
    expect(resolveNextTextAlignment('right', 'forward')).toBe('right');
  });

  it('updates only the selected block content alignment', () => {
    const mounted = createEditor();
    mounted.editor.commands.setTextSelection(3);

    expect(changeCurrentBlockAlignment(mounted.editor, 'forward')).toBe(true);
    const blockGroup = mounted.editor.state.doc.firstChild;
    expect(blockGroup?.child(0).firstChild?.attrs.textAlignment).toBe('center');
    expect(blockGroup?.child(1).firstChild?.attrs.textAlignment).toBe('center');
    mounted.destroy();
  });

  it('aligns every block content intersected by a text selection', () => {
    const mounted = createEditor();
    const paragraphs = positionsOf(mounted.editor, 'paragraph');
    mounted.editor.view.dispatch(
      mounted.editor.state.tr.setSelection(
        TextSelection.create(mounted.editor.state.doc, paragraphs[0] + 1, paragraphs[1] + 2),
      ),
    );

    expect(setCurrentBlockAlignment(mounted.editor, 'right')).toBe(true);
    expect(
      Array.from(
        { length: 2 },
        (_, index) => mounted.editor.state.doc.firstChild?.child(index).firstChild?.attrs.textAlignment,
      ),
    ).toEqual(['right', 'right']);
    mounted.destroy();
  });

  it('resolves both content and block-container node selections', () => {
    const mounted = createEditor();
    const [firstBlock] = positionsOf(mounted.editor, 'blockContainer');
    const [firstParagraph] = positionsOf(mounted.editor, 'paragraph');

    mounted.editor.view.dispatch(
      mounted.editor.state.tr.setSelection(NodeSelection.create(mounted.editor.state.doc, firstParagraph)),
    );
    expect(setCurrentBlockAlignment(mounted.editor, 'center')).toBe(true);

    mounted.editor.view.dispatch(
      mounted.editor.state.tr.setSelection(NodeSelection.create(mounted.editor.state.doc, firstBlock)),
    );
    expect(moveCurrentBlock(mounted.editor, 'down')).toBe(true);
    expect(mounted.editor.state.selection).toBeInstanceOf(NodeSelection);
    expect((mounted.editor.state.selection as NodeSelection).node.type.name).toBe('blockContainer');
    expect(mounted.editor.state.doc.firstChild?.child(1).attrs.id).toBe('first');
    mounted.destroy();
  });

  it('aligns all cells in a cell selection without changing their containing block ID', () => {
    const mounted = createEditor({
      type: 'doc',
      content: [
        {
          type: 'blockGroup',
          content: [
            {
              type: 'blockContainer',
              attrs: { id: 'table-block' },
              content: [
                {
                  type: 'table',
                  content: [
                    {
                      type: 'tableRow',
                      content: [
                        {
                          type: 'tableCell',
                          content: [{ type: 'tableParagraph', content: [{ type: 'text', text: 'one' }] }],
                        },
                        {
                          type: 'tableCell',
                          content: [{ type: 'tableParagraph', content: [{ type: 'text', text: 'two' }] }],
                        },
                      ],
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    });
    const cells = positionsOf(mounted.editor, 'tableCell');
    mounted.editor.view.dispatch(
      mounted.editor.state.tr.setSelection(CellSelection.create(mounted.editor.state.doc, cells[0], cells[1])),
    );

    expect(setCurrentBlockAlignment(mounted.editor, 'right')).toBe(true);
    expect(
      positionsOf(mounted.editor, 'tableCell').map(
        (position) => mounted.editor.state.doc.nodeAt(position)?.attrs.textAlignment,
      ),
    ).toEqual(['right', 'right']);
    expect(mounted.editor.state.doc.firstChild?.firstChild?.attrs.id).toBe('table-block');
    expect(moveCurrentBlock(mounted.editor, 'down')).toBe(false);
    mounted.destroy();
  });

  it('aligns the current table cell from a text cursor', () => {
    const mounted = createEditor({
      type: 'doc',
      content: [
        {
          type: 'blockGroup',
          content: [
            {
              type: 'blockContainer',
              attrs: { id: 'table-block' },
              content: [
                {
                  type: 'table',
                  content: [
                    {
                      type: 'tableRow',
                      content: [
                        {
                          type: 'tableCell',
                          content: [{ type: 'tableParagraph', content: [{ type: 'text', text: 'one' }] }],
                        },
                      ],
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    });
    const [paragraph] = positionsOf(mounted.editor, 'tableParagraph');
    mounted.editor.commands.setTextSelection(paragraph + 1);

    expect(changeCurrentBlockAlignment(mounted.editor, 'forward')).toBe(true);
    const [cell] = positionsOf(mounted.editor, 'tableCell');
    expect(mounted.editor.state.doc.nodeAt(cell)?.attrs.textAlignment).toBe('center');
    mounted.destroy();
  });

  it('returns false without mutation when selected content does not support alignment', () => {
    const mounted = createEditor({
      type: 'doc',
      content: [
        {
          type: 'blockGroup',
          content: [
            {
              type: 'blockContainer',
              attrs: { id: 'quote' },
              content: [{ type: 'quote', content: [{ type: 'text', text: 'quote' }] }],
            },
          ],
        },
      ],
    });
    const before = mounted.editor.state.doc;
    mounted.editor.commands.setTextSelection(3);

    expect(setCurrentBlockAlignment(mounted.editor, 'right')).toBe(false);
    expect(mounted.editor.state.doc.eq(before)).toBe(true);
    mounted.destroy();
  });

  it('moves the current block among its siblings and stops at the group boundary', () => {
    const mounted = createEditor();
    mounted.editor.commands.setTextSelection(3);

    expect(moveCurrentBlock(mounted.editor, 'up')).toBe(false);
    expect(moveCurrentBlock(mounted.editor, 'down')).toBe(true);
    const blockGroup = mounted.editor.state.doc.firstChild;
    expect([blockGroup?.child(0).attrs.id, blockGroup?.child(1).attrs.id]).toEqual(['second', 'first']);
    expect(moveCurrentBlock(mounted.editor, 'down')).toBe(false);
    mounted.destroy();
  });

  it('moves a nested block only within its own block group', () => {
    const mounted = createEditor({
      type: 'doc',
      content: [
        {
          type: 'blockGroup',
          content: [
            {
              type: 'blockContainer',
              attrs: { id: 'parent' },
              content: [
                { type: 'paragraph', content: [{ type: 'text', text: 'parent' }] },
                {
                  type: 'blockGroup',
                  content: [
                    {
                      type: 'blockContainer',
                      attrs: { id: 'nested-first' },
                      content: [{ type: 'paragraph', content: [{ type: 'text', text: 'nested first' }] }],
                    },
                    {
                      type: 'blockContainer',
                      attrs: { id: 'nested-second' },
                      content: [{ type: 'paragraph', content: [{ type: 'text', text: 'nested second' }] }],
                    },
                  ],
                },
              ],
            },
            {
              type: 'blockContainer',
              attrs: { id: 'outer-sibling' },
              content: [{ type: 'paragraph', content: [{ type: 'text', text: 'outer' }] }],
            },
          ],
        },
      ],
    });
    const nestedSecond = positionsOf(mounted.editor, 'blockContainer').find(
      (position) => mounted.editor.state.doc.nodeAt(position)?.attrs.id === 'nested-second',
    );
    expect(nestedSecond).toBeTypeOf('number');
    mounted.editor.view.dispatch(
      mounted.editor.state.tr.setSelection(NodeSelection.create(mounted.editor.state.doc, nestedSecond!)),
    );

    expect(moveCurrentBlock(mounted.editor, 'up')).toBe(true);
    const outerGroup = mounted.editor.state.doc.firstChild;
    const nestedGroup = outerGroup?.child(0).child(1);
    expect([nestedGroup?.child(0).attrs.id, nestedGroup?.child(1).attrs.id]).toEqual(['nested-second', 'nested-first']);
    expect([outerGroup?.child(0).attrs.id, outerGroup?.child(1).attrs.id]).toEqual(['parent', 'outer-sibling']);
    mounted.destroy();
  });

  it('binds the established keyboard shortcuts to the same block commands', () => {
    const mounted = createEditor();
    mounted.editor.commands.setTextSelection(3);

    mounted.editor.view.dom.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'ArrowRight', ctrlKey: true, shiftKey: true, bubbles: true }),
    );
    expect(mounted.editor.state.doc.firstChild?.child(0).firstChild?.attrs.textAlignment).toBe('center');
    mounted.editor.view.dom.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'ArrowDown', altKey: true, shiftKey: true, bubbles: true }),
    );
    expect([
      mounted.editor.state.doc.firstChild?.child(0).attrs.id,
      mounted.editor.state.doc.firstChild?.child(1).attrs.id,
    ]).toEqual(['second', 'first']);
    mounted.destroy();
  });
});
