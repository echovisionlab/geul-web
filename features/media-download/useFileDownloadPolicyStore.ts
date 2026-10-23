'use client';

import { useEffect, useMemo, useRef } from 'react';
import { useStore } from 'zustand';
import { useWindowEvent } from '@mantine/hooks';
import { useEditorEntityChanges } from '@/lib/editor/editor-entity-changes';
import type { FileDownloadPolicyTarget } from '@/lib/types/file-download-access';
import { policyOwnerDocument } from './file-download-policy-state';
import {
  createFileDownloadPolicyStore,
  normalizeFileDownloadPolicyTarget,
  type FileDownloadPolicyEditorAdapter,
} from './file-download-policy-store';

/** Runs one target's policy store while mounted and feeds it peer changes for that target. */
export function useFileDownloadPolicyStore({
  target,
  adapter,
  releaseId,
  onDetachedSaveFailure,
}: {
  target: FileDownloadPolicyTarget;
  adapter: FileDownloadPolicyEditorAdapter;
  /** Track policies change with their owning Release. */
  releaseId?: string;
  onDetachedSaveFailure: (staleTarget: boolean) => void;
}) {
  const { entityType, entityId, blockId, referencePath, expectedFileId } = target;
  const normalizedTarget = useMemo(
    () => normalizeFileDownloadPolicyTarget({ entityType, entityId, blockId, referencePath, expectedFileId }),
    [blockId, entityId, entityType, expectedFileId, referencePath],
  );
  const detachedFailure = useRef(onDetachedSaveFailure);
  detachedFailure.current = onDetachedSaveFailure;
  const store = useMemo(
    () =>
      createFileDownloadPolicyStore(normalizedTarget, {
        onDetachedSaveFailure: (staleTarget) => detachedFailure.current(staleTarget),
      }),
    [normalizedTarget],
  );
  useEffect(() => {
    store.start(adapter);
    return () => store.stop();
  }, [adapter, store]);

  useEditorEntityChanges(store.document, store.notifyPeerChange, undefined, undefined, store.captureOwnChange);
  // The owning room supplies server invalidations; the exact selector remains the
  // browser-channel key. Track IDs do not identify their release owner.
  const ownerDocument = policyOwnerDocument(normalizedTarget, releaseId);
  useEditorEntityChanges(ownerDocument ?? store.document, () => {
    if (ownerDocument) {
      store.notifyPeerChange();
    }
  });
  useWindowEvent('beforeunload', (event) => {
    if (store.hasUnsavedChanges()) {
      event.preventDefault();
    }
  });

  return { store, state: useStore(store.api) };
}
