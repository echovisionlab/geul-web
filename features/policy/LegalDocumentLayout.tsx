'use client';

import { useMemo, type ReactNode } from 'react';

import { LayoutContainer } from '@/components/core/Layout';
import type { LocalizedRichTextBlock } from '@/features/editor/contract/localized-rich-text';
// Leaf modules: these documents have no authored layout, so the collaboration schema stays off the route.
import { ContentChrome } from '@/features/document-layout/ui/ContentChrome';
import { ContentLayoutView } from '@/features/document-layout/ui/ContentLayoutView';
import { FLOW_DOCUMENT_LAYOUT } from '@/features/document-layout/ui/types';
import { TableOfContents } from '@/features/navigation/TableOfContents';
import { buildGeneratedBlockTocItems } from '@/lib/toc-items';
import { LegalRichTextContent } from './LegalRichTextContent';

export interface LegalDocumentLayoutProps {
  /** Notices, title, metadata and document actions: the document chrome on the reading column. */
  header: ReactNode;
  /** The authored body; without one (`null`/`undefined`) `empty` renders on the reading column instead. */
  blocks: readonly LocalizedRichTextBlock[] | null | undefined;
  empty: ReactNode;
  contentClassName: string;
  requestedLocale?: string;
  contentLocale?: string;
  'data-legal-document': string;
}

/**
 * Public legal documents read like posts: the header and running text share one centered reading
 * column, the outline sits beside them (`center` placement) and paper keeps the page measure.
 */
export function LegalDocumentLayout({
  header,
  blocks,
  empty,
  contentClassName,
  requestedLocale,
  contentLocale,
  'data-legal-document': document,
}: LegalDocumentLayoutProps) {
  const tocItems = useMemo(() => buildGeneratedBlockTocItems(blocks), [blocks]);
  return (
    <div data-legal-document={document}>
      <ContentLayoutView
        layout={FLOW_DOCUMENT_LAYOUT}
        chrome={<ContentChrome measure="reading">{header}</ContentChrome>}
      >
        <TableOfContents items={tocItems} contentPlacement="center">
          {blocks ? (
            <LegalRichTextContent
              blocks={blocks}
              className={contentClassName}
              requestedLocale={requestedLocale}
              contentLocale={contentLocale}
              readingMeasure
            />
          ) : (
            <LayoutContainer size="reading" inset="none">
              {empty}
            </LayoutContainer>
          )}
        </TableOfContents>
      </ContentLayoutView>
    </div>
  );
}
