'use client';

import { useEffect, useLayoutEffect, useMemo } from 'react';
import { createDebouncedPatch, type PatchWriter } from './debounced-patch';
import { registerEditorSave } from './editor-save-registry';

export function useDebouncedPatch<T extends object>({
  write,
  delay,
  scope,
  document,
  recoveryScope,
  recoveryKey,
  merge,
  retry = false,
}: {
  write: PatchWriter<T>;
  delay: number;
  scope: unknown;
  document: string;
  recoveryScope?: string | null;
  recoveryKey?: string;
  merge?: (pending: T, next: T) => T;
  retry?: boolean;
}) {
  const inferredRecoveryScope = typeof scope === 'string' || typeof scope === 'number' ? document : null;
  const activeRecoveryScope = recoveryScope === undefined ? inferredRecoveryScope : recoveryScope;
  const state = useMemo(() => {
    // Each room/document owns its writer as well as its queue, including stale handlers.
    return {
      scope,
      document,
      queue: createDebouncedPatch<T>(delay, document, inferredRecoveryScope, merge, retry, recoveryKey),
      write: undefined as PatchWriter<T> | undefined,
      active: false,
    };
  }, [delay, scope, document, merge, retry, recoveryKey]);
  useLayoutEffect(() => {
    state.write = write;
    state.queue.setRecoveryScope(activeRecoveryScope);
  });
  useEffect(() => {
    state.active = true;
    state.queue.activateRecovery(state.write);
    const unregister = registerEditorSave(state.document, state.queue);
    return () => {
      state.active = false;
      state.queue.preservePendingForRecovery();
      unregister();
      state.queue.cancel();
      state.queue.deactivateRecovery();
    };
  }, [state]);
  return useMemo(
    () =>
      Object.assign(
        (patch: T) => {
          if (state.active && state.write) {
            state.queue.enqueue(patch, state.write);
          }
        },
        {
          flush: state.queue.flush,
          cancel: state.queue.cancel,
          hasPending: state.queue.hasPending,
          getPendingPatch: state.queue.getPendingPatch,
        },
      ),
    [state],
  );
}
