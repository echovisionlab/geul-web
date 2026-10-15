'use client';

import type { CSSProperties } from 'react';
import { UploadType } from '@echovisionlab/geul-proto/secure/file_pb.ts';
import { useTranslations } from 'next-intl';
import { notifications } from '@/components/core/Notification';
import type { AspectRatioConfig } from '@/components/core/ImageCropper';
import { ImageUploadCropField, type ImageUploadRejection } from '@/components/core/ImageUpload';
import { getUploadSelectionMimeTypes, UPLOAD_CONFIGS } from '@/lib/constants/upload-config';
import { imageSelectionAcceptTypes } from '@/lib/utils/upload';
import { getUploadSelectionMaxSize } from '@/lib/utils/upload-policy';
import { useImageUploadCrop } from './useImageUploadCrop';
import { useImageCropAccessibility } from '@/lib/i18n/useImageCropAccessibility';
import { OG_IMAGE_ASPECT_RATIO } from '@/lib/constants/og-image';

export interface ImageUploadCropControllerProps {
  imageUrl: string | null;
  idPrefix?: string;
  canEdit: boolean;
  isUploading: boolean;
  uploadProgress: number;
  isRemoving: boolean;
  onUpload: (blob: Blob) => void;
  onRemove: () => void;
  aspectRatio?: AspectRatioConfig;
  sizes?: string;
  previewWidth?: CSSProperties['width'];
  previewMaxWidth?: CSSProperties['maxWidth'];
  previewMinHeight?: CSSProperties['minHeight'];
  label?: string;
  acceptMimeTypes?: readonly string[];
  maxSize?: number;
  uploadType?: UploadType;
}

export function ImageUploadCropController({
  imageUrl,
  idPrefix,
  canEdit,
  isUploading,
  uploadProgress,
  isRemoving,
  onUpload,
  onRemove,
  aspectRatio = OG_IMAGE_ASPECT_RATIO,
  previewWidth = '100%',
  previewMaxWidth,
  previewMinHeight,
  label,
  acceptMimeTypes,
  maxSize,
  uploadType = UploadType.FEATURED_IMAGE,
}: ImageUploadCropControllerProps) {
  const t = useTranslations('featuredImage');
  const tCommon = useTranslations('common');
  const cropAccessibility = useImageCropAccessibility(t('cropTitle'));
  const selectedMimeTypes = acceptMimeTypes ?? getUploadSelectionMimeTypes(uploadType);
  const inputMaxSize = getUploadSelectionMaxSize(
    uploadType,
    'image/jpeg',
    maxSize ?? UPLOAD_CONFIGS[uploadType].maxSize,
  );
  const { tempImageSrc, cropModalOpened, isPreparing, handleFileDrop, handleCropComplete, handleCropCancel } =
    useImageUploadCrop({
      onUpload,
      uploadType,
    });

  const handleReject = (rejections: ImageUploadRejection[]) => {
    const rejection = rejections[0];
    if (!rejection) {
      return;
    }

    let message = t('errors.fileRejected');

    if (rejection.reason === 'too-large') {
      message = t('errors.fileTooLarge', { maxSize: formatBytes(inputMaxSize) });
    } else if (rejection.reason === 'invalid-type') {
      message = t('errors.invalidFileType');
    }

    notifications.show({ message, tone: 'danger' });
  };

  const resolvedLabel = label ?? t('label');
  const isPreparingImage = isPreparing || (isUploading && uploadProgress <= 0);
  const uploadStatusLabel = isPreparingImage
    ? tCommon('uploadField.status.preparingImage')
    : tCommon('uploadField.status.uploading');

  return (
    <ImageUploadCropField
      cropAccessibility={cropAccessibility}
      imageUrl={imageUrl}
      cropImageSrc={tempImageSrc}
      cropOpened={canEdit && cropModalOpened}
      idPrefix={idPrefix}
      canEdit={canEdit}
      loading={isUploading || isPreparing}
      progress={isPreparingImage ? undefined : uploadProgress}
      removeButtonLoading={isRemoving}
      labels={{
        field: resolvedLabel,
        imageAlt: t('alt'),
        emptyTitle: canEdit ? tCommon('actions.uploadItem', { item: resolvedLabel }) : resolvedLabel,
        emptyDescription: '',
        readOnlyDescription: '',
        loading: uploadStatusLabel,
        removeButtonAriaLabel: t('actions.removeAria'),
        cropTitle: t('cropTitle'),
        cropPreviewAlt: resolvedLabel,
        cropCancel: tCommon('actions.cancel'),
        cropConfirm: tCommon('actions.confirm'),
        cropProcessing: tCommon('uploadField.status.preparingImage'),
      }}
      accept={imageSelectionAcceptTypes(selectedMimeTypes)}
      maxSize={Number.isFinite(inputMaxSize) ? inputMaxSize : undefined}
      aspectRatio={aspectRatio}
      previewWidth={previewWidth}
      previewMaxWidth={previewMaxWidth}
      previewMinHeight={previewMinHeight}
      onFileSelect={(file) => {
        if (canEdit) {
          handleFileDrop([file]);
        }
      }}
      onReject={handleReject}
      onRemove={() => {
        if (canEdit) {
          onRemove();
        }
      }}
      onCrop={(blob) => {
        if (canEdit) {
          handleCropComplete(blob);
        }
      }}
      onCropClose={handleCropCancel}
    />
  );
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`;
  }

  if (bytes < 1024 * 1024) {
    return `${Math.round(bytes / 1024)} KB`;
  }

  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
