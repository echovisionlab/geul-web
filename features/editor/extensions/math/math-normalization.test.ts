import { describe, expect, it } from 'vitest';
import { normalizeEditorBlocksMath } from './math-normalization';

describe('normalizeEditorBlocksMath', () => {
  it('converts inline latex markers inside text blocks to mathInline content', () => {
    const normalized = normalizeEditorBlocksMath([
      {
        id: 'paragraph-1',
        type: 'paragraph',
        props: {},
        content: [
          {
            type: 'text',
            text: 'Euler uses $e$ and $\\pi$.',
            styles: {},
          },
        ],
        children: [],
      } as never,
    ]);

    expect(normalized.changed).toBe(true);
    expect(normalized.blocks).toEqual([
      {
        id: 'paragraph-1',
        type: 'paragraph',
        props: {},
        content: [
          { type: 'text', text: 'Euler uses ', styles: {} },
          { type: 'mathInline', props: { latex: 'e' } },
          { type: 'text', text: ' and ', styles: {} },
          { type: 'mathInline', props: { latex: '\\pi' } },
          { type: 'text', text: '.', styles: {} },
        ],
        children: [],
      },
    ]);
  });

  it('converts standalone $$...$$ paragraphs into math blocks', () => {
    const normalized = normalizeEditorBlocksMath([
      {
        id: 'paragraph-1',
        type: 'paragraph',
        props: {},
        content: [{ type: 'text', text: '$$e^{i\\pi}+1=0$$', styles: {} }],
        children: [],
      } as never,
    ]);

    expect(normalized.changed).toBe(true);
    expect(normalized.blocks).toEqual([
      {
        id: 'paragraph-1',
        type: 'math',
        props: { latex: 'e^{i\\pi}+1=0' },
        children: [],
      },
    ]);
  });

  it('leaves plain text untouched when no math markers exist', () => {
    const normalized = normalizeEditorBlocksMath([
      {
        id: 'paragraph-1',
        type: 'paragraph',
        props: {},
        content: [{ type: 'text', text: 'Plain text only', styles: {} }],
        children: [],
      } as never,
    ]);

    expect(normalized.changed).toBe(false);
    expect(normalized.blocks).toHaveLength(1);
    expect(normalized.blocks[0]).toMatchObject({
      id: 'paragraph-1',
      type: 'paragraph',
    });
  });
});
