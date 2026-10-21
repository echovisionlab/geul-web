// @vitest-environment jsdom

import { Editor, type JSONContent, type NodeType, type TextType } from '@tiptap/core';
import type { Node as ProseMirrorNode } from '@tiptap/pm/model';
import { TextSelection } from '@tiptap/pm/state';
import { describe, expect, it } from 'vitest';
import { authoredEditorPalettes } from '@/components/core/design-tokens';
import { createTiptapWireExtensions } from './wire-schema';
import { EDITOR_TOOLBAR_SHORTCUTS } from '../toolbars/EditorToolbarTooltip';

function block(id: string, content: JSONContent, children: JSONContent[] = []): JSONContent {
  return {
    type: 'blockContainer',
    attrs: { id },
    content: [content, ...(children.length > 0 ? [{ type: 'blockGroup', content: children }] : [])],
  };
}

function documentWithBlocks(blocks: JSONContent[]): JSONContent {
  return {
    type: 'doc',
    content: [{ type: 'blockGroup', content: blocks }],
  };
}

function findNodePosition(editor: Editor, nodeName: string): number {
  let position = -1;
  editor.state.doc.descendants((node, pos) => {
    if (position === -1 && node.type.name === nodeName) {
      position = pos;
    }
  });
  if (position === -1) {
    throw new Error(`Missing ${nodeName} node`);
  }
  return position;
}

