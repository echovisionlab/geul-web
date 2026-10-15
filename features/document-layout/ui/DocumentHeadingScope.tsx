'use client';

import { createContext, useContext, type ReactNode } from 'react';
import type { DocumentHeadingParentLevel } from './document-heading-level';

const DocumentHeadingParentLevelContext = createContext<DocumentHeadingParentLevel>(0);

export interface DocumentHeadingScopeProps {
  /**
   * The heading level the authored body sits under. `ContentLayoutView` declares `1` (the document title)
   * for its body when it has chrome; a body under a level-2 section label declares `2`. Outside any scope
   * the level is `0` and authored headings render their authored element.
   */
  parentLevel: DocumentHeadingParentLevel;
  children: ReactNode;
}

/** Declares where authored rich-text headings sit in the page outline; published renderers consume it. */
export function DocumentHeadingScope({ parentLevel, children }: DocumentHeadingScopeProps) {
  return (
    <DocumentHeadingParentLevelContext.Provider value={parentLevel}>
      {children}
    </DocumentHeadingParentLevelContext.Provider>
  );
}

/** The parent heading level of the nearest `DocumentHeadingScope` (0 without one). */
export function useDocumentHeadingParentLevel(): DocumentHeadingParentLevel {
  return useContext(DocumentHeadingParentLevelContext);
}
