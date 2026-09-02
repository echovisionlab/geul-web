// @vitest-environment jsdom

import { Editor, getSchema } from '@tiptap/core';
import { describe, expect, it } from 'vitest';
import * as Y from 'yjs';
import { prosemirrorJSONToYXmlFragment, yXmlFragmentToProseMirrorRootNode } from 'y-prosemirror';
import { moveCurrentBlock } from '../block-commands';
import { createCollaborationExtension } from '../collaboration';
import { createTiptapWireExtensions } from '../wire-schema';
import { createCompactTiptapExtensions, resolveCompactEditorAuthoringMode } from './CompactTiptapEditor';

describe('CompactTiptapEditor profile', () => {
  it('allows only the existing compact bio nodes and marks', () => {
    const tiptapSchema = getSchema(createCompactTiptapExtensions('Write a bio'));

    expect(Object.keys(tiptapSchema.nodes).sort()).toEqual([
      'blockContainer',
      'blockGroup',
      'divider',
      'doc',
      'hardBreak',
      'paragraph',
      'text',
    ]);
    expect(Object.keys(tiptapSchema.marks).sort()).toEqual([
      'backgroundColor',
      'bold',
      'code',
      'italic',
      'link',
      'strike',
      'textColor',
      'underline',
    ]);
  });

  it('reads and writes the existing Y.XmlFragment without conversion', async () => {
    const yDoc = new Y.Doc();
    const fragment = yDoc.getXmlFragment('document-store');
    const wireSchema = getSchema(createTiptapWireExtensions());
    prosemirrorJSONToYXmlFragment(
      wireSchema,
      {
        type: 'doc',
        content: [
          {
            type: 'blockGroup',
            content: [
              {
                type: 'blockContainer',
                attrs: { id: 'profile-bio' },
                content: [
                  {
                    type: 'paragraph',
                    attrs: { backgroundColor: 'default', textColor: 'default', textAlignment: 'left' },
                    content: [{ type: 'text', text: 'Original bio', marks: [{ type: 'bold' }] }],
                  },
                ],
              },
            ],
          },
        ],
      },
      fragment,
    );
    const before = fragment.toJSON();
    const element = document.createElement('div');
    document.body.append(element);
    const editor = new Editor({
      element,
      extensions: [...createCompactTiptapExtensions('Write a bio'), createCollaborationExtension({ fragment })],
    });

    expect(editor.getText()).toContain('Original bio');
    expect(fragment.toJSON()).toBe(before);

    const paragraphPosition = 2;
    editor.view.dispatch(editor.state.tr.insertText(' updated', paragraphPosition + 1 + 'Original bio'.length));
    expect(yXmlFragmentToProseMirrorRootNode(fragment, wireSchema).toJSON()).toMatchObject({
      type: 'doc',
      content: [
        {
          type: 'blockGroup',
          content: [
            {
              type: 'blockContainer',
              attrs: { id: 'profile-bio' },
              content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Original bio updated' }] }],
            },
          ],
        },
      ],
    });

    editor.destroy();
    element.remove();
    yDoc.destroy();
  });

  it('uses the shared paragraph Enter command', () => {
    const element = document.createElement('div');
    document.body.append(element);
    const editor = new Editor({
      element,
      extensions: createCompactTiptapExtensions('Write a bio'),
      content: {
        type: 'doc',
        content: [
          {
            type: 'blockGroup',
            content: [
              {
                type: 'blockContainer',
                attrs: { id: 'bio' },
                content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Bio' }] }],
              },
            ],
          },
        ],
      },
    });
    editor.commands.setTextSelection(6);

    const enter = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true });
    editor.view.dom.dispatchEvent(enter);

    expect(enter.defaultPrevented).toBe(true);
    expect(editor.state.doc.firstChild?.childCount).toBe(2);
    expect(editor.state.doc.firstChild?.child(0).attrs.id).toBe('bio');
    expect(editor.state.doc.firstChild?.child(1).attrs.id).not.toBe('bio');
    editor.destroy();
    element.remove();
  });

  it('locks target structure while keeping locale-owned paragraph text editable', () => {
    const element = document.createElement('div');
    document.body.append(element);
    const editor = new Editor({
      element,
      extensions: createCompactTiptapExtensions('Write a bio', true),
      content: {
        type: 'doc',
        content: [
          {
            type: 'blockGroup',
            content: [
              {
                type: 'blockContainer',
                attrs: { id: 'first' },
                content: [{ type: 'paragraph', content: [{ type: 'text', text: 'First' }] }],
              },
              {
                type: 'blockContainer',
                attrs: { id: 'second' },
                content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Second' }] }],
              },
            ],
          },
        ],
      },
    });
    let firstTextPosition = 0;
    editor.state.doc.descendants((node, position) => {
      if (firstTextPosition === 0 && node.type.name === 'paragraph') {
        firstTextPosition = position + 1;
      }
    });

    editor.commands.setTextSelection(firstTextPosition + 'First'.length);
    editor.commands.insertContent(' translated');
    expect(editor.getText()).toContain('First translated');

    const afterTextEdit = editor.getJSON();
    const enter = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true });
    editor.view.dom.dispatchEvent(enter);
    expect(enter.defaultPrevented).toBe(true);
    expect(editor.getJSON()).toEqual(afterTextEdit);

    editor.commands.setTextSelection(firstTextPosition + 1);
    expect(moveCurrentBlock(editor, 'down')).toBe(true);
    expect(editor.getJSON()).toEqual(afterTextEdit);

    let range: { from: number; to: number } | null = null;
    editor.state.doc.descendants((node, position) => {
      if (node.type.name === 'blockContainer' && node.attrs.id === 'first') {
        range = { from: position, to: position + node.nodeSize };
      }
    });
    expect(range).not.toBeNull();
    editor.view.dispatch(editor.state.tr.delete(range!.from, range!.to));
    expect(editor.getJSON()).toEqual(afterTextEdit);

    editor.destroy();
    element.remove();
  });

  it('grants localized text authority without granting target neutral authority', () => {
    expect(resolveCompactEditorAuthoringMode(true, true)).toEqual({
      allowNeutralBlockEdits: false,
      allowLocalizedBlockEdits: true,
    });
    expect(resolveCompactEditorAuthoringMode(false, true)).toEqual({
      allowNeutralBlockEdits: false,
      allowLocalizedBlockEdits: false,
    });
  });

  it('rejects content nodes outside the compact profile', () => {
    const schema = getSchema(createCompactTiptapExtensions('Write a bio'));

    expect(() =>
      schema.nodeFromJSON({
        type: 'doc',
        content: [
          {
            type: 'blockGroup',
            content: [{ type: 'blockContainer', content: [{ type: 'heading', content: [] }] }],
          },
        ],
      }),
    ).toThrow(/Unknown node type: heading/);
  });
});
