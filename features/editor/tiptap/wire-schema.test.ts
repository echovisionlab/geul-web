// @vitest-environment jsdom

import { Editor, getSchema, type JSONContent } from '@tiptap/core';
import type { Node as ProseMirrorNode } from '@tiptap/pm/model';
import { TextSelection } from '@tiptap/pm/state';
import { describe, expect, it } from 'vitest';
import * as Y from 'yjs';
import { prosemirrorJSONToYXmlFragment, yXmlFragmentToProseMirrorRootNode } from 'y-prosemirror';
import { editorSchema } from '@/features/editor/schema';
import { normalizeMapBlockPropsInput } from '@/lib/types/map-block/schema';
import { createCollaborationExtension } from './collaboration';
import { createP5SketchExtension } from './p5';
import { KOREAN_P5_SKETCH_LABELS } from './p5/p5-labels.fixtures';
import { createShaderExtension } from './shader';
import { createThreeSceneExtension, KOREAN_THREE_SCENE_LABELS } from './three';
import { createTiptapWireExtensions } from './wire-schema';

function attributeDefaults(attributes: Record<string, { default?: unknown }>) {
  return Object.fromEntries(Object.entries(attributes).map(([name, attribute]) => [name, attribute.default]));
}

const wireSchema = getSchema([
  ...createTiptapWireExtensions(),
  createP5SketchExtension({ labels: KOREAN_P5_SKETCH_LABELS }),
  createThreeSceneExtension({ labels: KOREAN_THREE_SCENE_LABELS }),
  createShaderExtension(),
]);

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

