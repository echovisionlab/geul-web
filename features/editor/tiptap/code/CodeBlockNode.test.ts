// @vitest-environment jsdom

import { Editor } from '@tiptap/core';
import { NodeSelection } from '@tiptap/pm/state';
import { afterEach, describe, expect, it } from 'vitest';
import { createTiptapWireExtensions } from '../wire-schema';
import { isMonacoSourceEditorEvent } from '../code-editor';
import { codeEditorModelPath, selectCodeBlockAtPosition } from './CodeBlockNode';
import { replaceCodeBlockSource } from './code-source-transaction';

const mounted: { editor: Editor; element: HTMLElement }[] = [];

function fixture(source = 'const count = 1;') {
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
                  attrs: { title: 'Localized sample', language: 'javascript', textAlignment: 'left' },
                  content: [{ type: 'text', text: source }],
                },
              ],
            },
          ],
        },
      ],
    },
  });
  mounted.push({ editor, element });
  let position = -1;
  editor.state.doc.descendants((node, nodePosition) => {
    if (node.type.name === 'codeBlock') {
      position = nodePosition;
    }
  });
  const node = editor.state.doc.nodeAt(position);
  if (!node) {
    throw new Error('Expected code block');
  }
  return { editor, position, node };
}

afterEach(() => {
  for (const value of mounted.splice(0)) {
    value.editor.destroy();
    value.element.remove();
  }
});

describe('code block Monaco source adapter', () => {
  it('scopes stable model paths to the editor authority instance', () => {
    const visibleLocaleEditor = {};
    const hiddenMirrorEditor = {};
    expect(codeEditorModelPath(visibleLocaleEditor, 'shared-block-id', 'ts')).toBe(
      codeEditorModelPath(visibleLocaleEditor, 'shared-block-id', 'ts'),
    );
    expect(codeEditorModelPath(visibleLocaleEditor, 'shared-block-id', 'ts')).not.toBe(
      codeEditorModelPath(hiddenMirrorEditor, 'shared-block-id', 'ts'),
    );
    expect(codeEditorModelPath(visibleLocaleEditor, 'unsafe/id', 'glsl')).toContain('unsafe%2Fid.glsl');
  });

  it.each([
    ['ArrowLeft', false],
    ['ArrowRight', true],
    ['Enter', false],
    ['Tab', false],
  ])('isolates %s keyboard handling from ProseMirror (shift=%s)', (key, shiftKey) => {
    const root = document.createElement('div');
    root.dataset.sourceEditor = 'monaco';
    const textarea = document.createElement('textarea');
    root.append(textarea);
    document.body.append(root);
    const event = new KeyboardEvent('keydown', { key, shiftKey, bubbles: true });
    Object.defineProperty(event, 'target', { value: textarea });
    expect(isMonacoSourceEditorEvent(event)).toBe(true);
    root.remove();
  });

  it('does not swallow outer block keyboard events', () => {
    const button = document.createElement('button');
    const event = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true });
    Object.defineProperty(event, 'target', { value: button });
    expect(isMonacoSourceEditorEvent(event)).toBe(false);
  });

  it('exits Monaco to the exact code node selection without changing source or attributes', () => {
    const { editor, position, node } = fixture();
    const before = editor.state.doc.toJSON();
    expect(selectCodeBlockAtPosition(editor, () => position)).toBe(true);
    expect(editor.state.selection).toBeInstanceOf(NodeSelection);
    expect(editor.state.selection.from).toBe(position);
    expect(editor.state.doc.toJSON()).toEqual(before);
    expect(editor.state.doc.nodeAt(position)?.textContent).toBe(node.textContent);
    expect(document.activeElement).toBe(editor.view.dom);
  });

  it('selects the exact code node from its outer keyboard selector without stealing selector focus', () => {
    const { editor, position } = fixture();
    const before = editor.state.doc.toJSON();
    const selector = document.createElement('button');
    document.body.append(selector);
    selector.focus();

    expect(selectCodeBlockAtPosition(editor, () => position, false)).toBe(true);

    expect(editor.state.selection).toBeInstanceOf(NodeSelection);
    expect(editor.state.selection.from).toBe(position);
    expect(editor.state.doc.toJSON()).toEqual(before);
    expect(document.activeElement).toBe(selector);
    selector.remove();
  });

  it('persists an edit in text content while preserving durable attributes', () => {
    const { editor, position, node } = fixture();
    const nextSource = 'const count = 10;\nconsole.log(count);';
    expect(replaceCodeBlockSource({ editor, getPos: () => position, node }, nextSource)).toBe(true);
    const updated = editor.state.doc.nodeAt(position);
    expect(updated?.textContent).toBe(nextSource);
    expect(updated?.attrs).toMatchObject({
      title: 'Localized sample',
      language: 'javascript',
      textAlignment: 'left',
    });
    expect(updated?.nodeSize).toBe(nextSource.length + 2);
  });

  it('does nothing for an unchanged source or readonly editor', () => {
    const first = fixture();
    expect(
      replaceCodeBlockSource(
        { editor: first.editor, getPos: () => first.position, node: first.node },
        first.node.textContent,
      ),
    ).toBe(false);
    first.editor.setEditable(false);
    expect(
      replaceCodeBlockSource({ editor: first.editor, getPos: () => first.position, node: first.node }, 'changed'),
    ).toBe(false);
  });
});
