'use client';

import { useCallback, useEffect, useMemo, useRef, type ReactNode } from 'react';
import type { EditorRuntimeEvent, RuntimeEntityType } from '@echovisionlab/geul-common/collaboration/runtime-events';
import type { HocuspocusProvider } from '@hocuspocus/provider';
import { persistCollaborativeDocumentNow } from '@/lib/collab/persist-now';
import { getDocumentRoomSnapshot } from '@/lib/collab/document-room-snapshot';
import type { BlockRoomProtocolTransport } from '@/lib/collab/block-room-protocol';
import { requireBlockRoomDurabilityProtocol } from '@/lib/collab/block-room-durability';
import { registerCollaborativeDocumentSave } from '@/lib/editor/collaborative-document-save';
import {
  subscribeToProviderRuntimeEvents,
  type EditorRuntimeEventListener,
  type EditorRuntimeEventSubscriptionOptions,
} from '@/lib/collab/subscribe-runtime-events';
import { EditorRuntimeContext } from './editor-runtime-context-value';
import { isBlockRoomJournalSettled } from '@/lib/collab/block-room-journal-durability';
import { getProviderAccessLevel } from '@/lib/collab/provider-control-state';
import { getDocumentRoomJournalStore } from '@/lib/collab/document-room-journal-store';

/** Document rooms whose semantic intents are journaled (see document-room-intent). */
const JOURNALED_DOCUMENT_ROOMS: ReadonlySet<string> = new Set(['form', 'menu', 'series', 'email_layout']);

export { useOptionalEditorRuntimeContext } from './editor-runtime-context-value';
export type { EditorRuntimeContextValue } from './editor-runtime-context-value';

interface RuntimeEventSubscriber {
  listener: EditorRuntimeEventListener;
  options?: EditorRuntimeEventSubscriptionOptions;
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
  useEffect(() => {
    if (!provider || ['page', 'menu', 'series', 'email_layout'].includes(entityType)) {
      return;
    }
    // Block rooms and journaled document rooms keep unsaved edits on this device; others in memory.
    // A room downgraded to view parks them until it is reopened with edit access.
    const isParked = () => getProviderAccessLevel(provider) === 'view';
    const persistence = blockRoomProtocol
      ? {
          kind: 'block-room' as const,
          protocol: requireBlockRoomDurabilityProtocol(blockRoomProtocol),
          isDurable: isBlockRoomJournalSettled,
          isParked,
        }
      : JOURNALED_DOCUMENT_ROOMS.has(entityType)
        ? {
            kind: 'persist-now' as const,
            isDurable: () => getDocumentRoomJournalStore()?.isSettled() ?? false,
            isParked,
          }
        : { kind: 'persist-now' as const, isParked };
    return registerCollaborativeDocumentSave(provider, `${entityType}:${entityId}`, persistence);
  }, [blockRoomProtocol, entityId, entityType, provider]);
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
    if (blockRoomProtocol) {
      return blockRoomProtocol.getSnapshot();
    }
    const registryEntityType = entityType === 'series' ? 'post_series' : entityType;
    const snapshot = getDocumentRoomSnapshot(provider?.document, {
      entityType: registryEntityType,
      entityId,
      documentName: provider?.configuration.name,
    });
    if (!snapshot) {
      return Promise.reject(new Error('A validated collaboration snapshot is not available.'));
    }
    const { documentName: _documentName, ...blockRoomSnapshot } = snapshot;
    return Promise.resolve(blockRoomSnapshot);
  }, [blockRoomProtocol, entityId, entityType, provider]);

  useEffect(
    () =>
      subscribeToProviderRuntimeEvents(
        provider,
        (event: EditorRuntimeEvent) => {
          for (const subscriber of runtimeEventSubscribersRef.current) {
            if (runtimeEventMatchesSubscriber(event, subscriber.options)) {
              subscriber.listener(event);
            }
          }
        },
        {
          onResync: () => {
            for (const subscriber of runtimeEventSubscribersRef.current) {
              subscriber.options?.onResync?.();
            }
          },
        },
      ),
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