function createMountedEditor(content: JSONContent) {
  const element = document.createElement('div');
  document.body.append(element);
  const editor = new Editor({
    element,
    extensions: createTiptapWireExtensions(),
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

function pressModShortcut(editor: Editor, key: string, shiftKey = false) {
  const event = new KeyboardEvent('keydown', {
    key,
    bubbles: true,
    cancelable: true,
    ctrlKey: true,
    shiftKey,
  });
  editor.view.dom.dispatchEvent(event);
  return event;
}

function typeText(editor: Editor, text: string) {
  for (const character of text) {
    const { from, to } = editor.state.selection;
    const handled = editor.view.someProp('handleTextInput', (handler) =>
      handler(editor.view, from, to, character, () => editor.state.tr.insertText(character, from, to)),
    );
    if (!handled) {
      editor.view.dispatch(editor.state.tr.insertText(character, from, to));
    }
  }
}

const fileNode: JSONContent = {
  type: 'file',
  attrs: {
    fileId: 'file-123',
    fileName: 'field-recording.wav',
    name: 'Field recording',
    alt: '',
    caption: 'Original caption',
    width: '0',
    height: '0',
    displaySize: '100',
    textAlignment: 'left' as const,
    mimeType: 'audio/wav',
  },
};

describe('Tiptap wire schema', () => {
  it('keeps native TextSelection across standalone atom blocks', () => {
    const element = document.createElement('div');
    const editor = new Editor({
      element,
      extensions: createTiptapWireExtensions(),
      content: documentWithBlocks([
        block('before', { type: 'paragraph', content: [{ type: 'text', text: 'Before' }] }),
        block('video', { type: 'externalVideo', attrs: { url: 'https://youtu.be/dQw4w9WgXcQ' } }),
        block('file', fileNode),
        block('after', { type: 'paragraph', content: [{ type: 'text', text: 'After' }] }),
      ]),
    });
    const paragraphs: number[] = [];
    editor.state.doc.descendants((node, position) => {
      if (node.type.name === 'paragraph') {
        paragraphs.push(position);
      }
    });
    const [before, after] = paragraphs;
    if (before === undefined || after === undefined) {
      throw new Error('Expected selection boundary Paragraphs.');
    }

    editor.view.dispatch(editor.state.tr.setSelection(TextSelection.create(editor.state.doc, before + 2, after + 2)));

    const selectedTypes: string[] = [];
    editor.state.selection.content().content.descendants((node) => {
      selectedTypes.push(node.type.name);
    });
    expect(editor.state.selection).toBeInstanceOf(TextSelection);
    expect(selectedTypes).toEqual(expect.arrayContaining(['externalVideo', 'file']));
    expect(editor.extensionManager.extensions.map((extension) => extension.name)).not.toContain('nodeRange');
    expect(editor.extensionManager.extensions.map((extension) => extension.name)).not.toContain('blockRangeSelection');
    editor.destroy();
  });

  it.each([
    ['# ', 1],
    ['## ', 2],
    ['### ', 3],
  ])('converts a block-start %j prefix into heading level %i', (prefix, level) => {
    const element = document.createElement('div');
    const editor = new Editor({
      element,
      extensions: createTiptapWireExtensions(),
      content: documentWithBlocks([block('heading-shortcut', { type: 'paragraph' })]),
    });
    editor.commands.setTextSelection(findNodePosition(editor, 'paragraph') + 1);

    typeText(editor, prefix);

    const heading = editor.state.doc.nodeAt(findNodePosition(editor, 'heading'));
    expect(heading?.attrs.level).toBe(level);
    expect(heading?.textContent).toBe('');
    editor.destroy();
  });

  it('can apply a heading shortcut again after Backspace resets the empty heading', () => {
    const element = document.createElement('div');
    const editor = new Editor({
      element,
      extensions: createTiptapWireExtensions(),
      content: documentWithBlocks([block('heading-shortcut-repeat', { type: 'paragraph' })]),
    });
    editor.commands.setTextSelection(findNodePosition(editor, 'paragraph') + 1);

    typeText(editor, '## ');
    expect(editor.state.doc.nodeAt(findNodePosition(editor, 'heading'))?.attrs.level).toBe(2);

    const firstBackspace = new KeyboardEvent('keydown', { key: 'Backspace', bubbles: true, cancelable: true });
    editor.view.dom.dispatchEvent(firstBackspace);
    expect(firstBackspace.defaultPrevented).toBe(true);
    expect(editor.state.doc.nodeAt(findNodePosition(editor, 'paragraph'))?.textContent).toBe('');

    typeText(editor, '## ');
    expect(editor.state.doc.nodeAt(findNodePosition(editor, 'heading'))?.attrs.level).toBe(2);

    const secondBackspace = new KeyboardEvent('keydown', { key: 'Backspace', bubbles: true, cancelable: true });
    editor.view.dom.dispatchEvent(secondBackspace);
    expect(secondBackspace.defaultPrevented).toBe(true);
    expect(editor.state.doc.nodeAt(findNodePosition(editor, 'paragraph'))?.textContent).toBe('');
    editor.destroy();
  });

  it('does not convert heading markers in the middle of paragraph text', () => {
    const element = document.createElement('div');
    const editor = new Editor({
      element,
      extensions: createTiptapWireExtensions(),
      content: documentWithBlocks([
        block('plain-text', { type: 'paragraph', content: [{ type: 'text', text: 'Location' }] }),
      ]),
    });
    const paragraph = findNodePosition(editor, 'paragraph');
    editor.commands.setTextSelection(paragraph + 1 + 'Location'.length);

    typeText(editor, ' # ');

    expect(editor.state.selection.$from.parent.type.name).toBe('paragraph');
    expect(editor.state.selection.$from.parent.textContent).toBe('Location # ');
    editor.destroy();
  });

  it('converts a block-start TypeScript fence into a typed Code block', () => {
    const element = document.createElement('div');
    const editor = new Editor({
      element,
      extensions: createTiptapWireExtensions(),
      content: documentWithBlocks([block('code-shortcut', { type: 'paragraph' })]),
    });
    editor.commands.setTextSelection(findNodePosition(editor, 'paragraph') + 1);

    typeText(editor, '```ts ');

    const code = editor.state.doc.nodeAt(findNodePosition(editor, 'codeBlock'));
    expect(code?.attrs.language).toBe('typescript');
    expect(code?.textContent).toBe('');
    editor.destroy();
  });

  it('renders safe legacy hex color marks inline while semantic and unsafe values stay CSS-owned', () => {
    const element = document.createElement('div');
    document.body.appendChild(element);
    const editor = new Editor({
      element,
      extensions: createTiptapWireExtensions(),
      content: documentWithBlocks([
        block('colors', {
          type: 'paragraph',
          content: [
            { type: 'text', text: 'semantic', marks: [{ type: 'textColor', attrs: { stringValue: 'blue' } }] },
            { type: 'text', text: 'safe', marks: [{ type: 'textColor', attrs: { stringValue: '#b02d23' } }] },
            {
              type: 'text',
              text: 'unsafe',
              marks: [{ type: 'backgroundColor', attrs: { stringValue: 'red;background:url(x)' } }],
            },
          ],
        }),
      ]),
    });

    expect(element.querySelector<HTMLElement>('[stringvalue="blue"]')?.getAttribute('style')).toBeNull();
    expect(element.querySelector<HTMLElement>('[stringvalue="#b02d23"]')?.style.color).toBe('rgb(176, 45, 35)');
    expect(element.querySelector<HTMLElement>('[stringvalue^="red;"]')?.getAttribute('style')).toBeNull();
    const saved = editor.getJSON();
    editor.commands.setContent(saved);
    expect(editor.getJSON()).toEqual(saved);
    expect(element.querySelector('[stringvalue="blue"]')).not.toBeNull();
    expect(element.querySelector<HTMLElement>('[stringvalue="#b02d23"]')?.style.color).toBe('rgb(176, 45, 35)');
    editor.destroy();
    element.remove();
  });

  it('roundtrips every durable authored color name and legacy hex without serializing theme colors', () => {
    const names = Object.keys(authoredEditorPalettes.light)
      .filter((name) => name.startsWith('text-color-'))
      .map((name) => name.replace('text-color-', ''));
    const content = names.flatMap((name) =>
      ['textColor', 'backgroundColor'].map((type) => ({
        type: 'text',
        text: `${type}:${name}`,
        marks: [{ type, attrs: { stringValue: name } }],
      })),
    );
    content.push({ type: 'text', text: 'legacy', marks: [{ type: 'textColor', attrs: { stringValue: '#112233' } }] });
    const editor = new Editor({
      extensions: createTiptapWireExtensions(),
      content: documentWithBlocks([block('durable-colors', { type: 'paragraph', content })]),
    });
    const saved = editor.getJSON();
    editor.commands.setContent(saved);
    expect(editor.getJSON()).toEqual(saved);
    const group = editor.getJSON().content?.[0];
    if (!group || 'text' in group) {
      throw new Error('Expected a persisted block group.');
    }
    const container = group.content?.[0];
    if (!container || 'text' in container) {
      throw new Error('Expected a persisted block container.');
    }
    const paragraph = container.content?.[0];
    if (!paragraph || 'text' in paragraph || paragraph.type !== 'paragraph') {
      throw new Error('Expected the authored color paragraph.');
    }
    const authoredInline: (NodeType | TextType)[] = paragraph.content ?? [];
    expect(authoredInline.flatMap((text) => (text.marks ?? []).map((mark) => mark.attrs?.stringValue))).toEqual([
      ...names.flatMap((name) => [name, name]),
      '#112233',
    ]);
    editor.destroy();
  });

  it('round-trips durable table width and block alignment attributes', () => {
    const element = document.createElement('div');
    document.body.append(element);
    const editor = new Editor({
      element,
      extensions: createTiptapWireExtensions(),
      content:
        '<table data-display-size="64" data-text-alignment="right"><tbody><tr><td><p>x</p></td></tr></tbody></table>',
    });
    let table: ProseMirrorNode | null = null;
    editor.state.doc.descendants((node) => {
      if (!table && node.type.name === 'table') {
        table = node;
      }
    });
    expect((table as ProseMirrorNode | null)?.attrs).toMatchObject({
      displaySize: 64,
      textAlignment: 'right',
    });
    expect(editor.getHTML()).toContain('data-display-size="64"');
    expect(editor.getHTML()).toContain('data-text-alignment="right"');
    editor.destroy();
    element.remove();
  });

  it('keeps media identity in the standalone Tiptap projection while editing its caption', () => {
    const content = documentWithBlocks([
      block(
        'paragraph-one',
        {
          type: 'paragraph',
          attrs: {
            backgroundColor: 'default',
            textColor: 'default',
            textAlignment: 'left',
          },
          content: [{ type: 'text', text: 'Before Tiptap', marks: [{ type: 'bold' }] }],
        },
        [block('file-block-one', fileNode)],
      ),
    ]);
    const mounted = createMountedEditor(content);
    const tiptap = mounted.editor;

    expect(tiptap.getJSON()).toMatchObject({
      type: 'doc',
      content: [
        {
          type: 'blockGroup',
          content: [
            {
              type: 'blockContainer',
              attrs: { id: 'paragraph-one' },
              content: [
                { type: 'paragraph' },
                {
                  type: 'blockGroup',
                  content: [
                    {
                      type: 'blockContainer',
                      attrs: { id: 'file-block-one' },
                      content: [{ type: 'file', attrs: { fileId: 'file-123' } }],
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    });

    const filePosition = findNodePosition(tiptap, 'file');
    tiptap.view.dispatch(
      tiptap.state.tr.setNodeMarkup(filePosition, undefined, {
        ...tiptap.state.doc.nodeAt(filePosition)?.attrs,
        caption: 'Updated by Tiptap',
      }),
    );

    expect(tiptap.state.doc.nodeAt(filePosition)?.attrs).toMatchObject({
      fileId: 'file-123',
      caption: 'Updated by Tiptap',
    });

    mounted.destroy();
  });

  it('does not mutate supplied editor content while mounting', () => {
    const content = documentWithBlocks([
      block('stable-paragraph', {
        type: 'paragraph',
        attrs: { backgroundColor: 'default', textColor: 'default', textAlignment: 'left' },
        content: [{ type: 'text', text: 'Stable document' }],
      }),
    ]);
    const before = structuredClone(content);
    const mounted = createMountedEditor(content);

    expect(content).toEqual(before);

    mounted.destroy();
  });

  it('provides the common formatting shortcuts from the wire extension', () => {
    const mounted = createMountedEditor(
      documentWithBlocks([
        block('shortcut-paragraph', {
          type: 'paragraph',
          attrs: { backgroundColor: 'default', textColor: 'default', textAlignment: 'left' },
          content: [{ type: 'text', text: 'Format me' }],
        }),
      ]),
    );
    const paragraphPosition = findNodePosition(mounted.editor, 'paragraph');
    mounted.editor.commands.setTextSelection({
      from: paragraphPosition + 1,
      to: paragraphPosition + 1 + 'Format me'.length,
    });

    // The toolbar tooltips advertise these strings; each must toggle its mark in the editor.
    for (const mark of ['bold', 'italic', 'underline', 'strike', 'code'] as const) {
      const parts = EDITOR_TOOLBAR_SHORTCUTS[mark].split('-');
      expect(parts[0], `${mark} uses Mod`).toBe('Mod');
      const key = parts.at(-1)!;
      const shiftKey = parts.includes('Shift');
      expect(pressModShortcut(mounted.editor, key, shiftKey).defaultPrevented, mark).toBe(true);
      expect(mounted.editor.isActive(mark), mark).toBe(true);
      pressModShortcut(mounted.editor, key, shiftKey);
      expect(mounted.editor.isActive(mark), mark).toBe(false);
    }

    mounted.destroy();
  });

  it('consumes formatting shortcuts without applying or storing marks in inline math source', () => {
    const mounted = createMountedEditor(
      documentWithBlocks([
        block('math-shortcuts', {
          type: 'paragraph',
          content: [
            { type: 'text', text: 'before ' },
            { type: 'mathInline', content: [{ type: 'text', text: 'x^2' }] },
            { type: 'text', text: ' after' },
          ],
        }),
      ]),
    );
    const mathPosition = findNodePosition(mounted.editor, 'mathInline');
    mounted.editor.commands.setTextSelection({ from: mathPosition + 1, to: mathPosition + 4 });

    for (const shortcut of [
      { key: 'b', mark: 'bold' },
      { key: 'i', mark: 'italic' },
      { key: 'u', mark: 'underline' },
      { key: 's', mark: 'strike', shiftKey: true },
      { key: 'e', mark: 'code' },
    ]) {
      expect(pressModShortcut(mounted.editor, shortcut.key, shortcut.shiftKey).defaultPrevented).toBe(true);
      expect(mounted.editor.isActive(shortcut.mark)).toBe(false);
      expect(mounted.editor.state.storedMarks).toBeNull();
      expect(mounted.editor.state.doc.nodeAt(mathPosition)?.firstChild?.marks).toHaveLength(0);
    }

    mounted.destroy();
  });
});

describe('numbered list start', () => {
  it('restarts the editor counter where the published list does', () => {
    const editor = new Editor({
      extensions: createTiptapWireExtensions(),
      content: documentWithBlocks([
        block('n1', { type: 'numberedListItem', attrs: { start: 3 }, content: [{ type: 'text', text: 'three' }] }),
        block('n2', { type: 'numberedListItem', content: [{ type: 'text', text: 'four' }] }),
      ]),
    });
    const [first, second] = editor.view.dom.querySelectorAll<HTMLElement>('[data-content-type="numberedListItem"]');
    expect(first.style.getPropertyValue('counter-set')).toBe('numbered-list 3');
    expect(first.getAttribute('data-start')).toBe('3');
    expect(second.style.getPropertyValue('counter-set')).toBe('');
    editor.destroy();
  });
});
