import { getSchema } from '@tiptap/core';
import { expect, it } from 'vitest';
import { createTiptapWireExtensions } from '../wire-schema';
import { createMapStoryDocument } from './TiptapMapNodeView.story-fixtures';

it.each(['slash', 'empty', 'populated'] as const)('produces valid %s Map story content', (kind) => {
  const schema = getSchema(createTiptapWireExtensions());
  expect(() => schema.nodeFromJSON(createMapStoryDocument({ kind })).check()).not.toThrow();
});
