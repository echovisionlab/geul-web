import type { Extensions } from '@tiptap/core';
import { TiptapMathClipboard } from './math-clipboard';
import { TiptapMathInput } from './math-input';
import { TiptapMathBlockNode, TiptapMathInlineNode, type TiptapMathOptions } from './TiptapMathNodeViews';

export { TiptapMathClipboard, normalizeMathFragment } from './math-clipboard';
export { TiptapMathInput } from './math-input';
export { TiptapMathBlockNode, TiptapMathInlineNode } from './TiptapMathNodeViews';
export type { TiptapMathOptions } from './TiptapMathNodeViews';
export { loadMathRenderer, useRenderedMath } from './math-render-runtime';

export function createTiptapMathExtensions(options: Partial<TiptapMathOptions> = {}): Extensions {
  return [TiptapMathBlockNode.configure(options), TiptapMathInlineNode, TiptapMathInput, TiptapMathClipboard];
}

/** Replaces the wire-only math nodes while retaining every other wire extension. */
export function withTiptapMathExtensions(extensions: Extensions, options: Partial<TiptapMathOptions> = {}): Extensions {
  return [
    ...extensions.filter((extension) => extension.name !== 'math' && extension.name !== 'mathInline'),
    ...createTiptapMathExtensions(options),
  ];
}
