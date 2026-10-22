'use client';

import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { timestampMs } from '@bufbuild/protobuf/wkt';
import type { MediaDelivery } from '@echovisionlab/geul-proto/common/media_pb.ts';
import type { ContentBlockMediaItem } from '@echovisionlab/geul-proto/content/block_content_pb.ts';
import { ContentBlockMediaRuntimeIndex } from '@/features/media/content-block-media-runtime-index';
import type { EditorMediaRuntimeStore } from '../lib/editor-media-runtime-store';
import {
  fileStatusFromDelivery,
  resolveEditorFileStatusRuntime,
  type EditorFileStatusRuntimeState,
} from '@/lib/media/editor-file-status-runtime';

type EditorSnapshotMedia = ReadonlyMap<string, EditorFileStatusRuntimeState>;

/** Signed URLs this close to expiry are left to the status bootstrap, which issues fresh ones. */
const EXPIRY_MARGIN_MS = 60_000;

function hasUsableUrls(delivery: MediaDelivery, now: number): boolean {
  return [delivery.inline, delivery.download].every(
    (ref) => !ref?.expiresAt || timestampMs(ref.expiresAt) > now + EXPIRY_MARGIN_MS,
  );
}

const EditorSnapshotMediaContext = createContext<EditorSnapshotMedia | null>(null);

/**
 * Hands the File deliveries the SSR snapshot already rendered to the live editor,
 * so its File blocks open with the same media instead of a loading state.
 */
export function EditorSnapshotMediaProvider({
  items,
  children,
}: {
  items: readonly ContentBlockMediaItem[];
  children: ReactNode;
}) {
  const media = useMemo(() => {
    const files = new Map<string, EditorFileStatusRuntimeState>();
    const now = Date.now();
    for (const [fileId, delivery] of new ContentBlockMediaRuntimeIndex(items).filesById) {
      if (!hasUsableUrls(delivery, now)) {
        continue;
      }
      const runtime = resolveEditorFileStatusRuntime(fileStatusFromDelivery(delivery));
      if (runtime) {
        files.set(fileId, runtime);
      }
    }
    return files;
  }, [items]);
  return <EditorSnapshotMediaContext.Provider value={media}>{children}</EditorSnapshotMediaContext.Provider>;
}

export function useEditorSnapshotMedia(): EditorSnapshotMedia | null {
  return useContext(EditorSnapshotMediaContext);
}

/** Starts a resident editor's media store from the snapshot deliveries, when there are any. */
export function seedEditorMediaRuntimeStore(
  store: EditorMediaRuntimeStore,
  media: EditorSnapshotMedia | null,
): EditorMediaRuntimeStore {
  for (const [fileId, runtime] of media ?? []) {
    store.patchFile(fileId, runtime);
  }
  return store;
}
