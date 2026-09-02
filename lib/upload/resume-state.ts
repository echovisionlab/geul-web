export const UploadResumeStateCode = {
  IDLE: 'U-RESUME-IDLE',
  ACTIVE_SURFACE: 'U-RESUME-ACTIVE-SURFACE',
  AVAILABLE: 'U-RESUME-AVAILABLE',
  MISSING_SESSION: 'U-RESUME-MISSING-SESSION',
  LOOKUP_ERROR: 'U-RESUME-LOOKUP-ERROR',
} as const;

export type UploadResumeStateCode = (typeof UploadResumeStateCode)[keyof typeof UploadResumeStateCode];

export interface UploadResumeIdentity {
  slotId?: string | null | undefined;
  attemptId?: string | null | undefined;
  fileId?: string | null | undefined;
  pendingFileId?: string | null | undefined;
  allowEntityLookup?: boolean | null | undefined;
}

export function getUploadResumeLookupFileId(identity: UploadResumeIdentity): string | undefined {
  return identity.pendingFileId || identity.fileId || undefined;
}

export function hasUploadResumeAttemptIdentity(identity: UploadResumeIdentity): boolean {
  return Boolean(identity.pendingFileId || identity.attemptId);
}

export function hasUploadResumeBackendLookupIdentity(identity: UploadResumeIdentity): boolean {
  if (identity.allowEntityLookup) {
    return true;
  }

  if (getUploadResumeLookupFileId(identity)) {
    return true;
  }

  return Boolean(identity.slotId);
}
