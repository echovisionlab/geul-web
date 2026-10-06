import type { BlockViewProps } from '../types';
import { EmbedFrame } from './EmbedFrame';
import { parseEmbedProps } from './schema';

export function PageEmbedView({ props }: BlockViewProps) {
  return <EmbedFrame props={parseEmbedProps(props)} />;
}
