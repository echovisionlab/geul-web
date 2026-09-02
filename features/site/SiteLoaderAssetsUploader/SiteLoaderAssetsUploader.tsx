'use client';

import { useMemo, useState } from 'react';
import { IconTrash } from '@tabler/icons-react';
import { useMutation } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { Box, Group, Stack, Text } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconButton } from '@/components/core/IconButton';
import { ImageUploadField } from '@/components/core/ImageUpload';
import { addSiteLoaderAssetAction, removeSiteLoaderAssetAction } from '@/lib/actions/site-setting';
import { UPLOAD_CONFIGS } from '@/lib/constants/upload-config';
import { useUpload } from '@/lib/hooks/useUpload';
import { useUploadValidation } from '@/lib/hooks/useUploadValidation';
import type { SiteLoaderAsset } from '@/lib/types/site-setting/config';
import { UploadType } from '@/lib/types/upload/model';
import { formatFileSize, formatMimeTypes } from '@/lib/utils/upload';

interface SiteLoaderAssetsUploaderProps {
  assets: SiteLoaderAsset[];
  onSuccess?: () => void;
}

export function SiteLoaderAssetsUploader({ assets, onSuccess }: SiteLoaderAssetsUploaderProps) {
  const t = useTranslations('adminSettings.site');
  const tCommon = useTranslations('common');
  const tCommonNotifications = useTranslations('common.notifications');
  const uploadType = UploadType.SITE_LOADER;
  const config = UPLOAD_CONFIGS[uploadType];
  const { validateFile } = useUploadValidation();
  const { uploadFile, isUploading } = useUpload(uploadType);
  const [uploading, setUploading] = useState(false);

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
    mutationFn: (fileId: string) => addSiteLoaderAssetAction(fileId),
    onSuccess: (result) => {
      if (result.error) {
        notifications.show({ message: result.error, color: 'red' });
        return;
      }
      notifications.show({ message: t('assets.uploaded', { label }), color: 'green' });
      onSuccess?.();
    },
  });

  const removeLoader = useMutation({
    mutationFn: (fileId: string) => removeSiteLoaderAssetAction(fileId),
    onSuccess: (result) => {
      if (result.error) {
        notifications.show({ message: result.error, color: 'red' });
        return;
      }
      notifications.show({
        message: result.warning ?? t('assets.removed', { label }),
        color: result.warning ? 'orange' : 'yellow',
      });
      onSuccess?.();
    },
  });

  const handleFileSelect = async (file: File) => {
    const validation = validateFile(file, uploadType);
    if (!validation.valid) {
      notifications.show({ message: validation.error, color: 'red' });
      return;
    }

    setUploading(true);
    try {
      const { fileId } = await uploadFile(file, { slotId: 'loader' });
      await addLoader.mutateAsync(fileId);
    } catch (error) {
      notifications.show({
        message: error instanceof Error ? error.message : tCommonNotifications('uploadFailed'),
        color: 'red',
      });
    } finally {
      setUploading(false);
    }
  };

  return (
    <Box>
      <Text size="sm" fw={500} mb={4}>
        {label}
      </Text>
      <Text size="xs" c="dimmed" mb="xs">
        {description}
      </Text>

      <Stack gap="xs">
        {assets.length > 0 ? (
          <Group gap="xs" align="center">
            {assets.map((asset) => (
              <Box key={asset.file_id} pos="relative">
                <Box
                  style={{
                    width: 48,
                    height: 48,
                    border: '1px solid var(--mantine-color-default-border)',
                    borderRadius: 'var(--mantine-radius-sm)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    overflow: 'hidden',
                    background: 'var(--mantine-color-body)',
                  }}
                >
                  <img src={asset.url} alt={label} style={{ display: 'block', maxWidth: '100%', maxHeight: '100%' }} />
                </Box>
                <IconButton
                  size="xs"
                  shape="circle"
                  tone="danger"
                  emphasis="strong"
                  pos="absolute"
                  top={-4}
                  right={-4}
                  loading={removeLoader.isPending}
                  aria-label={tCommon('actions.remove')}
                  onClick={() => removeLoader.mutate(asset.file_id)}
                >
                  <IconTrash size={12} />
                </IconButton>
              </Box>
            ))}
          </Group>
        ) : null}

        <ImageUploadField
          alt={label}
          imageUrl={null}
          accept={[...config.permittedMimeTypes]}
          maxSize={config.maxSize}
          loading={uploading || isUploading || addLoader.isPending}
          loadingLabel={uploadPrompt}
          emptyTitle={label}
          emptyDescription={uploadPrompt}
          preview={{ mode: 'fixed', width: '100%', height: 96, fit: 'contain' }}
          placeholder={{ width: '100%', minHeight: 96, iconSize: 24 }}
          onFileSelect={handleFileSelect}
          onReject={() => notifications.show({ message: errorMessage, color: 'red' })}
        />
      </Stack>
    </Box>
  );
}
