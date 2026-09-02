// @vitest-environment jsdom

import { Editor, Node, type JSONContent } from '@tiptap/core';
import type { JsonValue } from '@bufbuild/protobuf';
import { MissingAttachmentMediaKind } from '@echovisionlab/geul-proto/content/block_content_pb.ts';
import { describe, expect, it } from 'vitest';
import type { ProseMirrorBlockDescriptor } from './block-room-prosemirror-bridge';
import {
  array,
  documentToTiptap,
  inlineContentProjectionEqual,
  object,
  parseDocument,
  splitPayload,
  type JsonObject,
} from './block-room-tiptap-codec';
import { richTextProseMirrorAdapterForProtoCase } from './block-room-prosemirror-registry';
import { SHADER_STAGE_DEFINITIONS } from './shader/shader-program';
import { createTiptapWireExtensions } from './wire-schema';
import { geulTiptapEmojis } from './emoji/emoji-extension';

function executableWireExtensions() {
  const stages = SHADER_STAGE_DEFINITIONS.map(([, name]) =>
    Node.create({
      name,
      content: 'text*',
      addAttributes: () => ({ channels: { default: null } }),
      renderHTML: () => ['pre', 0],
    }),
  );
  return [
    Node.create({
      name: 'shader',
      group: 'blockContent',
      content: SHADER_STAGE_DEFINITIONS.map(([, name]) => name).join(' '),
      renderHTML: () => ['div', 0],
    }),
    ...stages,
  ];
}

function descriptor(
  protoCase: 'paragraph' | 'file' | 'map' | 'shader' | 'table' | 'callout',
  id: string,
  basePayload: JsonObject,
  localePayload: JsonObject,
): ProseMirrorBlockDescriptor {
  return {
    id,
    adapter: richTextProseMirrorAdapterForProtoCase(protoCase),
    basePayload,
    localePayload,
    children: [],
  };
}

function missingAttachment(formerFileId: string): JsonObject {
  return {
    missingAttachment: {
      formerFileId,
      mediaKind: MissingAttachmentMediaKind.IMAGE,
    },
  };
}

function findNodePosition(editor: Editor, type: string): number {
  let position = -1;
  editor.state.doc.descendants((node, candidate) => {
    if (position === -1 && node.type.name === type) {
      position = candidate;
      return false;
    }
    return true;
  });
  if (position < 0) {
    throw new Error(`Expected ${type} node.`);
  }
  return position;
}

function paragraphPositionByText(editor: Editor, text: string): number {
  let position = -1;
  editor.state.doc.descendants((node, candidate) => {
    if (position === -1 && node.type.name === 'paragraph' && node.textContent === text) {
      position = candidate;
      return false;
    }
    return true;
  });
  if (position < 0) {
    throw new Error(`Expected Paragraph containing ${text}.`);
  }
  return position;
}

