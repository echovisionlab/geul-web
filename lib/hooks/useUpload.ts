'use client';

import { useCallback } from 'react';
import type { TranscodeEntityType } from '@echovisionlab/geul-proto/secure/events_pb.ts';
import { UploadType } from '@echovisionlab/geul-proto/secure/file_pb.ts';
import { getUploadSelectionMimeTypes, UPLOAD_CONFIGS } from '@/lib/constants/upload-config';
import { getExtensionFromMimeType, toAcceptString } from '@/lib/utils/upload';
import type { UploadLifecycleStage } from '@/lib/utils/upload-runtime';
import { useFileUpload } from './useFileUpload';

interface UploadProgress {
  loaded: number;
  total: number;
  percentage: number;
  stage?: UploadLifecycleStage;
}

interface UploadOptions {
  entityId?: string;
  entityType?: TranscodeEntityType;
  slotId?: string;
  fileName?: string;
  onProgress?: (progress: UploadProgress) => void;
  concurrency?: number;
}

interface UploadResult {
  url: string;
  fileId: string;
}

function canonicalBlobFileName(fileName: string | undefined, extension: string): string {
  const fallbackName = `upload.${extension}`;
  const trimmedName = fileName?.trim();
  if (!trimmedName) {
    return fallbackName;
  }

  const expectedSuffix = `.${extension}`;
  if (trimmedName.toLowerCase().endsWith(expectedSuffix.toLowerCase())) {
    return trimmedName;
  }

  const extensionIndex = trimmedName.lastIndexOf('.');
  const baseName = extensionIndex > 0 ? trimmedName.slice(0, extensionIndex) : trimmedName;
  return `${baseName}.${extension}`;
}

/**
 * Unified upload hook that combines validation, constraints, and file upload.
 *
 * @param uploadType - The type of upload (e.g., 'userAvatar', 'artistImage')
 *
 * @example
 * ```tsx
 * function AvatarUploader({ memberId }) {
 *   const { upload, isUploading, config, acceptString } = useUpload('userAvatar');
 *
 *   const handleSelect = async (blob: Blob) => {
 *     try {
 *       const { url } = await upload(blob, { entityId: memberId });
 *       onSuccess(url);
 *     } catch (error) {
 *       showError(error.message);
 *     }
 *   };
 *
 *   return (
 *     <input
 *       type="file"
 *       accept={acceptString}
 *       onChange={(e) => handleSelect(e.target.files[0])}
 *       disabled={isUploading}
 *     />
 *   );
 * }
 * ```
 */
export function useUpload(uploadType: UploadType) {
  const config = UPLOAD_CONFIGS[uploadType];
  const {
    upload: multipartUpload,
    abort,
    downloadFromUrl: downloadFromUrlInternal,
    isUploading,
    isDownloading,
  } = useFileUpload();

  /**
   * Upload a Blob with automatic validation against constraints.
   */
  const upload = useCallback(
    async (blob: Blob, options: UploadOptions): Promise<UploadResult> => {
      const ext = getExtensionFromMimeType(blob.type);
      const fileName = canonicalBlobFileName(options.fileName, ext);
      const file = new File([blob], fileName, { type: blob.type });

      return multipartUpload(file, {
        uploadType,
        entityId: options.entityId,
        entityType: options.entityType,
        slotId: options.slotId,
        onProgress: options.onProgress,
        concurrency: options.concurrency,
      });
    },
    [uploadType, multipartUpload],
  );

  /**
   * Upload a File directly with validation.
   */
  const uploadFile = useCallback(
    async (file: File, options: Omit<UploadOptions, 'fileName'>): Promise<UploadResult> => {
      return multipartUpload(file, {
        uploadType,
        entityId: options.entityId,
        entityType: options.entityType,
        slotId: options.slotId,
        onProgress: options.onProgress,
        concurrency: options.concurrency,
      });
    },
    [uploadType, multipartUpload],
  );

  /**
   * Download a file from URL and save it (server-side download).
   */
  const downloadFromUrl = useCallback(
    async (entityId: string, url: string): Promise<UploadResult> => {
      return downloadFromUrlInternal(uploadType, entityId, url);
    },
    [downloadFromUrlInternal, uploadType],
  );

  return {
    /** Upload a Blob with automatic validation */
    upload,
    /** Upload a File directly with validation */
    uploadFile,
    /** Download from URL (server-side) */
    downloadFromUrl,
    /** Abort current upload */
    abort,
    /** Whether upload is in progress */
    isUploading,
    /** Whether URL download is in progress */
    isDownloading,
    /** Upload config for this type */
    config,
    /** HTML accept attribute string for file inputs */
    acceptString: toAcceptString(getUploadSelectionMimeTypes(uploadType)),
  };
}
