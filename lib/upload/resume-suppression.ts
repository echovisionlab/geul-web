export interface UploadResumeSuppressionIdentity {
  attemptId?: string | null;
  fileId?: string | null;
}

export interface UploadResumeCandidateIdentity {
  attemptId?: string | null;
  fileId?: string | null;
}

export function isUploadResumeSuppressed(
  candidate: UploadResumeCandidateIdentity | null | undefined,
  suppression: UploadResumeSuppressionIdentity | null | undefined,
): boolean {
  if (!candidate || !suppression) {
    return false;
  }

  return Boolean(
    (suppression.attemptId && candidate.attemptId === suppression.attemptId) ||
    (suppression.fileId && candidate.fileId === suppression.fileId),
  );
}
