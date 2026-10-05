'use client';

import { useCallback, useRef, useState } from 'react';
import type { RuntimeEntityType } from '@echovisionlab/geul-common/collaboration/runtime-events';
import { TranscodeEntityType } from '@echovisionlab/geul-proto/secure/events_pb.ts';
import type { UploadType } from '@echovisionlab/geul-proto/secure/file_pb.ts';
import type { HocuspocusProvider } from '@hocuspocus/provider';
import { useMutation } from '@tanstack/react-query';
import { Code } from '@connectrpc/connect';
import type { ActionResult } from '@/lib/actions/action-result';
import { CLIENT_MEDIA_ARTIFACTS_MISSING } from '@/lib/upload/upload-errors';
import {
  abortUploadAction,
  completeUploadAction,
  completeClientMediaUploadAction,
  recoverCompletedClientMediaUploadAction,
  findMultipartUploadCandidateAction,
  initiateUploadAction,
  prepareClientMediaUploadAction,
  recoverCompletedUploadAction,
} from '../actions/file.ts';
import { useOptionalEditorRuntimeContext } from '@/lib/contexts/EditorRuntimeContext';
import {
  UploadPausedError,
  type DownloadFromUrlOptions,
  type UploadOptions,
  type UploadResult,
} from '@/lib/upload/file-upload-contract';
import { UPLOAD_ABORTED_MESSAGE } from '@/lib/upload/failure';
import { useUploadLifecycleTracker } from './useUploadLifecycleTracker';

export type {
  DownloadFromUrlOptions,
  FileIngestLifecycleUpdate,
  UploadOptions,
  UploadProgress,
  UploadResult,
} from '@/lib/upload/file-upload-contract';

export { UploadPausedError } from '@/lib/upload/file-upload-contract';

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

function unwrapClientMediaCompletion(result: ActionResult<{ url: string; fileId: string }>): {
  url: string;
  fileId: string;
} {
  if (result.ok) {
    return { url: result.url, fileId: result.fileId };
  }
  if (result.error === CLIENT_MEDIA_ARTIFACTS_MISSING) {
    throw new Error(CLIENT_MEDIA_ARTIFACTS_MISSING);
  }
  if (result.errorCode === Code.Unauthenticated) {
    throw new Error('Unauthorized');
  }
  if (result.errorCode === Code.PermissionDenied) {
    throw new Error('Forbidden');
  }
  if (
    [Code.InvalidArgument, Code.NotFound, Code.FailedPrecondition, Code.DataLoss].includes(result.errorCode as Code)
  ) {
    throw new Error('Upload failed');
  }
  throw new Error(result.error);
}

export function useFileUpload(options?: UseFileUploadOptions) {
  const abortedRef = useRef(false);
  const pausedRef = useRef(false);
  const partAbortersRef = useRef<Set<() => void>>(new Set());
  const [isDirectUploading, setIsDirectUploading] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
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
    pausedRef.current = false;
    abortedRef.current = true;
    partAbortersRef.current.forEach((abortPart) => abortPart());
  }, []);

  const pauseUpload = useCallback(() => {
    pausedRef.current = true;
    abortedRef.current = true;
    partAbortersRef.current.forEach((abortPart) => abortPart());
  }, []);

  const initiateMutation = useMutation({ mutationFn: initiateUploadAction });
  const completeMutation = useMutation({ mutationFn: completeUploadAction });
  const abortMutation = useMutation({ mutationFn: abortUploadAction });

  const upload = useCallback(
    async (file: File, uploadOptions: UploadOptions): Promise<UploadResult> => {
      abortedRef.current = false;
      pausedRef.current = false;
      setIsDirectUploading(true);
      let runDirectFileUpload: typeof import('@/lib/upload/direct-upload-runner').runDirectFileUpload;
      try {
        ({ runDirectFileUpload } = await import('@/lib/upload/direct-upload-runner'));
        if (abortedRef.current) {
          throw pausedRef.current ? new UploadPausedError() : new Error(UPLOAD_ABORTED_MESSAGE);
        }
      } catch (error) {
        setIsDirectUploading(false);
        throw error;
      }
      return runDirectFileUpload(file, uploadOptions, {
        canTrackServerLifecycle: lifecycle.canTrack,
        lifecycleTrackers: lifecycle.trackers,
        isAborted: () => abortedRef.current,
        isPaused: () => pausedRef.current,
        resetAborted: () => {
          abortedRef.current = false;
          pausedRef.current = false;
        },
        abortActiveUpload,
        registerPartAborter,
        clearPartAborters: () => partAbortersRef.current.clear(),
        setUploading: setIsDirectUploading,
        initiate: initiateMutation.mutateAsync,
        complete: async (input) =>
          input.clientMediaBundleId
            ? unwrapClientMediaCompletion(
                await completeClientMediaUploadAction({ ...input, clientMediaBundleId: input.clientMediaBundleId }),
              )
            : completeMutation.mutateAsync(input),
        prepareBundle: prepareClientMediaUploadAction,
        abort: abortMutation.mutateAsync,
        findCandidate: findMultipartUploadCandidateAction,
        recoverCompleted: async (input) =>
          input.clientMediaBundleId
            ? unwrapClientMediaCompletion(
                await recoverCompletedClientMediaUploadAction({
                  ...input,
                  clientMediaBundleId: input.clientMediaBundleId,
                }),
              )
            : recoverCompletedUploadAction(input),
      });
    },
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
    async (
      uploadType: UploadType,
      entityId: string,
      url: string,
      entityType?: TranscodeEntityType,
      downloadOptions?: DownloadFromUrlOptions,
    ): Promise<UploadResult> => {
      abortedRef.current = false;
      pausedRef.current = false;
      setIsDownloading(true);
      try {
        const { runRemoteFileImport } = await import('@/lib/upload/remote-import-runner');
        if (abortedRef.current) {
          throw pausedRef.current ? new UploadPausedError() : new Error(UPLOAD_ABORTED_MESSAGE);
        }
        return await runRemoteFileImport(uploadType, entityId, url, entityType, downloadOptions, {
          upload,
          isAborted: () => abortedRef.current,
          isPaused: () => pausedRef.current,
          abortActiveUpload,
          registerPartAborter,
        });
      } finally {
        setIsDownloading(false);
      }
    },
    [upload, abortActiveUpload, registerPartAborter],
  );

  return {
    upload,
    abort: abortActiveUpload,
    pauseUpload,
    downloadFromUrl,
    isUploading: initiateMutation.isPending || isDirectUploading || isDownloading || completeMutation.isPending,
    isDownloading,
  };
}
