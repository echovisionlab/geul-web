'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type {
  EditorRuntimeEvent,
  MediaProcessingLifecycleRuntimeEvent,
  MediaProcessingLifecycleRuntimePayload,
} from '@echovisionlab/geul-common/collaboration/runtime-events';
import { MediaProcessingStatus } from '@echovisionlab/geul-proto/common/media_pb.ts';
import { useEditorRuntimeEvents } from '@/lib/hooks/useEditorRuntimeEvents';
import type { EditorFileStatusSnapshot } from './editor-file-status-runtime';
import { getEditorFileStatus, useEditorFileStatusBootstrap } from './use-editor-file-status-bootstrap';

interface UseMediaProcessingRuntimeStateOptions<T> {
  fileId?: string | null;
  pendingUploadFileId?: string | null;
  mediaSlotId?: string | null;
  mediaAttemptId?: string | null;
  trackId?: string | null;
  enabled?: boolean;
  bootstrapEnabled?: boolean;
  mapStatus: (status: EditorFileStatusSnapshot) => T | null;
}

interface MediaProcessingRuntimeState<T> {
  value: T | null;
  isLoading: boolean;
}

function normalizeId(value: string | null | undefined): string {
  return typeof value === 'string' ? value.trim() : '';
}

function payloadMatchesIdentity(
  payload: MediaProcessingLifecycleRuntimePayload,
  identity: {
    fileId: string;
    pendingUploadFileId: string;
    mediaSlotId: string;
    mediaAttemptId: string;
    trackId: string;
  },
): boolean {
  if (identity.fileId && payload.fileId === identity.fileId) {
    return true;
  }

  if (identity.pendingUploadFileId && payload.fileId === identity.pendingUploadFileId) {
    return true;
  }

  if (identity.mediaSlotId && identity.mediaAttemptId) {
    return payload.slotId === identity.mediaSlotId && payload.attemptId === identity.mediaAttemptId;
  }

  const hasFileScopedIdentity = Boolean(
    identity.fileId || identity.pendingUploadFileId || (identity.mediaSlotId && identity.mediaAttemptId),
  );
  if (hasFileScopedIdentity) {
    return false;
  }

  return Boolean(identity.trackId && payload.trackId === identity.trackId);
}

function runtimeStatusToFileStatus(payload: MediaProcessingLifecycleRuntimePayload): MediaProcessingStatus {
  switch (payload.status) {
    case 'ready':
      return MediaProcessingStatus.READY;
    case 'failed':
      return MediaProcessingStatus.FAILED;
    case 'processing':
      return MediaProcessingStatus.PROCESSING;
  }
}

function snapshotFromRuntimePayload(payload: MediaProcessingLifecycleRuntimePayload): EditorFileStatusSnapshot {
  return {
    completed: payload.status === 'ready',
    failed: payload.status === 'failed',
    unavailable: false,
    url: '',
    originalUrl: '',
    waveformUrl: '',
    spectrogramUrl: '',
    thumbnailUrl: '',
    hlsUrl: '',
    durationSeconds: payload.outputs?.durationSeconds || 0,
    processingStatus: runtimeStatusToFileStatus(payload),
    processingPercentage: payload.status === 'processing' ? payload.percentage : undefined,
  };
}

function eventOrderingKey(event: MediaProcessingLifecycleRuntimeEvent): string {
  return [
    event.payload.fileId,
    event.payload.trackId ?? '',
    event.payload.slotId ?? '',
    event.payload.attemptId ?? '',
  ].join(':');
}

export function useMediaProcessingRuntimeState<T>({
  fileId,
  pendingUploadFileId,
  mediaSlotId,
  mediaAttemptId,
  trackId,
  enabled = true,
  bootstrapEnabled = true,
  mapStatus,
}: UseMediaProcessingRuntimeStateOptions<T>): MediaProcessingRuntimeState<T> {
  const identity = {
    fileId: normalizeId(fileId),
    pendingUploadFileId: normalizeId(pendingUploadFileId),
    mediaSlotId: normalizeId(mediaSlotId),
    mediaAttemptId: normalizeId(mediaAttemptId),
    trackId: normalizeId(trackId),
  };
  const identityKey = [
    identity.fileId,
    identity.pendingUploadFileId,
    identity.mediaSlotId,
    identity.mediaAttemptId,
    identity.trackId,
  ].join(':');
  const currentIdentityKeyRef = useRef(identityKey);
  currentIdentityKeyRef.current = identityKey;
  const [runtimeState, setRuntimeState] = useState<{
    identityKey: string;
    value: T | null;
  }>(() => ({ identityKey, value: null }));
  const lastSequencesRef = useRef<Map<string, number>>(new Map());
  const bootstrap = useEditorFileStatusBootstrap({
    fileId: identity.fileId,
    enabled: enabled && bootstrapEnabled && Boolean(identity.fileId),
    mapStatus,
  });

  useEffect(() => {
    setRuntimeState({ identityKey, value: null });
    lastSequencesRef.current.clear();
  }, [identityKey]);

  const handleRuntimeEvent = useCallback(
    (event: EditorRuntimeEvent) => {
      if (!enabled || currentIdentityKeyRef.current !== identityKey || event.kind !== 'media.processing.lifecycle') {
        return;
      }

      if (!payloadMatchesIdentity(event.payload, identity)) {
        return;
      }

      const key = eventOrderingKey(event);
      if (typeof event.sequence === 'number' && event.sequence > 0) {
        const previous = lastSequencesRef.current.get(key);
        if (typeof previous === 'number' && event.sequence <= previous) {
          return;
        }
        lastSequencesRef.current.set(key, event.sequence);
      }

      if (event.payload.status === 'ready') {
        const expectedSequence = event.sequence;
        void getEditorFileStatus(event.payload.fileId)
          .then((status) => {
            if (
              currentIdentityKeyRef.current !== identityKey ||
              (typeof expectedSequence === 'number' &&
                expectedSequence > 0 &&
                lastSequencesRef.current.get(key) !== expectedSequence)
            ) {
              return;
            }
            setRuntimeState({ identityKey, value: mapStatus(status) });
          })
          .catch(() => {
            if (currentIdentityKeyRef.current === identityKey) {
              setRuntimeState({ identityKey, value: mapStatus(snapshotFromRuntimePayload(event.payload)) });
            }
          });
        return;
      }

      setRuntimeState({ identityKey, value: mapStatus(snapshotFromRuntimePayload(event.payload)) });
    },
    [
      enabled,
      identity.fileId,
      identity.mediaAttemptId,
      identity.mediaSlotId,
      identity.pendingUploadFileId,
      identity.trackId,
      mapStatus,
    ],
  );

  useEditorRuntimeEvents(null, handleRuntimeEvent);

  const runtimeValue = runtimeState.identityKey === identityKey ? runtimeState.value : null;

  return {
    value: runtimeValue ?? bootstrap.value,
    isLoading: !runtimeValue && bootstrap.isLoading,
  };
}
