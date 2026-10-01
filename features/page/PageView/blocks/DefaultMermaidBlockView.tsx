'use client';

import { MermaidDiagram } from '@/features/mermaid/MermaidDiagram';

export function DefaultMermaidBlockView({ source, title }: { source: string; title: string }) {
  return <MermaidDiagram source={source} title={title} />;
}
