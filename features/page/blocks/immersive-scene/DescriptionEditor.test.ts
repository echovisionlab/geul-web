import { describe, expect, it } from 'vitest';
import { immersiveSceneDescriptionSchema } from '@/lib/types/editor/schema';

describe('immersiveSceneDescriptionSchema', () => {
  it('contains only text-oriented blocks, inline content, and Markdown-preserving styles', () => {
    expect(Object.keys(immersiveSceneDescriptionSchema.blockSchema)).toEqual([
      'paragraph',
      'heading',
      'bulletListItem',
      'numberedListItem',
    ]);
    expect(Object.keys(immersiveSceneDescriptionSchema.inlineContentSchema)).toEqual(['text', 'link']);
    expect(Object.keys(immersiveSceneDescriptionSchema.styleSchema)).toEqual(['bold', 'italic', 'strike']);
  });
});
