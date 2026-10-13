'use client';

import { useEffect, useRef } from 'react';
import type { EditorRuntimeEvent } from '@echovisionlab/geul-common/collaboration/runtime-events';
import type { HocuspocusProvider } from '@hocuspocus/provider';
import {
  subscribeToProviderRuntimeEvents,
  type EditorRuntimeEventSubscriptionOptions,
} from '@/lib/collab/subscribe-runtime-events';
import { useOptionalEditorRuntimeContext } from '@/lib/contexts/EditorRuntimeContext';

export function useEditorRuntimeEvents(
  provider: HocuspocusProvider | null,
  onEvent: (event: EditorRuntimeEvent) => void,
  options?: EditorRuntimeEventSubscriptionOptions,
): void {
  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent;
  const onResyncRef = useRef(options?.onResync);
  onResyncRef.current = options?.onResync;
  const runtimeContext = useOptionalEditorRuntimeContext();

  useEffect(() => {
    // `onResync` runs when events could not be delivered; the latest callback is used.
    const subscription = { ...options, onResync: () => onResyncRef.current?.() };
    if (runtimeContext && (!provider || provider === runtimeContext.provider)) {
      return runtimeContext.subscribeToRuntimeEvents((event) => onEventRef.current(event), subscription);
    }

    if (provider) {
      return subscribeToProviderRuntimeEvents(provider, (event) => onEventRef.current(event), subscription);
    }
  }, [provider, runtimeContext, options?.entityId, options?.entityType, options?.locale]);
}
