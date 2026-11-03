'use client';

import { useEffect, useMemo, useState } from 'react';
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
): UploadResumeState {
  const lookupFileId = getUploadResumeLookupFileId(options ?? {});
  const hasUploadAttemptIdentity = hasUploadResumeAttemptIdentity(options ?? {});
  const storedSession = lookupFileId ? readUploadSession(lookupFileId) : null;
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
  const lookup = useMemo(
    () => ({
      uploadType,
      entityId,
      entityType: options?.entityType,
      slotId: options?.slotId,
      expectedCurrentFileId: options?.expectedCurrentFileId,
      attemptId: options?.attemptId,
      pendingFileId: options?.pendingFileId,
      lookupFileId,
      fileId: storedSession?.fileId,
      uploadId: storedSession?.uploadId,
      hasUploadAttemptIdentity,
      hasDurableSource: options?.hasDurableSource,
      isActive: isSurfaceActive || isSlotActive,
    }),
    [
      uploadType,
      entityId,
      options?.entityType,
      options?.slotId,
      options?.expectedCurrentFileId,
      options?.attemptId,
      options?.pendingFileId,
      lookupFileId,
      storedSession?.fileId,
      storedSession?.uploadId,
      hasUploadAttemptIdentity,
      options?.hasDurableSource,
      isSurfaceActive,
      isSlotActive,
    ],
  );
  const initialCode = !lookup.entityId
    ? UploadResumeStateCode.IDLE
    : lookup.isActive
      ? UploadResumeStateCode.ACTIVE_SURFACE
      : lookup.fileId && lookup.uploadId
        ? UploadResumeStateCode.LOOKUP_PENDING
        : lookup.hasUploadAttemptIdentity && !lookup.hasDurableSource
          ? UploadResumeStateCode.MISSING_SESSION
          : UploadResumeStateCode.IDLE;
  const [result, setResult] = useState<{ lookup: typeof lookup; state: UploadResumeState } | null>(null);

  useEffect(() => {
    if (
      initialCode !== UploadResumeStateCode.LOOKUP_PENDING ||
      !lookup.entityId ||
      !lookup.fileId ||
      !lookup.uploadId
    ) {
      return;
    }

    let active = true;
    const input = {
      uploadType: lookup.uploadType,
      entityId: lookup.entityId,
      entityType: lookup.entityType,
      slotId: lookup.slotId || undefined,
      expectedCurrentFileId: lookup.expectedCurrentFileId || undefined,
      fileId: lookup.fileId,
      uploadId: lookup.uploadId,
    };
    const setResumeState = (state: UploadResumeState) => setResult({ lookup, state });

    const load = async () => {
      try {
        const candidate = await findMultipartUploadCandidateShared(input, findMultipartUploadCandidateAction);

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
          : lookup.hasUploadAttemptIdentity && !lookup.hasDurableSource
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
  }, [initialCode, lookup]);

  return result?.lookup === lookup ? result.state : { code: initialCode, resumeNotice: null, hasActiveSession: false };
}
