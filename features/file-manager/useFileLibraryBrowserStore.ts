'use client';

import { useEffect, useState } from 'react';
import { useStore } from 'zustand';
import {
  createFileLibraryBrowserStore,
  type FileLibraryBrowserAdapter,
  type FileLibraryBrowserOptions,
} from './file-library-browser-store';

/** Runs a File library browser while mounted. Options apply when it is created. */
export function useFileLibraryBrowserStore(adapter: FileLibraryBrowserAdapter, options?: FileLibraryBrowserOptions) {
  const [store] = useState(() => createFileLibraryBrowserStore(options));
  useEffect(() => {
    store.start(adapter);
    return () => store.stop();
  }, [adapter, store]);
  return { store, state: useStore(store.api) };
}
