// @vitest-environment jsdom

import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { Editor, getSchema } from '@tiptap/core';
import { EditorContent, useEditor } from '@tiptap/react';
import { Fragment, Schema, Slice } from '@tiptap/pm/model';
import { NodeSelection, TextSelection } from '@tiptap/pm/state';
import { MantineProvider } from '@mantine/core';
import { describe, expect, it, vi } from 'vitest';
import * as Y from 'yjs';
import { prosemirrorJSONToYXmlFragment } from 'y-prosemirror';
import { createCollaborationExtension } from '../collaboration';
import { createTiptapWireExtensions } from '../wire-schema';
import { TiptapMathInput, normalizeMathFragment, withTiptapMathExtensions } from './index';

function block(id: string, content: Record<string, unknown>) {
  return { type: 'blockContainer', attrs: { id }, content: [content] };
}

function createEditor(content: Record<string, unknown>) {
  const element = document.createElement('div');
  document.body.append(element);
  const editor = new Editor({
    element,
    extensions: withTiptapMathExtensions(createTiptapWireExtensions()),
    content: { type: 'doc', content: [{ type: 'blockGroup', content: [block('target', content)] }] },
  });
  return {
    editor,
    destroy: () => {
      editor.destroy();
      element.remove();
    },
  };
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

function inputText(editor: Editor, text: string): boolean {
  const position = editor.state.selection.from;
  return Boolean(
    editor.view.someProp('handleTextInput', (handler) =>
      handler(editor.view, position, position, text, () => editor.state.tr),
    ),
  );
}

describe('Tiptap math runtime', () => {
  it('converts a completed $...$ input rule without converting incomplete, empty, or code source', () => {
    const mounted = createEditor({ type: 'paragraph', content: [{ type: 'text', text: '$x' }] });
    mounted.editor.commands.setTextSelection(findNodePosition(mounted.editor, 'paragraph') + 3);
    expect(inputText(mounted.editor, '$')).toBe(true);
    expect(mounted.editor.getJSON()).toMatchObject({
      content: [
        {
          content: [
            {
              content: [
                {
                  type: 'paragraph',
                  content: [{ type: 'mathInline', attrs: { latex: '' }, content: [{ type: 'text', text: 'x' }] }],
                },
              ],
            },
          ],
        },
      ],
    });
    mounted.destroy();

    const incomplete = createEditor({ type: 'paragraph', content: [{ type: 'text', text: '$x' }] });
    incomplete.editor.commands.setTextSelection(findNodePosition(incomplete.editor, 'paragraph') + 3);
    expect(inputText(incomplete.editor, 'y')).toBe(false);
    expect(incomplete.editor.getText()).toContain('$x');
    incomplete.destroy();

    const empty = createEditor({ type: 'paragraph', content: [{ type: 'text', text: '$' }] });
    empty.editor.commands.setTextSelection(findNodePosition(empty.editor, 'paragraph') + 2);
    expect(inputText(empty.editor, '$')).toBe(false);
    empty.destroy();

    const code = createEditor({ type: 'codeBlock', content: [{ type: 'text', text: '$x' }] });
    code.editor.commands.setTextSelection(findNodePosition(code.editor, 'codeBlock') + 3);
    expect(inputText(code.editor, '$')).toBe(false);
    code.destroy();
  });

  it('serializes inline source text through the schema HTML content hole', () => {
    const mounted = createEditor({
      type: 'paragraph',
      content: [{ type: 'mathInline', content: [{ type: 'text', text: 'E^MC2' }] }],
    });

    expect(mounted.editor.getHTML()).toContain('<span data-inline-content-type="mathInline">E^MC2</span>');
    mounted.destroy();
  });

  it('keeps inline source plain and skips delimiter conversion while the caret is inside it', () => {
    const mounted = createEditor({
      type: 'paragraph',
      content: [{ type: 'mathInline', content: [{ type: 'text', text: '$x' }] }],
    });
    const position = findNodePosition(mounted.editor, 'mathInline');
    mounted.editor.commands.setTextSelection({ from: position + 1, to: position + 3 });
    mounted.editor.chain().toggleMark('bold').run();
    expect(mounted.editor.state.doc.nodeAt(position)?.firstChild?.marks).toHaveLength(0);

    mounted.editor.commands.setTextSelection(position + 3);
    expect(inputText(mounted.editor, '$')).toBe(false);
    expect(mounted.editor.state.doc.nodeAt(position)?.textContent).toBe('$x');

    const pasted = new Slice(Fragment.from(mounted.editor.state.schema.text('$y$')), 0, 0);
    const transformed = mounted.editor.view.someProp('transformPasted', (transform) =>
      transform(pasted, mounted.editor.view, true),
    );
    expect(transformed).toBe(pasted);
    mounted.destroy();
  });

  it('converts a complete standalone $$...$$ paragraph to block math only outside a table', () => {
    const mounted = createEditor({ type: 'paragraph', content: [{ type: 'text', text: '$$x^2$' }] });
    mounted.editor.commands.setTextSelection(findNodePosition(mounted.editor, 'paragraph') + 7);
    expect(inputText(mounted.editor, '$')).toBe(true);
    expect(mounted.editor.state.doc.nodeAt(findNodePosition(mounted.editor, 'math'))?.attrs.latex).toBe('x^2');
    mounted.destroy();
  });

  it('leaves block source unchanged when the block target or math schema is unavailable', () => {
    const missingTarget = createEditor({ type: 'paragraph', content: [{ type: 'text', text: '$$x^2$' }] });
    missingTarget.editor.commands.setTextSelection(findNodePosition(missingTarget.editor, 'paragraph') + 7);
    const nodeAt = vi.spyOn(missingTarget.editor.state.doc, 'nodeAt').mockReturnValue(null);
    expect(inputText(missingTarget.editor, '$')).toBe(false);
    nodeAt.mockRestore();
    expect(missingTarget.editor.getText()).toContain('$$x^2$');
    missingTarget.destroy();

    const element = document.createElement('div');
    document.body.append(element);
    const missingMath = new Editor({
      element,
      extensions: [...createTiptapWireExtensions().filter((extension) => extension.name !== 'math'), TiptapMathInput],
      content: {
        type: 'doc',
        content: [
          {
            type: 'blockGroup',
            content: [block('target', { type: 'paragraph', content: [{ type: 'text', text: '$$x^2$' }] })],
          },
        ],
      },
    });
    missingMath.commands.setTextSelection(findNodePosition(missingMath, 'paragraph') + 7);
    expect(inputText(missingMath, '$')).toBe(false);
    expect(missingMath.getText()).toContain('$$x^2$');
    missingMath.destroy();
    element.remove();
  });

  it('does not replace a partial textblock match and delete its trailing suffix', () => {
    const mounted = createEditor({
      type: 'paragraph',
      content: [{ type: 'text', text: '$$x^2$ trailing' }],
    });
    mounted.editor.commands.setTextSelection(findNodePosition(mounted.editor, 'paragraph') + 7);
    const before = mounted.editor.getJSON();
    expect(inputText(mounted.editor, '$')).toBe(false);
    expect(mounted.editor.getJSON()).toEqual(before);
    mounted.destroy();
  });

  it('does not create inline math when the inline schema is unavailable', () => {
    const element = document.createElement('div');
    document.body.append(element);
    const editor = new Editor({
      element,
      extensions: [
        ...createTiptapWireExtensions().filter((extension) => extension.name !== 'mathInline'),
        TiptapMathInput,
      ],
      content: {
        type: 'doc',
        content: [
          {
            type: 'blockGroup',
            content: [block('target', { type: 'paragraph', content: [{ type: 'text', text: '$x' }] })],
          },
        ],
      },
    });
    editor.commands.setTextSelection(findNodePosition(editor, 'paragraph') + 3);
    const before = editor.getJSON();
    expect(inputText(editor, '$')).toBe(false);
    expect(editor.getJSON()).toEqual(before);
    editor.destroy();
    element.remove();
  });

  it('never upgrades completed block delimiters inside a table cell', () => {
    const mounted = createEditor({
      type: 'table',
      content: [
        {
          type: 'tableRow',
          content: [
            {
              type: 'tableCell',
              content: [
                {
                  type: 'tableParagraph',
                  content: [{ type: 'text', text: '$$x^2$' }],
                },
              ],
            },
          ],
        },
      ],
    });
    mounted.editor.commands.setTextSelection(findNodePosition(mounted.editor, 'tableParagraph') + 7);
    const before = mounted.editor.getJSON();
    expect(inputText(mounted.editor, '$')).toBe(false);
    expect(mounted.editor.getJSON()).toEqual(before);
    expect(findNodePosition(mounted.editor, 'math')).toBe(-1);
    mounted.destroy();
  });

  it('normalizes every supported pasted delimiter into inline math without upgrading display source to a block', () => {
    const mounted = createEditor({ type: 'paragraph' });
    const paragraph = mounted.editor.state.schema.nodes.paragraph!.create(
      null,
      mounted.editor.state.schema.text('a $x$ $$y$$ \\(z\\) \\[w\\]'),
    );
    const pasted = new Slice(Fragment.from(paragraph), 0, 0);
    const slice = mounted.editor.view.someProp('transformPasted', (transform) =>
      transform(pasted, mounted.editor.view, true),
    );
    expect(slice).toBeInstanceOf(Slice);
    if (!slice) {
      throw new Error('Math clipboard transform is not registered');
    }
    expect(slice.content.firstChild?.childCount).toBe(8);
    const names: string[] = [];
    slice.content.firstChild?.forEach((node) => names.push(node.type.name));
    expect(names.filter((name) => name === 'mathInline')).toHaveLength(4);
    expect(names).not.toContain('math');
    mounted.destroy();
  });

  it('returns pasted content unchanged when the inline math schema is unavailable', () => {
    const schema = new Schema({
      nodes: {
        doc: { content: 'paragraph+' },
        paragraph: { content: 'text*' },
        text: {},
      },
    });
    const paragraph = schema.nodes.paragraph;
    if (!paragraph) {
      throw new Error('Paragraph schema is unavailable');
    }
    const fragment = Fragment.from(paragraph.create(null, schema.text('a $x$ value')));
    expect(normalizeMathFragment(fragment, schema)).toBe(fragment);
  });

  it('prefers an outer delimiter over every nested delimiter it contains', () => {
    const mounted = createEditor({ type: 'paragraph' });
    const paragraph = mounted.editor.state.schema.nodes.paragraph;
    if (!paragraph) {
      throw new Error('Paragraph schema is unavailable');
    }
    const fragment = Fragment.from(paragraph.create(null, mounted.editor.state.schema.text('\\[$x$ + $y$\\]')));
    const normalized = normalizeMathFragment(fragment, mounted.editor.state.schema);
    expect(normalized.firstChild?.childCount).toBe(1);
    expect(normalized.firstChild?.firstChild?.type.name).toBe('mathInline');
    expect(normalized.firstChild?.firstChild?.textContent).toBe('$x$ + $y$');
    mounted.destroy();
  });

  it('does not recursively normalize the source of an existing inline math node', () => {
    const mounted = createEditor({ type: 'paragraph' });
    const mathInline = mounted.editor.state.schema.nodes.mathInline;
    if (!mathInline) {
      throw new Error('Inline math schema is unavailable');
    }
    const fragment = Fragment.from(mathInline.create(null, mounted.editor.state.schema.text('$x$')));
    const normalized = normalizeMathFragment(fragment, mounted.editor.state.schema);
    expect(normalized.childCount).toBe(1);
    expect(normalized.firstChild?.type.name).toBe('mathInline');
    expect(normalized.firstChild?.textContent).toBe('$x$');
    expect(normalized.firstChild?.firstChild?.type.name).toBe('text');
    mounted.destroy();
  });

  it('normalizes a legacy attribute-only node that arrives from a collaborator after the editor mounted', async () => {
    const initialDocument = {
      type: 'doc',
      content: [
        {
          type: 'blockGroup',
          content: [block('target', { type: 'paragraph', content: [{ type: 'text', text: 'x' }] })],
        },
      ],
    };
    const yDoc = new Y.Doc();
    const fragment = yDoc.getXmlFragment('document-store');
    const schema = getSchema(withTiptapMathExtensions(createTiptapWireExtensions()));
    prosemirrorJSONToYXmlFragment(schema, schema.nodeFromJSON(initialDocument).toJSON(), fragment);
    const observerElement = document.createElement('div');
    const collaboratorElement = document.createElement('div');
    document.body.append(observerElement, collaboratorElement);
    const observer = new Editor({
      element: observerElement,
      extensions: [
        ...withTiptapMathExtensions(createTiptapWireExtensions()),
        createCollaborationExtension({ fragment }),
      ],
    });
    const collaborator = new Editor({
      element: collaboratorElement,
      extensions: [...createTiptapWireExtensions(), createCollaborationExtension({ fragment })],
    });
    const paragraphPosition = findNodePosition(collaborator, 'paragraph');
    const mathInline = collaborator.state.schema.nodes.mathInline;
    if (!mathInline) {
      throw new Error('Inline math schema is unavailable');
    }
    collaborator.view.dispatch(
      collaborator.state.tr.replaceWith(
        paragraphPosition + 1,
        paragraphPosition + 2,
        mathInline.create({ latex: 'legacy' }),
      ),
    );
    await Promise.resolve();

    const migrated = observer.state.doc.nodeAt(findNodePosition(observer, 'mathInline'));
    expect(migrated?.attrs.latex).toBe('');
    expect(migrated?.textContent).toBe('legacy');
    expect(collaborator.state.doc.nodeAt(findNodePosition(collaborator, 'mathInline'))?.textContent).toBe('legacy');

    observer.destroy();
    collaborator.destroy();
    observerElement.remove();
    collaboratorElement.remove();
    yDoc.destroy();
  });

  it('edits inline math as character-addressable paragraph content without a Tab stop or node selection', async () => {
    const editorRef: { current: Editor | null } = { current: null };
    function Harness() {
      const instance = useEditor({
        immediatelyRender: false,
        extensions: withTiptapMathExtensions(createTiptapWireExtensions()),
        content: {
          type: 'doc',
          content: [
            {
              type: 'blockGroup',
              content: [
                block('target', {
                  type: 'paragraph',
                  content: [
                    { type: 'text', text: 'Hello ' },
                    { type: 'mathInline', content: [{ type: 'text', text: 'E^MC2' }] },
                    { type: 'text', text: ' world' },
                  ],
                }),
              ],
            },
          ],
        },
      });
      editorRef.current = instance;
      return (
        <MantineProvider>
          <EditorContent editor={instance} />
        </MantineProvider>
      );
    }
    const container = document.createElement('div');
    document.body.append(container);
    const root = createRoot(container);
    await act(async () => root.render(<Harness />));
    const inlineView = container.querySelector<HTMLElement>('[data-math-inline]');
    expect(inlineView).not.toBeNull();
    expect(inlineView?.tagName).toBe('SPAN');
    expect(inlineView?.querySelector('[data-node-view-content]')?.tagName).toBe('SPAN');
    expect(inlineView).not.toHaveAttribute('role');
    expect(inlineView?.tabIndex).toBe(-1);
    expect(inlineView?.querySelector('textarea')).toBeNull();
    expect(inlineView?.dataset.renderable).toBe('true');
    const editor = editorRef.current;
    expect(editor).not.toBeNull();
    const mathPosition = findNodePosition(editor!, 'mathInline');
    const mathNode = editor!.state.doc.nodeAt(mathPosition);
    expect(mathNode?.textContent).toBe('E^MC2');
    expect(mathNode?.isAtom).toBe(false);
    expect(mathNode?.type.spec.selectable).toBe(false);

    const afterMath = mathPosition + mathNode!.nodeSize;
    await act(async () => editor!.commands.setTextSelection(afterMath));
    const left = new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true, cancelable: true });
    await act(async () => editor!.view.dom.dispatchEvent(left));
    expect(left.defaultPrevented).toBe(true);
    expect(editor!.state.selection).toBeInstanceOf(TextSelection);
    expect(editor!.state.selection).not.toBeInstanceOf(NodeSelection);
    expect(editor!.state.selection.$head.parent.type.name).toBe('mathInline');
    expect(editor!.state.selection.$head.parentOffset).toBe('E^MC2'.length);

    const paragraphPosition = findNodePosition(editor!, 'paragraph');
    await act(async () => {
      editor!.view.dispatch(
        editor!.state.tr.setSelection(
          TextSelection.create(editor!.state.doc, paragraphPosition + 1, mathPosition + 1 + 2),
        ),
      );
    });
    expect(editor!.state.doc.textBetween(editor!.state.selection.from, editor!.state.selection.to)).toBe('Hello E^');
    expect(container.querySelector('[data-math-inline-editing="true"]')).not.toBeNull();

    await act(async () => editor!.commands.setTextSelection(paragraphPosition + 1));
    expect(container.querySelector('[data-math-inline-editing="true"]')).toBeNull();
    const sourceSurface = inlineView?.querySelector('[data-node-view-content]');
    const previewSurface = inlineView?.querySelector('.katex')?.parentElement;
    expect(sourceSurface).toHaveAttribute('aria-hidden', 'true');
    expect(previewSurface).not.toHaveAttribute('aria-hidden');

    const pointer = new MouseEvent('mousedown', { button: 0, bubbles: true, cancelable: true });
    await act(async () => {
      editor!.commands.setTextSelection(mathPosition + 2);
      inlineView?.dispatchEvent(pointer);
    });
    expect(pointer.defaultPrevented).toBe(false);
    expect(editor!.state.selection.$head.parent.type.name).toBe('mathInline');
    expect(container.querySelector('[data-math-inline-editing="true"]')).not.toBeNull();
    expect(sourceSurface).not.toHaveAttribute('aria-hidden');
    expect(previewSurface).toHaveAttribute('aria-hidden', 'true');

    const staleEditingPointer = new MouseEvent('mousedown', { button: 0, bubbles: true, cancelable: true });
    await act(async () => {
      editor!.commands.setTextSelection(paragraphPosition + 1);
      inlineView?.dispatchEvent(staleEditingPointer);
    });
    expect(staleEditingPointer.defaultPrevented).toBe(true);
    expect(editor!.state.selection.$head.parent.type.name).toBe('mathInline');
    await act(async () => root.unmount());
    container.remove();
  });

  it('undoes and redoes an inline source character through collaborative history without losing its source or preview', async () => {
    const initialDocument = {
      type: 'doc',
      content: [
        {
          type: 'blockGroup',
          content: [
            block('target', {
              type: 'paragraph',
              content: [
                { type: 'text', text: 'Hello ' },
                { type: 'mathInline', content: [{ type: 'text', text: 'E^MC' }] },
                { type: 'text', text: ' world' },
              ],
            }),
          ],
        },
      ],
    };
    const yDoc = new Y.Doc();
    const fragment = yDoc.getXmlFragment('document-store');
    const schema = getSchema(withTiptapMathExtensions(createTiptapWireExtensions()));
    prosemirrorJSONToYXmlFragment(schema, schema.nodeFromJSON(initialDocument).toJSON(), fragment);

    const editorRef: { current: Editor | null } = { current: null };
    function Harness() {
      const instance = useEditor({
        immediatelyRender: false,
        extensions: [
          ...withTiptapMathExtensions(createTiptapWireExtensions()),
          createCollaborationExtension({ fragment }),
        ],
      });
      editorRef.current = instance;
      return (
        <MantineProvider>
          <EditorContent editor={instance} />
        </MantineProvider>
      );
    }

    const container = document.createElement('div');
    document.body.append(container);
    const root = createRoot(container);
    await act(async () => root.render(<Harness />));
    const editor = editorRef.current;
    expect(editor).not.toBeNull();

    const pressModShortcut = async (shiftKey = false) => {
      const event = new KeyboardEvent('keydown', {
        key: 'z',
        bubbles: true,
        cancelable: true,
        ctrlKey: true,
        shiftKey,
      });
      await act(async () => editor!.view.dom.dispatchEvent(event));
      expect(event.defaultPrevented).toBe(true);
    };
    const inlineSource = () => {
      const position = findNodePosition(editor!, 'mathInline');
      return editor!.state.doc.nodeAt(position)?.textContent;
    };

    const mathPosition = findNodePosition(editor!, 'mathInline');
    await act(async () => {
      editor!.commands.setTextSelection(mathPosition + 1 + 'E^MC'.length);
      editor!.commands.insertContent('2');
    });
    expect(inlineSource()).toBe('E^MC2');
    expect(container.querySelector('[data-math-inline-editing="true"] [data-node-view-content]')).not.toHaveAttribute(
      'aria-hidden',
    );

    const paragraphPosition = findNodePosition(editor!, 'paragraph');
    await act(async () => editor!.commands.setTextSelection(paragraphPosition + 1));
    expect(container.querySelector('[data-math-inline-editing="true"]')).toBeNull();
    expect(container.querySelector('[data-math-inline] [data-node-view-content]')).toHaveAttribute(
      'aria-hidden',
      'true',
    );
    expect(container.querySelector('[data-math-inline] .katex')).not.toBeNull();

    await pressModShortcut();
    expect(inlineSource()).toBe('E^MC');
    expect(container.querySelector('[data-math-inline] [data-node-view-content]')?.textContent).toBe('E^MC');
    expect(container.querySelector('[data-math-inline] .katex')).not.toBeNull();

    await pressModShortcut(true);
    expect(inlineSource()).toBe('E^MC2');
    expect(container.querySelector('[data-math-inline] [data-node-view-content]')?.textContent).toBe('E^MC2');
    expect(container.querySelector('[data-math-inline] .katex')).not.toBeNull();

    const inlineView = container.querySelector<HTMLElement>('[data-math-inline]');
    await act(async () => {
      inlineView?.dispatchEvent(new MouseEvent('mousedown', { button: 0, bubbles: true, cancelable: true }));
    });
    expect(editor!.state.selection.$head.parent.type.name).toBe('mathInline');
    expect(container.querySelector('[data-math-inline-editing="true"] [data-node-view-content]')?.textContent).toBe(
      'E^MC2',
    );
    expect(container.querySelector('[data-math-inline-editing="true"] [data-node-view-content]')).not.toHaveAttribute(
      'aria-hidden',
    );

    await act(async () => root.unmount());
    container.remove();
    yDoc.destroy();
  });

  it('keeps invalid inline source visible and migrates legacy latex attributes into editable text', async () => {
    const editorRef: { current: Editor | null } = { current: null };
    function Harness() {
      const instance = useEditor({
        immediatelyRender: false,
        extensions: withTiptapMathExtensions(createTiptapWireExtensions()),
        content: {
          type: 'doc',
          content: [
            {
              type: 'blockGroup',
              content: [
                block('target', {
                  type: 'paragraph',
                  content: [{ type: 'mathInline', attrs: { latex: '\\frac{' } }],
                }),
              ],
            },
          ],
        },
      });
      editorRef.current = instance;
      return (
        <MantineProvider>
          <EditorContent editor={instance} />
        </MantineProvider>
      );
    }
    const container = document.createElement('div');
    document.body.append(container);
    const root = createRoot(container);
    await act(async () => root.render(<Harness />));
    await act(async () => Promise.resolve());

    const editor = editorRef.current;
    const mathNode = editor?.state.doc.nodeAt(findNodePosition(editor!, 'mathInline'));
    const inlineView = container.querySelector<HTMLElement>('[data-math-inline]');
    expect(mathNode?.textContent).toBe('\\frac{');
    expect(mathNode?.attrs.latex).toBe('');
    expect(inlineView?.dataset.renderable).toBeUndefined();
    expect(inlineView?.textContent).toContain('\\frac{');
    expect(inlineView?.querySelector('.katex')).toBeNull();
    const sourceSurface = inlineView?.querySelector<HTMLElement>('[data-node-view-content]');
    expect(sourceSurface).toHaveAttribute('aria-invalid', 'true');
    const describedBy = sourceSurface?.getAttribute('aria-describedby');
    expect(describedBy).toBeTruthy();
    expect(document.getElementById(describedBy!)?.textContent).toContain('KaTeX parse error');
    await act(async () => root.unmount());
    container.remove();
  });

  it('selects block math as one outer boundary instead of directly opening a source textarea', async () => {
    const editorRef: { current: Editor | null } = { current: null };
    function Harness() {
      const instance = useEditor({
        immediatelyRender: false,
        extensions: withTiptapMathExtensions(createTiptapWireExtensions()),
        content: {
          type: 'doc',
          content: [{ type: 'blockGroup', content: [block('target', { type: 'math', attrs: { latex: 'x^2' } })] }],
        },
      });
      editorRef.current = instance;
      return <EditorContent editor={instance} />;
    }
    const container = document.createElement('div');
    document.body.append(container);
    const root = createRoot(container);
    await act(async () => root.render(<Harness />));
    const editor = editorRef.current;
    expect(editor).not.toBeNull();
    const before = editor!.state.doc.toJSON();
    const blockView = container.querySelector<HTMLElement>('[data-math-block]');
    expect(blockView).not.toBeNull();

    await act(async () => blockView?.click());

    expect(editor!.state.selection).toBeInstanceOf(NodeSelection);
    expect((editor!.state.selection as NodeSelection).node.type.name).toBe('math');
    expect(blockView?.dataset.selected).toBe('true');
    expect(blockView?.querySelector('textarea')).toBeNull();
    expect(editor!.state.doc.toJSON()).toEqual(before);
    await act(async () => root.unmount());
    container.remove();
  });
});
