'use client';

import type { CSSProperties } from 'react';
import { Stack, Text } from '@mantine/core';
import { ImageCropper, type AspectRatioConfig } from '../ImageCropper';
import { ImageUploadField, type ImageUploadAccept, type ImageUploadRejection } from './ImageUploadField';

export interface ImageUploadCropFieldLabels {
  field: string;
  imageAlt: string;
  emptyTitle: string;
  emptyDescription: string;
  readOnlyDescription: string;
  changeHint?: string;
  loading: string;
  removeButtonAriaLabel: string;
  cropTitle: string;
  cropPreviewAlt: string;
  cropCancel: string;
  cropConfirm: string;
  cropProcessing: string;
}

export interface ImageUploadCropFieldProps {
  imageUrl: string | null;
  cropImageSrc: string | null;
  cropOpened: boolean;
  idPrefix?: string;
  canEdit: boolean;
  loading: boolean;
  progress?: number;
  removeButtonLoading: boolean;
  labels: ImageUploadCropFieldLabels;
  accept?: ImageUploadAccept;
  maxSize?: number;
  aspectRatio?: AspectRatioConfig;
  previewWidth?: CSSProperties['width'];
  previewMaxWidth?: CSSProperties['maxWidth'];
  previewMinHeight?: CSSProperties['minHeight'];
  onFileSelect: (file: File) => void;
  onReject: (rejections: ImageUploadRejection[]) => void;
  onRemove?: () => void;
  onCrop: (blob: Blob) => void;
  onCropClose: () => void;
}

/**
 * Domain-free image selection and crop surface. Upload policy, preprocessing,
 * persistence, notifications, and translated copy are supplied by its controller.
 */
export function ImageUploadCropField({
  imageUrl,
  cropImageSrc,
  cropOpened,
  idPrefix,
  canEdit,
  loading,
  progress,
  removeButtonLoading,
  labels,
  accept,
  maxSize,
  aspectRatio = 1200 / 630,
  previewWidth = '100%',
  previewMaxWidth,
  previewMinHeight = 120,
  onFileSelect,
  onReject,
  onRemove,
  onCrop,
  onCropClose,
}: ImageUploadCropFieldProps) {
  return (
    <Stack gap={4} style={{ position: 'relative', zIndex: 1 }}>
      <Text size="xs" c="dimmed">
        {labels.field}
      </Text>

      <ImageUploadField
        imageUrl={imageUrl}
        alt={labels.imageAlt}
        inputId={idPrefix ? `${idPrefix}-file-input` : undefined}
        dropzoneId={idPrefix ? `${idPrefix}-dropzone` : undefined}
        accept={accept}
        maxSize={maxSize}
        canEdit={canEdit}
        disabled={loading}
        loading={loading}
        loadingLabel={labels.loading}
        progress={progress}
        emptyTitle={labels.emptyTitle}
        emptyDescription={canEdit ? labels.emptyDescription : labels.readOnlyDescription}
        changeHint={imageUrl && canEdit ? labels.changeHint : undefined}
        removeButtonAriaLabel={labels.removeButtonAriaLabel}
        removeButtonLoading={removeButtonLoading}
        preview={{
          mode: aspectRatio === 'free' ? 'hug' : 'fixed',
          width: previewWidth,
          maxWidth: previewMaxWidth,
          aspectRatio: typeof aspectRatio === 'number' ? `${aspectRatio}` : undefined,
          minHeight: previewMinHeight,
          fit: aspectRatio === 'free' ? 'contain' : 'cover',
        }}
        placeholder={{
          width: previewWidth,
          minHeight: previewMinHeight,
          iconSize: 22,
        }}
        onFileSelect={onFileSelect}
        onValidationReject={onReject}
        onRemove={imageUrl && canEdit ? onRemove : undefined}
      />

      {cropImageSrc ? (
        <ImageCropper
          imageSrc={cropImageSrc}
          opened={cropOpened}
          onClose={onCropClose}
          onCrop={onCrop}
          title={labels.cropTitle}
          labels={{
            previewAlt: labels.cropPreviewAlt,
            cancel: labels.cropCancel,
            confirm: labels.cropConfirm,
          }}
          aspectRatio={aspectRatio}
          processingLabel={labels.cropProcessing}
        />
      ) : null}
    </Stack>
  );
}
