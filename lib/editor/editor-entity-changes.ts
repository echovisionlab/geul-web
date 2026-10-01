'use client';

import { useEffect, useRef } from 'react';
import type { HocuspocusProvider } from '@hocuspocus/provider';
import { useOptionalEditorRuntimeContext } from '@/lib/contexts/EditorRuntimeContext';

const CHANNEL_NAME = 'geul:editor-entity-changes:v1';

/** Share an invalidation hint only. Every recipient reloads through its authorized API. */
export function publishEditorEntityChange(document: string): void {
  if (typeof BroadcastChannel === 'undefined') {
    return;
  }
  const channel = new BroadcastChannel(CHANNEL_NAME);
  channel.postMessage({ document });
  channel.close();
}

export function useEditorEntityChanges(
  document: string,
  onChange: () => void,
  provider?: HocuspocusProvider | null,
): void {
  const runtime = useOptionalEditorRuntimeContext();
  const runtimeKey = runtime ? `${runtime.entityType.replaceAll('_', '-')}:${runtime.entityId}` : null;
  const activeProvider = provider ?? (runtimeKey === document ? runtime?.provider : null);
  const callback = useRef(onChange);
  callback.current = onChange;
  useEffect(() => {
    if (typeof BroadcastChannel === 'undefined') {
      return;
    }
    const channel = new BroadcastChannel(CHANNEL_NAME);
    channel.onmessage = ({ data }: MessageEvent<unknown>) => {
      if (data && typeof data === 'object' && 'document' in data && data.document === document) {
        callback.current();
      }
    };
    return () => channel.close();
  }, [document]);
  useEffect(() => {
    if (!activeProvider) {
      return;
    }
    const stateless = ({ payload }: { payload: string }) => {
      try {
        const message: unknown = JSON.parse(payload);
        if (
          message &&
          typeof message === 'object' &&
          'kind' in message &&
          message.kind === 'editor.entity_changed' &&
          'version' in message &&
          message.version === 1 &&
          'document' in message &&
          message.document === document
        ) {
          callback.current();
        }
      } catch {
        /* Ignore non-event collaboration messages. */
      }
    };
    const synced = ({ state }: { state: boolean }) => {
      if (state) {
        callback.current();
      }
    };
    activeProvider.on('stateless', stateless);
    activeProvider.on('synced', synced);
    return () => {
      activeProvider.off('stateless', stateless);
      activeProvider.off('synced', synced);
    };
  }, [activeProvider, document]);
}
