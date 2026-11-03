'use client';
import { SectionCard as DsSectionCard } from '@/components/core/Section';
import { Text as DsText } from '@/components/core/Typography';
import {
  LayoutInset as DsLayoutInset,
  LayoutStack as DsLayoutStack,
  LayoutInline as DsLayoutInline,
} from '@/components/core/Layout';
import { notifications } from '@/components/core/Notification';
import { useMemo, useRef, useState } from 'react';
import { IconTrash } from '@tabler/icons-react';
import { useMutation } from '@tanstack/react-query';
import { useLocale, useTranslations } from 'next-intl';
import { IconButton } from '@/components/core/IconButton';
import { ImageUploadField } from '@/components/core/ImageUpload';
import { addSiteLoaderAssetAction, removeSiteLoaderAssetAction } from '@/lib/actions/site-setting';
import { UPLOAD_CONFIGS } from '@/lib/constants/upload-config';
import { useUpload } from '@/lib/hooks/useUpload';
import { useUploadValidation } from '@/lib/hooks/useUploadValidation';
import type { SiteLoaderAsset } from '@/lib/types/site-setting/config';
import { UploadType } from '@/lib/types/upload/model';
import { formatFileSize, formatMimeTypes } from '@/lib/utils/upload';
export interface SiteLoaderBindings {
  add: typeof addSiteLoaderAssetAction;
  remove: typeof removeSiteLoaderAssetAction;
  uploadFile: ReturnType<typeof useUpload>['uploadFile'];
}
interface SiteLoaderAssetsUploaderProps {
  bindings?: SiteLoaderBindings;
  assets: SiteLoaderAsset[];
  onSuccess?: () => void;
}
export function SiteLoaderAssetsUploader({ assets, onSuccess, bindings }: SiteLoaderAssetsUploaderProps) {
  const t = useTranslations('adminSettings.site');
  const locale = useLocale();
  const tCommon = useTranslations('common');
  const tCommonNotifications = useTranslations('common.notifications');
  const uploadType = UploadType.SITE_LOADER;
  const config = UPLOAD_CONFIGS[uploadType];
  const { validateFile } = useUploadValidation();
  const transport = useUpload(uploadType);
  const { isUploading } = transport;
  const uploadFile = bindings?.uploadFile ?? transport.uploadFile;
  const [uploading, setUploading] = useState(false);
  const operation = useRef(false);
  const label = t('assets.loader.label');
  const description = t('assets.loader.description');
  const uploadPrompt = useMemo(
    () =>
      `${tCommon('uploadField.instruction')} · ${tCommon('uploadField.constraints', {
        formats: formatMimeTypes([...config.permittedMimeTypes]),
        maxSize: formatFileSize(config.maxSize),
      })}`,
    [config, tCommon],
  );
  const errorMessage = useMemo(
    () =>
      t('assets.errorMessage', {
        label,
        mimeTypes: formatMimeTypes([...config.permittedMimeTypes]),
        maxSize: formatFileSize(config.maxSize),
      }),
    [config, label, t],
  );
  const addLoader = useMutation({
    mutationFn: (fileId: string) => (bindings?.add ?? addSiteLoaderAssetAction)(fileId),
    onSuccess: (result) => {
      if (result.error) {
        notifications.show({ message: result.error, tone: 'danger' });
        return;
      }
      notifications.show({ message: t('assets.uploaded', { label }), tone: 'positive' });
      onSuccess?.();
    },
  });
  const removeLoader = useMutation({
    mutationFn: (fileId: string) => (bindings?.remove ?? removeSiteLoaderAssetAction)(fileId),
    onSuccess: (result) => {
      if (result.error) {
        notifications.show({ message: result.error, tone: 'danger' });
        return;
      }
      notifications.show({
        message: result.warning ?? t('assets.removed', { label }),
        tone: result.warning ? 'warning' : 'positive',
      });
      onSuccess?.();
    },
  });
  const handleFileSelect = async (file: File) => {
    if (operation.current || removeLoader.isPending) {
      return;
    }
    const validation = validateFile(file, uploadType);
    if (!validation.valid) {
      notifications.show({ message: validation.error, tone: 'danger' });
      return;
    }
    operation.current = true;
    setUploading(true);
    try {
      const { fileId } = await uploadFile(file, { slotId: 'loader' });
      await addLoader.mutateAsync(fileId);
    } catch (error) {
      notifications.show({
        message: error instanceof Error ? error.message : tCommonNotifications('uploadFailed'),
        tone: 'danger',
      });
    } finally {
      operation.current = false;
      setUploading(false);
    }
  };
  return (
    // Same stacked field rhythm as the logo uploaders: label and description form one block.
    <DsLayoutStack gap="xxs">
      <DsLayoutStack gap="none">
        <DsText size="sm" weight="medium">
          {label}
        </DsText>
        <DsText size="xs" tone="secondary">
          {description}
        </DsText>
      </DsLayoutStack>

      <DsLayoutStack gap="xs">
        {assets.length > 0 ? (
          // Tiles leave room for their corner remove badges, which straddle each tile's corner.
          <DsLayoutInset blockStart="md">
            <DsLayoutInline gap="xl" align="center">
              {assets.map((asset, index) => (
                <div style={{ position: 'relative' }} key={asset.file_id}>
                  <div style={{ width: 48, height: 48, overflow: 'hidden' }}>
                    <DsSectionCard padding="none" appearance="surface" border="all">
                      <DsLayoutInline align="center" justify="center">
                        <img
                          src={asset.url}
                          alt={label}
                          style={{ display: 'block', maxWidth: '100%', maxHeight: '100%' }}
                        />
                      </DsLayoutInline>
                    </DsSectionCard>
                  </div>
                  <IconButton
                    size="xs"
                    shape="circle"
                    tone="danger"
                    emphasis="medium"
                    placement="overlay-end"
                    loading={removeLoader.isPending}
                    disabled={uploading || isUploading || addLoader.isPending}
                    aria-label={`${tCommon('actions.remove')} ${label} ${new Intl.NumberFormat(locale).format(index + 1)}`}
                    onClick={() => removeLoader.mutate(asset.file_id)}
                  >
                    <IconTrash size={12} />
                  </IconButton>
                </div>
              ))}
            </DsLayoutInline>
          </DsLayoutInset>
        ) : null}

        <ImageUploadField
          alt={label}
          imageUrl={null}
          accept={[...config.permittedMimeTypes]}
          maxSize={config.maxSize}
          loading={uploading || isUploading || addLoader.isPending}
          loadingLabel={addLoader.isPending ? tCommon('states.loading') : tCommon('uploadField.status.uploading')}
          disabled={removeLoader.isPending}
          dropzoneAriaLabel={label}
          emptyDescription={uploadPrompt}
          preview={{ mode: 'fixed', width: '100%', height: 96, fit: 'contain' }}
          placeholder={{ width: '100%', minHeight: 96, iconSize: 'md' }}
          onFileSelect={handleFileSelect}
          onReject={() => notifications.show({ message: errorMessage, tone: 'danger' })}
        />
      </DsLayoutStack>
    </DsLayoutStack>
  );
}
