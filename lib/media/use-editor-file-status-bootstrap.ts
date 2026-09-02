'use client';

import { useEffect, useEffectEvent, useState } from 'react';
import { getFileStatusesAction } from '@/lib/actions/file';
import type { EditorFileStatusSnapshot } from './editor-file-status-runtime';

interface PendingFileStatusRequest {
  resolve: (status: EditorFileStatusSnapshot) => void;
  reject: (error: unknown) => void;
}

const pendingFileStatusRequests = new Map<string, PendingFileStatusRequest[]>();
let fileStatusFlushScheduled = false;

export function getEditorFileStatus(fileId: string): Promise<EditorFileStatusSnapshot> {
  const normalizedFileId = fileId.trim();
  if (!normalizedFileId) {
    return Promise.reject(new Error('fileId is required'));
  }

  const statusPromise = new Promise<EditorFileStatusSnapshot>((resolve, reject) => {
    const requests = pendingFileStatusRequests.get(normalizedFileId) ?? [];
    requests.push({ resolve, reject });
    pendingFileStatusRequests.set(normalizedFileId, requests);
  });

  if (!fileStatusFlushScheduled) {
    fileStatusFlushScheduled = true;
    setTimeout(() => {
      fileStatusFlushScheduled = false;
      const pendingRequests = new Map(pendingFileStatusRequests);
      pendingFileStatusRequests.clear();
      const fileIds = Array.from(pendingRequests.keys());

      void getFileStatusesAction(fileIds)
        .then((statuses) => {
          for (const [pendingFileId, requests] of pendingRequests) {
            const status = statuses[pendingFileId];
            if (!status) {
              const error = new Error(`Missing file status response for ${pendingFileId}`);
              requests.forEach((request) => request.reject(error));
              continue;
            }
            requests.forEach((request) => request.resolve(status));
          }
        })
        .catch((error) => {
          for (const requests of pendingRequests.values()) {
            requests.forEach((request) => request.reject(error));
          }
        });
    }, 0);
  }

  return statusPromise;
}

interface UseEditorFileStatusBootstrapOptions<T> {
  fileId?: string;
  enabled?: boolean;
  mapStatus: (status: EditorFileStatusSnapshot) => T | null;
}

interface EditorFileStatusBootstrapState<T> {
  value: T | null;
  isLoading: boolean;
}

export function useEditorFileStatusBootstrap<T>({
  fileId,
  enabled = true,
  mapStatus,
}: UseEditorFileStatusBootstrapOptions<T>): EditorFileStatusBootstrapState<T> {
  const normalizedFileId = fileId?.trim() || '';
  const requestKey = enabled ? normalizedFileId : '';
  const [state, setState] = useState<{
    requestKey: string;
    value: T | null;
    isLoading: boolean;
  }>(() => ({ requestKey, value: null, isLoading: Boolean(requestKey) }));
  const handleStatus = useEffectEvent((status: EditorFileStatusSnapshot) => mapStatus(status));

  useEffect(() => {
    if (!requestKey) {
      setState({ requestKey: '', value: null, isLoading: false });
      return;
    }

    let cancelled = false;
    setState({ requestKey, value: null, isLoading: true });

    void getEditorFileStatus(requestKey)
      .then((status) => {
        if (cancelled) {
          return;
        }
        setState({ requestKey, value: handleStatus(status), isLoading: false });
      })
      .catch(() => {
        if (!cancelled) {
          setState({ requestKey, value: null, isLoading: false });
        }
        // Editor blocks fall back to persisted/collab-projected props on bootstrap failure.
      });

    return () => {
      cancelled = true;
    };
  }, [requestKey]);

  if (state.requestKey !== requestKey) {
    return { value: null, isLoading: Boolean(requestKey) };
  }

  return {
    value: state.value,
    isLoading: state.isLoading,
  };
}
