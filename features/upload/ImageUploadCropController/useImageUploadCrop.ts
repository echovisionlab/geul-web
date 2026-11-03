import { useCallback, useEffect, useRef, useState, type ChangeEvent } from 'react';
import { UploadType } from '@echovisionlab/geul-proto/secure/file_pb.ts';
import { useDisclosure } from '@mantine/hooks';
import { notifications } from '@/components/core/Notification';
import { prepareImageFileForPreview } from '@/lib/utils/upload-pipeline';

export interface UseImageUploadCropOptions {
  onUpload: (blob: Blob) => void;
  uploadType?: UploadType;
  enabled?: boolean;
  targetKey?: unknown;
}

/**
 * Owns browser-side image preprocessing and crop-session state for upload controllers.
 */
export function useImageUploadCrop({
  onUpload,
  uploadType = UploadType.FEATURED_IMAGE,
  enabled = true,
  targetKey,
}: UseImageUploadCropOptions) {
  const [isPreparing, setIsPreparing] = useState(false);
  const preparingRef = useRef(false);
  const generation = useRef(0);
  const [tempImageSrc, setTempImageSrc] = useState<string | null>(null);
  const [cropModalOpened, { open: openCropModal, close: closeCropModal }] = useDisclosure(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    generation.current += 1;
    preparingRef.current = false;
    setIsPreparing(false);
    setTempImageSrc(null);
    closeCropModal();
    return () => {
      generation.current += 1;
    };
  }, [uploadType, enabled, targetKey, closeCropModal]);

  const handleFiles = useCallback(
    async (files: File[]) => {
      const file = files[0];
      if (!enabled || !file || preparingRef.current) {
        return;
      }

      const request = generation.current;
      preparingRef.current = true;
      setIsPreparing(true);
      try {
        const previewFile = await prepareImageFileForPreview(file, uploadType);
        if (request !== generation.current) {
          return;
        }
        const preview = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => {
            if (typeof reader.result === 'string') {
              resolve(reader.result);
            } else {
              reject(new Error('Failed to read image preview.'));
            }
          };
          reader.onerror = () => reject(new Error('Failed to read image preview.'));
          reader.readAsDataURL(previewFile);
        });
        if (request !== generation.current) {
          return;
        }
        setTempImageSrc(preview);
        openCropModal();
      } catch (error) {
        if (request !== generation.current) {
          return;
        }
        notifications.show({
          message: error instanceof Error ? error.message : 'Failed to prepare image.',
          tone: 'danger',
        });
      } finally {
        if (request === generation.current) {
          preparingRef.current = false;
          setIsPreparing(false);
        }
      }
    },
    [enabled, openCropModal, uploadType],
  );

  const handleFileDrop = useCallback(
    (files: File[]) => {
      void handleFiles(files);
    },
    [handleFiles],
  );

  const handleFileSelect = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      void handleFiles(Array.from(event.currentTarget.files ?? []));
      event.currentTarget.value = '';
    },
    [handleFiles],
  );

  const handleCropComplete = useCallback(
    (blob: Blob) => {
      onUpload(blob);
      closeCropModal();
      setTempImageSrc(null);
    },
    [onUpload, closeCropModal],
  );

  const handleCropCancel = useCallback(() => {
    generation.current += 1;
    preparingRef.current = false;
    setIsPreparing(false);
    closeCropModal();
    setTempImageSrc(null);
  }, [closeCropModal]);

  const handleChange = useCallback(() => {
    inputRef.current?.click();
  }, []);

  return {
    isPreparing,
    tempImageSrc,
    cropModalOpened,
    inputRef,
    handleFileDrop,
    handleFileSelect,
    handleCropComplete,
    handleCropCancel,
    handleChange,
  };
}
