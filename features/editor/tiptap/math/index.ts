import type { Extensions } from '@tiptap/core';
import { TiptapMathClipboard } from './math-clipboard';
import { TiptapMathInput } from './math-input';
import { TiptapMathBlockNode, TiptapMathInlineNode } from './TiptapMathNodeViews';

export { TiptapMathClipboard, normalizeMathFragment } from './math-clipboard';
export { TiptapMathInput } from './math-input';
export { TiptapMathBlockNode, TiptapMathInlineNode } from './TiptapMathNodeViews';
export { renderMath } from './math-render';

export function createTiptapMathExtensions(): Extensions {
  return [TiptapMathBlockNode, TiptapMathInlineNode, TiptapMathInput, TiptapMathClipboard];
}

/** Replaces the wire-only math nodes while retaining every other wire extension. */
export function withTiptapMathExtensions(extensions: Extensions): Extensions {
  return [
    ...extensions.filter((extension) => extension.name !== 'math' && extension.name !== 'mathInline'),
    ...createTiptapMathExtensions(),
  ];
}
