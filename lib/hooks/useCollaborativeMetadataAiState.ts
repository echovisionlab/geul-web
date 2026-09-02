'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { HocuspocusProvider } from '@hocuspocus/provider';
import type * as Y from 'yjs';
import {
  createMetadataAiMap,
  DEFAULT_METADATA_AI_SHARED_STATE,
  METADATA_AI_GRACE_PERIOD_MS,
  type MetadataAiField,
  type MetadataAiSharedState,
} from '@/lib/collab/metadata-ai';

interface AwarenessUserState {
  user?: {
    id?: string;
    name?: string;
  };
}

interface AwarenessLike {
  getStates: () => Map<number, AwarenessUserState>;
  on: (event: 'change', callback: () => void) => void;
  off: (event: 'change', callback: () => void) => void;
}

export interface CollaborativeMetadataAiIdentity {
  currentMemberId: string;
  currentMemberDisplayName: string;
}

export interface CollaborativeMetadataAiStateResult {
  sharedState: MetadataAiSharedState;
  isRequester: boolean;
  requesterConnected: boolean;
  setJobId: (generationId: string, jobId: string | null) => boolean;
  startGeneration: (fields: MetadataAiField[], allMetadata: boolean, generationId?: string | null) => string | null;
  markApplying: (generationId: string) => boolean;
  markReady: (generationId: string, fields: MetadataAiField[], allMetadata: boolean) => boolean;
  updateReadyFields: (generationId: string, fields: MetadataAiField[], allMetadata: boolean) => boolean;
  clearState: (generationId?: string | null) => boolean;
}

function buildIdleState(): MetadataAiSharedState {
  return { ...DEFAULT_METADATA_AI_SHARED_STATE };
}

function getAwareness(provider: HocuspocusProvider | null): AwarenessLike | null {
  const awareness = provider?.awareness;
  if (!awareness) {
    return null;
  }
  return awareness as unknown as AwarenessLike;
}

function listConnectedMemberIds(awareness: AwarenessLike | null): string[] {
  if (!awareness) {
    return [];
  }

  const ids = new Set<string>();
  awareness.getStates().forEach((state) => {
    const memberId = state.user?.id;
    if (memberId) {
      ids.add(memberId);
    }
  });
  return Array.from(ids).sort();
}

function areMemberIdListsEqual(left: string[], right: string[]) {
  if (left.length !== right.length) {
    return false;
  }

  return left.every((value, index) => value === right[index]);
}

function isMatchingGeneration(state: MetadataAiSharedState, generationId: string | null | undefined): boolean {
  if (!generationId) {
    return true;
  }

  return state.generationId === generationId;
}

