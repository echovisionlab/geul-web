'use client';

import { notifications } from '@mantine/notifications';
import type { ImageUploadAccept, ImageUploadRejection } from '@/components/core/ImageUpload';
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

  /** Label text */
  label: string;
  /** Description text */
  description: string;
  /** Upload prompt text (default: 'Drop or click to upload') */
  uploadPrompt?: string;

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
  label,
  description,
  uploadPrompt = 'Drop or click to upload',
  onDrop,
  onDelete,
  errorMessage,
}: ImageDropzoneProps) {
  const handleFileSelect = (file: File) => {
    if (!file) {
      return;
    }

    // Manual minSize validation (Mantine Dropzone doesn't support minSize)
    if (minSize && file.size < minSize) {
      notifications.show({
        message: `File too small. Minimum size: ${formatBytes(minSize)}`,
        color: 'red',
      });
      return;
    }

    onDrop([file]);
  };
  const handleReject = (rejections: ImageUploadRejection[]) => {
    const rejection = rejections[0];
    if (!rejection) {
      return;
    }

    let message = errorMessage || 'File rejected';

    if (rejection.reason === 'too-large') {
      message = `File too large. Maximum size: ${formatBytes(maxSize)}`;
    } else if (rejection.reason === 'invalid-type') {
      message = errorMessage || 'Invalid file type';
    }

    notifications.show({ message, color: 'red' });
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
      label={label}
      description={description}
      uploadPrompt={uploadPrompt}
      removeButtonAriaLabel={`Remove ${label}`}
      onFileSelect={handleFileSelect}
      onReject={handleReject}
      onDelete={onDelete}
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
