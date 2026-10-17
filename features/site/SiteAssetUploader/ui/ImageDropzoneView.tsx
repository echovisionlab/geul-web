'use client';

import { Text as DsText } from '@/components/core/Typography';
import { LayoutStack as DsLayoutStack } from '@/components/core/Layout';

import {
  ImageUploadField,
  type ImagePreviewSurface,
  type ImageUploadAccept,
  type ImageUploadRejection,
} from '@/components/core/ImageUpload';

interface ImageDropzoneViewProps {
  currentUrl: string | null;
  uploading: boolean;
  deleting: boolean;
  disabled: boolean;
  accept: ImageUploadAccept;
  maxSize: number;
  previewHeight: number;
  previewWidth: number | 'auto';
  previewSurface?: ImagePreviewSurface;
  label: string;
  description: string;
  uploadPrompt: string;
  removeButtonAriaLabel: string;
  onFileSelect: (file: File) => void;
  onReject: (rejections: ImageUploadRejection[]) => void;
  onDelete: () => void;
}

export function ImageDropzoneView({
  currentUrl,
  uploading,
  deleting,
  disabled,
  accept,
  maxSize,
  previewHeight,
  previewWidth,
  previewSurface,
  label,
  description,
  uploadPrompt,
  removeButtonAriaLabel,
  onFileSelect,
  onReject,
  onDelete,
}: ImageDropzoneViewProps) {
  const isAutoWidth = previewWidth === 'auto';
  const previewMaxWidth = isAutoWidth ? 400 : previewWidth;

  return (
    // Same stacked field rhythm as Core Field: label and description form one block above the control.
    <DsLayoutStack gap="xxs">
      <DsLayoutStack gap="none">
        <DsText size="sm" weight="medium">
          {label}
        </DsText>
        <DsText size="xs" tone="secondary">
          {description}
        </DsText>
      </DsLayoutStack>

      <ImageUploadField
        imageUrl={currentUrl}
        alt={label}
        accept={accept}
        maxSize={maxSize}
        disabled={disabled || uploading}
        loading={uploading}
        loadingLabel={uploadPrompt}
        dropzoneAriaLabel={label}
        emptyDescription={uploadPrompt}
        changeHint={currentUrl ? uploadPrompt : undefined}
        removeButtonAriaLabel={removeButtonAriaLabel}
        removeButtonLoading={deleting}
        preview={{
          mode: isAutoWidth ? 'hug' : 'fixed',
          width: isAutoWidth ? 'auto' : previewWidth,
          height: previewHeight,
          maxWidth: previewMaxWidth,
          maxHeight: previewHeight,
          fit: 'contain',
          surface: previewSurface,
        }}
        placeholder={{
          width: '100%',
          height: 'auto',
          minHeight: Math.max(previewHeight, 96),
          iconSize: 'md',
        }}
        onFileSelect={onFileSelect}
        onValidationReject={onReject}
        onRemove={currentUrl && !disabled ? onDelete : undefined}
      />
    </DsLayoutStack>
  );
}
