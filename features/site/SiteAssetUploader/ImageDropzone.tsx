'use client';

import { useTranslations } from 'next-intl';
import { notifications } from '@/components/core/Notification';
import type { ImagePreviewSurface, ImageUploadAccept, ImageUploadRejection } from '@/components/core/ImageUpload';
import { formatFileSize } from '@/lib/utils/upload';
import { ImageDropzoneView } from './ui/ImageDropzoneView';

export interface ImageDropzoneProps {
  /** Current image URL (null if no image) */
  currentUrl: string | null;
  /** Whether an upload is in progress */
  uploading: boolean;
  /** Whether a delete is in progress */
  deleting: boolean;
  /** Whether the dropzone is disabled */
  disabled?: boolean;

  /** Allowed MIME types */
  accept: ImageUploadAccept;
  /** Minimum file size in bytes */
  minSize?: number;
  /** Maximum file size in bytes */
  maxSize: number;

  /** Preview image height in pixels */
  previewHeight: number;
  /** Preview image width in pixels or 'auto' */
  previewWidth: number | 'auto';
  /** Background the preview is drawn on, e.g. the theme a logo is made for. */
  previewSurface?: ImagePreviewSurface;

  /** Label text */
  label: string;
  /** Description text */
  description: string;
  /** Upload prompt text (instruction and accepted formats) */
  uploadPrompt: string;

  /** Called when files are dropped */
  onDrop: (files: File[]) => void;
  /** Called when delete is clicked */
  onDelete: () => void;

  /** Error message for rejected files */
  errorMessage?: string;
}

export function ImageDropzone({
  currentUrl,
  uploading,
  deleting,
  disabled = false,
  accept,
  minSize,
  maxSize,
  previewHeight,
  previewWidth,
  previewSurface,
  label,
  description,
  uploadPrompt,
  onDrop,
  onDelete,
  errorMessage,
}: ImageDropzoneProps) {
  const t = useTranslations('common.uploadField');
  const handleFileSelect = (file: File) => {
    if (!file) {
      return;
    }
    // The dropzone validates type and maximum size; the minimum is checked here.
    if (minSize && file.size < minSize) {
      notifications.show({ message: t('errors.tooSmall', { minSize: formatFileSize(minSize) }), tone: 'danger' });
      return;
    }
    onDrop([file]);
  };
  const handleReject = (rejections: ImageUploadRejection[]) => {
    const rejection = rejections[0];
    if (!rejection) {
      return;
    }
    const message =
      rejection.reason === 'too-large'
        ? t('errors.tooLarge', { maxSize: formatFileSize(maxSize) })
        : (errorMessage ?? t('errors.invalidType'));
    notifications.show({ message, tone: 'danger' });
  };

  return (
    <ImageDropzoneView
      currentUrl={currentUrl}
      uploading={uploading}
      deleting={deleting}
      disabled={disabled}
      accept={accept}
      maxSize={maxSize}
      previewHeight={previewHeight}
      previewWidth={previewWidth}
      previewSurface={previewSurface}
      label={label}
      description={description}
      uploadPrompt={uploadPrompt}
      removeButtonAriaLabel={t('removeLabel', { label })}
      onFileSelect={handleFileSelect}
      onReject={handleReject}
      onDelete={onDelete}
    />
  );
}