function generateMetadataGenerationId() {
  if (typeof globalThis.crypto?.randomUUID === 'function') {
    return globalThis.crypto.randomUUID();
  }

  return `metadata-ai-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function useCollaborativeMetadataAiState(
  doc: Y.Doc | null,
  provider: HocuspocusProvider | null,
  identity: CollaborativeMetadataAiIdentity | null,
): CollaborativeMetadataAiStateResult {
  const metadataAiMap = useMemo(() => {
    return doc ? createMetadataAiMap(doc) : null;
  }, [doc]);
  const mapRef = useRef<ReturnType<typeof createMetadataAiMap> | null>(null);
  const [sharedState, setSharedState] = useState<MetadataAiSharedState>(buildIdleState);
  const [connectedMemberIds, setConnectedMemberIds] = useState<string[]>([]);

  mapRef.current = metadataAiMap;

  useEffect(() => {
    if (!metadataAiMap) {
      setSharedState(buildIdleState());
      return;
    }

    setSharedState(metadataAiMap.getAllWithDefaults(buildIdleState()));
  }, [metadataAiMap]);

  useEffect(() => {
    if (!metadataAiMap) {
      return;
    }

    return metadataAiMap.observe((changedKeys) => {
      setSharedState((prev) => {
        const next = { ...prev };
        changedKeys.forEach((key) => {
          const value = metadataAiMap.get(key);
          Object.assign(next, {
            [key]: value ?? DEFAULT_METADATA_AI_SHARED_STATE[key],
          });
        });
        return next;
      });
    });
  }, [metadataAiMap]);

  useEffect(() => {
    const awareness = getAwareness(provider);
    let disposed = false;
    const sync = () => {
      queueMicrotask(() => {
        if (disposed) {
          return;
        }

        const next = listConnectedMemberIds(awareness);
        setConnectedMemberIds((current) => (areMemberIdListsEqual(current, next) ? current : next));
      });
    };

    sync();
    if (!awareness) {
      return () => {
        disposed = true;
      };
    }

    awareness.on('change', sync);
    return () => {
      disposed = true;
      awareness.off('change', sync);
    };
  }, [provider]);

  const requesterConnected = Boolean(
    sharedState.requesterMemberId && connectedMemberIds.includes(sharedState.requesterMemberId),
  );
  const isRequester = Boolean(
    identity?.currentMemberId &&
    sharedState.requesterMemberId &&
    sharedState.requesterMemberId === identity.currentMemberId,
  );

  const getLatestSharedState = useCallback(() => {
    return mapRef.current?.getAllWithDefaults(buildIdleState()) ?? buildIdleState();
  }, []);

  const setSharedStatePatch = useCallback(
    (patch: Partial<MetadataAiSharedState>) => {
      const latest = getLatestSharedState();
      mapRef.current?.setMany({
        ...latest,
        ...patch,
      });
    },
    [getLatestSharedState],
  );

  useEffect(() => {
    if (
      sharedState.status === 'idle' ||
      !sharedState.autoClearAt ||
      !sharedState.requesterMemberId ||
      !requesterConnected
    ) {
      return;
    }

    setSharedStatePatch({
      orphanedAt: null,
      autoClearAt: null,
      updatedAt: Date.now(),
    });
  }, [
    requesterConnected,
    setSharedStatePatch,
    sharedState.autoClearAt,
    sharedState.requesterMemberId,
    sharedState.status,
  ]);

  useEffect(() => {
    if (sharedState.status === 'idle' || !sharedState.requesterMemberId || sharedState.autoClearAt || isRequester) {
      return;
    }
    if (requesterConnected || connectedMemberIds.length === 0) {
      return;
    }

    const timeout = window.setTimeout(() => {
      const latest = mapRef.current?.getAllWithDefaults(buildIdleState()) ?? buildIdleState();
      const latestRequesterConnected =
        latest.requesterMemberId !== null && connectedMemberIds.includes(latest.requesterMemberId);
      if (latest.status !== 'idle' && latest.requesterMemberId && !latest.autoClearAt && !latestRequesterConnected) {
        mapRef.current?.setMany({
          ...latest,
          orphanedAt: Date.now(),
          autoClearAt: Date.now() + METADATA_AI_GRACE_PERIOD_MS,
          updatedAt: Date.now(),
        });
      }
    }, 2_000);

    return () => window.clearTimeout(timeout);
  }, [
    connectedMemberIds,
    isRequester,
    requesterConnected,
    sharedState.autoClearAt,
    sharedState.requesterMemberId,
    sharedState.status,
  ]);

  useEffect(() => {
    if (sharedState.status === 'idle' || !sharedState.autoClearAt) {
      return;
    }

    const delay = sharedState.autoClearAt - Date.now();
    if (delay <= 0) {
      mapRef.current?.setMany(buildIdleState());
      return;
    }

    const timeout = window.setTimeout(() => {
      const latest = mapRef.current?.getAllWithDefaults(buildIdleState()) ?? buildIdleState();
      if (latest.autoClearAt && latest.autoClearAt <= Date.now()) {
        mapRef.current?.setMany(buildIdleState());
      }
    }, delay);

    return () => window.clearTimeout(timeout);
  }, [sharedState.autoClearAt, sharedState.status]);

  const startGeneration = useCallback(
    (fields: MetadataAiField[], allMetadata: boolean, generationIdOverride?: string | null) => {
      if (!identity || !mapRef.current) {
        return null;
      }

      const latest = getLatestSharedState();
      if (latest.status !== 'idle') {
        return null;
      }

      const generationId = generationIdOverride || generateMetadataGenerationId();
      mapRef.current.setMany({
        status: 'generating',
        generationId,
        jobId: null,
        requesterMemberId: identity.currentMemberId,
        requesterNickname: identity.currentMemberDisplayName,
        requestedFields: fields,
        allMetadata,
        startedAt: Date.now(),
        updatedAt: Date.now(),
        orphanedAt: null,
        autoClearAt: null,
      });
      return generationId;
    },
    [getLatestSharedState, identity],
  );

  const setJobId = useCallback(
    (generationId: string, jobId: string | null) => {
      if (!mapRef.current) {
        return false;
      }

      const latest = getLatestSharedState();
      if (!isMatchingGeneration(latest, generationId) || latest.status === 'idle') {
        return false;
      }

      mapRef.current.setMany({
        ...latest,
        jobId,
        updatedAt: Date.now(),
      });
      return true;
    },
    [getLatestSharedState],
  );

  const markReady = useCallback(
    (generationId: string, fields: MetadataAiField[], allMetadata: boolean) => {
      if (!identity || !mapRef.current) {
        return false;
      }

      const latest = getLatestSharedState();
      if (
        !isMatchingGeneration(latest, generationId) ||
        latest.requesterMemberId !== identity.currentMemberId ||
        latest.status !== 'generating'
      ) {
        return false;
      }

      mapRef.current.setMany({
        status: 'ready',
        generationId,
        jobId: latest.jobId,
        requesterMemberId: identity.currentMemberId,
        requesterNickname: identity.currentMemberDisplayName,
        requestedFields: fields,
        allMetadata,
        startedAt: latest.startedAt ?? Date.now(),
        updatedAt: Date.now(),
        orphanedAt: null,
        autoClearAt: null,
      });
      return true;
    },
    [getLatestSharedState, identity],
  );

  const markApplying = useCallback(
    (generationId: string) => {
      if (!identity || !mapRef.current) {
        return false;
      }

      const latest = getLatestSharedState();
      if (
        !isMatchingGeneration(latest, generationId) ||
        latest.requesterMemberId !== identity.currentMemberId ||
        latest.status !== 'ready'
      ) {
        return false;
      }

      mapRef.current.setMany({
        ...latest,
        status: 'applying',
        updatedAt: Date.now(),
        orphanedAt: null,
        autoClearAt: null,
      });
      return true;
    },
    [getLatestSharedState, identity],
  );

  const updateReadyFields = useCallback(
    (generationId: string, fields: MetadataAiField[], allMetadata: boolean) => {
      if (!mapRef.current) {
        return false;
      }

      const latest = getLatestSharedState();
      if (!isMatchingGeneration(latest, generationId) || (latest.status !== 'ready' && latest.status !== 'applying')) {
        return false;
      }

      if (fields.length === 0) {
        mapRef.current.setMany(buildIdleState());
        return true;
      }

      mapRef.current.setMany({
        ...latest,
        status: 'ready',
        requestedFields: fields,
        allMetadata,
        updatedAt: Date.now(),
      });
      return true;
    },
    [getLatestSharedState],
  );

  const clearState = useCallback(
    (generationId?: string | null) => {
      const latest = getLatestSharedState();
      if (!isMatchingGeneration(latest, generationId)) {
        return false;
      }

      mapRef.current?.setMany(buildIdleState());
      return true;
    },
    [getLatestSharedState],
  );

  return {
    sharedState,
    isRequester,
    requesterConnected,
    setJobId,
    startGeneration,
    markApplying,
    markReady,
    updateReadyFields,
    clearState,
  };
}
