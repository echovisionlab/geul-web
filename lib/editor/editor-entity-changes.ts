'use client';

import { parseEditorWriteToken } from './editor-write-token';
import { parseServerMessage } from '@echovisionlab/geul-common/collaboration/protocol';
import { getProviderAccessEnded, getProviderDocumentRevision } from '@/lib/collab/provider-control-state';
import { DOCUMENT_ROOM_SNAPSHOT_MAP_NAME } from '@/lib/collab/document-room-snapshot';
import { createLogger } from '@/lib/utils/logger';
import { useEffect, useRef } from 'react';
import type { HocuspocusProvider } from '@hocuspocus/provider';
import { useOptionalEditorRuntimeContext } from '@/lib/contexts/EditorRuntimeContext';

const pendingEntities = new Map<
  string,
  {
    timer: ReturnType<typeof setTimeout>;
    /** Per listener, every queued notification's "still needed" check; one true refetches. */
    listeners: Map<() => void, Array<() => boolean>>;
  }
>();

const CHANNEL_NAME = 'geul:editor-entity-changes:v1';

/** Share an invalidation hint only. Every recipient reloads through its authorized API. */
export function publishEditorEntityChange(document: string, origin?: string): void {
  if (typeof BroadcastChannel === 'undefined') {
    return;
  }
  const channel = new BroadcastChannel(CHANNEL_NAME);
  // Other tabs compare only the tab origin; the member part is for the API.
  channel.postMessage({ document, ...(origin ? { origin: parseEditorWriteToken(origin).origin } : {}) });
  channel.close();
}

export function useEditorEntityChanges(
  document: string,
  onChange: () => void,
  provider?: HocuspocusProvider | null,
  knownRevision?: string | null,
  captureOwnChange?: (origin?: string) => () => boolean,
): void {
  const runtime = useOptionalEditorRuntimeContext();
  const entity = document.replaceAll('_', '-');
  const runtimeKey = runtime ? `${runtime.entityType.replaceAll('_', '-')}:${runtime.entityId}` : null;
  const activeProvider = provider ?? (runtimeKey === entity ? runtime?.provider : null);
  const callback = useRef(onChange);
  callback.current = onChange;
  const ownChange = useRef(captureOwnChange);
  ownChange.current = captureOwnChange;
  const revision = useRef(knownRevision);
  revision.current = knownRevision;
  // Terminal access stops every refetch path: the API would refuse it and the editor is read-only.
  // Access ends for one entity's room connection; another entity or a new connection (after the
  // editor signs in again) starts with access.
  const accessEnded = useRef<{ entity: string; provider: unknown } | null>(null);
  const entityRef = useRef(entity);
  entityRef.current = entity;
  const providerRef = useRef(activeProvider);
  providerRef.current = activeProvider;
  const hasAccess = () =>
    !(accessEnded.current?.entity === entityRef.current && accessEnded.current.provider === providerRef.current) &&
    !getProviderAccessEnded(providerRef.current);
  useEffect(() => {
    if (typeof BroadcastChannel === 'undefined') {
      return;
    }
    const channel = new BroadcastChannel(CHANNEL_NAME);
    channel.onmessage = ({ data }: MessageEvent<unknown>) => {
      if (data && typeof data === 'object' && 'document' in data && data.document === document && hasAccess()) {
        const origin = 'origin' in data && typeof data.origin === 'string' ? data.origin : undefined;
        if (!ownChange.current?.(origin)()) {
          callback.current();
        }
      }
    };
    return () => channel.close();
  }, [document]);
  useEffect(() => {
    if (!activeProvider) {
      return;
    }
    const heldRevision = () =>
      revision.current ??
      getProviderDocumentRevision(activeProvider) ??
      activeProvider.document?.getMap<string>(DOCUMENT_ROOM_SNAPSHOT_MAP_NAME).get('documentRevision');
    const notify = () => {
      if (hasAccess()) {
        callback.current();
      }
    };
    const cancelPending = () => {
      const pending = pendingEntities.get(entity);
      pending?.listeners.delete(notify);
      if (pending && !pending.listeners.size) {
        clearTimeout(pending.timer);
        pendingEntities.delete(entity);
      }
    };
    const stateless = ({ payload }: { payload: string }) => {
      const parsed = parseServerMessage(payload);
      if (!parsed.ok) {
        void createLogger('entity-changes').warn('Ignoring collaboration message', { data: { ...parsed } });
        return;
      }
      const message = parsed.message;
      if (message.kind === 'room.access_ended') {
        accessEnded.current = { entity, provider: activeProvider };
        cancelPending();
        return;
      }
      if (message.kind !== 'entity.changed' || message.entity !== entity || !hasAccess()) {
        return;
      }
      // Only a document-scope revision names what changed. Metadata and locale changes keep the
      // document revision, so holding that revision says nothing about the changed resource.
      const ownCanonicalAdopted = ownChange.current?.(message.origin);
      const alreadyHeld = () =>
        Boolean(ownCanonicalAdopted?.()) ||
        (message.scope === 'document' && message.revision !== undefined && message.revision === heldRevision());
      if (alreadyHeld()) {
        return;
      }
      let pending = pendingEntities.get(entity);
      if (!pending) {
        pending = {
          listeners: new Map(),
          timer: setTimeout(() => {
            const queued = pendingEntities.get(entity);
            pendingEntities.delete(entity);
            for (const [deliver, needed] of queued?.listeners ?? []) {
              try {
                if (needed.some((check) => check())) {
                  deliver();
                }
              } catch (error) {
                void createLogger('entity-changes').warn('Entity-change listener failed', {
                  data: { error: String(error) },
                });
              }
            }
          }, 250),
        };
        pendingEntities.set(entity, pending);
      }
      // A local canonical acknowledgement during this window can prove an origin-bearing hint
      // already adopted. Otherwise metadata/locale hints remain needed even at a held document revision.
      const needed = pending.listeners.get(notify) ?? [];
      needed.push(() => !alreadyHeld());
      pending.listeners.set(notify, needed);
    };
    const synced = ({ state }: { state: boolean }) => {
      if (state) {
        notify();
      }
    };
    activeProvider.on('stateless', stateless);
    activeProvider.on('synced', synced);
    return () => {
      cancelPending();
      activeProvider.off('stateless', stateless);
      activeProvider.off('synced', synced);
    };
  }, [activeProvider, entity]);
}
