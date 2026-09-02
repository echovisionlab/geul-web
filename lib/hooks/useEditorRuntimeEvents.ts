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
  const runtimeContext = useOptionalEditorRuntimeContext();

  useEffect(() => {
    if (runtimeContext && (!provider || provider === runtimeContext.provider)) {
      return runtimeContext.subscribeToRuntimeEvents((event) => onEventRef.current(event), options);
    }

    if (provider) {
      return subscribeToProviderRuntimeEvents(provider, (event) => onEventRef.current(event), options);
    }
  }, [provider, runtimeContext, options?.entityId, options?.entityType, options?.locale]);
}
