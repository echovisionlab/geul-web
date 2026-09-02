import { useCallback, useRef, useState, type ChangeEvent } from 'react';
import { UploadType } from '@echovisionlab/geul-proto/secure/file_pb.ts';
import { useDisclosure } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import { prepareImageFileForPreview } from '@/lib/utils/upload-pipeline';

export interface UseImageUploadCropOptions {
  onUpload: (blob: Blob) => void;
  uploadType?: UploadType;
}

/**
 * Owns browser-side image preprocessing and crop-session state for upload controllers.
 */
export function useImageUploadCrop({ onUpload, uploadType = UploadType.FEATURED_IMAGE }: UseImageUploadCropOptions) {
  const [tempImageSrc, setTempImageSrc] = useState<string | null>(null);
  const [cropModalOpened, { open: openCropModal, close: closeCropModal }] = useDisclosure(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const handleFiles = useCallback(
    async (files: File[]) => {
      const file = files[0];
      if (!file) {
        return;
      }

      let previewFile: File;
      try {
        previewFile = await prepareImageFileForPreview(file, uploadType);
      } catch (error) {
        notifications.show({
          message: error instanceof Error ? error.message : 'Failed to prepare image.',
          color: 'red',
        });
        return;
      }

      const reader = new FileReader();
      reader.onload = (e) => {
        setTempImageSrc(e.target?.result as string);
        openCropModal();
      };
      reader.readAsDataURL(previewFile);
    },
    [openCropModal, uploadType],
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
    closeCropModal();
    setTempImageSrc(null);
  }, [closeCropModal]);

  const handleChange = useCallback(() => {
    inputRef.current?.click();
  }, []);

  return {
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
