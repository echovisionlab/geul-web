'use client';

import { useCallback, useEffect, useState } from 'react';
import { Stack } from '@mantine/core';
import type { FileRejection } from '@mantine/dropzone';
import { ImageCropper } from '@/components/core/ImageCropper';
import { ImageUploadField, type ImageUploadRejection } from '@/components/core/ImageUpload';

const USER_AVATAR_OUTPUT_DIMENSION = 1024;
const USER_AVATAR_OUTPUT_QUALITY = 0.85;

export interface ProfileAvatarControlLabels {
  alt: string;
  upload: string;
  change: string;
  remove: string;
  cropTitle: string;
  cropPreview: string;
  cancel: string;
  confirm: string;
  preparing: string;
}

export interface ProfileAvatarControlProps {
  imageUrl?: string | null;
  size?: number;
  accept: readonly string[];
  maxSize: number;
  labels: ProfileAvatarControlLabels;
  disabled?: boolean;
  validateFile?: (file: File) => string | null;
  prepareFile?: (file: File) => Promise<File>;
  onValidationError?: (message: string) => void;
  onFileRejected?: (rejections: FileRejection[]) => void;
  onValidationReject?: (rejections: ImageUploadRejection[]) => void;
  onSave: (blob: Blob) => Promise<boolean>;
  onRemove?: () => Promise<boolean>;
}

/**
 * Pure profile-avatar editing UI. Upload policy, persistence, notifications,
 * and session refresh are supplied by its controller through props.
 */
export function ProfileAvatarControl({
  imageUrl,
  size = 80,
  accept,
  maxSize,
  labels,
  disabled = false,
  validateFile,
  prepareFile,
  onValidationError,
  onFileRejected,
  onValidationReject,
  onSave,
  onRemove,
}: ProfileAvatarControlProps) {
  const [operation, setOperation] = useState<'idle' | 'preparing' | 'removing'>('idle');
  const [cropModalOpen, setCropModalOpen] = useState(false);
  const [cropImageUrl, setCropImageUrl] = useState<string | null>(null);
  const normalizedImageUrl = imageUrl?.trim() ?? '';
  const hasImage = normalizedImageUrl.length > 0;

  const clearCropImage = useCallback(() => {
    setCropImageUrl((current) => {
      if (current) {
        URL.revokeObjectURL(current);
      }
      return null;
    });
    setCropModalOpen(false);
  }, []);

  useEffect(() => clearCropImage, [clearCropImage]);

  const openFile = useCallback(
    async (file: File) => {
      const validationError = validateFile?.(file);
      if (validationError) {
        onValidationError?.(validationError);
        return;
      }

      setOperation('preparing');
      try {
        const previewFile = prepareFile ? await prepareFile(file) : file;
        clearCropImage();
        setCropImageUrl(URL.createObjectURL(previewFile));
        setCropModalOpen(true);
      } catch (error) {
        onValidationError?.(error instanceof Error ? error.message : 'Failed to prepare image.');
      } finally {
        setOperation('idle');
      }
    },
    [clearCropImage, onValidationError, prepareFile, validateFile],
  );

  const handleCrop = useCallback(
    async (blob: Blob) => {
      const saved = await onSave(blob);
      if (saved) {
        clearCropImage();
      }
      return saved;
    },
    [clearCropImage, onSave],
  );

  const handleRemove = useCallback(async () => {
    if (!onRemove || !hasImage) {
      return;
    }

    setOperation('removing');
    try {
      await onRemove();
    } finally {
      setOperation('idle');
    }
  }, [hasImage, onRemove]);

  const busy = disabled || operation !== 'idle';

  return (
    <Stack gap={4}>
      <ImageUploadField
        imageUrl={normalizedImageUrl || null}
        alt={labels.alt}
        dropzoneAriaLabel={hasImage ? labels.change : labels.upload}
        accept={accept}
        maxSize={maxSize}
        disabled={busy}
        loading={operation === 'preparing'}
        loadingLabel={labels.preparing}
        removeButtonAriaLabel={labels.remove}
        removeButtonLoading={operation === 'removing'}
        removeButtonOffset={0}
        preview={{
          mode: 'circle',
          width: size,
          height: size,
          fit: 'cover',
        }}
        placeholder={{
          width: size,
          height: size,
          minHeight: size,
          radius: '50%',
          iconSize: Math.max(20, size * 0.35),
          compact: true,
        }}
        onFileSelect={(file) => void openFile(file)}
        onReject={onFileRejected}
        onValidationReject={onValidationReject}
        onRemove={onRemove && hasImage ? handleRemove : undefined}
      />

      {cropImageUrl ? (
        <ImageCropper
          imageSrc={cropImageUrl}
          opened={cropModalOpen}
          onClose={clearCropImage}
          onCrop={handleCrop}
          title={labels.cropTitle}
          labels={{
            previewAlt: labels.cropPreview,
            cancel: labels.cancel,
            confirm: labels.confirm,
          }}
          aspectRatio={1}
          circularCrop
          processingLabel={labels.preparing}
          maxOutputWidth={USER_AVATAR_OUTPUT_DIMENSION}
          maxOutputHeight={USER_AVATAR_OUTPUT_DIMENSION}
          outputQuality={USER_AVATAR_OUTPUT_QUALITY}
        />
      ) : null}
    </Stack>
  );
}
