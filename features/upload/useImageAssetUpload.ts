'use client';

import { useCallback, useState } from 'react';
import type { TranscodeEntityType } from '@echovisionlab/geul-proto/secure/events_pb.ts';
import { notifications } from '@mantine/notifications';
import { useUpload } from '@/lib/hooks/useUpload';
import type { UploadType } from '@/lib/types/upload/model';
import { createClientLogger } from '@/lib/utils/client-logger';

const logger = createClientLogger('ImageAssetUpload');

interface UseImageAssetUploadOptions {
  uploadType: UploadType;
  entityId: string;
  entityType?: TranscodeEntityType;
  fileName: string | (() => string);
  onUploaded: (fileId: string) => unknown | Promise<unknown>;
  uploadFailedMessage: string;
  enabled?: boolean;
  disabledMessage?: string;
}

export function useImageAssetUpload({
  uploadType,
  entityId,
  entityType,
  fileName,
  onUploaded,
  uploadFailedMessage,
  enabled = true,
  disabledMessage = uploadFailedMessage,
}: UseImageAssetUploadOptions) {
  const [uploadProgress, setUploadProgress] = useState(0);
  const { upload, isUploading } = useUpload(uploadType);

  const handleUpload = useCallback(
    async (blob: Blob) => {
      setUploadProgress(0);
      if (!enabled) {
        notifications.show({ message: disabledMessage, color: 'red' });
        return;
      }

      try {
        const { fileId } = await upload(blob, {
          entityId,
          entityType,
          fileName: typeof fileName === 'function' ? fileName() : fileName,
          onProgress: (progress) => setUploadProgress(progress.percentage),
        });
        await onUploaded(fileId);
      } catch (error) {
        logger.error('Upload error', {
          error: error instanceof Error ? error.message : String(error),
        });
        notifications.show({
          message: error instanceof Error ? error.message : uploadFailedMessage,
          color: 'red',
        });
      } finally {
        setUploadProgress(0);
      }
    },
    [disabledMessage, enabled, entityId, entityType, fileName, onUploaded, upload, uploadFailedMessage],
  );

  return { handleUpload, isUploading, uploadProgress };
}
