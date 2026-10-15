'use client';

import katex from 'katex';
import 'katex/dist/katex.min.css';
import type { GeneratedRichTextBlock } from './GeneratedRichTextBlockView.types';
import { ScrollArea } from '@/components/core/Display';

export function GeneratedMathBlockView({ block }: { block: GeneratedRichTextBlock<'math'> }) {
  const source = block.base.props?.latex ?? '';
  const html = katex.renderToString(source, { displayMode: true, throwOnError: false });
  return (
    <div className="math-block" data-latex={source}>
      <ScrollArea scrollbars="x" data-math-scroll="">
        <span dangerouslySetInnerHTML={{ __html: html }} />
      </ScrollArea>
    </div>
  );
}
