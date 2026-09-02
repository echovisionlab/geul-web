'use client';

import {
  parseEditorRuntimeEventMessage,
  type EditorRuntimeEvent,
  type RuntimeEntityType,
} from '@echovisionlab/geul-common/collaboration/runtime-events';
import type { HocuspocusProvider } from '@hocuspocus/provider';

export interface EditorRuntimeEventSubscriptionOptions {
  entityType?: RuntimeEntityType;
  entityId?: string;
  locale?: string | null;
}

export type EditorRuntimeEventListener = (event: EditorRuntimeEvent) => void;

export function subscribeToProviderRuntimeEvents(
  provider: HocuspocusProvider | null,
  onEvent: EditorRuntimeEventListener,
  options?: EditorRuntimeEventSubscriptionOptions,
): () => void {
  if (!provider) {
    return () => {};
  }

  const hasLocaleFilter = options != null && Object.hasOwn(options, 'locale') && options.locale !== undefined;

  const handleStateless = ({ payload }: { payload: string }) => {
    const event = parseEditorRuntimeEventMessage(payload);
    if (!event) {
      return;
    }

    if (options?.entityType && event.entityType !== options.entityType) {
      return;
    }
    if (options?.entityId && event.entityId !== options.entityId) {
      return;
    }
    if (hasLocaleFilter) {
      const expectedLocale = options?.locale?.trim() || '';
      const payloadLocale = event.locale?.trim() || '';
      if (expectedLocale !== payloadLocale) {
        return;
      }
    }

    onEvent(event);
  };

  provider.on('stateless', handleStateless);
  return () => {
    provider.off('stateless', handleStateless);
  };
}
