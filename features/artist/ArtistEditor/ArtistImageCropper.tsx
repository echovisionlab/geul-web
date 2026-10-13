'use client';

import { LayoutStack as DsLayoutStack } from '@/components/core/Layout';
import { useCallback, useState } from 'react';
import { UploadType } from '@echovisionlab/geul-proto/secure/file_pb.ts';
import { useTranslations } from 'next-intl';

import { notifications } from '@/components/core/Notification';
import { ImageCropper } from '@/components/core/ImageCropper';
import { useImageCropAccessibility } from '@/lib/i18n/useImageCropAccessibility';
import { ImageUploadField, type ImageUploadRejection } from '@/components/core/ImageUpload';
import { getUploadSelectionMimeTypes, UPLOAD_CONFIGS } from '@/lib/constants/upload-config';
import { formatFileSize, formatMimeTypes, imageSelectionAcceptTypes } from '@/lib/utils/upload';
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
  const cropAccessibility = useImageCropAccessibility(tCommon('messages.cropItem', { item: resolvedLabel }));
  const inputMaxSize = getUploadSelectionMaxSize(UploadType.ARTIST_IMAGE, 'image/jpeg', config.maxSize);
  const placeholderMetrics = getArtistImagePlaceholderMetrics(size);

  const [loading, setLoading] = useState(false);
  const [operation, setOperation] = useState<'idle' | 'preparing' | 'uploading' | 'deleting'>('idle');
  const [cropModalOpen, setCropModalOpen] = useState(false);
  const [imageSrc, setImageSrc] = useState<string | null>(null);

  const openFile = useCallback(
    async (file: File) => {
      setOperation('preparing');
      setLoading(true);
      try {
        const previewFile = await prepareImageFileForPreview(file, UploadType.ARTIST_IMAGE);
        const preview = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => {
            if (typeof reader.result === 'string') {
              resolve(reader.result);
            } else {
              reject(new Error('Failed to read image preview.'));
            }
          };
          reader.onerror = () => reject(new Error('Failed to read image preview.'));
          reader.readAsDataURL(previewFile);
        });
        setImageSrc(preview);
        setCropModalOpen(true);
      } catch (error) {
        notifications.show({
          message: error instanceof Error ? error.message : tCommon('messages.uploadImageFailed'),
          tone: 'danger',
        });
      } finally {
        setOperation('idle');
        setLoading(false);
      }
    },
    [tCommon],
  );

  const handleReject = useCallback(
    (rejections: ImageUploadRejection[]) => {
      const rejection = rejections[0];
      let message = tCommon('messages.uploadImageFailed');

      if (rejection?.reason === 'too-large') {
        message = `File too large. Maximum size: ${formatFileSize(inputMaxSize)}`;
      } else if (rejection?.reason === 'invalid-type') {
        message = `Invalid file type. Supported formats: ${formatMimeTypes([...selectionMimeTypes])}`;
      }

      notifications.show({ message, tone: 'danger' });
    },
    [inputMaxSize, selectionMimeTypes, tCommon],
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

  const processing = (operation === 'uploading' || operation === 'preparing') && loading;
  const isPreparingImage = operation === 'preparing' || (processing && uploadProgress <= 0);

  return (
    <DsLayoutStack gap="xxs">
      <ImageUploadField
        imageUrl={currentImage}
        alt={artistName || resolvedLabel}
        label={label ? resolvedLabel : undefined}
        inputId={inputId}
        dropzoneId={inputId ? `${inputId}-dropzone` : undefined}
        accept={imageSelectionAcceptTypes(selectionMimeTypes)}
        maxSize={Number.isFinite(inputMaxSize) ? inputMaxSize : undefined}
        disabled={loading}
        loading={processing}
        loadingLabel={
          isPreparingImage ? tCommon('uploadField.status.preparingImage') : tCommon('uploadField.status.uploading')
        }
        progress={isPreparingImage ? undefined : uploadProgress}
        emptyTitle={tCommon('actions.uploadItem', { item: resolvedLabel })}
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
          iconSize: 'md',
        }}
        onFileSelect={(file) => void openFile(file)}
        onValidationReject={handleReject}
        onRemove={currentImage ? handleDelete : undefined}
      />

      {imageSrc && (
        <ImageCropper
          cropAccessibility={cropAccessibility}
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
    </DsLayoutStack>
  );
}