function createDocumentStoreFixture(document: JSONContent) {
  // Make an unsupported or malformed fixture fail before it can be written to
  // the authoritative document-store fragment.
  const validatedDocument = wireSchema.nodeFromJSON(document);
  validatedDocument.check();

  const yDoc = new Y.Doc();
  const fragment = yDoc.getXmlFragment('document-store');
  prosemirrorJSONToYXmlFragment(wireSchema, validatedDocument.toJSON(), fragment);
  return { yDoc, fragment };
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

function createMountedEditor(fragment: Y.XmlFragment) {
  const element = document.createElement('div');
  document.body.append(element);
  const editor = new Editor({
    element,
    extensions: [...createTiptapWireExtensions(), createCollaborationExtension({ fragment })],
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
    previewWidth: '100',
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
    editor.destroy();
    element.remove();
  });

  it('matches the durable editor node names, content expressions, and attributes', () => {
    const structuralNodes = {
      doc: { group: '', content: 'blockGroup', attrs: {} },
      blockGroup: { group: 'childContainer', content: 'blockGroupChild+', attrs: {} },
      blockContainer: {
        group: 'blockGroupChild bnBlock',
        content: 'blockContent blockGroup?',
        attrs: { id: null },
      },
      tableParagraph: { group: 'tableContent', content: 'inline*', attrs: {} },
      tableHeader: {
        group: '',
        content: 'tableContent+',
        attrs: {
          id: null,
          textColor: 'default',
          backgroundColor: 'default',
          textAlignment: 'left',
          colspan: 1,
          rowspan: 1,
          colwidth: null,
        },
      },
      tableCell: {
        group: '',
        content: 'tableContent+',
        attrs: {
          id: null,
          textColor: 'default',
          backgroundColor: 'default',
          textAlignment: 'left',
          colspan: 1,
          rowspan: 1,
          colwidth: null,
        },
      },
      tableRow: { group: '', content: '(tableCell | tableHeader)+', attrs: { id: null } },
      text: { group: 'inline', content: '', attrs: {} },
      hardBreak: { group: 'inline', content: '', attrs: {} },
      mathInline: { group: 'inline', content: 'text*', attrs: { latex: '' } },
      emoji: { group: 'inline', content: '', attrs: { name: null } },
      externalVideo: {
        group: 'blockContent',
        content: '',
        attrs: {
          backgroundColor: 'default',
          textColor: 'default',
          textAlignment: 'left',
          previewWidth: 100,
          aspectRatio: 'auto',
          url: '',
          label: '',
          sourceContent: [],
        },
      },
      shaderCommon: { group: '', content: 'text*', attrs: {} },
      shaderVertex: { group: '', content: 'text*', attrs: {} },
      shaderBufferA: { group: '', content: 'text*', attrs: { channels: null } },
      shaderBufferB: { group: '', content: 'text*', attrs: { channels: null } },
      shaderBufferC: { group: '', content: 'text*', attrs: { channels: null } },
      shaderBufferD: { group: '', content: 'text*', attrs: { channels: null } },
      shaderCubemap: { group: '', content: 'text*', attrs: { channels: null } },
      shaderSound: { group: '', content: 'text*', attrs: { channels: null } },
      shaderImage: { group: '', content: 'text*', attrs: { channels: null } },
    } as const;
    const expectedNodeNames = [...Object.keys(editorSchema.blockSchema), ...Object.keys(structuralNodes)].sort();

    expect(Object.keys(wireSchema.nodes).sort()).toEqual(expectedNodeNames);

    for (const [name, blockSpec] of Object.entries(editorSchema.blockSchema)) {
      const node = wireSchema.nodes[name];
      expect(node, name).toBeDefined();
      expect(node.spec.group ?? '', `${name} group`).toBe('blockContent');
      expect(String(node.spec.content ?? ''), `${name} content`).toBe(blockSpec.content);
      const expectedAttributes = Object.fromEntries(
        Object.entries(blockSpec.props).map(([prop, spec]) => [prop, spec.default]),
      );
      expect(attributeDefaults(node.spec.attrs ?? {}), `${name} attributes`).toEqual(
        name === 'map'
          ? { ...expectedAttributes, mapPlaceId: '', location: '' }
          : name === 'file'
            ? { ...expectedAttributes, attachment: null }
            : expectedAttributes,
      );
    }

    for (const [name, expected] of Object.entries(structuralNodes)) {
      const node = wireSchema.nodes[name];
      expect(node, name).toBeDefined();
      expect(node.spec.group ?? '', `${name} group`).toBe(expected.group);
      expect(String(node.spec.content ?? ''), `${name} content`).toBe(expected.content);
      expect(attributeDefaults(node.spec.attrs ?? {}), `${name} attributes`).toEqual(expected.attrs);
    }
    expect(wireSchema.nodes.mathInline?.spec.marks).toBe('');

    const expectedMarks = {
      bold: {},
      italic: {},
      underline: {},
      strike: {},
      code: {},
      textColor: { stringValue: undefined },
      backgroundColor: { stringValue: undefined },
      link: { href: null },
    };
    expect(Object.keys(wireSchema.marks).sort()).toEqual(Object.keys(expectedMarks).sort());
    for (const [name, expectedAttrs] of Object.entries(expectedMarks)) {
      expect(attributeDefaults(wireSchema.marks[name]?.spec.attrs ?? {}), `${name} attributes`).toEqual(expectedAttrs);
    }
  });

  it('round-trips durable table width and block alignment attributes', () => {
    const element = document.createElement('div');
    document.body.append(element);
    const editor = new Editor({
      element,
      extensions: createTiptapWireExtensions(),
      content:
        '<table data-preview-width="64" data-text-alignment="right"><tbody><tr><td><p>x</p></td></tr></tbody></table>',
    });
    let table: ProseMirrorNode | null = null;
    editor.state.doc.descendants((node) => {
      if (!table && node.type.name === 'table') {
        table = node;
      }
    });
    expect((table as ProseMirrorNode | null)?.attrs).toMatchObject({
      previewWidth: 64,
      textAlignment: 'right',
    });
    expect(editor.getHTML()).toContain('data-preview-width="64"');
    expect(editor.getHTML()).toContain('data-text-alignment="right"');
    editor.destroy();
    element.remove();
  });

  it('keeps converter-only document-store fixtures on the verified File ID contract', () => {
    const { yDoc, fragment } = createDocumentStoreFixture(
      documentWithBlocks([
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
      ]),
    );

    const mounted = createMountedEditor(fragment);
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

    expect(yXmlFragmentToProseMirrorRootNode(fragment, wireSchema).toJSON()).toMatchObject({
      type: 'doc',
      content: [
        {
          type: 'blockGroup',
          content: [
            {
              type: 'blockContainer',
              attrs: { id: 'paragraph-one' },
              content: [
                {
                  type: 'paragraph',
                  content: [{ type: 'text', text: 'Before Tiptap', marks: [{ type: 'bold' }] }],
                },
                {
                  type: 'blockGroup',
                  content: [
                    {
                      type: 'blockContainer',
                      attrs: { id: 'file-block-one' },
                      content: [
                        {
                          type: 'file',
                          attrs: {
                            fileId: 'file-123',
                            caption: 'Updated by Tiptap',
                          },
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

    mounted.destroy();
    yDoc.destroy();
  });

  it('reads a legacy map from an existing document-store fragment through the canonical conversion boundary', () => {
    const { yDoc, fragment } = createDocumentStoreFixture(
      documentWithBlocks([
        block('legacy-map', {
          type: 'map',
          attrs: {
            mapPlaceId: 'legacy-place',
            location: JSON.stringify({ name: 'Seoul', lat: 37.5665, lng: 126.978 }),
          },
        }),
      ]),
    );

    const mounted = createMountedEditor(fragment);
    const mapPosition = findNodePosition(mounted.editor, 'map');
    const mapAttributes = mounted.editor.state.doc.nodeAt(mapPosition)?.attrs;

    expect(mapAttributes).toMatchObject({ mapPlaceId: 'legacy-place' });
    expect(normalizeMapBlockPropsInput(mapAttributes)).toMatchObject({
      mapPlaceIds: 'legacy-place',
      centerLat: '37.5665',
      centerLng: '126.978',
    });
    expect(normalizeMapBlockPropsInput(mapAttributes)).not.toHaveProperty('mapPlaceId');
    expect(normalizeMapBlockPropsInput(mapAttributes)).not.toHaveProperty('location');

    mounted.destroy();
    yDoc.destroy();
  });

  it('syncs edits between two independently hydrated Yjs clients', () => {
    const { yDoc: sourceDoc, fragment: sourceFragment } = createDocumentStoreFixture(
      documentWithBlocks([
        block(
          'paragraph-one',
          {
            type: 'paragraph',
            attrs: {
              backgroundColor: 'default',
              textColor: 'default',
              textAlignment: 'left',
            },
            content: [{ type: 'text', text: 'Client A' }],
          },
          [block('file-block-one', fileNode)],
        ),
      ]),
    );
    const peerDoc = new Y.Doc();
    Y.applyUpdate(peerDoc, Y.encodeStateAsUpdate(sourceDoc));
    const peerFragment = peerDoc.getXmlFragment('document-store');
    const source = createMountedEditor(sourceFragment);
    const peer = createMountedEditor(peerFragment);

    let sourceUpdate: Uint8Array | null = null;
    sourceDoc.on('update', (update) => {
      sourceUpdate = update;
    });
    const paragraphPosition = findNodePosition(source.editor, 'paragraph');
    const paragraph = source.editor.state.doc.nodeAt(paragraphPosition);
    source.editor.view.dispatch(
      source.editor.state.tr.insertText(' synced', paragraphPosition + 1 + (paragraph?.content.size ?? 0)),
    );
    expect(sourceUpdate).not.toBeNull();
    Y.applyUpdate(peerDoc, sourceUpdate!);
    expect(peer.editor.getText()).toContain('Client A synced');

    let peerUpdate: Uint8Array | null = null;
    peerDoc.on('update', (update) => {
      peerUpdate = update;
    });
    const peerFilePosition = findNodePosition(peer.editor, 'file');
    peer.editor.view.dispatch(
      peer.editor.state.tr.setNodeMarkup(peerFilePosition, undefined, {
        ...peer.editor.state.doc.nodeAt(peerFilePosition)?.attrs,
        caption: 'Updated by client B',
      }),
    );
    expect(peerUpdate).not.toBeNull();
    Y.applyUpdate(sourceDoc, peerUpdate!);
    expect(source.editor.state.doc.nodeAt(findNodePosition(source.editor, 'file'))?.attrs.caption).toBe(
      'Updated by client B',
    );

    source.destroy();
    peer.destroy();
    sourceDoc.destroy();
    peerDoc.destroy();
  });

  it('does not rewrite an existing fragment merely by mounting Tiptap', () => {
    const { yDoc, fragment } = createDocumentStoreFixture(
      documentWithBlocks([
        block('stable-paragraph', {
          type: 'paragraph',
          attrs: { backgroundColor: 'default', textColor: 'default', textAlignment: 'left' },
          content: [{ type: 'text', text: 'Stable document' }],
        }),
      ]),
    );
    const before = fragment.toJSON();
    const mounted = createMountedEditor(fragment);

    expect(fragment.toJSON()).toBe(before);

    mounted.destroy();
    yDoc.destroy();
  });

  it('provides the common formatting shortcuts from the wire extension', () => {
    const { yDoc, fragment } = createDocumentStoreFixture(
      documentWithBlocks([
        block('shortcut-paragraph', {
          type: 'paragraph',
          attrs: { backgroundColor: 'default', textColor: 'default', textAlignment: 'left' },
          content: [{ type: 'text', text: 'Format me' }],
        }),
      ]),
    );
    const mounted = createMountedEditor(fragment);
    const paragraphPosition = findNodePosition(mounted.editor, 'paragraph');
    mounted.editor.commands.setTextSelection({
      from: paragraphPosition + 1,
      to: paragraphPosition + 1 + 'Format me'.length,
    });

    for (const shortcut of [
      { key: 'b', mark: 'bold' },
      { key: 'i', mark: 'italic' },
      { key: 'u', mark: 'underline' },
      { key: 's', mark: 'strike', shiftKey: true },
      { key: 'e', mark: 'code' },
    ]) {
      expect(pressModShortcut(mounted.editor, shortcut.key, shortcut.shiftKey).defaultPrevented).toBe(true);
      expect(mounted.editor.isActive(shortcut.mark)).toBe(true);
      pressModShortcut(mounted.editor, shortcut.key, shortcut.shiftKey);
      expect(mounted.editor.isActive(shortcut.mark)).toBe(false);
    }

    mounted.destroy();
    yDoc.destroy();
  });

  it('consumes formatting shortcuts without applying or storing marks in inline math source', () => {
    const { yDoc, fragment } = createDocumentStoreFixture(
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
    const mounted = createMountedEditor(fragment);
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
    yDoc.destroy();
  });

  it('routes Mod-Z and Mod-Shift-Z through the collaborative Yjs undo authority', () => {
    const { yDoc, fragment } = createDocumentStoreFixture(
      documentWithBlocks([
        block('undo-paragraph', {
          type: 'paragraph',
          attrs: { backgroundColor: 'default', textColor: 'default', textAlignment: 'left' },
          content: [{ type: 'text', text: 'Before' }],
        }),
      ]),
    );
    const mounted = createMountedEditor(fragment);
    const paragraphPosition = findNodePosition(mounted.editor, 'paragraph');
    const paragraph = mounted.editor.state.doc.nodeAt(paragraphPosition);
    mounted.editor.view.dispatch(
      mounted.editor.state.tr.insertText(' after', paragraphPosition + 1 + (paragraph?.content.size ?? 0)),
    );
    expect(mounted.editor.getText()).toContain('Before after');

    expect(pressModShortcut(mounted.editor, 'z').defaultPrevented).toBe(true);
    expect(mounted.editor.getText()).toContain('Before');
    expect(mounted.editor.getText()).not.toContain('after');

    expect(pressModShortcut(mounted.editor, 'z', true).defaultPrevented).toBe(true);
    expect(mounted.editor.getText()).toContain('Before after');

    mounted.destroy();
    yDoc.destroy();
  });
});
