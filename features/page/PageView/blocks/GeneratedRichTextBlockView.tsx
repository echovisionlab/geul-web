'use client';

import dynamic from 'next/dynamic';
import type { GeneratedRichTextBlockViewProps } from './GeneratedRichTextBlockView.types';

// Keep unused rich-text implementations outside the initial public client graph.
// SSR remains enabled for readable text, media fallbacks, and the print surface.
const RuntimeView = dynamic(() =>
  import('./GeneratedRichTextBlockViewRuntime').then((module) => module.GeneratedRichTextBlockView),
);

export function GeneratedRichTextBlockView(props: GeneratedRichTextBlockViewProps) {
  return <RuntimeView {...props} />;
}
