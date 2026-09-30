import type { JSONContent } from '@tiptap/core';
import { describe, expect, it } from 'vitest';
import type { ProseMirrorBlockDescriptor } from './block-room-prosemirror-bridge';
import { parseDocument } from './block-room-tiptap-codec';
import { richTextProseMirrorAdapterForProtoCase } from './block-room-prosemirror-registry';
import { planTiptapStructure } from './block-room-tiptap-structure-plan';

function paragraph(id: string, children: readonly JSONContent[] = []): JSONContent {
  return {
    type: 'blockContainer',
    attrs: { id },
    content: [
      { type: 'paragraph', content: [{ type: 'text', text: id }] },
      ...(children.length > 0 ? [{ type: 'blockGroup', content: [...children] }] : []),
    ],
  };
}

function descriptor(id: string, children: readonly ProseMirrorBlockDescriptor[] = []): ProseMirrorBlockDescriptor {
  return {
    id,
    adapter: richTextProseMirrorAdapterForProtoCase('paragraph'),
    basePayload: { props: {} },
    localePayload: { props: {}, content: [{ text: id }] },
    children,
  };
}

function roots(...blocks: JSONContent[]) {
  return parseDocument({ type: 'doc', content: [{ type: 'blockGroup', content: blocks }] });
}

describe('pure Tiptap Block-room structural plan', () => {
  it('moves surviving children before deleting removed ancestors and plans localized inserts', () => {
    const previous = [descriptor('parent', [descriptor('promoted')]), descriptor('survivor')];
    const before = previous.map((block) => ({ id: block.id, children: block.children.map((child) => child.id) }));
    const next = roots(paragraph('promoted'), paragraph('survivor'), {
      type: 'blockContainer',
      attrs: { id: 'created' },
      content: [{ type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Hello' }] }],
    });

    const plan = planTiptapStructure(previous, next, ['en', 'ko'], 'ko');

    expect(plan.operations.filter((operation) => operation.type === 'move')).toEqual([
      { type: 'move', blockId: 'promoted', placement: { parentBlockId: undefined, index: 0 } },
      { type: 'move', blockId: 'survivor', placement: { parentBlockId: undefined, index: 1 } },
    ]);
    const insert = plan.operations.find((operation) => operation.type === 'insert');
    expect(insert).toMatchObject({
      type: 'insert',
      block: { id: 'created', protoCase: 'heading' },
      placement: { index: 2 },
      needsAnchor: true,
      data: { localeData: { en: { value: { case: 'heading' } }, ko: { value: { case: 'heading' } } } },
    });
    expect(plan.operations.at(-1)).toEqual({ type: 'delete', blockId: 'parent' });
    expect(previous.map((block) => ({ id: block.id, children: block.children.map((child) => child.id) }))).toEqual(
      before,
    );
  });

  it('deletes discarded subtrees before calculating moves for surviving siblings', () => {
    const previous = [
      descriptor('discarded-parent', [descriptor('discarded-child')]),
      descriptor('first-survivor'),
      descriptor('second-survivor'),
    ];

    const plan = planTiptapStructure(
      previous,
      roots(paragraph('second-survivor'), paragraph('first-survivor')),
      ['ko'],
      'ko',
    );

    const structuralOperations = plan.operations.filter((operation) => operation.type !== 'update-payload');
    expect(structuralOperations).toEqual([
      { type: 'delete', blockId: 'discarded-child' },
      { type: 'delete', blockId: 'discarded-parent' },
      { type: 'move', blockId: 'second-survivor', placement: { parentBlockId: undefined, index: 0 } },
    ]);
  });

  it('plans a move before replacing the kind of an existing Block', () => {
    const previous = [descriptor('existing')];
    const next = roots({
      type: 'blockContainer',
      attrs: { id: 'existing' },
      content: [{ type: 'heading', attrs: { level: 3 }, content: [{ type: 'text', text: 'Title' }] }],
    });

    const plan = planTiptapStructure(previous, next, ['ko'], 'ko');

    expect(plan.operations.map((operation) => operation.type)).toEqual(['replace-kind']);
    expect(plan.operations[0]).toMatchObject({
      type: 'replace-kind',
      block: { id: 'existing', protoCase: 'heading' },
      previous: { adapter: { protoCase: 'paragraph' } },
      data: { localeData: { ko: { value: { case: 'heading' } } } },
    });
  });
});
