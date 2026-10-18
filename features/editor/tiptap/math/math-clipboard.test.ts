import { Editor, getSchema } from '@tiptap/core';
import { Fragment, Schema, Slice } from '@tiptap/pm/model';
import { describe, expect, it } from 'vitest';
import { createTiptapWireExtensions } from '../wire-schema';
import { normalizeMathFragment, withTiptapMathExtensions } from './index';

const mathExtensions = () => withTiptapMathExtensions(createTiptapWireExtensions());

// No `element`: the editor keeps its state without an EditorView, which is all paste transforms read.
function createEditor(content: Record<string, unknown>) {
  const editor = new Editor({
    element: null,
    extensions: mathExtensions(),
    content: {
      type: 'doc',
      content: [
        { type: 'blockGroup', content: [{ type: 'blockContainer', attrs: { id: 'target' }, content: [content] }] },
      ],
    },
  });
  editor.view.updateState(editor.state.reconfigure({ plugins: editor.extensionManager.plugins }));
  return editor;
}

/** Runs every plugin's `transformPasted` in order, as ProseMirror does before inserting a paste. */
function transformPasted(editor: Editor, slice: Slice): Slice {
  return editor.state.plugins.reduce(
    (current, plugin) => plugin.props.transformPasted?.call(plugin, current, editor.view, true) ?? current,
    slice,
  );
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

describe('Tiptap math clipboard', () => {
  it('normalizes every supported pasted delimiter into inline math without upgrading display source to a block', () => {
    const editor = createEditor({ type: 'paragraph' });
    const { schema } = editor.state;
    const paragraph = schema.nodes.paragraph!.create(null, schema.text('a $x$ $$y$$ \\(z\\) \\[w\\]'));

    const slice = transformPasted(editor, new Slice(Fragment.from(paragraph), 0, 0));

    const pasted = slice.content.firstChild;
    expect(pasted?.childCount).toBe(8);
    const names: string[] = [];
    pasted?.forEach((node) => names.push(node.type.name));
    expect(names.filter((name) => name === 'mathInline')).toHaveLength(4);
    expect(names).not.toContain('math');
    editor.destroy();
  });

  it('pastes delimiters as plain source while the caret is inside inline math', () => {
    const editor = createEditor({
      type: 'paragraph',
      content: [{ type: 'mathInline', content: [{ type: 'text', text: '$x' }] }],
    });
    editor.commands.setTextSelection(findNodePosition(editor, 'mathInline') + 3);
    const pasted = new Slice(Fragment.from(editor.state.schema.text('$y$')), 0, 0);

    expect(transformPasted(editor, pasted)).toBe(pasted);
    editor.destroy();
  });

  it('returns pasted content unchanged when the inline math schema is unavailable', () => {
    const schema = new Schema({
      nodes: {
        doc: { content: 'paragraph+' },
        paragraph: { content: 'text*' },
        text: {},
      },
    });
    const fragment = Fragment.from(schema.nodes.paragraph!.create(null, schema.text('a $x$ value')));
    expect(normalizeMathFragment(fragment, schema)).toBe(fragment);
  });

  it('prefers an outer delimiter over every nested delimiter it contains', () => {
    const schema = getSchema(mathExtensions());
    const fragment = Fragment.from(schema.nodes.paragraph!.create(null, schema.text('\\[$x$ + $y$\\]')));
    const normalized = normalizeMathFragment(fragment, schema);
    expect(normalized.firstChild?.childCount).toBe(1);
    expect(normalized.firstChild?.firstChild?.type.name).toBe('mathInline');
    expect(normalized.firstChild?.firstChild?.textContent).toBe('$x$ + $y$');
  });

  it('does not recursively normalize the source of an existing inline math node', () => {
    const schema = getSchema(mathExtensions());
    const fragment = Fragment.from(schema.nodes.mathInline!.create(null, schema.text('$x$')));
    const normalized = normalizeMathFragment(fragment, schema);
    expect(normalized.childCount).toBe(1);
    expect(normalized.firstChild?.type.name).toBe('mathInline');
    expect(normalized.firstChild?.textContent).toBe('$x$');
    expect(normalized.firstChild?.firstChild?.type.name).toBe('text');
  });
});
