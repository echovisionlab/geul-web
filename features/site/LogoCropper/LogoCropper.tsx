'use client';

import { LayoutStack as DsLayoutStack } from '@/components/core/Layout';
import { useCallback, useState } from 'react';
import { UploadType } from '@echovisionlab/geul-proto/secure/file_pb.ts';
import { useTranslations } from 'next-intl';
import { useImageCropAccessibility } from '@/lib/i18n/useImageCropAccessibility';

import { notifications } from '@/components/core/Notification';
import { ImageCropper } from '@/components/core/ImageCropper';
import { ImageUploadField, type ImagePreviewSurface, type ImageUploadRejection } from '@/components/core/ImageUpload';
import { getUploadSelectionMimeTypes, UPLOAD_CONFIGS } from '@/lib/constants/upload-config';
import { formatFileSize, formatMimeTypes } from '@/lib/utils/upload';
import { prepareImageFileForPreview } from '@/lib/utils/upload-pipeline';

export interface LogoCropperProps {
  currentImage: string | null | undefined;
  name?: string | null;
  inputId?: string;
  label?: string;
  size?: number;
  disabled?: boolean;
  uploadProgress?: number;
  onUpload: (data: Uint8Array<ArrayBuffer>, mimeType: string) => Promise<{ url: string }>;
  onDelete?: () => Promise<unknown>;
  onImageChange: (url: string | null) => Promise<void>;
  /** Backdrop of the logo preview; theme variants preview on the theme they are made for. */
  previewSurface?: ImagePreviewSurface;
}

/**
 * Logo cropper for label/client logos.
 * Uses free aspect ratio since logos can have various shapes.
 */
