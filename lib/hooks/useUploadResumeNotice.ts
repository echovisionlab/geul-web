'use client';

import { useEffect, useState } from 'react';
import { TranscodeEntityType } from '@echovisionlab/geul-proto/secure/events_pb.ts';
import { UploadSessionStatus, UploadType } from '@echovisionlab/geul-proto/secure/file_pb.ts';
import { findMultipartUploadCandidateAction } from '@/lib/actions/file';
import {
  buildUploadSurfaceKey,
  useIsUploadSurfaceActive,
  useIsUploadSurfaceSlotActive,
} from '@/lib/hooks/uploadSurfaceActivity';
import {
  getUploadResumeLookupFileId,
  hasUploadResumeAttemptIdentity,
  UploadResumeStateCode,
} from '@/lib/upload/resume-state';
import { findMultipartUploadCandidateShared } from '@/lib/utils/upload-resume-candidate';
import { isResumableMultipartUpload } from '@/lib/utils/upload-runtime';
import { readUploadSession } from '@/lib/upload/upload-session-store';

const RESUME_NOTICE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
export interface UploadResumeNotice {
  uploadId: string;
  fileId: string;
  fileName: string;
  attemptId?: string;
  status: UploadSessionStatus;
}

export interface UploadResumeState {
  code: UploadResumeStateCode;
  resumeNotice: UploadResumeNotice | null;
  hasActiveSession: boolean;
}

interface UploadResumeOptions {
  entityType?: TranscodeEntityType;
  slotId?: string | null | undefined;
  expectedCurrentFileId?: string | null | undefined;
  attemptId?: string | null | undefined;
  fileId?: string | null | undefined;
  pendingFileId?: string | null | undefined;
  hasDurableSource?: boolean;
}

function isFreshUploadSession(lastActivityAt: Date | null) {
  return lastActivityAt != null && Date.now() - lastActivityAt.getTime() < RESUME_NOTICE_MAX_AGE_MS;
}

function isActiveUploadSession(status: UploadSessionStatus) {
  return (
    status === UploadSessionStatus.INITIATED ||
    status === UploadSessionStatus.UPLOADING ||
    status === UploadSessionStatus.FINALIZING
  );
}

export function useUploadResumeState(
  uploadType: UploadType,
  entityId: string | null | undefined,
  options?: UploadResumeOptions,
) {
  const [resumeState, setResumeState] = useState<UploadResumeState>({
    code: UploadResumeStateCode.IDLE,
    resumeNotice: null,
    hasActiveSession: false,
  });
  const lookupFileId = getUploadResumeLookupFileId(options ?? {});
  const hasUploadAttemptIdentity = hasUploadResumeAttemptIdentity(options ?? {});
  const storedSession = lookupFileId ? readUploadSession(lookupFileId) : null;
  const hasBackendLookupIdentity = Boolean(storedSession);
  const surfaceKey = buildUploadSurfaceKey({
    uploadType,
    entityId: entityId || '',
    slotId: options?.slotId,
    attemptId: options?.attemptId,
  });
  const isSurfaceActive = useIsUploadSurfaceActive(surfaceKey);
  const isSlotActive = useIsUploadSurfaceSlotActive({
    uploadType,
    entityId: entityId || '',
    slotId: options?.slotId,
  });

  useEffect(() => {
    if (!entityId) {
      setResumeState({
        code: UploadResumeStateCode.IDLE,
        resumeNotice: null,
        hasActiveSession: false,
      });
      return;
    }

    let active = true;

    const load = async () => {
      if (isSurfaceActive || isSlotActive) {
        if (active) {
          setResumeState({
            code: UploadResumeStateCode.ACTIVE_SURFACE,
            resumeNotice: null,
            hasActiveSession: false,
          });
        }
        return;
      }

      if (!hasBackendLookupIdentity) {
        if (active) {
          setResumeState({
            code:
              hasUploadAttemptIdentity && !options?.hasDurableSource
                ? UploadResumeStateCode.MISSING_SESSION
                : UploadResumeStateCode.IDLE,
            resumeNotice: null,
            hasActiveSession: false,
          });
        }
        return;
      }

      try {
        const candidate = await findMultipartUploadCandidateShared(
          {
            uploadType,
            entityId,
            entityType: options?.entityType,
            slotId: options?.slotId || undefined,
            expectedCurrentFileId: options?.expectedCurrentFileId || undefined,
            fileId: storedSession!.fileId,
            uploadId: storedSession!.uploadId,
          },
          findMultipartUploadCandidateAction,
        );

        if (!active) {
          return;
        }

        const isFinalizing = candidate?.status === UploadSessionStatus.FINALIZING;
        const hasActiveSession = Boolean(
          candidate &&
          isActiveUploadSession(candidate.status) &&
          (isFinalizing ||
            (isFreshUploadSession(candidate.lastActivityAt) &&
              isResumableMultipartUpload({
                fileSize: candidate.fileSize,
                chunkSize: candidate.chunkSize,
                totalParts: candidate.totalParts,
              }))),
        );
        const code = hasActiveSession
          ? UploadResumeStateCode.AVAILABLE
          : hasUploadAttemptIdentity && !options?.hasDurableSource
            ? UploadResumeStateCode.MISSING_SESSION
            : UploadResumeStateCode.IDLE;

        setResumeState({
          code,
          resumeNotice:
            hasActiveSession && candidate
              ? {
                  uploadId: candidate.uploadId,
                  fileId: candidate.fileId,
                  fileName: candidate.fileName,
                  attemptId: candidate.attemptId || undefined,
                  status: candidate.status,
                }
              : null,
          hasActiveSession,
        });
      } catch {
        if (!active) {
          return;
        }

        setResumeState({
          code: UploadResumeStateCode.LOOKUP_ERROR,
          resumeNotice: null,
          hasActiveSession: false,
        });
      }
    };

    void load();

    return () => {
      active = false;
    };
  }, [
    entityId,
    hasBackendLookupIdentity,
    hasUploadAttemptIdentity,
    isSurfaceActive,
    isSlotActive,
    lookupFileId,
    options?.entityType,
    options?.hasDurableSource,
    options?.attemptId,
    options?.expectedCurrentFileId,
    options?.pendingFileId,
    options?.slotId,
    storedSession?.fileId,
    storedSession?.uploadId,
    uploadType,
  ]);

  return resumeState;
}
