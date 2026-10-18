import { Editor, type Extensions } from '@tiptap/core';
import { describe, expect, it } from 'vitest';
import { createTiptapWireExtensions } from '../wire-schema';
import { TiptapMathInput, withTiptapMathExtensions } from './index';

function documentWith(content: Record<string, unknown>) {
  return {
    type: 'doc',
    content: [
      { type: 'blockGroup', content: [{ type: 'blockContainer', attrs: { id: 'target' }, content: [content] }] },
    ],
  };
}

// No `element`: the editor keeps its state without an EditorView, which is all text input handlers read.
function createEditor(
  content: Record<string, unknown>,
  extensions: Extensions = withTiptapMathExtensions(createTiptapWireExtensions()),
) {
  const editor = new Editor({ element: null, extensions, content: documentWith(content) });
  editor.view.updateState(editor.state.reconfigure({ plugins: editor.extensionManager.plugins }));
  return editor;
}

function findNodePosition(editor: Editor, name: string): number {
  let position = -1;
  editor.state.doc.descendants((node, pos) => {
    if (node.type.name === name) {
      position = pos;
      return false;
    }
    return true;
  });
  return position;
}

/** Offers typed text to each plugin in order until one handles it, as ProseMirror does for `handleTextInput`. */
function inputText(editor: Editor, text: string): boolean {
  const position = editor.state.selection.from;
  return editor.state.plugins.some((plugin) =>
    Boolean(plugin.props.handleTextInput?.call(plugin, editor.view, position, position, text, () => editor.state.tr)),
  );
}

describe('Tiptap math input', () => {
  it('converts a completed $...$ input rule without converting incomplete, empty, or code source', () => {
    const completed = createEditor({ type: 'paragraph', content: [{ type: 'text', text: '$x' }] });
    completed.commands.setTextSelection(findNodePosition(completed, 'paragraph') + 3);
    expect(inputText(completed, '$')).toBe(true);
    expect(completed.getJSON()).toMatchObject(
      documentWith({ type: 'paragraph', content: [{ type: 'mathInline', content: [{ type: 'text', text: 'x' }] }] }),
    );
    completed.destroy();

    const incomplete = createEditor({ type: 'paragraph', content: [{ type: 'text', text: '$x' }] });
    incomplete.commands.setTextSelection(findNodePosition(incomplete, 'paragraph') + 3);
    expect(inputText(incomplete, 'y')).toBe(false);
    expect(incomplete.getText()).toContain('$x');
    incomplete.destroy();

    const empty = createEditor({ type: 'paragraph', content: [{ type: 'text', text: '$' }] });
    empty.commands.setTextSelection(findNodePosition(empty, 'paragraph') + 2);
    expect(inputText(empty, '$')).toBe(false);
    empty.destroy();

    const code = createEditor({ type: 'codeBlock', content: [{ type: 'text', text: '$x' }] });
    code.commands.setTextSelection(findNodePosition(code, 'codeBlock') + 3);
    expect(inputText(code, '$')).toBe(false);
    code.destroy();
  });

  it('keeps inline source plain and skips delimiter conversion while the caret is inside it', () => {
    const editor = createEditor({
      type: 'paragraph',
      content: [{ type: 'mathInline', content: [{ type: 'text', text: '$x' }] }],
    });
    const position = findNodePosition(editor, 'mathInline');
    editor.commands.setTextSelection({ from: position + 1, to: position + 3 });
    editor.chain().toggleMark('bold').run();
    expect(editor.state.doc.nodeAt(position)?.firstChild?.marks).toHaveLength(0);

    editor.commands.setTextSelection(position + 3);
    expect(inputText(editor, '$')).toBe(false);
    expect(editor.state.doc.nodeAt(position)?.textContent).toBe('$x');
    editor.destroy();
  });

  it('converts a complete standalone $$...$$ paragraph to block math only outside a table', () => {
    const editor = createEditor({ type: 'paragraph', content: [{ type: 'text', text: '$$x^2$' }] });
    editor.commands.setTextSelection(findNodePosition(editor, 'paragraph') + 7);
    expect(inputText(editor, '$')).toBe(true);
    expect(editor.state.doc.nodeAt(findNodePosition(editor, 'math'))?.attrs.latex).toBe('x^2');
    editor.destroy();
  });

  it('leaves block source unchanged when the math schema is unavailable', () => {
    const editor = createEditor({ type: 'paragraph', content: [{ type: 'text', text: '$$x^2$' }] }, [
      ...createTiptapWireExtensions().filter((extension) => extension.name !== 'math'),
      TiptapMathInput,
    ]);
    editor.commands.setTextSelection(findNodePosition(editor, 'paragraph') + 7);
    expect(inputText(editor, '$')).toBe(false);
    expect(editor.getText()).toContain('$$x^2$');
    editor.destroy();
  });

  it('does not replace a partial textblock match and delete its trailing suffix', () => {
    const editor = createEditor({ type: 'paragraph', content: [{ type: 'text', text: '$$x^2$ trailing' }] });
    editor.commands.setTextSelection(findNodePosition(editor, 'paragraph') + 7);
    const before = editor.getJSON();
    expect(inputText(editor, '$')).toBe(false);
    expect(editor.getJSON()).toEqual(before);
    editor.destroy();
  });

  it('does not create inline math when the inline schema is unavailable', () => {
    const editor = createEditor({ type: 'paragraph', content: [{ type: 'text', text: '$x' }] }, [
      ...createTiptapWireExtensions().filter((extension) => extension.name !== 'mathInline'),
      TiptapMathInput,
    ]);
    editor.commands.setTextSelection(findNodePosition(editor, 'paragraph') + 3);
    const before = editor.getJSON();
    expect(inputText(editor, '$')).toBe(false);
    expect(editor.getJSON()).toEqual(before);
    editor.destroy();
  });

  it('never upgrades completed block delimiters inside a table cell', () => {
    const editor = createEditor({
      type: 'table',
      content: [
        {
          type: 'tableRow',
          content: [
            {
              type: 'tableCell',
              content: [{ type: 'tableParagraph', content: [{ type: 'text', text: '$$x^2$' }] }],
            },
          ],
        },
      ],
    });
    editor.commands.setTextSelection(findNodePosition(editor, 'tableParagraph') + 7);
    const before = editor.getJSON();
    expect(inputText(editor, '$')).toBe(false);
    expect(editor.getJSON()).toEqual(before);
    expect(findNodePosition(editor, 'math')).toBe(-1);
    editor.destroy();
  });
});
