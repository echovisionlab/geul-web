'use client';

import { useSyncExternalStore } from 'react';
import { UploadType } from '@echovisionlab/geul-proto/secure/file_pb.ts';
import type { UploadLifecycleStage } from '@/lib/utils/upload-runtime';

const listeners = new Set<() => void>();
const activeUploads = new Map<string, number>();
const activeUploadCancelers = new Map<string, Set<() => void>>();
const activeUploadLifecycles = new Map<string, UploadSurfaceLifecycle>();
const activeUploadActivityIds = new Map<string, string>();

export interface UploadSurfaceLifecycle {
  stage: UploadLifecycleStage | null;
  progress: number;
  error?: string;
}

export function mergeUploadSurfaceLifecycle(
  current: UploadSurfaceLifecycle | null | undefined,
  lifecycle: UploadSurfaceLifecycle,
): UploadSurfaceLifecycle {
  return {
    stage: lifecycle.stage,
    progress: Math.max(current?.progress ?? 0, Math.max(0, Math.min(100, Math.round(lifecycle.progress)))),
    error: lifecycle.error,
  };
}

export function buildUploadSurfaceKey(input: {
  uploadType: UploadType;
  entityId: string;
  slotId?: string | null | undefined;
  attemptId?: string | null | undefined;
}) {
  return [input.uploadType.toString(), input.entityId, input.slotId || '', input.attemptId || ''].join(':');
}

function emitChange() {
  listeners.forEach((listener) => listener());
}

export function markUploadSurfaceActive(key: string, activityId = key) {
  const currentActivityId = activeUploadActivityIds.get(key);
  if (currentActivityId !== activityId) {
    activeUploads.set(key, 1);
    activeUploadActivityIds.set(key, activityId);
    activeUploadLifecycles.delete(key);
    activeUploadCancelers.delete(key);
  } else {
    activeUploads.set(key, (activeUploads.get(key) || 0) + 1);
  }
  emitChange();
}

export function updateUploadSurfaceLifecycle(
  key: string,
  lifecycle: UploadSurfaceLifecycle,
  activityId = activeUploadActivityIds.get(key) ?? key,
) {
  if (activeUploadActivityIds.get(key) !== activityId) {
    return;
  }

  const current = activeUploadLifecycles.get(key);
  const normalized = mergeUploadSurfaceLifecycle(current, lifecycle);
  if (
    current &&
    current.stage === normalized.stage &&
    current.progress === normalized.progress &&
    current.error === normalized.error
  ) {
    return;
  }

  activeUploadLifecycles.set(key, normalized);
  emitChange();
}

export function registerUploadSurfaceCancel(
  key: string,
  cancel: () => void,
  activityId = activeUploadActivityIds.get(key) ?? key,
) {
  if (activeUploadActivityIds.get(key) !== activityId) {
    return () => undefined;
  }

  const existing = activeUploadCancelers.get(key) ?? new Set<() => void>();
  existing.add(cancel);
  activeUploadCancelers.set(key, existing);
  emitChange();

  return () => {
    if (activeUploadActivityIds.get(key) !== activityId) {
      return;
    }
    const next = activeUploadCancelers.get(key);
    if (!next) {
      return;
    }
    next.delete(cancel);
    if (next.size === 0) {
      activeUploadCancelers.delete(key);
    }
    emitChange();
  };
}

export function cancelUploadSurface(key: string) {
  const cancelers = activeUploadCancelers.get(key);
  if (!cancelers || cancelers.size === 0) {
    return false;
  }

  Array.from(cancelers).forEach((cancel) => cancel());
  return true;
}

export function clearUploadSurfaceActive(key: string, activityId = activeUploadActivityIds.get(key) ?? key) {
  if (activeUploadActivityIds.get(key) !== activityId) {
    return;
  }

  const next = (activeUploads.get(key) || 0) - 1;
  if (next > 0) {
    activeUploads.set(key, next);
  } else {
    activeUploads.delete(key);
    activeUploadLifecycles.delete(key);
    activeUploadActivityIds.delete(key);
    activeUploadCancelers.delete(key);
  }
  emitChange();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshotForKey(key: string) {
  return (activeUploads.get(key) || 0) > 0;
}

function getSnapshotForSlot(input: { uploadType: UploadType; entityId: string; slotId?: string | null | undefined }) {
  const surfaceKey = [input.uploadType.toString(), input.entityId, input.slotId || ''].join(':');
  for (const activeKey of activeUploads.keys()) {
    if (activeKey.startsWith(`${surfaceKey}:`) && (activeUploads.get(activeKey) || 0) > 0) {
      return true;
    }
  }
  return false;
}

function getCancelSnapshotForKey(key: string) {
  return (activeUploadCancelers.get(key)?.size || 0) > 0;
}

function getLifecycleSnapshotForKey(key: string) {
  return activeUploadLifecycles.get(key) ?? null;
}

export function useIsUploadSurfaceActive(key: string) {
  return useSyncExternalStore(
    subscribe,
    () => getSnapshotForKey(key),
    () => false,
  );
}

export function useIsUploadSurfaceSlotActive(input: {
  uploadType: UploadType;
  entityId: string;
  slotId?: string | null | undefined;
}) {
  return useSyncExternalStore(
    subscribe,
    () => getSnapshotForSlot(input),
    () => false,
  );
}

export function useCanCancelUploadSurface(key: string) {
  return useSyncExternalStore(
    subscribe,
    () => getCancelSnapshotForKey(key),
    () => false,
  );
}

export function useUploadSurfaceLifecycle(key: string) {
  return useSyncExternalStore(
    subscribe,
    () => getLifecycleSnapshotForKey(key),
    () => null,
  );
}
