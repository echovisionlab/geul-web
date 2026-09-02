// @vitest-environment jsdom

import { Editor } from '@tiptap/core';
import { NodeSelection } from '@tiptap/pm/state';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { EditorAuthoringMode } from '@/features/editor/EditorAuthoringMode';
import { createTiptapWireExtensions } from '../wire-schema';
import {
  canDeleteSelectedCodeBlock,
  deleteSelectedCodeBlock,
  getSelectedCodeBlock,
  updateSelectedCodeBlockAttrs,
} from './code-block-commands';

const mounted: { editor: Editor; element: HTMLElement }[] = [];

function createEditor(includeAfter = true) {
  const element = document.createElement('div');
  document.body.append(element);
  const editor = new Editor({
    element,
    extensions: createTiptapWireExtensions(),
    content: {
      type: 'doc',
      content: [
        {
          type: 'blockGroup',
          content: [
            {
              type: 'blockContainer',
              attrs: { id: 'code' },
              content: [
                {
                  type: 'codeBlock',
                  attrs: { language: 'javascript', previewWidth: '100', textAlignment: 'left' },
                  content: [{ type: 'text', text: 'const answer = 42;' }],
                },
              ],
            },
            ...(includeAfter
              ? [
                  {
                    type: 'blockContainer',
                    attrs: { id: 'after' },
                    content: [{ type: 'paragraph', content: [{ type: 'text', text: 'After' }] }],
                  },
                ]
              : []),
          ],
        },
      ],
    },
  });
  mounted.push({ editor, element });
  let containerPosition = -1;
  editor.state.doc.descendants((node, position) => {
    if (containerPosition < 0 && node.type.name === 'blockContainer' && node.attrs.id === 'code') {
      containerPosition = position;
    }
  });
  return { editor, containerPosition, codePosition: containerPosition + 1 };
}

function neutralMode(overrides: Partial<EditorAuthoringMode> = {}): EditorAuthoringMode {
  return {
    allowLocalizedBlockEdits: false,
    allowNeutralBlockEdits: true,
    ...overrides,
  };
}

afterEach(() => {
  for (const value of mounted.splice(0)) {
    value.editor.destroy();
    value.element.remove();
  }
});

describe('code block contextual commands', () => {
  it('resolves either the content node or its selected block container', () => {
    const { editor, containerPosition, codePosition } = createEditor();
    editor.view.dispatch(editor.state.tr.setSelection(NodeSelection.create(editor.state.doc, containerPosition)));
    expect(getSelectedCodeBlock(editor)).toMatchObject({
      position: codePosition,
      source: 'const answer = 42;',
      language: 'javascript',
      previewWidth: '100',
      textAlignment: 'left',
    });
    editor.view.dispatch(editor.state.tr.setSelection(NodeSelection.create(editor.state.doc, codePosition)));
    expect(getSelectedCodeBlock(editor)?.position).toBe(codePosition);
  });

  it('updates language and alignment without replacing source or losing selection', () => {
    const { editor, containerPosition, codePosition } = createEditor();
    const applyNeutralBlockProps = vi.fn();
    const authoringMode = neutralMode({ applyNeutralBlockProps });
    editor.view.dispatch(editor.state.tr.setSelection(NodeSelection.create(editor.state.doc, containerPosition)));
    expect(
      updateSelectedCodeBlockAttrs(
        editor,
        { language: 'typescript', previewWidth: '63', textAlignment: 'right' },
        authoringMode,
      ),
    ).toBe(true);
    expect(editor.state.doc.nodeAt(codePosition)?.attrs).toMatchObject({
      language: 'typescript',
      previewWidth: '63',
      textAlignment: 'right',
    });
    expect(applyNeutralBlockProps).toHaveBeenCalledWith('code', {
      language: 'typescript',
      previewWidth: '63',
      textAlignment: 'right',
    });
    expect(editor.state.doc.nodeAt(codePosition)?.textContent).toBe('const answer = 42;');
    expect(editor.state.selection).toBeInstanceOf(NodeSelection);
    expect(editor.state.selection.from).toBe(codePosition);
  });

  it('deletes the selected code container but refuses to delete a document sole block', () => {
    const { editor, containerPosition } = createEditor();
    const deleteNeutralBlock = vi.fn();
    const authoringMode = neutralMode({ deleteNeutralBlock });
    editor.view.dispatch(editor.state.tr.setSelection(NodeSelection.create(editor.state.doc, containerPosition)));
    expect(canDeleteSelectedCodeBlock(editor)).toBe(true);
    expect(deleteSelectedCodeBlock(editor, authoringMode)).toBe(true);
    expect(deleteNeutralBlock).toHaveBeenCalledWith('code');
    expect(editor.state.doc.textContent).toBe('After');

    const sole = createEditor(false);
    sole.editor.view.dispatch(
      sole.editor.state.tr.setSelection(NodeSelection.create(sole.editor.state.doc, sole.containerPosition + 1)),
    );
    expect(canDeleteSelectedCodeBlock(sole.editor)).toBe(false);
    expect(deleteSelectedCodeBlock(sole.editor, authoringMode)).toBe(false);
  });

  it('fails closed for target-locale neutral mutations while leaving localized source intact', () => {
    const { editor, codePosition } = createEditor();
    const applyNeutralBlockProps = vi.fn();
    const deleteNeutralBlock = vi.fn();
    const targetLocaleMode = neutralMode({
      allowLocalizedBlockEdits: true,
      allowNeutralBlockEdits: false,
      applyNeutralBlockProps,
      deleteNeutralBlock,
    });
    editor.view.dispatch(editor.state.tr.setSelection(NodeSelection.create(editor.state.doc, codePosition)));
    const before = editor.state.doc.toJSON();
    expect(updateSelectedCodeBlockAttrs(editor, { language: 'glsl' }, targetLocaleMode)).toBe(false);
    expect(deleteSelectedCodeBlock(editor, targetLocaleMode)).toBe(false);
    expect(editor.state.doc.toJSON()).toEqual(before);
    expect(editor.state.doc.nodeAt(codePosition)?.textContent).toBe('const answer = 42;');
    expect(applyNeutralBlockProps).not.toHaveBeenCalled();
    expect(deleteNeutralBlock).not.toHaveBeenCalled();
  });
});
