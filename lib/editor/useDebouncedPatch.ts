'use client';

import { useEffect, useLayoutEffect, useMemo } from 'react';
import { createDebouncedPatch, type PatchWriter } from './debounced-patch';
import { registerEditorSave } from './editor-save-registry';

export function useDebouncedPatch<T extends object>({
  write,
  delay,
  scope,
  document,
}: {
  write: PatchWriter<T>;
  delay: number;
  scope: unknown;
  document: string;
}) {
  const state = useMemo(() => {
    // Each room/document owns its writer as well as its queue, including stale handlers.
    return {
      scope,
      document,
      queue: createDebouncedPatch<T>(delay),
      write: undefined as PatchWriter<T> | undefined,
      active: false,
    };
  }, [delay, scope, document]);
  useLayoutEffect(() => {
    state.write = write;
  });
  useEffect(() => {
    state.active = true;
    const unregister = registerEditorSave(state.document, state.queue);
    return () => {
      state.active = false;
      unregister();
      state.queue.cancel();
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
        { flush: state.queue.flush, cancel: state.queue.cancel },
      ),
    [state],
  );
}
