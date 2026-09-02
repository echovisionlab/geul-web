'use client';

import { useRef } from 'react';
import type { EditorRuntimeEvent, RuntimeEntityType } from '@echovisionlab/geul-common/collaboration/runtime-events';
import type { HocuspocusProvider } from '@hocuspocus/provider';
import { useEditorRuntimeEvents } from './useEditorRuntimeEvents';
import { updateUploadSurfaceLifecycle } from './uploadSurfaceActivity';
import type { InFlightServerLifecycle } from '@/lib/upload/file-upload-contract';
import { mergeUploadProgress, runtimeEventMatchesUpload } from '@/lib/upload/upload-progress';

function isTerminalLifecycleEvent(event: Extract<EditorRuntimeEvent, { kind: 'file.ingest.lifecycle' }>): boolean {
  return event.payload.stage === 'failed' || event.payload.stage === 'completed';
}

function applyServerLifecycleEvent(
  event: Extract<EditorRuntimeEvent, { kind: 'file.ingest.lifecycle' }>,
  tracker: InFlightServerLifecycle,
  correlationId: string,
): void {
  const isCompleted = event.payload.stage === 'completed';
  mergeUploadProgress(tracker.progress, {
    percentage: isCompleted ? 100 : event.payload.progress,
    loadedBytes: event.payload.bytesCompleted,
  });
  tracker.onLifecycle?.({
    correlationId,
    mode: event.payload.source,
    stage: event.payload.stage,
    percentage: event.payload.progress == null && !isCompleted ? undefined : tracker.progress.percentage,
    loadedBytes: event.payload.bytesCompleted == null ? undefined : tracker.progress.loadedBytes,
    totalBytes: event.payload.bytesTotal,
    fileId: event.payload.fileId,
    error: event.payload.error,
    source: 'server',
  });

  if (tracker.uploadSurfaceKey) {
    updateUploadSurfaceLifecycle(
      tracker.uploadSurfaceKey,
      {
        stage: event.payload.stage,
        progress: tracker.progress.percentage,
        error: event.payload.error || undefined,
      },
      tracker.activityId,
    );
  }
}

interface Options {
  provider: HocuspocusProvider | null;
  entityType?: RuntimeEntityType;
  entityId?: string;
  enabled: boolean;
}

export function useUploadLifecycleTracker({ provider, entityType, entityId, enabled }: Options) {
  const trackersRef = useRef<Map<string, InFlightServerLifecycle>>(new Map());

  useEditorRuntimeEvents(
    provider,
    (event) => {
      if (event.kind !== 'file.ingest.lifecycle' || !event.correlationId) {
        return;
      }

      const tracker = trackersRef.current.get(event.correlationId);
      if (!tracker || !runtimeEventMatchesUpload(tracker.progress, event.payload)) {
        return;
      }

      applyServerLifecycleEvent(event, tracker, event.correlationId);
      if (isTerminalLifecycleEvent(event)) {
        trackersRef.current.delete(event.correlationId);
      }
    },
    { entityType, entityId },
  );

  return {
    canTrack: enabled && Boolean(entityType && entityId),
    trackers: trackersRef.current,
  };
}
