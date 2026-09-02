'use client';

import { PublicRichTextBlockView } from '@/features/page/PageView/blocks/PublicRichTextBlockView';
import type { BlockViewProps } from '../types';

export function RichTextView({ content, requestedLocale }: BlockViewProps) {
  if (!content || content.length === 0) {
    return null;
  }

  return (
    <div className="rich-text-content prose">
      {content.map((block) => (
        <PublicRichTextBlockView key={block.id} block={block} requestedLocale={requestedLocale} />
      ))}
    </div>
  );
}
