import type { UploadType } from '@echovisionlab/geul-proto/secure/file_pb.ts';
import { uploadDirectPartWithRetry, uploadRelayedPartWithRetry, verifyUploadPrefix } from './multipart-transport';
import { usesDirectS3MultipartTransport } from './transport-policy';
import { createUploadError } from './upload-errors';
import { UPLOAD_ABORTED_MESSAGE } from './failure';
import { getMultipartUploadLifecycleStage, type UploadLifecycleStage } from '@/lib/utils/upload-runtime';

export interface MultipartSessionProgress {
  loadedBytes: number;
  percentage: number;
  stage: UploadLifecycleStage;
}

interface MultipartSessionOptions {
  uploadType: UploadType;
  file: File;
  fileId: string;
  uploadId: string;
  chunkSize: number;
  totalParts: number;
  uploadedParts: ReadonlyArray<{ partNumber: number; etag: string }>;
  correlationId: string;
  concurrency: number;
  isAborted: () => boolean;
  registerAborter: (aborter: () => void) => () => void;
  onProgress: (progress: MultipartSessionProgress) => void;
}

export async function runMultipartUploadSession({
  uploadType,
  file,
  fileId,
  uploadId,
  chunkSize,
  totalParts,
  uploadedParts,
  correlationId,
  concurrency,
  isAborted,
  registerAborter,
  onProgress,
}: MultipartSessionOptions): Promise<void> {
  const usesDirectS3 = usesDirectS3MultipartTransport(uploadType);
  const uploadedPartMap = new Map(uploadedParts.map((part) => [part.partNumber, part.etag]));
  const partLoadedBytes = new Map<number, number>();

  const getPartSize = (partNumber: number) => {
    const start = (partNumber - 1) * chunkSize;
    const end = Math.min(start + chunkSize, file.size);
    return Math.max(end - start, 0);
  };

  for (const partNumber of uploadedPartMap.keys()) {
    partLoadedBytes.set(partNumber, getPartSize(partNumber));
  }

  const emitProgress = () => {
    const loadedBytes = Array.from(partLoadedBytes.values()).reduce((sum, loaded) => sum + loaded, 0);
    onProgress({
      loadedBytes,
      percentage: Math.round((loadedBytes / file.size) * 100),
      stage: getMultipartUploadLifecycleStage(totalParts, uploadedPartMap.has(1)),
    });
  };

  const uploadPart = async (partNumber: number) => {
    if (isAborted()) {
      throw createUploadError(UPLOAD_ABORTED_MESSAGE);
    }

    const start = (partNumber - 1) * chunkSize;
    const end = Math.min(start + chunkSize, file.size);
    const chunk = file.slice(start, end);

    partLoadedBytes.set(partNumber, partLoadedBytes.get(partNumber) ?? 0);
    emitProgress();

    const uploadPartWithRetry = usesDirectS3 ? uploadDirectPartWithRetry : uploadRelayedPartWithRetry;
    const etag = await uploadPartWithRetry({
      fileId,
      uploadId,
      partNumber,
      correlationId,
      chunk,
      isAborted,
      onProgress: (loaded) => {
        partLoadedBytes.set(partNumber, Math.max(partLoadedBytes.get(partNumber) ?? 0, loaded));
        emitProgress();
      },
      registerAborter,
    });

    uploadedPartMap.set(partNumber, etag);
    partLoadedBytes.set(partNumber, chunk.size);
    emitProgress();
  };

  emitProgress();

  const missingParts = Array.from({ length: totalParts }, (_, index) => index + 1).filter(
    (partNumber) => !uploadedPartMap.has(partNumber),
  );

  if (missingParts[0] === 1) {
    if (usesDirectS3) {
      await verifyUploadPrefix({
        fileId,
        uploadId,
        correlationId,
        prefix: file.slice(0, Math.min(file.size, 64 * 1024)),
        registerAborter,
      });
    }
    await uploadPart(1);
  }

  const remainingParts = missingParts.filter((partNumber) => partNumber !== 1);
  for (let index = 0; index < remainingParts.length; index += concurrency) {
    await Promise.all(remainingParts.slice(index, index + concurrency).map(uploadPart));
  }
}
