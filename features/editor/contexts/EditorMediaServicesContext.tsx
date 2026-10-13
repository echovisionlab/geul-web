'use client';

import { createContext, useContext, type ReactNode } from 'react';
import type { EditorFileLibraryDataSource } from '../components/EditorFileLibraryPicker';
import type { EditorMediaRuntimeStore } from '../lib/editor-media-runtime-store';
import type { UploadOptions, UploadResult } from '@/lib/upload/file-upload-contract';

export interface EditorMediaServices {
  upload: (file: File, options: UploadOptions) => Promise<UploadResult>;
  library: EditorFileLibraryDataSource;
  createRuntimeStore: () => EditorMediaRuntimeStore;
}

const EditorMediaServicesContext = createContext<EditorMediaServices | null>(null);

/** Supplies embedded editor IO without replacing the editor, validation or insertion workflow. */
export function EditorMediaServicesProvider({
  services,
  children,
}: {
  services: EditorMediaServices;
  children: ReactNode;
}) {
  return <EditorMediaServicesContext.Provider value={services}>{children}</EditorMediaServicesContext.Provider>;
}

export function useOptionalEditorMediaServices() {
  return useContext(EditorMediaServicesContext);
}
