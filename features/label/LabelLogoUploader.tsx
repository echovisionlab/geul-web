'use client';

import { useCallback, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { notifications } from '@mantine/notifications';
import { LogoCropper } from '@/features/site/LogoCropper/LogoCropper';
import { deleteLabelLogoAction, setLabelLogoAction, type ThemeAssetVariantName } from '@/lib/actions/label';
import { useUpload } from '@/lib/hooks/useUpload';
import { UploadType } from '@/lib/types/upload/model';

export interface LabelLogoUploaderProps {
  /** Label ID to upload logo for */
  labelId: string;
  /** Current logo URL */
  currentImage: string | null | undefined;
  /** Theme variant this uploader owns */
  variant?: ThemeAssetVariantName;
  /** Label's display name */
  name?: string | null;
  /** Deterministic file input id for testing */
  inputId?: string;
  /** Logo display size */
  size?: number;
  /** Label text */
  label?: string;
  /** Prevent upload and deletion while editor access is blocked. */
  disabled?: boolean;
  /** Called after successful upload or delete with the new URL */
  onImageChange?: (url: string | null) => void;
}

/**
 * Feature wrapper for LogoCropper that handles label logo upload logic.
 *
 * Uses the unified upload system:
 * 1. Upload file to generic file table via useUpload hook
 * 2. Link file to label via setLogo mutation
 *
 * @example
 * ```tsx
 * <LabelLogoUploader
 *   labelId={label.id}
 *   currentImage={label.image_url}
 *   name={label.name}
 *   onImageChange={(url) => setField('imageUrl', url)}
 * />
 * ```
 */
export function LabelLogoUploader({
  labelId,
  currentImage,
  variant = 'light',
  name,
  inputId,
  size = 100,
  label,
  disabled = false,
  onImageChange,
}: LabelLogoUploaderProps) {
  const tCommon = useTranslations('common');
  const resolvedLabel = label ?? tCommon('labels.logo');
  const [uploadProgress, setUploadProgress] = useState(0);

  // Unified upload hook for file storage
  const { upload } = useUpload(UploadType.LABEL_IMAGE);

  // Mutations for linking file to label and deletion
  const setLogo = useMutation({
    mutationFn: (data: { labelId: string; fileId: string }) => setLabelLogoAction(data.labelId, data.fileId, variant),
  });

  const deleteImage = useMutation({
    mutationFn: (data: { labelId: string }) => deleteLabelLogoAction(data.labelId, variant),
  });

  const handleUpload = useCallback(
    async (data: Uint8Array<ArrayBuffer>, mimeType: string): Promise<{ url: string }> => {
      // Convert Uint8Array to Blob for upload
      const blob = new Blob([data], { type: mimeType });

      // Upload to file table
      setUploadProgress(0);

      try {
        const { fileId, url } = await upload(blob, {
          entityId: labelId,
          fileName: `logo-${variant}`,
          slotId: `logo_${variant}`,
          onProgress: (progress) => setUploadProgress(progress.percentage),
        });

        // Link file to label
        const result = await setLogo.mutateAsync({ labelId, fileId });
        if (result.error) {
          notifications.show({ message: result.error, color: 'red' });
          throw new Error(result.error);
        }

        return { url };
      } finally {
        setUploadProgress(0);
      }
    },
    [labelId, upload, setLogo, variant],
  );

  const handleDelete = useCallback(async () => {
    const result = await deleteImage.mutateAsync({ labelId });
    if (result.error) {
      notifications.show({ message: result.error, color: 'red' });
      throw new Error(result.error);
    }
    return result;
  }, [labelId, deleteImage]);

  const handleImageChange = useCallback(
    async (url: string | null) => {
      onImageChange?.(url);
    },
    [onImageChange],
  );

  return (
    <LogoCropper
      currentImage={currentImage}
      name={name}
      inputId={inputId}
      size={size}
      label={resolvedLabel}
      disabled={disabled}
      uploadProgress={uploadProgress}
      onUpload={handleUpload}
      onDelete={handleDelete}
      onImageChange={handleImageChange}
    />
  );
}