describe('Block-room Tiptap codec', () => {
  it('round-trips a Callout body with durable nested Blocks', () => {
    const child = descriptor(
      'paragraph',
      '10000000-0000-4000-8000-000000000202',
      { props: {} },
      { props: {}, content: [{ text: { text: 'Nested copy' } }] },
    );
    const callout: ProseMirrorBlockDescriptor = {
      ...descriptor(
        'callout',
        '10000000-0000-4000-8000-000000000201',
        { props: { icon: '⚠️', backgroundColor: 'yellow' } },
        { props: {}, content: [{ text: { text: 'Callout body' } }] },
      ),
      children: [child],
    };

    const parsed = parseDocument(documentToTiptap([callout]));
    expect(parsed[0]).toMatchObject({ kind: 'callout', attrs: { icon: '⚠️', backgroundColor: 'yellow' } });
    expect(parsed[0]?.content).toEqual([{ type: 'text', text: 'Callout body', marks: [] }]);
    expect(parsed[0]?.children[0]).toMatchObject({
      kind: 'paragraph',
      parentBlockId: '10000000-0000-4000-8000-000000000201',
    });
    expect(splitPayload(parsed[0]!)).toEqual({
      base: { props: { icon: '⚠️', backgroundColor: 'yellow' } },
      locale: { props: {}, content: [{ text: { text: 'Callout body', styles: {} } }] },
    });
    expect(splitPayload(parsed[0]!.children[0]!).locale.content).toEqual([
      { text: { text: 'Nested copy', styles: {} } },
    ]);
  });

  it('omits PM-invalid empty styled leaves while preserving visible siblings through an unrelated edit', () => {
    const directId = '10000000-0000-4000-8000-000000000191';
    const linkedId = '10000000-0000-4000-8000-000000000192';
    const unrelatedId = '10000000-0000-4000-8000-000000000193';
    const input = documentToTiptap([
      descriptor(
        'paragraph',
        directId,
        { props: {} },
        {
          props: {},
          content: [
            { text: { text: '', styles: { bold: true } } },
            { text: { text: 'styled sibling', styles: { italic: true } } },
          ],
        },
      ),
      descriptor(
        'paragraph',
        linkedId,
        { props: {} },
        {
          props: {},
          content: [
            {
              link: {
                href: 'https://example.com',
                content: [
                  { text: '', styles: { underline: true } },
                  { text: 'linked sibling', styles: { italic: true } },
                ],
              },
            },
          ],
        },
      ),
      descriptor(
        'paragraph',
        unrelatedId,
        { props: {} },
        {
          props: {},
          content: [{ text: { text: 'unrelated', styles: {} } }],
        },
      ),
    ]);
    const editor = new Editor({
      element: document.createElement('div'),
      extensions: createTiptapWireExtensions(),
      content: input,
    });

    const unrelated = paragraphPositionByText(editor, 'unrelated');
    editor.view.dispatch(editor.state.tr.insertText('!', unrelated + 1 + 'unrelated'.length));

    const blocks = parseDocument(editor.getJSON() as JSONContent);
    expect(blocks.map((block) => block.id)).toEqual([directId, linkedId, unrelatedId]);
    expect(splitPayload(blocks[0]!).locale.content).toEqual([
      { text: { text: 'styled sibling', styles: { italic: true } } },
    ]);
    expect(splitPayload(blocks[1]!).locale.content).toEqual([
      {
        link: {
          href: 'https://example.com',
          content: [{ text: 'linked sibling', styles: { italic: true } }],
        },
      },
    ]);
    expect(splitPayload(blocks[2]!).locale.content).toEqual([{ text: { text: 'unrelated!', styles: {} } }]);
    expect(
      inlineContentProjectionEqual(
        [
          { text: { text: '', styles: { bold: true } } },
          { text: { text: 'styled sibling', styles: { italic: true } } },
        ],
        splitPayload(blocks[0]!).locale.content as readonly JsonValue[],
      ),
    ).toBe(true);

    editor.destroy();
  });

  it('round-trips the canonical Map 3D buildings prop through the Tiptap alias', () => {
    const map = documentToTiptap([
      descriptor('map', '10000000-0000-4000-8000-000000000201', { props: { show3dBuildings: true } }, { props: {} }),
    ]);

    const editor = new Editor({
      element: document.createElement('div'),
      extensions: createTiptapWireExtensions(),
      content: map,
    });

    const mapPosition = findNodePosition(editor, 'map');
    const mapNode = editor.state.doc.nodeAt(mapPosition);
    expect(mapNode?.attrs).toMatchObject({ show3DBuildings: 'true' });
    expect(mapNode?.attrs).not.toHaveProperty('show3dBuildings');

    const parsed = parseDocument(editor.getJSON() as JSONContent);
    expect(splitPayload(parsed[0]!).base.props).toMatchObject({ show3dBuildings: true });

    editor.destroy();
  });

  it('round-trips restore-only missing attachment state through an unrelated paragraph edit', () => {
    const fileFormerId = '10000000-0000-4000-8000-000000000201';
    const textureFormerId = '10000000-0000-4000-8000-000000000202';
    const cubeFormerIds = Array.from(
      { length: 6 },
      (_, index) => `10000000-0000-4000-8000-${String(203 + index).padStart(12, '0')}`,
    );
    const shaderStages: JsonObject[] = SHADER_STAGE_DEFINITIONS.map((_, index): JsonObject => ({
      kind: index + 1,
      source: `stage-${index}`,
      channels:
        index === 2
          ? [
              { kind: 3, file: missingAttachment(textureFormerId) },
              { kind: 5, faces: cubeFormerIds.map(missingAttachment) },
            ]
          : [],
    }));
    const input = documentToTiptap([
      descriptor(
        'paragraph',
        '10000000-0000-4000-8000-000000000211',
        { props: {} },
        { props: {}, content: [{ text: { text: 'before', styles: {} } }] },
      ),
      descriptor(
        'file',
        '10000000-0000-4000-8000-000000000212',
        { props: { attachment: missingAttachment(fileFormerId) } },
        { props: {} },
      ),
      descriptor('shader', '10000000-0000-4000-8000-000000000213', { props: { stages: shaderStages } }, { props: {} }),
    ]);
    const editor = new Editor({
      element: document.createElement('div'),
      extensions: [...createTiptapWireExtensions(), ...executableWireExtensions()],
      content: input,
    });

    const paragraph = findNodePosition(editor, 'paragraph');
    editor.view.dispatch(editor.state.tr.insertText(' updated', paragraph + 1 + 'before'.length));

    const blocks = parseDocument(editor.getJSON() as JSONContent);
    const file = blocks.find((block) => block.kind === 'file');
    const shader = blocks.find((block) => block.kind === 'shader');
    if (!file || !shader) {
      throw new Error('Expected File and Shader blocks.');
    }
    const fileBaseProps = object(splitPayload(file).base.props);
    const shaderBaseProps = object(splitPayload(shader).base.props);
    expect(fileBaseProps.attachment).toEqual(missingAttachment(fileFormerId));
    const stages = shaderBaseProps.stages as readonly JsonObject[];
    expect(stages[2]?.channels).toEqual([
      { kind: 3, file: missingAttachment(textureFormerId) },
      { kind: 5, faces: cubeFormerIds.map(missingAttachment) },
    ]);

    editor.destroy();
  });

  it('round-trips stable table row and cell identities without positional matching', () => {
    const rowId = '10000000-0000-4000-8000-000000000221';
    const cellId = '10000000-0000-4000-8000-000000000222';
    const input = documentToTiptap([
      descriptor(
        'table',
        '10000000-0000-4000-8000-000000000220',
        { props: {}, content: { rows: [{ id: rowId, cells: [{ id: cellId, header: false, props: {} }] }] } },
        {
          props: {},
          content: {
            rows: [{ rowId, cells: [{ cellId, content: [{ text: { text: 'stable', styles: {} } }] }] }],
          },
        },
      ),
    ]);
    const editor = new Editor({
      element: document.createElement('div'),
      extensions: createTiptapWireExtensions(),
      content: input,
    });

    const parsed = parseDocument(editor.getJSON() as JSONContent);
    expect(parsed[0]?.content[0]?.attrs).toMatchObject({ id: rowId });
    expect(parsed[0]?.content[0]?.content?.[0]?.attrs).toMatchObject({ id: cellId });
    expect(splitPayload(parsed[0]!)).toMatchObject({
      base: { content: { rows: [{ id: rowId, cells: [{ id: cellId }] }] } },
      locale: { content: { rows: [{ rowId, cells: [{ cellId }] }] } },
    });
    editor.destroy();
  });

  it('deterministically upgrades legacy positional tables to durable identities', () => {
    const legacy = descriptor(
      'table',
      '10000000-0000-4000-8000-000000000224',
      {
        props: {},
        content: {
          rows: [
            {
              cells: [
                { header: true, props: {} },
                { header: true, props: {} },
              ],
            },
            {
              cells: [
                { header: false, props: {} },
                { header: false, props: {} },
              ],
            },
          ],
        },
      },
      {
        props: {},
        content: {
          rows: [
            { cells: [{ content: [{ text: { text: 'A' } }] }, { content: [{ text: { text: 'B' } }] }] },
            { cells: [{ content: [{ text: { text: 'C' } }] }, { content: [{ text: { text: 'D' } }] }] },
          ],
        },
      },
    );
    const first = documentToTiptap([legacy]);
    const second = documentToTiptap([legacy]);
    expect(first).toEqual(second);

    const editor = new Editor({
      element: document.createElement('div'),
      extensions: createTiptapWireExtensions(),
      content: first,
    });
    const parsed = parseDocument(editor.getJSON() as JSONContent);
    const payload = splitPayload(parsed[0]!);
    const baseRows = array(object(payload.base.content).rows).map(object);
    const localeRows = array(object(payload.locale.content).rows).map(object);

    expect(baseRows).toHaveLength(2);
    expect(localeRows).toHaveLength(2);
    expect(localeRows.map((row) => row.rowId)).toEqual(baseRows.map((row) => row.id));
    expect(localeRows.map((row) => array(row.cells).map((cell) => object(cell).cellId))).toEqual(
      baseRows.map((row) => array(row.cells).map((cell) => object(cell).id)),
    );
    expect(parsed[0]?.content.map((row) => row.content?.map((cell) => cell.content?.[0]?.content?.[0]?.text))).toEqual([
      ['A', 'B'],
      ['C', 'D'],
    ]);
    editor.destroy();
  });

  it('pairs a legacy locale positionally with already migrated base identities', () => {
    const rowId = '10000000-0000-4000-8000-000000000225';
    const cellId = '10000000-0000-4000-8000-000000000226';
    const input = documentToTiptap([
      descriptor(
        'table',
        '10000000-0000-4000-8000-000000000227',
        { props: {}, content: { rows: [{ id: rowId, cells: [{ id: cellId, header: false, props: {} }] }] } },
        { props: {}, content: { rows: [{ cells: [{ content: [{ text: { text: 'legacy locale' } }] }] }] } },
      ),
    ]);
    const editor = new Editor({
      element: document.createElement('div'),
      extensions: createTiptapWireExtensions(),
      content: input,
    });
    const payload = splitPayload(parseDocument(editor.getJSON() as JSONContent)[0]!);

    expect(payload.locale).toMatchObject({
      content: { rows: [{ rowId, cells: [{ cellId, content: [{ text: { text: 'legacy locale' } }] }] }] },
    });
    editor.destroy();
  });

  it('rejects partially migrated table identity sets', () => {
    expect(() =>
      documentToTiptap([
        descriptor(
          'table',
          '10000000-0000-4000-8000-000000000228',
          {
            props: {},
            content: {
              rows: [
                { id: '10000000-0000-4000-8000-000000000229', cells: [{ header: false, props: {} }] },
                { cells: [{ header: false, props: {} }] },
              ],
            },
          },
          { props: {}, content: { rows: [{ cells: [{ content: [] }] }, { cells: [{ content: [] }] }] } },
        ),
      ]),
    ).toThrow('partially migrated durable identities');
  });

  it('stores the official Tiptap Emoji node as locale Unicode text', () => {
    const smile = geulTiptapEmojis.find((item) => item.shortcodes.includes('smile'));
    if (!smile?.emoji) {
      throw new Error('Official Emoji data is missing :smile:.');
    }
    const input = documentToTiptap([
      descriptor('paragraph', '10000000-0000-4000-8000-000000000223', { props: {} }, { props: {}, content: [] }),
    ]);
    const paragraph = input.content?.[0]?.content?.[0]?.content?.[0];
    if (!paragraph) {
      throw new Error('Expected Emoji paragraph fixture.');
    }
    paragraph.content = [{ type: 'emoji', attrs: { name: smile.name } }];
    const editor = new Editor({
      element: document.createElement('div'),
      extensions: createTiptapWireExtensions(),
      content: input,
    });

    const parsed = parseDocument(editor.getJSON() as JSONContent);
    expect(splitPayload(parsed[0]!).locale.content).toEqual([{ text: { text: smile.emoji, styles: {} } }]);
    editor.destroy();
  });
});
