'use client';

import { createContext, useContext, type ReactNode } from 'react';
import type { EditorLibraryFileSelection } from '@/features/editor/lib/editor-library-file-selection';
interface EditorMediaIngestContextValue {
  dropFilesAtBlock: (referenceBlockId: string, files: FileList | File[]) => Promise<boolean>;
  selectLibraryFilesAtBlock: (referenceBlockId: string, files: EditorLibraryFileSelection[]) => boolean;
}

const EditorMediaIngestContext = createContext<EditorMediaIngestContextValue | null>(null);

interface EditorMediaIngestProviderProps extends EditorMediaIngestContextValue {
  children: ReactNode;
}

export function EditorMediaIngestProvider({
  children,
  dropFilesAtBlock,
  selectLibraryFilesAtBlock,
}: EditorMediaIngestProviderProps) {
  return (
    <EditorMediaIngestContext.Provider value={{ dropFilesAtBlock, selectLibraryFilesAtBlock }}>
      {children}
    </EditorMediaIngestContext.Provider>
  );
}

export function useOptionalEditorMediaIngestContext(): EditorMediaIngestContextValue | null {
  return useContext(EditorMediaIngestContext);
}
