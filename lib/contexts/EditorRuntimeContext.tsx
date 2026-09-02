'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, type ReactNode } from 'react';
import type { EditorRuntimeEvent, RuntimeEntityType } from '@echovisionlab/geul-common/collaboration/runtime-events';
import type { HocuspocusProvider } from '@hocuspocus/provider';
import { persistCollaborativeDocumentNow } from '@/lib/collab/persist-now';
import type { BlockRoomProtocolTransport, BlockRoomSnapshot } from '@/lib/collab/block-room-protocol';
import {
  subscribeToProviderRuntimeEvents,
  type EditorRuntimeEventListener,
  type EditorRuntimeEventSubscriptionOptions,
} from '@/lib/collab/subscribe-runtime-events';

interface RuntimeEventSubscriber {
  listener: EditorRuntimeEventListener;
  options?: EditorRuntimeEventSubscriptionOptions;
}

interface EditorRuntimeContextValue {
  provider: HocuspocusProvider | null;
  entityType: RuntimeEntityType;
  entityId: string;
  persistNow: () => Promise<void>;
  getContributorMemberIds: () => string[];
  getBlockRoomSnapshot: () => Promise<BlockRoomSnapshot>;
  subscribeToRuntimeEvents: (
    onEvent: EditorRuntimeEventListener,
    options?: EditorRuntimeEventSubscriptionOptions,
  ) => () => void;
}

function runtimeEventMatchesSubscriber(
  event: EditorRuntimeEvent,
  options?: EditorRuntimeEventSubscriptionOptions,
): boolean {
  if (options?.entityType && event.entityType !== options.entityType) {
    return false;
  }
  if (options?.entityId && event.entityId !== options.entityId) {
    return false;
  }

  const hasLocaleFilter = options != null && Object.hasOwn(options, 'locale') && options.locale !== undefined;
  if (!hasLocaleFilter) {
    return true;
  }

  return (options?.locale?.trim() || '') === (event.locale?.trim() || '');
}

const EditorRuntimeContext = createContext<EditorRuntimeContextValue | null>(null);

interface EditorRuntimeProviderProps {
  provider: HocuspocusProvider | null;
  entityType: RuntimeEntityType;
  entityId: string;
  blockRoomProtocol?: BlockRoomProtocolTransport | null;
  children: ReactNode;
}

export function EditorRuntimeProvider({
  provider,
  entityType,
  entityId,
  blockRoomProtocol,
  children,
}: EditorRuntimeProviderProps) {
  const runtimeEventSubscribersRef = useRef<Set<RuntimeEventSubscriber>>(new Set());
  const persistNow = useCallback(() => persistCollaborativeDocumentNow(provider), [provider]);
  const getContributorMemberIds = useCallback(() => {
    const ids = new Set<string>();
    for (const state of provider?.awareness?.getStates().values() ?? []) {
      const user = state.user;
      if (user && typeof user === 'object' && 'id' in user && typeof user.id === 'string' && user.id) {
        ids.add(user.id);
      }
    }
    return [...ids].sort();
  }, [provider]);
  const getBlockRoomSnapshot = useCallback(() => {
    if (!blockRoomProtocol) {
      return Promise.reject(new Error('Block-room WebSocket is not available.'));
    }
    return blockRoomProtocol.getSnapshot();
  }, [blockRoomProtocol]);

  useEffect(
    () =>
      subscribeToProviderRuntimeEvents(provider, (event: EditorRuntimeEvent) => {
        for (const subscriber of runtimeEventSubscribersRef.current) {
          if (runtimeEventMatchesSubscriber(event, subscriber.options)) {
            subscriber.listener(event);
          }
        }
      }),
    [provider],
  );

  const subscribeToRuntimeEvents = useCallback(
    (listener: EditorRuntimeEventListener, options?: EditorRuntimeEventSubscriptionOptions) => {
      const subscriber = { listener, options };
      runtimeEventSubscribersRef.current.add(subscriber);
      return () => {
        runtimeEventSubscribersRef.current.delete(subscriber);
      };
    },
    [],
  );

  const value = useMemo(
    () => ({
      provider,
      entityType,
      entityId,
      persistNow,
      getContributorMemberIds,
      getBlockRoomSnapshot,
      subscribeToRuntimeEvents,
    }),
    [
      entityId,
      entityType,
      getBlockRoomSnapshot,
      getContributorMemberIds,
      persistNow,
      provider,
      subscribeToRuntimeEvents,
    ],
  );

  return <EditorRuntimeContext.Provider value={value}>{children}</EditorRuntimeContext.Provider>;
}

export function useOptionalEditorRuntimeContext(): EditorRuntimeContextValue | null {
  return useContext(EditorRuntimeContext);
}
