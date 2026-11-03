'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { TranscodeEntityType } from '@echovisionlab/geul-proto/secure/events_pb.ts';
import { notifications } from '@/components/core/Notification';
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
  const { upload } = useUpload(uploadType);
  const [isUploading, setIsUploading] = useState(false);
  const generation = useRef(0);
  const active = useRef(false);
  const mounted = useRef(false);
  useEffect(() => {
    mounted.current = true;
    generation.current += 1;
    // Target changes invalidate callbacks, but the shared transport remains owned until settlement.
    setIsUploading(active.current);
    setUploadProgress(0);
    return () => {
      mounted.current = false;
      generation.current += 1;
    };
  }, [entityId, entityType, uploadType, enabled]);

  const handleUpload = useCallback(
    async (blob: Blob) => {
      if (active.current) {
        return;
      }
      if (!enabled) {
        notifications.show({ message: disabledMessage, tone: 'danger' });
        return;
      }

      const request = generation.current;
      active.current = true;
      setIsUploading(true);
      setUploadProgress(0);
      try {
        const { fileId } = await upload(blob, {
          entityId,
          entityType,
          fileName: typeof fileName === 'function' ? fileName() : fileName,
          onProgress: (progress) => {
            if (generation.current === request) {
              setUploadProgress(progress.percentage);
            }
          },
        });
        if (generation.current !== request) {
          return;
        }
        await onUploaded(fileId);
      } catch (error) {
        if (generation.current !== request) {
          return;
        }
        logger.error('Upload error', {
          error: error instanceof Error ? error.message : String(error),
        });
        notifications.show({
          message: error instanceof Error ? error.message : uploadFailedMessage,
          tone: 'danger',
        });
      } finally {
        active.current = false;
        if (mounted.current) {
          setIsUploading(false);
          setUploadProgress(0);
        }
      }
    },
    [disabledMessage, enabled, entityId, entityType, fileName, onUploaded, upload, uploadFailedMessage],
  );

  return { handleUpload, isUploading, uploadProgress };
}
