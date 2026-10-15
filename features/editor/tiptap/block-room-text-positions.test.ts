import { getSchema, Node } from '@tiptap/core';
import * as Y from 'yjs';
import { expect, it } from 'vitest';
import { richTextBlockCatalog } from '@echovisionlab/geul-proto/content/block_catalog.ts';
import { SHADER_STAGE_DEFINITIONS } from './shader/shader-program';
import { createTiptapWireExtensions } from './wire-schema';
import { relativeBlockPoint, resolveRelativeBlockPoint } from './block-room-text-positions';

it.each([false, true])('anchors cells by identity with reversed storage=%s', (reversed) => {
  const room = new Y.Doc();
  const first = new Y.Text();
  const second = new Y.Text('B');
  const inline = (text: Y.Text) => Y.Array.from([new Y.Map([['text', new Y.Map([['text', text]])]])]);
  const cellValues = [
    new Y.Map<unknown>([
      ['cellId', 'a'],
      ['content', inline(first)],
    ]),
    new Y.Map<unknown>([
      ['cellId', 'b'],
      ['content', inline(second)],
    ]),
  ];
  const cells = Y.Array.from(reversed ? cellValues.toReversed() : cellValues);
  room.getMap('block-document').set(
    'localeOverlay',
    new Y.Map([
      [
        'block',
        new Y.Map([
          [
            'payload',
            new Y.Map([
              [
                'content',
                new Y.Map([
                  [
                    'rows',
                    Y.Array.from([
                      new Y.Map<unknown>([
                        ['rowId', 'row'],
                        ['cells', cells],
                      ]),
                    ]),
                  ],
                ]),
              ],
            ]),
          ],
        ]),
      ],
    ]),
  );
  const schema = getSchema(createTiptapWireExtensions());
  const block = () =>
    schema.nodeFromJSON({
      type: 'blockContainer',
      attrs: { id: 'block' },
      content: [
        {
          type: 'table',
          content: [
            {
              type: 'tableRow',
              attrs: { id: 'row' },
              content: [first.toString(), 'B'].map((text, index) => ({
                type: 'tableCell',
                attrs: { id: index === 0 ? 'a' : 'b' },
                content: [{ type: 'tableParagraph', content: text ? [{ type: 'text', text }] : [] }],
              })),
            },
          ],
        },
      ],
    });
  const before = block();
  let offset = 0;
  before.descendants((node, pos) => {
    if (node.isText && node.text === 'B') {
      offset = pos;
    }
  });
  const relative = relativeBlockPoint(room, 'block', before, offset)!;
  expect(relative).toBeDefined();
  first.insert(0, 'X');
  expect(resolveRelativeBlockPoint(room, 'block', block(), relative)).toBe(offset + 1);
  room.destroy();
});

it('anchors sparse, reordered shader sources by stage kind', () => {
  const room = new Y.Doc();
  const common = new Y.Text('same');
  const image = new Y.Text('same');
  const kinds = richTextBlockCatalog.shader.fields.stages.items.fields.kind.values;
  const stages = Y.Array.from([
    new Y.Map<unknown>([
      ['kind', kinds.indexOf('image') + 1],
      ['source', image],
    ]),
    new Y.Map<unknown>([
      ['kind', kinds.indexOf('common') + 1],
      ['source', common],
    ]),
  ]);
  room
    .getMap('block-document')
    .set(
      'baseNodes',
      new Y.Map([['shader', new Y.Map([['payload', new Y.Map([['props', new Y.Map([['stages', stages]])]])]])]]),
    );
  const schema = getSchema([
    ...createTiptapWireExtensions(),
    Node.create({
      name: 'shader',
      group: 'blockContent',
      content: SHADER_STAGE_DEFINITIONS.map(([, name]) => name).join(' '),
    }),
    ...SHADER_STAGE_DEFINITIONS.map(([, name]) => Node.create({ name, content: 'text*' })),
  ]);
  const block = schema.nodeFromJSON({
    type: 'blockContainer',
    attrs: { id: 'shader' },
    content: [
      {
        type: 'shader',
        content: SHADER_STAGE_DEFINITIONS.map(([kind, name]) => ({
          type: name,
          content: kind === 'image' || kind === 'common' ? [{ type: 'text', text: 'same' }] : [],
        })),
      },
    ],
  });
  let offset = 0;
  block.descendants((node, pos) => {
    if (node.type.name === 'shaderImage') {
      offset = pos + 1;
    }
  });
  const relative = relativeBlockPoint(room, 'shader', block, offset)!;
  expect(relative).toBeDefined();
  expect(
    Y.createAbsolutePositionFromRelativePosition(Y.decodeRelativePosition(Uint8Array.from(relative)), room)?.type,
  ).toBe(image);
  room.destroy();
});
