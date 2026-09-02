'use client';

import { useEffect, useMemo, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { notifications } from '@mantine/notifications';
import { ImageDropzone } from '@/features/site/SiteAssetUploader/ImageDropzone';
import type { ImageUploadAccept } from '@/components/core/ImageUpload';
import { deleteSiteAssetAction, setSiteAssetAction } from '@/lib/actions/site-setting';
import { getUploadSelectionMimeTypes, UPLOAD_CONFIGS } from '@/lib/constants/upload-config';
import { useUpload } from '@/lib/hooks/useUpload';
import { useUploadValidation } from '@/lib/hooks/useUploadValidation';
import { SITE_ASSET_TO_UPLOAD_TYPE, type SiteAssetType } from '@/lib/types/upload/model';
import { maybeConvertSvg } from '@/lib/utils/svg';
import { formatFileSize, formatMimeTypes } from '@/lib/utils/upload';

export type SiteDropzoneAssetType = Exclude<
  SiteAssetType,
  'site_og_background' | 'privacy_og_background' | 'terms_og_background'
>;

/** Preview dimensions for each site asset type */
const SITE_ASSET_PREVIEW: Record<SiteDropzoneAssetType, { height: number; width: number | 'auto' }> = {
  logo_light: { height: 60, width: 'auto' },
  logo_dark: { height: 60, width: 'auto' },
  logo_email: { height: 60, width: 'auto' },
  favicon: { height: 32, width: 32 },
  loader: { height: 40, width: 40 },
};

function getSiteAssetSelectionAccept(
  type: SiteDropzoneAssetType,
  selectionMimeTypes: readonly string[],
): ImageUploadAccept {
  if (type !== 'favicon') {
    return selectionMimeTypes;
  }

  return Object.fromEntries(
    selectionMimeTypes.map((mimeType) => [
      mimeType,
      mimeType === 'image/x-icon' || mimeType === 'image/vnd.microsoft.icon' ? ['.ico'] : [],
    ]),
  );
}

export interface SiteAssetUploaderProps {
  /** The type of site asset to upload */
  type: SiteDropzoneAssetType;
  /** Current asset URL from form/settings */
  currentUrl: string | null;
  /** Called after successful upload/delete to refresh data */
  onSuccess?: (ogGenerationRunId?: string) => void;
}

export function SiteAssetUploader({ type, currentUrl, onSuccess }: SiteAssetUploaderProps) {
  const t = useTranslations('adminSettings.site');
  const tCommon = useTranslations('common');
  const tCommonNotifications = useTranslations('common.notifications');
  const uploadType = SITE_ASSET_TO_UPLOAD_TYPE[type];
  const config = UPLOAD_CONFIGS[uploadType];
  const accept = getSiteAssetSelectionAccept(type, getUploadSelectionMimeTypes(uploadType));
  const { validateFile } = useUploadValidation();
  const { uploadFile, isUploading } = useUpload(uploadType);
  const preview = SITE_ASSET_PREVIEW[type];
  const label = t(`assets.${type}.label`);
  const description = t(`assets.${type}.description`);

  const [uploading, setUploading] = useState(false);
  const [assetUrl, setAssetUrl] = useState(currentUrl);

  useEffect(() => {
    setAssetUrl(currentUrl);
  }, [currentUrl]);

  // Generate error message from config
  const errorMessage = useMemo(
    () =>
      t('assets.errorMessage', {
        label,
        mimeTypes: formatMimeTypes([...config.permittedMimeTypes]),
        maxSize: formatFileSize(config.maxSize),
      }),
    [config, label, t],
  );
  const uploadPrompt = useMemo(
    () =>
      `${tCommon('uploadField.instruction')} · ${tCommon('uploadField.constraints', {
        formats: formatMimeTypes([...config.permittedMimeTypes]),
        maxSize: formatFileSize(config.maxSize),
      })}`,
    [config, tCommon],
  );

  const setAsset = useMutation({
    mutationFn: (data: { type: SiteAssetType; fileId: string }) => setSiteAssetAction(data.type, data.fileId),
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
    mutationFn: (data: { type: SiteAssetType }) => deleteSiteAssetAction(data.type),
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
      setAssetUrl(null);
      onSuccess?.(result.ogGenerationRunId);
    },
  });

  const handleDrop = async (files: File[]) => {
    const file = files[0];
    if (!file) {
      return;
    }

    // Validate before upload
    const validation = validateFile(file, uploadType);
    if (!validation.valid) {
      notifications.show({ message: validation.error, color: 'red' });
      return;
    }

    setUploading(true);

    try {
      const preparedFile = type === 'logo_email' ? await maybeConvertSvg(file) : file;

      // Upload via multipart
      const { fileId } = await uploadFile(preparedFile, {
        slotId: type,
      });

      // Link file to site setting
      await setAsset.mutateAsync({ type, fileId });
    } catch (error) {
      notifications.show({
        message: error instanceof Error ? error.message : tCommonNotifications('uploadFailed'),
        color: 'red',
      });
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = () => {
    deleteAsset.mutate({ type });
  };

  return (
    <ImageDropzone
      currentUrl={assetUrl}
      uploading={uploading || isUploading}
      deleting={deleteAsset.isPending}
      accept={accept}
      maxSize={config.maxSize}
      previewHeight={preview.height}
      previewWidth={preview.width}
      label={label}
      description={description}
      uploadPrompt={uploadPrompt}
      errorMessage={errorMessage}
      onDrop={handleDrop}
      onDelete={handleDelete}
    />
  );
}
