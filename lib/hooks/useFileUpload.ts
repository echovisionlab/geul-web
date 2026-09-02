'use client';

import { useCallback, useRef, useState } from 'react';
import type { RuntimeEntityType } from '@echovisionlab/geul-common/collaboration/runtime-events';
import { TranscodeEntityType } from '@echovisionlab/geul-proto/secure/events_pb.ts';
import type { UploadType } from '@echovisionlab/geul-proto/secure/file_pb.ts';
import type { HocuspocusProvider } from '@hocuspocus/provider';
import { useMutation } from '@tanstack/react-query';
import {
  abortUploadAction,
  completeUploadAction,
  downloadFromUrlAction,
  findMultipartUploadCandidateAction,
  initiateUploadAction,
  recoverCompletedUploadAction,
} from '../actions/file.ts';
import { useOptionalEditorRuntimeContext } from '@/lib/contexts/EditorRuntimeContext';
import { runDirectFileUpload } from '@/lib/upload/direct-upload-runner';
import type { DownloadFromUrlOptions, UploadOptions, UploadResult } from '@/lib/upload/file-upload-contract';
import { runRemoteFileImport } from '@/lib/upload/remote-import-runner';
import { useUploadLifecycleTracker } from './useUploadLifecycleTracker';

export type {
  DownloadFromUrlOptions,
  FileIngestLifecycleUpdate,
  UploadOptions,
  UploadProgress,
  UploadResult,
} from '@/lib/upload/file-upload-contract';

export {
  UPLOAD_ABORTED_MESSAGE,
  UPLOAD_FINALIZATION_FAILED_MESSAGE,
  UPLOAD_FAILED_MESSAGE,
  UPLOAD_INTERRUPTED_MESSAGE,
} from '@/lib/upload/failure';

interface UseFileUploadOptions {
  provider?: HocuspocusProvider | null;
  entityType?: RuntimeEntityType | TranscodeEntityType;
  entityId?: string;
}

function normalizeRuntimeEntityType(
  entityType: RuntimeEntityType | TranscodeEntityType | undefined,
): RuntimeEntityType | undefined {
  if (entityType == null || typeof entityType === 'string') {
    return entityType;
  }

  switch (entityType) {
    case TranscodeEntityType.POST:
      return 'post';
    case TranscodeEntityType.PAGE:
      return 'page';
    case TranscodeEntityType.WORK:
      return 'work';
    case TranscodeEntityType.PROGRAM_EVENT:
      return 'program_event';
    default:
      return undefined;
  }
}

export function useFileUpload(options?: UseFileUploadOptions) {
  const abortedRef = useRef(false);
  const partAbortersRef = useRef<Set<() => void>>(new Set());
  const [isDirectUploading, setIsDirectUploading] = useState(false);
  const runtimeContext = useOptionalEditorRuntimeContext();
  const provider = options?.provider ?? null;
  const runtimeEntityType = normalizeRuntimeEntityType(options?.entityType ?? runtimeContext?.entityType);
  const runtimeEntityId = options?.entityId ?? runtimeContext?.entityId;
  const lifecycle = useUploadLifecycleTracker({
    provider,
    entityType: runtimeEntityType,
    entityId: runtimeEntityId,
    enabled: Boolean(provider || runtimeContext),
  });

  const registerPartAborter = useCallback((aborter: () => void) => {
    partAbortersRef.current.add(aborter);
    if (abortedRef.current) {
      aborter();
    }
    return () => {
      partAbortersRef.current.delete(aborter);
    };
  }, []);

  const abortActiveUpload = useCallback(() => {
    abortedRef.current = true;
    partAbortersRef.current.forEach((abortPart) => abortPart());
  }, []);

  const initiateMutation = useMutation({ mutationFn: initiateUploadAction });
  const completeMutation = useMutation({ mutationFn: completeUploadAction });
  const abortMutation = useMutation({ mutationFn: abortUploadAction });
  const downloadMutation = useMutation({ mutationFn: downloadFromUrlAction });

  const upload = useCallback(
    (file: File, uploadOptions: UploadOptions): Promise<UploadResult> =>
      runDirectFileUpload(file, uploadOptions, {
        canTrackServerLifecycle: lifecycle.canTrack,
        lifecycleTrackers: lifecycle.trackers,
        isAborted: () => abortedRef.current,
        resetAborted: () => {
          abortedRef.current = false;
        },
        abortActiveUpload,
        registerPartAborter,
        clearPartAborters: () => partAbortersRef.current.clear(),
        setUploading: setIsDirectUploading,
        initiate: initiateMutation.mutateAsync,
        complete: completeMutation.mutateAsync,
        abort: abortMutation.mutateAsync,
        findCandidate: findMultipartUploadCandidateAction,
        recoverCompleted: recoverCompletedUploadAction,
      }),
    [
      abortActiveUpload,
      abortMutation.mutateAsync,
      completeMutation.mutateAsync,
      initiateMutation.mutateAsync,
      lifecycle.canTrack,
      lifecycle.trackers,
      registerPartAborter,
    ],
  );

  const downloadFromUrl = useCallback(
    (
      uploadType: UploadType,
      entityId: string,
      url: string,
      entityType?: TranscodeEntityType,
      downloadOptions?: DownloadFromUrlOptions,
    ): Promise<UploadResult> =>
      runRemoteFileImport(uploadType, entityId, url, entityType, downloadOptions, {
        canTrackServerLifecycle: lifecycle.canTrack,
        lifecycleTrackers: lifecycle.trackers,
        download: downloadMutation.mutateAsync,
      }),
    [downloadMutation.mutateAsync, lifecycle.canTrack, lifecycle.trackers],
  );

  return {
    upload,
    abort: abortActiveUpload,
    downloadFromUrl,
    isUploading: initiateMutation.isPending || isDirectUploading || completeMutation.isPending,
    isDownloading: downloadMutation.isPending,
  };
}
