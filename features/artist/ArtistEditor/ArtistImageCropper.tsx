'use client';

import { useCallback, useState } from 'react';
import { UploadType } from '@echovisionlab/geul-proto/secure/file_pb.ts';
import { useTranslations } from 'next-intl';
import { Stack } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { ImageCropper } from '@/components/core/ImageCropper';
import { ImageUploadField, type ImageUploadRejection } from '@/components/core/ImageUpload';
import { getUploadSelectionMimeTypes, UPLOAD_CONFIGS } from '@/lib/constants/upload-config';
import { formatFileSize, formatMimeTypes } from '@/lib/utils/upload';
import { prepareImageFileForPreview } from '@/lib/utils/upload-pipeline';
import { getUploadSelectionMaxSize } from '@/lib/utils/upload-policy';
import { getPublicCdnUrl } from '@/lib/public-runtime-config';

// Aspect ratio limits: 9:16 (vertical) to 16:9 (horizontal)
const MIN_ASPECT = 9 / 16;
const MAX_ASPECT = 16 / 9;

function isConfiguredCdnImage(imageUrl: string): boolean {
  try {
    return new URL(imageUrl).origin === new URL(getPublicCdnUrl()).origin;
  } catch {
    return false;
  }
}

export function getArtistImagePlaceholderMetrics(size: number) {
  return {
    width: Math.max(Math.round(size * 2.2), 220),
    height: Math.max(size + 44, 144),
  };
}

export interface ArtistImageCropperProps {
  currentImage: string | null | undefined;
  artistName?: string | null;
  inputId?: string;
  label?: string;
  size?: number;
  uploadProgress?: number;
  onUpload: (data: Uint8Array<ArrayBuffer>, mimeType: string) => Promise<{ url: string }>;
  onDelete?: () => Promise<unknown>;
  onImageChange: (url: string | null) => Promise<void>;
}

export function ArtistImageCropper({
  currentImage,
  artistName,
  inputId,
  label,
  size = 120,
  uploadProgress = 0,
  onUpload,
  onDelete,
  onImageChange,
}: ArtistImageCropperProps) {
  const tCommon = useTranslations('common');
  const config = UPLOAD_CONFIGS[UploadType.ARTIST_IMAGE];
  const selectionMimeTypes = getUploadSelectionMimeTypes(UploadType.ARTIST_IMAGE);
  const resolvedLabel = label ?? tCommon('labels.image');
  const inputMaxSize = getUploadSelectionMaxSize(UploadType.ARTIST_IMAGE, 'image/jpeg', config.maxSize);
  const constraintText = tCommon('uploadField.constraints', {
    formats: formatMimeTypes([...selectionMimeTypes]),
    maxSize: formatFileSize(inputMaxSize),
  });
  const placeholderMetrics = getArtistImagePlaceholderMetrics(size);

  const [loading, setLoading] = useState(false);
  const [operation, setOperation] = useState<'idle' | 'uploading' | 'deleting'>('idle');
  const [cropModalOpen, setCropModalOpen] = useState(false);
  const [imageSrc, setImageSrc] = useState<string | null>(null);

  const openFile = useCallback(
    async (file: File) => {
      try {
        const previewFile = await prepareImageFileForPreview(file, UploadType.ARTIST_IMAGE);
        const reader = new FileReader();
        reader.addEventListener('load', () => {
          setImageSrc(reader.result as string);
          setCropModalOpen(true);
        });
        reader.readAsDataURL(previewFile);
      } catch (error) {
        notifications.show({
          message: error instanceof Error ? error.message : tCommon('messages.uploadImageFailed'),
          color: 'red',
        });
      }
    },
    [tCommon],
  );

  const handleReject = useCallback(
    (rejections: ImageUploadRejection[]) => {
      const rejection = rejections[0];
      let message = `${resolvedLabel}: ${constraintText}`;

      if (rejection?.reason === 'too-large') {
        message = `File too large. Maximum size: ${formatFileSize(inputMaxSize)}`;
      } else if (rejection?.reason === 'invalid-type') {
        message = `Invalid file type. Supported formats: ${formatMimeTypes([...selectionMimeTypes])}`;
      }

      notifications.show({ message, color: 'red' });
    },
    [constraintText, inputMaxSize, resolvedLabel, selectionMimeTypes],
  );

  const handleCrop = async (blob: Blob) => {
    setLoading(true);
    setOperation('uploading');
    try {
      const arrayBuffer = await blob.arrayBuffer();
      const data = new Uint8Array(arrayBuffer);

      const { url } = await onUpload(data, 'image/webp');
      await onImageChange(url);

      notifications.show({
        message: tCommon('messages.itemUpdated', { item: resolvedLabel }),
        color: 'green',
      });

      setCropModalOpen(false);
      setImageSrc(null);
    } catch (error) {
      notifications.show({
        message: error instanceof Error ? error.message : tCommon('messages.uploadImageFailed'),
        color: 'red',
      });
    } finally {
      setLoading(false);
      setOperation('idle');
    }
  };

  const handleDelete = async () => {
    setLoading(true);
    setOperation('deleting');
    try {
      const isApiImage = currentImage
        ? currentImage.includes('/media/artist/') || isConfiguredCdnImage(currentImage)
        : false;

      if (onDelete && isApiImage) {
        await onDelete();
      }

      await onImageChange(null);

      notifications.show({
        message: tCommon('messages.itemRemoved', { item: resolvedLabel }),
        color: 'green',
      });
    } catch (error) {
      notifications.show({
        message: error instanceof Error ? error.message : tCommon('messages.removeImageFailed'),
        color: 'red',
      });
    } finally {
      setLoading(false);
      setOperation('idle');
    }
  };

  const processing = operation === 'uploading' && loading;
  const isPreparingImage = processing && uploadProgress <= 0;

  return (
    <Stack gap={4}>
      <ImageUploadField
        imageUrl={currentImage}
        alt={artistName || resolvedLabel}
        label={label ? resolvedLabel : undefined}
        inputId={inputId}
        dropzoneId={inputId ? `${inputId}-dropzone` : undefined}
        accept={selectionMimeTypes}
        maxSize={inputMaxSize}
        disabled={loading}
        loading={processing}
        loadingLabel={
          isPreparingImage ? tCommon('uploadField.status.preparingImage') : tCommon('uploadField.status.uploading')
        }
        progress={isPreparingImage ? undefined : uploadProgress}
        emptyTitle={tCommon('actions.uploadItem', { item: resolvedLabel })}
        emptyDescription={`${tCommon('uploadField.instruction')} · ${constraintText}`}
        changeHint={currentImage ? tCommon('uploadField.changeHint') : undefined}
        removeButtonAriaLabel={tCommon('actions.remove')}
        removeButtonLoading={operation === 'deleting' && loading}
        preview={{
          mode: 'fixed',
          width: size,
          height: size,
          fit: 'cover',
        }}
        placeholder={{
          width: placeholderMetrics.width,
          height: placeholderMetrics.height,
          minHeight: placeholderMetrics.height,
          iconSize: 26,
        }}
        onFileSelect={(file) => void openFile(file)}
        onValidationReject={handleReject}
        onRemove={currentImage ? handleDelete : undefined}
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
          title={tCommon('messages.cropItem', { item: resolvedLabel })}
          labels={{
            previewAlt: resolvedLabel,
            cancel: tCommon('actions.cancel'),
            confirm: tCommon('actions.confirm'),
          }}
          aspectRatio={{ min: MIN_ASPECT, max: MAX_ASPECT }}
          processingLabel={tCommon('uploadField.status.preparingImage')}
        />
      )}
    </Stack>
  );
}
