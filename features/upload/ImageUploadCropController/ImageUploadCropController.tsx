'use client';

import type { CSSProperties } from 'react';
import { UploadType } from '@echovisionlab/geul-proto/secure/file_pb.ts';
import { useTranslations } from 'next-intl';
import { notifications } from '@mantine/notifications';
import type { AspectRatioConfig } from '@/components/core/ImageCropper';
import { ImageUploadCropField, type ImageUploadRejection } from '@/components/core/ImageUpload';
import { getUploadSelectionMimeTypes, UPLOAD_CONFIGS } from '@/lib/constants/upload-config';
import { formatFileSize, formatMimeTypes } from '@/lib/utils/upload';
import { getUploadSelectionMaxSize } from '@/lib/utils/upload-policy';
import { useImageUploadCrop } from './useImageUploadCrop';

const DEFAULT_IMAGE_UPLOAD_CONFIG = UPLOAD_CONFIGS[UploadType.FEATURED_IMAGE];

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
  aspectRatio = 1200 / 630,
  previewWidth = '100%',
  previewMaxWidth,
  previewMinHeight = 120,
  label,
  acceptMimeTypes = getUploadSelectionMimeTypes(UploadType.FEATURED_IMAGE),
  maxSize = DEFAULT_IMAGE_UPLOAD_CONFIG.maxSize,
  uploadType = UploadType.FEATURED_IMAGE,
}: ImageUploadCropControllerProps) {
  const t = useTranslations('featuredImage');
  const tCommon = useTranslations('common');
  const inputMaxSize = getUploadSelectionMaxSize(uploadType, 'image/jpeg', maxSize);
  const { tempImageSrc, cropModalOpened, handleFileDrop, handleCropComplete, handleCropCancel } = useImageUploadCrop({
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

    notifications.show({ message, color: 'red' });
  };

  const resolvedLabel = label ?? t('label');
  const constraintText = tCommon('uploadField.constraints', {
    formats: formatMimeTypes([...acceptMimeTypes]),
    maxSize: formatFileSize(inputMaxSize),
  });
  const ratioLabel = formatAspectRatio(aspectRatio);
  const emptyDescription = ratioLabel
    ? `${t('empty.editable', { ratio: ratioLabel })} · ${constraintText}`
    : constraintText;
  const isPreparingImage = isUploading && uploadProgress <= 0;
  const uploadStatusLabel = isPreparingImage
    ? tCommon('uploadField.status.preparingImage')
    : tCommon('uploadField.status.uploading');

  return (
    <ImageUploadCropField
      imageUrl={imageUrl}
      cropImageSrc={tempImageSrc}
      cropOpened={cropModalOpened}
      idPrefix={idPrefix}
      canEdit={canEdit}
      loading={isUploading}
      progress={isPreparingImage ? undefined : uploadProgress}
      removeButtonLoading={isRemoving}
      labels={{
        field: resolvedLabel,
        imageAlt: t('alt'),
        emptyTitle: canEdit ? tCommon('actions.uploadItem', { item: resolvedLabel }) : resolvedLabel,
        emptyDescription,
        readOnlyDescription: t('empty.readOnly'),
        changeHint: t('hint'),
        loading: uploadStatusLabel,
        removeButtonAriaLabel: t('actions.removeAria'),
        cropTitle: t('cropTitle'),
        cropPreviewAlt: resolvedLabel,
        cropCancel: tCommon('actions.cancel'),
        cropConfirm: tCommon('actions.confirm'),
        cropProcessing: tCommon('uploadField.status.preparingImage'),
      }}
      accept={acceptMimeTypes}
      maxSize={inputMaxSize}
      aspectRatio={aspectRatio}
      previewWidth={previewWidth}
      previewMaxWidth={previewMaxWidth}
      previewMinHeight={previewMinHeight}
      onFileSelect={(file) => handleFileDrop([file])}
      onReject={handleReject}
      onRemove={onRemove}
      onCrop={handleCropComplete}
      onCropClose={handleCropCancel}
    />
  );
}

function formatAspectRatio(aspectRatio: AspectRatioConfig): string | null {
  if (aspectRatio === 'free') {
    return null;
  }

  if (typeof aspectRatio === 'number') {
    return `${Math.round(aspectRatio * 9)}:9`;
  }

  return `${Math.round(aspectRatio.min * 9)}:9-${Math.round(aspectRatio.max * 9)}:9`;
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
