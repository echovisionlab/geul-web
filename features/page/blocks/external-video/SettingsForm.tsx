'use client';

import { useTranslations } from 'next-intl';
import { Stack } from '@mantine/core';
import { Select, TextInput } from '@/components/core/Input';
import { resolveExternalVideo } from '@/lib/media/external-video';
import { parseExternalVideoProps, type ExternalVideoProps } from './schema';

interface ExternalVideoSettingsFormProps {
  props: Partial<ExternalVideoProps>;
  updateSharedProps: (props: Record<string, unknown>) => void;
  updateLocalizedProps: (props: Record<string, unknown>) => void;
}

export function ExternalVideoSettingsForm({
  props,
  updateSharedProps,
  updateLocalizedProps,
}: ExternalVideoSettingsFormProps) {
  const t = useTranslations('pageEditor.externalVideo');
  const parsed = parseExternalVideoProps(props);
  const invalidUrl = parsed.url.trim().length > 0 && !resolveExternalVideo(parsed.url);
  const aspectRatioOptions = ['auto', '16:9', '4:3', '1:1', '9:16'].map((value) => ({
    value,
    label: value === 'auto' ? t('aspectRatioAuto') : value,
  }));

  return (
    <Stack gap="sm" data-page-block-editor="external-video">
      <TextInput
        label={t('urlLabel')}
        description={t('urlDescription')}
        placeholder={t('urlPlaceholder')}
        value={parsed.url}
        error={invalidUrl ? t('invalidUrl') : undefined}
        onChange={(event) => updateSharedProps({ url: event.currentTarget.value })}
      />
      <Select
        label={t('aspectRatioLabel')}
        data={aspectRatioOptions}
        value={parsed.aspectRatio}
        onChange={(value) => updateSharedProps({ aspectRatio: value || 'auto' })}
      />
      <TextInput
        label={t('captionLabel')}
        description={t('captionDescription')}
        placeholder={t('captionPlaceholder')}
        value={parsed.caption}
        onChange={(event) => updateLocalizedProps({ caption: event.currentTarget.value })}
      />
    </Stack>
  );
}
