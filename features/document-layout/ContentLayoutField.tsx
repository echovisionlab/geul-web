'use client';

import { ContentLayoutFieldView, type ContentLayoutFieldLabels } from './ui/ContentLayoutFieldView';
import { toDocumentLayout, toDocumentLayoutViewModel } from './document-layout-view-model';
import type { DocumentLayout } from './types';

export interface ContentLayoutFieldProps {
  value: DocumentLayout;
  onChange: (value: DocumentLayout) => void;
  labels: ContentLayoutFieldLabels;
  disabled?: boolean;
}

/** Adapts the collaboration contract to the domain-free document-layout field view. */
export function ContentLayoutField({ value, onChange, labels, disabled }: ContentLayoutFieldProps) {
  return (
    <ContentLayoutFieldView
      value={toDocumentLayoutViewModel(value)}
      onChange={(nextValue) => onChange(toDocumentLayout(nextValue))}
      labels={labels}
      disabled={disabled}
    />
  );
}
