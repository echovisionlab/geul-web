'use client';

import { CampaignTargetMode } from '@echovisionlab/geul-proto/secure/campaign_pb.ts';
import { useTranslations } from 'next-intl';
import { Stack } from '@mantine/core';
import { Alert } from '@/components/core/Alert';
import { Select } from '@/components/core/Input';

export interface ActiveCampaignAudience {
  id: string;
  name: string;
  segmentTypeLabel: string;
}

export interface CampaignTargetSelection {
  targetMode: CampaignTargetMode.ALL | CampaignTargetMode.SEGMENT;
  segmentId: string | null;
}

interface CampaignTargetControlProps extends CampaignTargetSelection {
  audiences: ActiveCampaignAudience[];
  disabled?: boolean;
  loadError?: boolean;
  onChange: (selection: CampaignTargetSelection) => void;
}

export function isCompleteCampaignTarget(selection: CampaignTargetSelection): boolean {
  return (
    (selection.targetMode === CampaignTargetMode.ALL && selection.segmentId === null) ||
    (selection.targetMode === CampaignTargetMode.SEGMENT && Boolean(selection.segmentId))
  );
}

export function isDeliverableCampaignTarget(
  selection: CampaignTargetSelection,
  audiences: ActiveCampaignAudience[],
): boolean {
  if (!isCompleteCampaignTarget(selection)) {
    return false;
  }
  return (
    selection.targetMode === CampaignTargetMode.ALL || audiences.some((audience) => audience.id === selection.segmentId)
  );
}

export function CampaignTargetControl({
  targetMode,
  segmentId,
  audiences,
  disabled = false,
  loadError = false,
  onChange,
}: CampaignTargetControlProps) {
  const t = useTranslations('campaignEditor.target');
  const allValue = 'all';
  const segmentValue = (id: string) => `segment:${id}`;
  const selectedAudienceIsActive = segmentId === null || audiences.some((audience) => audience.id === segmentId);
  const targetOptions: Array<{ value: string; label: string; disabled?: boolean }> = [
    { value: allValue, label: t('all') },
    ...audiences.map((audience) => ({
      value: segmentValue(audience.id),
      label: `${audience.name} (${audience.segmentTypeLabel})`,
    })),
  ];

  if (segmentId && !selectedAudienceIsActive) {
    targetOptions.push({
      value: segmentValue(segmentId),
      label: t('unavailableAudience'),
      disabled: true,
    });
  }
  const value = targetMode === CampaignTargetMode.ALL ? allValue : segmentId ? segmentValue(segmentId) : null;

  return (
    <Stack gap="xs">
      <Select
        label={t('audienceLabel')}
        placeholder={t('audiencePlaceholder')}
        value={value}
        data={targetOptions}
        allowDeselect={false}
        searchable
        disabled={disabled}
        onChange={(value) => {
          if (value === allValue) {
            onChange({ targetMode: CampaignTargetMode.ALL, segmentId: null });
          } else if (value?.startsWith('segment:')) {
            onChange({
              targetMode: CampaignTargetMode.SEGMENT,
              segmentId: value.slice('segment:'.length),
            });
          }
        }}
      />
      {loadError ? (
        <Alert tone="danger">{t('audienceLoadError')}</Alert>
      ) : targetMode === CampaignTargetMode.SEGMENT && (!segmentId || !selectedAudienceIsActive) ? (
        <Alert tone="warning">{t(segmentId ? 'unavailableAudienceDescription' : 'audienceRequired')}</Alert>
      ) : null}
    </Stack>
  );
}
