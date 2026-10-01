// @vitest-environment jsdom

import { Editor, getSchema } from '@tiptap/core';
import { fromJson, type JsonValue } from '@bufbuild/protobuf';
import { contentBlockCatalogFingerprint } from '@echovisionlab/geul-proto/content/block_catalog.ts';
import {
  LocalizedRichTextDocumentSchema,
  RichTextProfile,
} from '@echovisionlab/geul-proto/content/block_content_pb.ts';
import {
  hydrateCanonicalBlockRoom,
  materializeCanonicalBlockRoom,
} from '@echovisionlab/geul-common/collaboration/block-room-codec';
import { describe, expect, it } from 'vitest';
import * as Y from 'yjs';
import { moveCurrentBlock } from '../block-commands';
import { createBlockRoomProseMirrorBridge } from '../block-room-prosemirror-bridge';
import { createRichTextBlockRoomTiptapController } from '../block-room-tiptap-controller';
import { createCompactTiptapExtensions, resolveCompactEditorAuthoringMode } from './CompactTiptapEditor';

const COMPACT_PARAGRAPH_ID = '019cce25-dbc0-7d12-9f1f-735b1a6c6b31';

function compactTextFromRoom(room: Y.Doc): string {
  const document = materializeCanonicalBlockRoom(room, 'artist');
  if (document.$typeName !== 'api.content.v1.LocalizedRichTextDocument') {
    throw new Error('Expected a rich-text document.');
  }
  const paragraph = document.localeOverlay?.blocks[0]?.value;
  if (paragraph?.case !== 'paragraph') {
    return '';
  }
  return paragraph.value.content
    .map((inline) => (inline.value.case === 'text' ? inline.value.value.text : ''))
    .join('');
}

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

  it('projects and writes compact content through the canonical Block-room controller', () => {
    const yDoc = new Y.Doc();
    hydrateCanonicalBlockRoom(
      yDoc,
      'artist',
      'en',
      fromJson(LocalizedRichTextDocumentSchema, {
        blockCatalogFingerprint: contentBlockCatalogFingerprint,
        profile: RichTextProfile.COMPACT,
        locale: 'en',
        base: {
          nodes: [{ block: { id: COMPACT_PARAGRAPH_ID, paragraph: { props: {} } }, placement: { index: 0 } }],
        },
        localeOverlay: {
          locale: 'en',
          blocks: [
            {
              blockId: COMPACT_PARAGRAPH_ID,
              paragraph: { props: {}, content: [{ text: { text: 'Original bio', styles: { bold: true } } }] },
            },
          ],
        },
      } as JsonValue),
      [],
    );
    const bridge = createBlockRoomProseMirrorBridge({ document: yDoc, documentType: 'artist', locale: 'en' });
    const controller = createRichTextBlockRoomTiptapController(bridge);
    const element = document.createElement('div');
    document.body.append(element);
    const editor = new Editor({
      element,
      extensions: [...createCompactTiptapExtensions('Write a bio'), controller.extension],
      content: controller.initialContent,
    });
    const disconnect = controller.connect(editor);

    expect(editor.getText()).toContain('Original bio');
    expect(compactTextFromRoom(yDoc)).toBe('Original bio');

    let paragraphPosition = -1;
    editor.state.doc.descendants((node, position) => {
      if (paragraphPosition < 0 && node.type.name === 'paragraph') {
        paragraphPosition = position;
      }
    });
    expect(paragraphPosition).toBeGreaterThanOrEqual(0);
    editor.view.dispatch(editor.state.tr.insertText(' updated', paragraphPosition + 1 + 'Original bio'.length));
    expect(compactTextFromRoom(yDoc)).toBe('Original bio updated');

    disconnect();
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
