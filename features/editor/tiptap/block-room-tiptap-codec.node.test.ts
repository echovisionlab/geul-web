import { describe, expect, it } from 'vitest';
import type { ProseMirrorBlockDescriptor } from './block-room-prosemirror-bridge';
import { richTextProseMirrorAdapterForProtoCase } from './block-room-prosemirror-registry';
import { documentToTiptap, parseDocument, splitPayload, type JsonObject } from './block-room-tiptap-codec';

// Codec cases that need no Editor. Cases that round-trip through a real Tiptap schema and view stay in
// block-room-tiptap-codec.test.ts.

function descriptor(
  protoCase: 'paragraph' | 'table' | 'callout' | 'mermaid',
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

function table(id: string, basePayload: JsonObject, localePayload: JsonObject): ProseMirrorBlockDescriptor {
  return descriptor('table', id, basePayload, localePayload);
}

describe('Block-room Tiptap codec without an editor', () => {
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

  const rowId = '10000000-0000-4000-8000-000000000225';
  const cellId = '10000000-0000-4000-8000-000000000226';

  it.each<[string, ProseMirrorBlockDescriptor]>([
    [
      'legacy rows and cells without any identities',
      table(
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
      ),
    ],
    [
      'durable base identities with a locale payload that has none',
      table(
        '10000000-0000-4000-8000-000000000227',
        { props: {}, content: { rows: [{ id: rowId, cells: [{ id: cellId, header: false, props: {} }] }] } },
        { props: {}, content: { rows: [{ cells: [{ content: [{ text: { text: 'legacy locale' } }] }] }] } },
      ),
    ],
    [
      'malformed row UUIDs',
      table(
        '10000000-0000-4000-8000-000000000234',
        { props: {}, content: { rows: [{ id: 'not-a-uuid', cells: [] }] } },
        { props: {}, content: { rows: [{ rowId: 'not-a-uuid', cells: [] }] } },
      ),
    ],
    [
      'a partially migrated identity set',
      table(
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
    ],
  ])('rejects a table with %s', (_, block) => {
    expect(() => documentToTiptap([block])).toThrow('must have durable UUID identities');
  });

  it('rejects duplicate table identities instead of pairing duplicate positions', () => {
    const duplicateRowId = '10000000-0000-4000-8000-000000000231';
    const duplicateCellId = '10000000-0000-4000-8000-000000000232';
    expect(() =>
      documentToTiptap([
        table(
          '10000000-0000-4000-8000-000000000230',
          {
            props: {},
            content: {
              rows: [
                { id: duplicateRowId, cells: [] },
                { id: duplicateRowId, cells: [] },
              ],
            },
          },
          {
            props: {},
            content: {
              rows: [
                { rowId: duplicateRowId, cells: [] },
                { rowId: duplicateRowId, cells: [] },
              ],
            },
          },
        ),
      ]),
    ).toThrow('missing or duplicate durable row ID');

    expect(() =>
      documentToTiptap([
        table(
          '10000000-0000-4000-8000-000000000233',
          {
            props: {},
            content: { rows: [{ id: duplicateRowId, cells: [{ id: duplicateCellId }, { id: duplicateCellId }] }] },
          },
          {
            props: {},
            content: {
              rows: [
                {
                  rowId: duplicateRowId,
                  cells: [
                    { cellId: duplicateCellId, content: [] },
                    { cellId: duplicateCellId, content: [] },
                  ],
                },
              ],
            },
          },
        ),
      ]),
    ).toThrow('missing or duplicate durable cell ID');
  });
});

describe('Mermaid canonical wire', () => {
  it('preserves source text in the shared payload and title in the locale payload', () => {
    const base = { props: { source: 'flowchart LR\n  A --> B' } };
    const locale = { props: { title: '설명' } };
    const blocks = parseDocument(documentToTiptap([descriptor('mermaid', 'mermaid-block', base, locale)]));
    expect(blocks[0]?.kind).toBe('mermaid');
    expect(splitPayload(blocks[0]!)).toEqual({ base, locale });
  });
});
