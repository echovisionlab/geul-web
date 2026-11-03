'use client';

import { useEffect, useRef, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { notifications } from '@/components/core/Notification';
import { ImageUploadCropController } from '@/features/upload/ImageUploadCropController';
import { deleteSiteAssetAction, setSiteAssetAction } from '@/lib/actions/site-setting';
import { getUploadSelectionMimeTypes, UPLOAD_CONFIGS } from '@/lib/constants/upload-config';
import type { SiteAssetBindings } from '@/features/site/site-asset-bindings';
import { useUpload } from '@/lib/hooks/useUpload';
import { SITE_ASSET_TO_UPLOAD_TYPE, type SiteAssetType } from '@/lib/types/upload/model';

export type SiteOgBackgroundAssetType = Extract<
  SiteAssetType,
  'site_og_background' | 'privacy_og_background' | 'terms_og_background'
>;

interface SiteOgBackgroundUploaderProps {
  canEdit?: boolean;
  type: SiteOgBackgroundAssetType;
  currentUrl: string | null;
  onSuccess?: (ogGenerationRunId?: string) => void;
  bindings?: SiteAssetBindings;
}

export function SiteOgBackgroundUploader({
  type,
  currentUrl,
  onSuccess,
  bindings,
  canEdit = true,
}: SiteOgBackgroundUploaderProps) {
  const t = useTranslations('adminSettings.site');
  const tCommonNotifications = useTranslations('common.notifications');
  const tSaveState = useTranslations('editorHeader.saveState');
  const uploadType = SITE_ASSET_TO_UPLOAD_TYPE[type];
  const config = UPLOAD_CONFIGS[uploadType];
  const uploadTransport = useUpload(uploadType);
  const { isUploading } = uploadTransport;
  const upload = bindings?.upload ?? uploadTransport.upload;
  const operation = useRef(false);
  const [uploading, setUploading] = useState(false);
  const [imageUrl, setImageUrl] = useState(currentUrl);
  const [uploadProgress, setUploadProgress] = useState(0);

  const label = t(`assets.${type}.label`);

  useEffect(() => {
    setImageUrl(currentUrl);
  }, [currentUrl]);

  const setAsset = useMutation({
    mutationFn: (fileId: string) => (bindings?.set ?? setSiteAssetAction)(type, fileId),
    onSuccess: (result) => {
      if (result.error) {
        notifications.show({ message: result.error, tone: 'danger' });
        return;
      }
      if (result.warning) {
        notifications.show({ message: result.warning, tone: 'warning' });
      } else {
        notifications.show({ message: t('assets.uploaded', { label }), tone: 'positive' });
      }
      onSuccess?.(result.ogGenerationRunId);
    },
  });

  const deleteAsset = useMutation({
    mutationFn: () => (bindings?.remove ?? deleteSiteAssetAction)(type),
    onSuccess: (result) => {
      if (result.error) {
        notifications.show({ message: result.error, tone: 'danger' });
        return;
      }
      if (result.warning) {
        notifications.show({ message: result.warning, tone: 'warning' });
      } else {
        notifications.show({ message: t('assets.removed', { label }), tone: 'positive' });
      }
      setImageUrl(null);
      onSuccess?.(result.ogGenerationRunId);
    },
  });

  const handleUpload = async (blob: Blob) => {
    if (!canEdit || operation.current) {
      return;
    }
    operation.current = true;
    setUploading(true);
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
        tone: 'danger',
      });
    } finally {
      operation.current = false;
      setUploading(false);
      setUploadProgress(0);
    }
  };

  return (
    <ImageUploadCropController
      imageUrl={imageUrl}
      canEdit={canEdit}
      isUploading={uploading || isUploading || setAsset.isPending}
      uploadProgress={uploadProgress}
      loadingLabel={setAsset.isPending ? tSaveState('saving') : undefined}
      isRemoving={deleteAsset.isPending}
      onUpload={handleUpload}
      onRemove={async () => {
        if (!canEdit || operation.current) {
          return;
        }
        operation.current = true;
        try {
          await deleteAsset.mutateAsync();
        } catch (error) {
          notifications.show({
            message: error instanceof Error ? error.message : tCommonNotifications('uploadFailed'),
            tone: 'danger',
          });
        } finally {
          operation.current = false;
        }
      }}
      label={label}
      acceptMimeTypes={getUploadSelectionMimeTypes(uploadType)}
      maxSize={config.maxSize}
      uploadType={uploadType}
    />
  );
}
