import { getSchema } from '@tiptap/core';
import { EditorState, TextSelection } from '@tiptap/pm/state';
import { describe, expect, it } from 'vitest';
import { createTiptapWireExtensions } from '../wire-schema';
import { getTiptapSlashQuery } from './query';

const schema = getSchema(createTiptapWireExtensions());

function state(content: Record<string, unknown>[]) {
  const doc = schema.nodeFromJSON({
    type: 'doc',
    content: [
      {
        type: 'blockGroup',
        content: [
          {
            type: 'blockContainer',
            attrs: { id: 'target-block' },
            content: [{ type: 'paragraph', content }],
          },
        ],
      },
    ],
  });
  return EditorState.create({ doc, selection: TextSelection.atEnd(doc) });
}

describe('slash query ranges', () => {
  it.each([
    {
      prefix: 'inline math',
      content: [
        { type: 'mathInline', content: [{ type: 'text', text: 'x' }] },
        { type: 'text', text: ' /p5' },
      ],
      from: 7,
      to: 10,
    },
    {
      prefix: 'a hard break',
      content: [{ type: 'text', text: 'Hello' }, { type: 'hardBreak' }, { type: 'text', text: '/p5' }],
      from: 9,
      to: 12,
    },
  ])('detects the exact slash range after $prefix', ({ content, from, to }) => {
    expect(getTiptapSlashQuery(state(content), true)).toEqual({
      from,
      to,
      contentPosition: 2,
      blockId: 'target-block',
      query: 'p5',
    });
  });

  it('does not treat a slash inside ordinary text as a command boundary', () => {
    expect(getTiptapSlashQuery(state([{ type: 'text', text: 'x/heading' }]), true)).toBeNull();
  });
});
