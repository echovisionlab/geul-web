'use client';

import type { LocalizedRichTextBlock } from '@/features/editor/contract/localized-rich-text';
import { GeneratedRichTextBlockView } from '@/features/page/PageView/blocks/GeneratedRichTextBlockView';

/**
 * The authored legal body. Public documents render it inside `LegalDocumentLayout` with the reading
 * measure; editor previews render it alone at their panel width.
 */
export function LegalRichTextContent({
  blocks,
  className,
  requestedLocale,
  contentLocale,
  readingMeasure = false,
}: {
  blocks: readonly LocalizedRichTextBlock[];
  className: string;
  requestedLocale?: string;
  contentLocale?: string;
  /** Running text on the `reading` measure; tables may extend to `standard` (document-content.css). */
  readingMeasure?: boolean;
}) {
  return (
    <div
      className={className}
      lang={contentLocale ?? requestedLocale}
      data-reading-measure={readingMeasure ? '' : undefined}
    >
      {blocks.map((block) => (
        <GeneratedRichTextBlockView key={block.id} block={block} requestedLocale={requestedLocale} />
      ))}
    </div>
  );
}
