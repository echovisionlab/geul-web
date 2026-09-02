'use client';

import { useEffect, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { notifications } from '@mantine/notifications';
import { ImageUploadCropController } from '@/features/upload/ImageUploadCropController';
import { deleteSiteAssetAction, setSiteAssetAction } from '@/lib/actions/site-setting';
import { getUploadSelectionMimeTypes, UPLOAD_CONFIGS } from '@/lib/constants/upload-config';
import { useUpload } from '@/lib/hooks/useUpload';
import { SITE_ASSET_TO_UPLOAD_TYPE, type SiteAssetType } from '@/lib/types/upload/model';

export type SiteOgBackgroundAssetType = Extract<
  SiteAssetType,
  'site_og_background' | 'privacy_og_background' | 'terms_og_background'
>;

interface SiteOgBackgroundUploaderProps {
  type: SiteOgBackgroundAssetType;
  currentUrl: string | null;
  onSuccess?: (ogGenerationRunId?: string) => void;
}

export function SiteOgBackgroundUploader({ type, currentUrl, onSuccess }: SiteOgBackgroundUploaderProps) {
  const t = useTranslations('adminSettings.site');
  const tCommonNotifications = useTranslations('common.notifications');
  const uploadType = SITE_ASSET_TO_UPLOAD_TYPE[type];
  const config = UPLOAD_CONFIGS[uploadType];
  const { upload, isUploading } = useUpload(uploadType);
  const [imageUrl, setImageUrl] = useState(currentUrl);
  const [uploadProgress, setUploadProgress] = useState(0);

  const label = t(`assets.${type}.label`);

  useEffect(() => {
    setImageUrl(currentUrl);
  }, [currentUrl]);

  const setAsset = useMutation({
    mutationFn: (fileId: string) => setSiteAssetAction(type, fileId),
    onSuccess: (result) => {
      if (result.error) {
        notifications.show({ message: result.error, color: 'red' });
        return;
      }
      if (result.warning) {
        notifications.show({ message: result.warning, color: 'orange' });
      } else {
        notifications.show({ message: t('assets.uploaded', { label }), color: 'green' });
      }
      onSuccess?.(result.ogGenerationRunId);
    },
  });

  const deleteAsset = useMutation({
    mutationFn: () => deleteSiteAssetAction(type),
    onSuccess: (result) => {
      if (result.error) {
        notifications.show({ message: result.error, color: 'red' });
        return;
      }
      if (result.warning) {
        notifications.show({ message: result.warning, color: 'orange' });
      } else {
        notifications.show({ message: t('assets.removed', { label }), color: 'yellow' });
      }
      setImageUrl(null);
      onSuccess?.(result.ogGenerationRunId);
    },
  });

  const handleUpload = async (blob: Blob) => {
    setUploadProgress(0);

    try {
      const { fileId } = await upload(blob, {
        slotId: type,
        fileName: type,
        onProgress: (progress) => setUploadProgress(progress.percentage),
      });

      await setAsset.mutateAsync(fileId);
    } catch (error) {
      notifications.show({
        message: error instanceof Error ? error.message : tCommonNotifications('uploadFailed'),
        color: 'red',
      });
    } finally {
      setUploadProgress(0);
    }
  };

  return (
    <ImageUploadCropController
      imageUrl={imageUrl}
      canEdit
      isUploading={isUploading}
      uploadProgress={uploadProgress}
      isRemoving={deleteAsset.isPending}
      onUpload={handleUpload}
      onRemove={() => deleteAsset.mutate()}
      aspectRatio={1200 / 630}
      previewMinHeight={120}
      label={label}
      acceptMimeTypes={getUploadSelectionMimeTypes(uploadType)}
      maxSize={config.maxSize}
      uploadType={uploadType}
    />
  );
}
