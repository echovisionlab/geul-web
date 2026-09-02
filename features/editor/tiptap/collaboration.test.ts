// @vitest-environment jsdom

import { Editor } from '@tiptap/core';
import { NodeSelection, TextSelection } from '@tiptap/pm/state';
import { CellSelection } from '@tiptap/pm/tables';
import { applyAwarenessUpdate, Awareness, encodeAwarenessUpdate } from 'y-protocols/awareness';
import { describe, expect, it, vi } from 'vitest';
import * as Y from 'yjs';
import {
  absolutePositionToRelativePosition,
  undo,
  yCursorPluginKey,
  ySyncPluginKey,
  yUndoPluginKey,
} from 'y-prosemirror';
import { createCollaborationExtension, replaceCollaborationDocument } from './collaboration';
import { createTiptapTableExtensions } from './table/table-extensions';
import { createTiptapWireExtensions } from './wire-schema';

const tableNodeNames = new Set(['table', 'tableRow', 'tableCell', 'tableHeader']);

const initialDocument = {
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
              attrs: { backgroundColor: 'default', textColor: 'default', textAlignment: 'left' },
              content: [{ type: 'text', text: 'Shared note' }],
            },
          ],
        },
      ],
    },
  ],
};

const tableDocument = {
  type: 'doc',
  content: [
    {
      type: 'blockGroup',
      content: [
        {
          type: 'blockContainer',
          attrs: { id: 'table-one' },
          content: [
            {
              type: 'table',
              content: [
                {
                  type: 'tableRow',
                  content: [
                    {
                      type: 'tableCell',
                      content: [{ type: 'tableParagraph', content: [{ type: 'text', text: 'A' }] }],
                    },
                    {
                      type: 'tableCell',
                      content: [{ type: 'tableParagraph', content: [{ type: 'text', text: 'B' }] }],
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
};

function createEditor(fragment: Y.XmlFragment, awareness?: Awareness, localUser?: { name: string; color: string }) {
  const element = document.createElement('div');
  document.body.append(element);
  const editor = new Editor({
    element,
    extensions: [
      ...createTiptapWireExtensions().filter((extension) => !tableNodeNames.has(extension.name)),
      ...createTiptapTableExtensions(),
      createCollaborationExtension({ fragment, awareness, localUser }),
    ],
  });
  return {
    editor,
    destroy() {
      editor.destroy();
      element.remove();
    },
  };
}

function createDocument(document: typeof initialDocument | typeof tableDocument = initialDocument) {
  const yDoc = new Y.Doc();
  const fragment = yDoc.getXmlFragment('document-store');
  const seed = createEditor(fragment);
  seed.editor.commands.setContent(document);
  seed.destroy();
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

function findNodePositions(editor: Editor, nodeName: string): number[] {
  const positions: number[] = [];
  editor.state.doc.descendants((node, pos) => {
    if (node.type.name === nodeName) {
      positions.push(pos);
    }
  });
  return positions;
}

describe('Tiptap collaboration', () => {
  it('moves the initial numeric selection into inline content when the same endpoint lands on blockContainer', () => {
    const { yDoc, fragment } = createDocument();
    const fragmentBefore = fragment.toJSON();
    const updateBefore = Array.from(Y.encodeStateAsUpdate(yDoc));
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    let yTransactionCount = 0;
    const onYTransaction = () => {
      yTransactionCount += 1;
    };
    yDoc.on('afterTransaction', onYTransaction);

    let mounted: ReturnType<typeof createEditor> | undefined;
    try {
      mounted = createEditor(fragment);
      expect(mounted.editor.state.selection).toBeInstanceOf(TextSelection);
      expect(mounted.editor.state.selection.$head.parent.inlineContent).toBe(true);
      expect(mounted.editor.state.doc.resolve(1).nodeAfter?.type.name).toBe('blockContainer');
      expect(warn.mock.calls.flat().join(' ')).not.toContain(
        'TextSelection endpoint not pointing into a node with inline content',
      );
      expect(fragment.toJSON()).toEqual(fragmentBefore);
      expect(Array.from(Y.encodeStateAsUpdate(yDoc))).toEqual(updateBefore);
      const undoPluginState = yUndoPluginKey.getState(mounted.editor.state);
      expect(undoPluginState).toBeDefined();
      expect(undoPluginState?.undoManager.undoStack).toHaveLength(0);
      expect(yTransactionCount).toBe(0);
    } finally {
      yDoc.off('afterTransaction', onYTransaction);
      warn.mockRestore();
      mounted?.destroy();
      yDoc.destroy();
    }
  });

  it('preserves a valid text selection across a forced Y.XmlFragment rerender', () => {
    const { yDoc, fragment } = createDocument();
    const mounted = createEditor(fragment);
    const paragraph = findNodePosition(mounted.editor, 'paragraph');
    const from = paragraph + 1;
    const to = from + 'Shared'.length;
    mounted.editor.view.dispatch(
      mounted.editor.state.tr.setSelection(TextSelection.create(mounted.editor.state.doc, to, from)),
    );
    const fragmentBefore = fragment.toJSON();
    const updateBefore = Array.from(Y.encodeStateAsUpdate(yDoc));
    const undoPluginState = yUndoPluginKey.getState(mounted.editor.state);
    if (!undoPluginState) {
      throw new Error('Yjs undo plugin state is unavailable.');
    }
    const undoManager = undoPluginState.undoManager;
    const undoCountBefore = undoManager.undoStack.length;
    let yTransactionCount = 0;
    const onYTransaction = () => {
      yTransactionCount += 1;
    };
    yDoc.on('afterTransaction', onYTransaction);

    const binding = ySyncPluginKey.getState(mounted.editor.state).binding as { _forceRerender: () => void };
    binding._forceRerender();
    yDoc.off('afterTransaction', onYTransaction);

    expect(mounted.editor.state.selection).toBeInstanceOf(TextSelection);
    expect(mounted.editor.state.selection.anchor).toBe(to);
    expect(mounted.editor.state.selection.head).toBe(from);
    expect(mounted.editor.state.doc.textBetween(from, to)).toBe('Shared');
    expect(fragment.toJSON()).toEqual(fragmentBefore);
    expect(Array.from(Y.encodeStateAsUpdate(yDoc))).toEqual(updateBefore);
    expect(undoManager.undoStack).toHaveLength(undoCountBefore);
    expect(yTransactionCount).toBe(0);

    mounted.destroy();
    yDoc.destroy();
  });

  it('preserves a selectable block NodeSelection across a forced Y.XmlFragment rerender', () => {
    const { yDoc, fragment } = createDocument();
    const mounted = createEditor(fragment);
    const blockPosition = findNodePosition(mounted.editor, 'blockContainer');
    mounted.editor.view.dispatch(
      mounted.editor.state.tr.setSelection(NodeSelection.create(mounted.editor.state.doc, blockPosition)),
    );

    const binding = ySyncPluginKey.getState(mounted.editor.state).binding as { _forceRerender: () => void };
    binding._forceRerender();

    expect(mounted.editor.state.selection).toBeInstanceOf(NodeSelection);
    expect(mounted.editor.state.selection.from).toBe(blockPosition);
    expect((mounted.editor.state.selection as NodeSelection).node.type.name).toBe('blockContainer');

    mounted.destroy();
    yDoc.destroy();
  });

  it('preserves a CellSelection across an actual table Y.XmlFragment rerender', () => {
    const { yDoc, fragment } = createDocument(tableDocument);
    const mounted = createEditor(fragment);
    const cells = findNodePositions(mounted.editor, 'tableCell');
    expect(cells).toHaveLength(2);
    const fragmentBefore = fragment.toJSON();
    expect(fragmentBefore).toContain('<table');
    mounted.editor.view.dispatch(
      mounted.editor.state.tr.setSelection(CellSelection.create(mounted.editor.state.doc, cells[1], cells[0])),
    );

    const binding = ySyncPluginKey.getState(mounted.editor.state).binding as { _forceRerender: () => void };
    binding._forceRerender();

    expect(mounted.editor.state.selection).toBeInstanceOf(CellSelection);
    expect((mounted.editor.state.selection as CellSelection).$anchorCell.pos).toBe(cells[1]);
    expect((mounted.editor.state.selection as CellSelection).$headCell.pos).toBe(cells[0]);
    expect(fragment.toJSON()).toBe(fragmentBefore);

    mounted.destroy();
    yDoc.destroy();
  });

  it('publishes the authenticated local name and color, repairs it after awareness reconnect, and removes it on destroy', () => {
    const { yDoc, fragment } = createDocument();
    const awareness = new Awareness(yDoc);
    const mounted = createEditor(fragment, awareness, { name: '  Mina Park ', color: '#8A2BE2' });

    expect(awareness.getLocalState()?.user).toEqual({ name: 'Mina Park', color: '#8a2be2' });

    // Providers can rehydrate awareness state during reconnect. The binding
    // restores only its own `user` field and leaves other awareness fields intact.
    awareness.setLocalState({ status: 'online' });
    expect(awareness.getLocalState()).toMatchObject({
      status: 'online',
      user: { name: 'Mina Park', color: '#8a2be2' },
    });

    mounted.destroy();
    expect(awareness.getLocalState()).toMatchObject({ status: 'online', user: null, cursor: null });
    awareness.destroy();
    yDoc.destroy();
  });

  it('renders remote collaborator cursor and selection decorations from awareness', async () => {
    const local = createDocument();
    const awareness = new Awareness(local.yDoc);
    const mounted = createEditor(local.fragment, awareness, { name: 'Mina', color: '#8a2be2' });

    const remoteDoc = new Y.Doc();
    Y.applyUpdate(remoteDoc, Y.encodeStateAsUpdate(local.yDoc));
    const remoteFragment = remoteDoc.getXmlFragment('document-store');
    const remoteEditor = createEditor(remoteFragment);
    const remoteBinding = ySyncPluginKey.getState(remoteEditor.editor.state).binding;
    const anchor = absolutePositionToRelativePosition(2, remoteFragment, remoteBinding.mapping);
    const head = absolutePositionToRelativePosition(3, remoteFragment, remoteBinding.mapping);
    const remoteAwareness = new Awareness(remoteDoc);
    remoteAwareness.setLocalState({
      user: { name: 'Remote collaborator', color: '#ff6600' },
      cursor: { anchor, head },
    });

    applyAwarenessUpdate(awareness, encodeAwarenessUpdate(remoteAwareness, [remoteDoc.clientID]), remoteAwareness);
    await new Promise((resolve) => window.setTimeout(resolve));

    expect(awareness.getStates().get(remoteDoc.clientID)?.user).toEqual({
      name: 'Remote collaborator',
      color: '#ff6600',
    });
    expect(yCursorPluginKey.getState(mounted.editor.state).find()).toHaveLength(2);
    expect(mounted.editor.view.dom.querySelector('.ProseMirror-yjs-cursor')?.textContent).toContain(
      'Remote collaborator',
    );

    remoteAwareness.destroy();
    remoteEditor.destroy();
    mounted.destroy();
    awareness.destroy();
    remoteDoc.destroy();
    local.yDoc.destroy();
  });

  it('tracks only local editor changes in undo, excluding remote and system projection transactions', () => {
    const { yDoc, fragment } = createDocument();
    const mounted = createEditor(fragment);
    const undoPluginState = yUndoPluginKey.getState(mounted.editor.state);
    expect(undoPluginState).toBeDefined();
    const undoManager = undoPluginState!.undoManager;

    mounted.editor.commands.insertContent(' local edit');
    const localUndoCount = undoManager.undoStack.length;
    expect(localUndoCount).toBeGreaterThan(0);

    // A server-side projection can touch the same Y.XmlFragment but uses its
    // own transaction origin, so a user cannot undo it from the editor.
    yDoc.transact(() => {
      (fragment.get(0) as Y.XmlElement).setAttribute('projection-version', '2');
    }, 'system-projection');
    expect(undoManager.undoStack).toHaveLength(localUndoCount);

    const remoteDoc = new Y.Doc();
    Y.applyUpdate(remoteDoc, Y.encodeStateAsUpdate(yDoc));
    const remoteFragment = remoteDoc.getXmlFragment('document-store');
    remoteDoc.transact(() => {
      (remoteFragment.get(0) as Y.XmlElement).setAttribute('remote-projection', '3');
    }, 'remote-editor');
    Y.applyUpdate(yDoc, Y.encodeStateAsUpdate(remoteDoc), 'remote-editor');
    expect(undoManager.undoStack).toHaveLength(localUndoCount);

    expect(undo(mounted.editor.state)).toBe(true);
    expect((fragment.get(0) as Y.XmlElement).getAttribute('projection-version')).toBe('2');
    expect((fragment.get(0) as Y.XmlElement).getAttribute('remote-projection')).toBe('3');

    mounted.destroy();
    remoteDoc.destroy();
    yDoc.destroy();
  });

  it('replaces the collaborative document through the live binding without creating a local undo item', () => {
    const { yDoc, fragment } = createDocument();
    const mounted = createEditor(fragment);
    const undoPluginState = yUndoPluginKey.getState(mounted.editor.state);
    if (!undoPluginState) {
      throw new Error('Yjs undo plugin state is unavailable.');
    }

    const projectedDocument = mounted.editor.schema.nodeFromJSON({
      ...initialDocument,
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
                  attrs: { backgroundColor: 'default', textColor: 'default', textAlignment: 'left' },
                  content: [{ type: 'text', text: 'Projected note' }],
                },
              ],
            },
          ],
        },
      ],
    });

    expect(replaceCollaborationDocument(mounted.editor, projectedDocument, 'test-system-projection')).toBe(true);
    expect(mounted.editor.state.doc.textContent).toBe('Projected note');
    expect(fragment.toJSON()).toContain('Projected note');
    expect(undoPluginState.undoManager.undoStack).toHaveLength(0);

    expect(replaceCollaborationDocument(mounted.editor, projectedDocument, 'test-system-projection')).toBe(false);
    expect(undoPluginState.undoManager.undoStack).toHaveLength(0);

    const paragraph = findNodePosition(mounted.editor, 'paragraph');
    const paragraphEnd = paragraph + mounted.editor.state.doc.nodeAt(paragraph)!.content.size;
    mounted.editor.view.dispatch(
      mounted.editor.state.tr.setSelection(TextSelection.create(mounted.editor.state.doc, paragraphEnd)),
    );
    mounted.editor.commands.insertContent(' local');
    expect(undoPluginState.undoManager.undoStack.length).toBeGreaterThan(0);
    expect(undo(mounted.editor.state)).toBe(true);
    expect(mounted.editor.state.doc.textContent).toBe('Projected note');

    mounted.destroy();
    yDoc.destroy();
  });

  it.each([[{ name: '', color: '#8a2be2' }], [{ name: 'Mina', color: 'rgb(1, 2, 3)' }]])(
    'rejects an invalid local awareness user: %o',
    (localUser) => {
      const { yDoc, fragment } = createDocument();
      const awareness = new Awareness(yDoc);

      expect(() => createCollaborationExtension({ fragment, awareness, localUser })).toThrow(/awareness/);

      awareness.destroy();
      yDoc.destroy();
    },
  );
});
