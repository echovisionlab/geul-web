import type { FileIngestRuntimeStage } from '@echovisionlab/geul-common/collaboration/runtime-events';

const DEFAULT_UPLOAD_CHUNK_SIZE = 10 * 1024 * 1024;

export type UploadLifecycleStage = FileIngestRuntimeStage | 'validating' | 'finalizing';

interface ResumableMultipartUploadOptions {
  fileSize: number;
  chunkSize?: number | null;
  totalParts?: number | null;
}

export interface UploadResumeCandidateFileMetadata {
  fileSize: number;
  fileName?: string | null;
  mimeType?: string | null;
  fileLastModified?: number | null;
  chunkSize?: number | null;
  totalParts?: number | null;
}

export interface SelectedUploadFileMetadata {
  size: number;
  name: string;
  lastModified: number;
}

export function isResumableMultipartUpload({
  fileSize,
  chunkSize = DEFAULT_UPLOAD_CHUNK_SIZE,
  totalParts,
}: ResumableMultipartUploadOptions): boolean {
  if (typeof totalParts === 'number' && Number.isFinite(totalParts)) {
    return totalParts > 1;
  }

  const normalizedChunkSize =
    typeof chunkSize === 'number' && Number.isFinite(chunkSize) && chunkSize > 0
      ? chunkSize
      : DEFAULT_UPLOAD_CHUNK_SIZE;

  return fileSize > normalizedChunkSize;
}

export function isSameSelectedUploadFileCandidate(
  candidate: UploadResumeCandidateFileMetadata,
  file: SelectedUploadFileMetadata,
  mimeType: string,
): boolean {
  if (candidate.fileSize !== file.size) {
    return false;
  }
  if (candidate.fileName && candidate.fileName !== file.name) {
    return false;
  }
  if (candidate.mimeType && candidate.mimeType !== mimeType) {
    return false;
  }
  if (
    typeof candidate.fileLastModified === 'number' &&
    candidate.fileLastModified > 0 &&
    candidate.fileLastModified !== file.lastModified
  ) {
    return false;
  }
  return true;
}

export function shouldResumeUploadIdentityCandidate(
  candidate: UploadResumeCandidateFileMetadata,
  file: SelectedUploadFileMetadata,
  mimeType: string,
): boolean {
  return (
    isResumableMultipartUpload({
      fileSize: candidate.fileSize,
      chunkSize: candidate.chunkSize,
      totalParts: candidate.totalParts,
    }) && isSameSelectedUploadFileCandidate(candidate, file, mimeType)
  );
}

export function getInitialUploadLifecycleStage(
  _fileSize: number,
  _chunkSize = DEFAULT_UPLOAD_CHUNK_SIZE,
): UploadLifecycleStage {
  return 'uploading';
}

export function getMultipartUploadLifecycleStage(
  _totalParts: number,
  _firstPartCompleted: boolean,
): UploadLifecycleStage {
  return 'uploading';
}
