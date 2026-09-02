// @vitest-environment jsdom

import { act } from 'react';
import { Editor } from '@tiptap/core';
import { TextSelection } from '@tiptap/pm/state';
import { createRoot } from 'react-dom/client';
import { describe, expect, it } from 'vitest';
import { useRegisterEditorAuthoringMode, type EditorAuthoringMode } from '@/features/editor/EditorAuthoringMode';
import { createTiptapWireExtensions } from '../wire-schema';
import { createSelectionBubbleMenuCommands, resolveSelectionBubbleMenuState } from './selection-bubble-commands';

Object.defineProperties(Range.prototype, {
  getBoundingClientRect: {
    configurable: true,
    value: () => document.body.getBoundingClientRect(),
  },
  getClientRects: {
    configurable: true,
    value: () => [document.body.getBoundingClientRect()],
  },
});

function RegistrationHarness({ editor, mode }: { editor: Editor; mode: EditorAuthoringMode }) {
  useRegisterEditorAuthoringMode(editor, mode);
  return null;
}

function block(id: string, text: string) {
  return {
    type: 'blockContainer',
    attrs: { id },
    content: [
      {
        type: 'paragraph',
        attrs: { backgroundColor: 'default', textColor: 'default', textAlignment: 'left' },
        content: [{ type: 'text', text }],
      },
    ],
  };
}

describe('localized selection BubbleMenu authority', () => {
  it('keeps locale text actions while rejecting neutral structure actions', async () => {
    const editorElement = document.createElement('div');
    const reactElement = document.createElement('div');
    document.body.append(editorElement, reactElement);
    const editor = new Editor({
      element: editorElement,
      extensions: createTiptapWireExtensions(),
      content: {
        type: 'doc',
        content: [
          {
            type: 'blockGroup',
            content: [block('first', 'first'), block('second', 'localized text')],
          },
        ],
      },
    });
    let secondParagraph = -1;
    editor.state.doc.descendants((node, position) => {
      if (node.type.name === 'paragraph' && node.textContent === 'localized text') {
        secondParagraph = position;
      }
    });
    if (secondParagraph < 0) {
      throw new Error('Expected the localized paragraph.');
    }
    editor.view.dispatch(
      editor.state.tr.setSelection(TextSelection.create(editor.state.doc, secondParagraph + 1, secondParagraph + 10)),
    );
    const root = createRoot(reactElement);

    await act(async () => {
      root.render(
        <RegistrationHarness
          editor={editor}
          mode={{ allowLocalizedBlockEdits: true, allowNeutralBlockEdits: false }}
        />,
      );
      await Promise.resolve();
    });

    const state = resolveSelectionBubbleMenuState(editor);
    expect(state).toMatchObject({
      canFormatText: true,
      canColor: true,
      canChangeBlockType: false,
      canAlign: false,
      canNest: false,
      canUnnest: false,
      canConvertToInlineMath: true,
    });
    const commands = createSelectionBubbleMenuCommands(editor);
    expect(commands.toggleTextStyle('bold')).toBe(true);
    expect(editor.isActive('bold')).toBe(true);
    expect(commands.setBlockType('heading-1')).toBe(false);
    expect(commands.setAlignment('center')).toBe(false);
    expect(commands.nest()).toBe(false);

    await act(async () => root.unmount());
    editor.destroy();
    editorElement.remove();
    reactElement.remove();
  });
});
