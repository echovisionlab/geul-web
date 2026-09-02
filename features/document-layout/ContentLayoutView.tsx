import type { ReactNode } from 'react';
import { toDocumentLayoutViewModel } from './document-layout-view-model';
import type { DocumentLayout } from './types';
import { ContentLayoutView as DocumentLayoutSurface } from './ui/ContentLayoutView';

export interface ContentLayoutViewProps {
  layout: DocumentLayout;
  chrome?: ReactNode;
  children: ReactNode;
  className?: string;
}

/** Adapts the collaboration contract to the domain-free document-layout surface. */
export function ContentLayoutView({ layout, chrome, children, className }: ContentLayoutViewProps) {
  return (
    <DocumentLayoutSurface layout={toDocumentLayoutViewModel(layout)} chrome={chrome} className={className}>
      {children}
    </DocumentLayoutSurface>
  );
}
