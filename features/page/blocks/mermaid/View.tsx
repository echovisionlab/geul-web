import { MermaidDiagram } from '@/features/mermaid/MermaidDiagram';
import type { BlockCanvasPreviewProps, BlockViewProps } from '../types';
import { parseMermaidProps, type MermaidProps } from './schema';

export function MermaidBlockView({ props }: BlockViewProps) {
  return <MermaidDiagram {...parseMermaidProps(props)} />;
}

export function MermaidCanvasPreview({ props }: BlockCanvasPreviewProps<MermaidProps>) {
  return <MermaidDiagram {...parseMermaidProps(props)} />;
}
