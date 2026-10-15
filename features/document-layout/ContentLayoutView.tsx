import type { ReactNode } from 'react';
import { toDocumentLayoutViewModel } from './document-layout-view-model';
import type { DocumentLayout } from './types';
import { ContentLayoutView as DocumentLayoutSurface } from './ui/ContentLayoutView';

export interface ContentLayoutViewProps {
  layout: DocumentLayout;
  chrome?: ReactNode;
  controls?: ReactNode;
  children: ReactNode;
  className?: string;
  /** Language of the document content; interface controls retain their own language. */
  contentLanguage?: string;
}

/** Adapts the collaboration contract to the domain-free document-layout surface. */
export function ContentLayoutView({
  layout,
  chrome,
  controls,
  children,
  className,
  contentLanguage,
}: ContentLayoutViewProps) {
  return (
    <DocumentLayoutSurface
      layout={toDocumentLayoutViewModel(layout)}
      chrome={chrome}
      controls={controls}
      className={className}
      contentLanguage={contentLanguage}
    >
      {children}
    </DocumentLayoutSurface>
  );
}
