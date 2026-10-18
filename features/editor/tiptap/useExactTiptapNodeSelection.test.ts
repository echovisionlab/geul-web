import { getSchema } from '@tiptap/core';
import { NodeSelection, TextSelection } from '@tiptap/pm/state';
import { describe, expect, it } from 'vitest';
import { createTiptapWireExtensions } from './wire-schema';
import { isExactTiptapNodeSelection } from './useExactTiptapNodeSelection';

describe('isExactTiptapNodeSelection', () => {
  it('distinguishes an exact atom NodeSelection from a TextSelection that covers the atom', () => {
    const doc = getSchema(createTiptapWireExtensions()).nodeFromJSON({
      type: 'doc',
      content: [
        {
          type: 'blockGroup',
          content: [
            {
              type: 'blockContainer',
              attrs: { id: 'before' },
              content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Before' }] }],
            },
            {
              type: 'blockContainer',
              attrs: { id: 'video' },
              content: [{ type: 'externalVideo', attrs: { url: 'https://youtu.be/dQw4w9WgXcQ' } }],
            },
            {
              type: 'blockContainer',
              attrs: { id: 'after' },
              content: [{ type: 'paragraph', content: [{ type: 'text', text: 'After' }] }],
            },
          ],
        },
      ],
    });
    let videoPosition = -1;
    let beforePosition = -1;
    let afterPosition = -1;
    doc.descendants((node, position) => {
      if (node.type.name === 'externalVideo') {
        videoPosition = position;
      } else if (node.type.name === 'paragraph' && beforePosition < 0) {
        beforePosition = position;
      } else if (node.type.name === 'paragraph') {
        afterPosition = position;
      }
    });
    const video = doc.nodeAt(videoPosition);
    const range = TextSelection.create(doc, beforePosition + 2, afterPosition + 2);
    const exact = NodeSelection.create(doc, videoPosition);

    expect(isExactTiptapNodeSelection(range, videoPosition, video)).toBe(false);
    expect(isExactTiptapNodeSelection(exact, videoPosition, video)).toBe(true);
  });
});
