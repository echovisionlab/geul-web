import { describe, expect, it } from 'vitest';
import { createTiptapMapNode, MapBlock } from './MapBlock';

describe('MapBlock compatibility export', () => {
  it('exposes the native Tiptap map extension under the historical name', () => {
    expect(MapBlock.name).toBe('map');
    expect(MapBlock.config.addNodeView).toEqual(expect.any(Function));
    expect(createTiptapMapNode().name).toBe('map');
  });
});
