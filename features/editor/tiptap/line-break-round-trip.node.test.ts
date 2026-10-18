import { getSchema, type JSONContent } from '@tiptap/core';
import { expect, it } from 'vitest';
import { inlineContentProjectionEqual, parseDocument, splitPayload } from './block-room-tiptap-codec';
import { createTiptapWireExtensions } from './wire-schema';

it('canonicalizes newline text supplied by JSON imports before persistence and compares legacy projections equally', () => {
  // The schema fills default attributes exactly as Editor#getJSON does for an imported document.
  const doc = getSchema(createTiptapWireExtensions())
    .nodeFromJSON({
      type: 'doc',
      content: [
        {
          type: 'blockGroup',
          content: [
            {
              type: 'blockContainer',
              attrs: { id: '10000000-0000-4000-8000-000000000111' },
              content: [
                { type: 'paragraph', content: [{ type: 'text', text: '\na\r\n\nb\r', marks: [{ type: 'bold' }] }] },
              ],
            },
          ],
        },
      ],
    })
    .toJSON() as JSONContent;

  const payload = splitPayload(parseDocument(doc)[0]!);
  expect(payload.locale.content).toEqual([
    { hardBreak: {} },
    { text: { text: 'a', styles: { bold: true } } },
    { hardBreak: {} },
    { hardBreak: {} },
    { text: { text: 'b', styles: { bold: true } } },
    { hardBreak: {} },
  ]);
  expect(
    inlineContentProjectionEqual(
      [{ text: { text: 'a\nb' } }],
      [{ text: { text: 'a' } }, { hardBreak: {} }, { text: { text: 'b' } }],
    ),
  ).toBe(true);
});
