'use client';

import katex from 'katex';
import 'katex/dist/katex.min.css';
import { getBlockPropString } from '@/lib/media/shared';
import type { Block } from '@/lib/types/page-content';

export function DefaultMathBlockView({ block }: { block: Block }) {
  const latex = getBlockPropString(block.props, 'latex');
  if (!latex) {
    return null;
  }

  let html = latex;
  try {
    html = katex.renderToString(latex, {
      displayMode: true,
      throwOnError: false,
    });
  } catch {
    // fallback to raw latex
  }

  return <div className="math-block" data-latex={latex} dangerouslySetInnerHTML={{ __html: html }} />;
}
