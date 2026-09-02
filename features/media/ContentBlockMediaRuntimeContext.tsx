'use client';

import { createContext, useContext, useMemo, type ReactNode } from 'react';
import type { ContentBlockMediaItem } from '@echovisionlab/geul-proto/content/block_content_pb.ts';
import { ContentBlockMediaRuntimeIndex } from './content-block-media-runtime';

const ContentBlockMediaRuntimeContext = createContext<ContentBlockMediaRuntimeIndex | null>(null);

export function ContentBlockMediaRuntimeProvider({
  items,
  children,
}: {
  items: readonly ContentBlockMediaItem[];
  children: ReactNode;
}) {
  const index = useMemo(() => new ContentBlockMediaRuntimeIndex(items), [items]);
  return <ContentBlockMediaRuntimeContext.Provider value={index}>{children}</ContentBlockMediaRuntimeContext.Provider>;
}

export function useContentBlockMediaRuntime(): ContentBlockMediaRuntimeIndex {
  const index = useContext(ContentBlockMediaRuntimeContext);
  if (!index) {
    throw new Error('Content Block media runtime context is required.');
  }
  return index;
}

export function useOptionalContentBlockMediaRuntime(): ContentBlockMediaRuntimeIndex | null {
  return useContext(ContentBlockMediaRuntimeContext);
}

export function useContentBlockMediaItem(blockId: string, referencePath = 'file'): ContentBlockMediaItem | undefined {
  return useContentBlockMediaRuntime().get(blockId, referencePath);
}
