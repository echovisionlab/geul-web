'use client';

import { useEffect } from 'react';
import type { EditorMediaFileRuntime, EditorMediaRuntimeStore } from '@/features/editor/lib/editor-media-runtime-store';
import { isBlockId } from '@/lib/editor/block-id';
import {
  resolveEditorFileStatusRuntime,
  type EditorFileStatusRuntimeState,
} from '@/lib/media/editor-file-status-runtime';
import { useMediaProcessingRuntimeState } from '@/lib/media/use-media-processing-runtime-state';

interface UseEditorMediaRuntimeBindingOptions {
  blockId: string;
  fileId: string;
  runtimeStore?: EditorMediaRuntimeStore;
}

function isTerminalRuntime(runtime: Readonly<EditorMediaFileRuntime> | undefined): boolean {
  return Boolean(
    runtime?.mimeType && (runtime.processingStatus === 'ready' || runtime.processingStatus === 'completed'),
  );
}

/**
 * Connects one durable File reference to its ephemeral delivery metadata.
 * Initial statuses are bulk-coalesced by the shared bootstrap and subsequent
 * processing changes arrive through the editor runtime event stream.
 */
export function useEditorMediaRuntimeBinding({ blockId, fileId, runtimeStore }: UseEditorMediaRuntimeBindingOptions) {
  const enabled = Boolean(runtimeStore && isBlockId(blockId) && isBlockId(fileId));
  const currentFileRuntime = enabled ? runtimeStore?.getSnapshot(blockId, fileId).file : undefined;
  const runtime = useMediaProcessingRuntimeState<EditorFileStatusRuntimeState>({
    fileId,
    enabled,
    bootstrapEnabled: !isTerminalRuntime(currentFileRuntime),
    mapStatus: resolveEditorFileStatusRuntime,
  });

  useEffect(() => {
    if (!enabled || !runtimeStore) {
      return;
    }
    return runtimeStore.acquireFileBinding(blockId, fileId);
  }, [blockId, enabled, fileId, runtimeStore]);

  useEffect(() => {
    if (enabled && runtimeStore && runtime.value) {
      runtimeStore.patchFile(fileId, runtime.value);
    }
  }, [enabled, fileId, runtime.value, runtimeStore]);

  return { isLoading: runtime.isLoading };
}
