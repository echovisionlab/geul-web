'use client';

import { MermaidDiagram } from '@/features/mermaid/MermaidDiagram';
import type { GeneratedRichTextBlock } from './GeneratedRichTextBlockView.types';

export function GeneratedMermaidBlockView({ block }: { block: GeneratedRichTextBlock<'mermaid'> }) {
  return <MermaidDiagram source={block.base.props?.source ?? ''} title={block.locale.props?.title ?? ''} />;
}