export function LogoCropper({
  currentImage,
  name,
  inputId,
  label,
  size = 80,
  disabled = false,
  uploadProgress = 0,
  onUpload,
  onDelete,
  onImageChange,
  previewSurface,
}: LogoCropperProps) {
  const tCommon = useTranslations('common');
  const config = UPLOAD_CONFIGS[UploadType.LABEL_IMAGE];
  const selectionMimeTypes = getUploadSelectionMimeTypes(UploadType.LABEL_IMAGE);
  const resolvedLabel = label ?? tCommon('labels.logo');
  const cropTitle = tCommon('messages.cropItem', { item: resolvedLabel });
  const cropAccessibility = useImageCropAccessibility(cropTitle);
  const uploadActionLabel = tCommon('actions.uploadItem', { item: resolvedLabel });
  const constraintText = tCommon('uploadField.constraints', {
    formats: formatMimeTypes([...selectionMimeTypes]),
    maxSize: formatFileSize(config.maxSize),
  });
  const placeholderMaxWidth = size * 3;

  const [loading, setLoading] = useState(false);
  const [operation, setOperation] = useState<'idle' | 'uploading' | 'deleting'>('idle');
  const [cropModalOpen, setCropModalOpen] = useState(false);
  const [imageSrc, setImageSrc] = useState<string | null>(null);

  const finalizeUpload = useCallback(
    async (data: Uint8Array<ArrayBuffer>, mimeType: string) => {
      setLoading(true);
      setOperation('uploading');
      try {
        const { url } = await onUpload(data, mimeType);
        await onImageChange(url);

        notifications.show({
          message: tCommon('messages.itemUpdated', { item: resolvedLabel }),
          tone: 'positive',
        });

        setCropModalOpen(false);
        setImageSrc(null);
      } catch (error) {
        notifications.show({
          message: error instanceof Error ? error.message : tCommon('messages.uploadImageFailed'),
          tone: 'danger',
        });
      } finally {
        setLoading(false);
        setOperation('idle');
      }
    },
    [onImageChange, onUpload, resolvedLabel, tCommon],
  );

  const openFile = useCallback(
    async (file: File) => {
      try {
        if (file.type === 'image/svg+xml') {
          const arrayBuffer = await file.arrayBuffer();
          await finalizeUpload(new Uint8Array(arrayBuffer), file.type);
          return;
        }

        const previewFile = await prepareImageFileForPreview(file, UploadType.LABEL_IMAGE);
        const reader = new FileReader();
        reader.addEventListener('load', () => {
          setImageSrc(reader.result as string);
          setCropModalOpen(true);
        });
        reader.readAsDataURL(previewFile);
      } catch (error) {
        notifications.show({
          message: error instanceof Error ? error.message : tCommon('messages.uploadImageFailed'),
          tone: 'danger',
        });
      }
    },
    [finalizeUpload, tCommon],
  );

  const handleReject = useCallback(
    (rejections: ImageUploadRejection[]) => {
      const rejection = rejections[0];
      let message = `${resolvedLabel}: ${constraintText}`;

      if (rejection?.reason === 'too-large') {
        message = `File too large. Maximum size: ${formatFileSize(config.maxSize)}`;
      } else if (rejection?.reason === 'invalid-type') {
        message = `Invalid file type. Supported formats: ${formatMimeTypes([...selectionMimeTypes])}`;
      }

      notifications.show({ message, tone: 'danger' });
    },
    [config.maxSize, constraintText, resolvedLabel, selectionMimeTypes],
  );

  const handleCrop = async (blob: Blob) => {
    const arrayBuffer = await blob.arrayBuffer();
    await finalizeUpload(new Uint8Array(arrayBuffer), 'image/webp');
  };

  const handleDelete = async () => {
    setLoading(true);
    setOperation('deleting');
    try {
      if (onDelete) {
        await onDelete();
      }
      await onImageChange(null);

      notifications.show({
        message: tCommon('messages.itemRemoved', { item: resolvedLabel }),
        tone: 'positive',
      });
    } catch (error) {
      notifications.show({
        message: error instanceof Error ? error.message : tCommon('messages.removeImageFailed'),
        tone: 'danger',
      });
    } finally {
      setLoading(false);
      setOperation('idle');
    }
  };

  const processing = operation === 'uploading' && loading;
  const previewMaxWidth = Math.max(size * 3.6, 280);
  const uploadPrompt = `${tCommon('uploadField.instruction')} · ${constraintText}`;

  return (
    <DsLayoutStack gap="xxs">
      <ImageUploadField
        imageUrl={currentImage}
        alt={name || resolvedLabel}
        label={label ? resolvedLabel : undefined}
        inputId={inputId}
        dropzoneId={inputId ? `${inputId}-dropzone` : undefined}
        dropzoneAriaLabel={uploadActionLabel}
        accept={selectionMimeTypes}
        maxSize={config.maxSize}
        disabled={disabled || loading}
        loading={processing}
        loadingLabel={
          uploadProgress <= 0 ? tCommon('uploadField.status.preparingImage') : tCommon('uploadField.status.uploading')
        }
        progress={uploadProgress <= 0 ? undefined : uploadProgress}
        emptyTitle={label ? undefined : uploadActionLabel}
        emptyDescription={uploadPrompt}
        changeHint={currentImage && size >= 80 ? tCommon('uploadField.changeHint') : undefined}
        removeButtonAriaLabel={`${tCommon('actions.remove')} ${name || resolvedLabel}`}
        removeButtonLoading={operation === 'deleting' && loading}
        preview={{
          mode: 'hug',
          width: 'auto',
          height: size,
          maxWidth: `min(100%, ${previewMaxWidth}px)`,
          maxHeight: size,
          fit: 'contain',
          surface: previewSurface,
        }}
        placeholder={{
          width: '100%',
          maxWidth: placeholderMaxWidth,
          height: 'auto',
          minHeight: 0,
          aspectRatio: '3 / 1',
          iconSize: 'md',
          compact: true,
          showCompactText: true,
        }}
        onFileSelect={(file) => void openFile(file)}
        onValidationReject={handleReject}
        onRemove={currentImage && !disabled ? handleDelete : undefined}
      />

      {imageSrc && (
        <ImageCropper
          imageSrc={imageSrc}
          opened={cropModalOpen}
          onClose={() => {
            setCropModalOpen(false);
            setImageSrc(null);
          }}
          onCrop={handleCrop}
          title={cropTitle}
          cropAccessibility={cropAccessibility}
          labels={{
            previewAlt: resolvedLabel,
            cancel: tCommon('actions.cancel'),
            confirm: tCommon('actions.confirm'),
          }}
          aspectRatio="free"
          processingLabel={tCommon('uploadField.status.preparingImage')}
        />
      )}
    </DsLayoutStack>
  );
}
