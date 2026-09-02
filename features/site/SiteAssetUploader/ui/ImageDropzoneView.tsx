'use client';

import { Box, Text } from '@mantine/core';
import { ImageUploadField, type ImageUploadAccept, type ImageUploadRejection } from '@/components/core/ImageUpload';

interface ImageDropzoneViewProps {
  currentUrl: string | null;
  uploading: boolean;
  deleting: boolean;
  disabled: boolean;
  accept: ImageUploadAccept;
  maxSize: number;
  previewHeight: number;
  previewWidth: number | 'auto';
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
    <Box>
      <Text size="sm" fw={500} mb={4}>
        {label}
      </Text>
      <Text size="xs" c="dimmed" mb="xs">
        {description}
      </Text>

      <ImageUploadField
        imageUrl={currentUrl}
        alt={label}
        accept={accept}
        maxSize={maxSize}
        disabled={disabled || uploading}
        loading={uploading}
        loadingLabel={uploadPrompt}
        emptyTitle={label}
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
          radius: 'var(--mantine-radius-sm)',
        }}
        placeholder={{
          width: '100%',
          height: 'auto',
          minHeight: Math.max(previewHeight, 96),
          iconSize: 24,
        }}
        onFileSelect={onFileSelect}
        onValidationReject={onReject}
        onRemove={currentUrl && !disabled ? onDelete : undefined}
      />
    </Box>
  );
}
