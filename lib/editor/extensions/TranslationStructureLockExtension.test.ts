import { Schema } from '@tiptap/pm/model';
import { describe, expect, it } from 'vitest';
import {
  findTrailingEmptyParagraphRange,
  runWithTranslationStructureSync,
  shouldAllowTranslationStructureTransaction,
  shouldBlockTranslationBeforeInput,
  shouldBlockTranslationStructureKey,
} from './TranslationStructureLockExtension';

const schema = new Schema({
  nodes: {
    doc: {
      content: 'blockContainer+',
    },
    blockContainer: {
      content: 'text*',
      attrs: {
        id: { default: null },
        type: { default: 'paragraph' },
        textAlignment: { default: 'left' },
      },
      toDOM(node) {
        return ['div', { 'data-id': node.attrs.id, 'data-content-type': node.attrs.type }, 0];
      },
    },
    text: {},
  },
});

function paragraph(id: string, text = '', textAlignment = 'left') {
  return schema.node('blockContainer', { id, type: 'paragraph', textAlignment }, text ? [schema.text(text)] : []);
}

function transactionLike(doc: ReturnType<typeof schema.node>, docChanged = true) {
  return {
    doc,
    docChanged,
    getMeta: () => undefined,
  };
}

describe('TranslationStructureLockExtension helpers', () => {
  it('finds the terminal empty paragraph range', () => {
    const doc = schema.node('doc', null, [paragraph('block-1', 'Hello'), paragraph('block-2')]);

    expect(findTrailingEmptyParagraphRange(doc)).toEqual({
      from: paragraph('block-1', 'Hello').nodeSize,
      to: doc.content.size,
    });

    const noTrailingEmptyParagraph = schema.node('doc', null, [
      paragraph('block-1', 'Hello'),
      paragraph('block-2', 'World'),
    ]);
    expect(findTrailingEmptyParagraphRange(noTrailingEmptyParagraph)).toBeNull();
  });

  it('blocks paragraph insertion while allowing locale-owned line breaks', () => {
    expect(shouldBlockTranslationBeforeInput('insertParagraph')).toBe(true);
    expect(shouldBlockTranslationBeforeInput('insertLineBreak')).toBe(false);
    expect(shouldBlockTranslationBeforeInput('insertText')).toBe(false);
    expect(shouldBlockTranslationBeforeInput(undefined)).toBe(false);
  });

  it('blocks structure-mutating keys and keeps normal typing available', () => {
    expect(
      shouldBlockTranslationStructureKey({
        key: 'Enter',
        altKey: false,
        shiftKey: false,
        metaKey: false,
        ctrlKey: false,
        isComposing: false,
      }),
    ).toBe(true);
    expect(
      shouldBlockTranslationStructureKey({
        key: 'Enter',
        altKey: false,
        shiftKey: true,
        metaKey: false,
        ctrlKey: false,
        isComposing: false,
      }),
    ).toBe(false);
    expect(
      shouldBlockTranslationStructureKey({
        key: 'Tab',
        altKey: false,
        shiftKey: false,
        metaKey: false,
        ctrlKey: false,
        isComposing: false,
      }),
    ).toBe(true);
    expect(
      shouldBlockTranslationStructureKey({
        key: 'ArrowUp',
        altKey: true,
        shiftKey: true,
        metaKey: false,
        ctrlKey: false,
        isComposing: false,
      }),
    ).toBe(true);
    expect(
      shouldBlockTranslationStructureKey({
        key: 'a',
        altKey: false,
        shiftKey: false,
        metaKey: false,
        ctrlKey: false,
        isComposing: false,
      }),
    ).toBe(false);
  });

  it('allows scoped programmatic structure sync wrappers to run and unwind', () => {
    let depthSeenInside = false;

    const result = runWithTranslationStructureSync(() => {
      depthSeenInside = true;
      return 'ok';
    });

    expect(depthSeenInside).toBe(true);
    expect(result).toBe('ok');
  });

  it('allows text-only doc changes and rejects local block-structure changes', () => {
    const previousDoc = schema.node('doc', null, [paragraph('block-1', 'Hello')]);
    const textEditedDoc = schema.node('doc', null, [paragraph('block-1', 'Hello world')]);
    const blockAddedDoc = schema.node('doc', null, [paragraph('block-1', 'Hello'), paragraph('block-2', 'World')]);

    expect(shouldAllowTranslationStructureTransaction(transactionLike(textEditedDoc), previousDoc)).toBe(true);
    expect(shouldAllowTranslationStructureTransaction(transactionLike(blockAddedDoc), previousDoc)).toBe(false);
  });

  it('rejects neutral block prop changes while keeping locale text editable', () => {
    const previousDoc = schema.node('doc', null, [paragraph('block-1', '번역', 'left')]);
    const neutralPropChanged = schema.node('doc', null, [paragraph('block-1', '번역', 'center')]);

    expect(shouldAllowTranslationStructureTransaction(transactionLike(neutralPropChanged), previousDoc)).toBe(false);
  });

  it('allows localized text to be created and removed inside a locked table cell', () => {
    const tableSchema = new Schema({
      nodes: {
        doc: { content: 'blockContainer+' },
        blockContainer: {
          content: 'table',
          attrs: { id: { default: null } },
        },
        table: {
          content: 'tableRow+',
          attrs: { textAlignment: { default: 'left' } },
        },
        tableRow: { content: 'tableCell+' },
        tableCell: {
          content: 'tableParagraph+',
          attrs: { textAlignment: { default: 'left' } },
        },
        tableParagraph: { content: 'inline*' },
        text: { group: 'inline' },
      },
    });
    const tableJson = (text?: string) => ({
      type: 'doc',
      content: [
        {
          type: 'blockContainer',
          attrs: { id: 'table-one' },
          content: [
            {
              type: 'table',
              attrs: { textAlignment: 'left' },
              content: [
                {
                  type: 'tableRow',
                  content: [
                    {
                      type: 'tableCell',
                      attrs: { textAlignment: 'left' },
                      content: [
                        {
                          type: 'tableParagraph',
                          ...(text ? { content: [{ type: 'text', text }] } : {}),
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
    const emptyCell = tableSchema.nodeFromJSON(tableJson());
    const cellWithText = tableSchema.nodeFromJSON(tableJson('기록'));

    expect(shouldAllowTranslationStructureTransaction(transactionLike(cellWithText), emptyCell)).toBe(true);
    expect(shouldAllowTranslationStructureTransaction(transactionLike(emptyCell), cellWithText)).toBe(true);
  });

  it('allows programmatic structure sync transactions', () => {
    const previousDoc = schema.node('doc', null, [paragraph('block-1', 'Hello')]);
    const nextDoc = schema.node('doc', null, [paragraph('block-1', 'Hello'), paragraph('block-2')]);

    expect(
      runWithTranslationStructureSync(() =>
        shouldAllowTranslationStructureTransaction(transactionLike(nextDoc), previousDoc),
      ),
    ).toBe(true);
  });
});
