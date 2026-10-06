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
}

/** Adapts the collaboration contract to the domain-free document-layout surface. */
export function ContentLayoutView({ layout, chrome, controls, children, className }: ContentLayoutViewProps) {
  return (
    <DocumentLayoutSurface
      layout={toDocumentLayoutViewModel(layout)}
      chrome={chrome}
      controls={controls}
      className={className}
    >
      {children}
    </DocumentLayoutSurface>
  );
}
