'use client';

import { LayoutStack as DsLayoutStack } from '@/components/core/Layout';
import { CampaignTargetMode } from '@echovisionlab/geul-proto/secure/campaign_pb.ts';
import { useTranslations } from 'next-intl';

import { Alert } from '@/components/core/Alert';
import { Select } from '@/components/core/Input';

export interface ActiveCampaignCriteria {
  id: string;
  name: string;
  kindLabel: string;
}

export interface CampaignTargetSelection {
  targetMode: CampaignTargetMode.ALL | CampaignTargetMode.MEMBER_CRITERIA;
  memberCriteriaId: string | null;
}

interface CampaignTargetControlProps extends CampaignTargetSelection {
  criteriaOptions: ActiveCampaignCriteria[];
  disabled?: boolean;
  loadError?: boolean;
  onChange: (selection: CampaignTargetSelection) => void;
}

export function isCompleteCampaignTarget(selection: CampaignTargetSelection): boolean {
  return (
    (selection.targetMode === CampaignTargetMode.ALL && selection.memberCriteriaId === null) ||
    (selection.targetMode === CampaignTargetMode.MEMBER_CRITERIA && Boolean(selection.memberCriteriaId))
  );
}

export function isDeliverableCampaignTarget(
  selection: CampaignTargetSelection,
  criteriaOptions: ActiveCampaignCriteria[],
): boolean {
  if (!isCompleteCampaignTarget(selection)) {
    return false;
  }
  return (
    selection.targetMode === CampaignTargetMode.ALL ||
    criteriaOptions.some((criteria) => criteria.id === selection.memberCriteriaId)
  );
}

export function CampaignTargetControl({
  targetMode,
  memberCriteriaId,
  criteriaOptions,
  disabled = false,
  loadError = false,
  onChange,
}: CampaignTargetControlProps) {
  const t = useTranslations('campaignEditor.target');
  const allValue = 'all';
  const criteriaValue = (id: string) => `criteria:${id}`;
  const selectedCriteriaIsActive =
    memberCriteriaId === null || criteriaOptions.some((criteria) => criteria.id === memberCriteriaId);
  const targetOptions: Array<{ value: string; label: string; disabled?: boolean }> = [
    { value: allValue, label: t('all') },
    ...criteriaOptions.map((criteria) => ({
      value: criteriaValue(criteria.id),
      label: `${criteria.name} (${criteria.kindLabel})`,
    })),
  ];

  if (memberCriteriaId && !selectedCriteriaIsActive) {
    targetOptions.push({
      value: criteriaValue(memberCriteriaId),
      label: t('unavailableCriteria'),
      disabled: true,
    });
  }
  const value =
    targetMode === CampaignTargetMode.ALL ? allValue : memberCriteriaId ? criteriaValue(memberCriteriaId) : null;

  return (
    <DsLayoutStack gap="xs">
      <Select
        label={t('criteriaLabel')}
        placeholder={t('criteriaPlaceholder')}
        value={value}
        data={targetOptions}
        allowDeselect={false}
        searchable
        disabled={disabled}
        onChange={(value) => {
          if (value === allValue) {
            onChange({ targetMode: CampaignTargetMode.ALL, memberCriteriaId: null });
          } else if (value?.startsWith('criteria:')) {
            onChange({
              targetMode: CampaignTargetMode.MEMBER_CRITERIA,
              memberCriteriaId: value.slice('criteria:'.length),
            });
          }
        }}
      />
      {loadError ? (
        <Alert tone="danger">{t('criteriaLoadError')}</Alert>
      ) : targetMode === CampaignTargetMode.MEMBER_CRITERIA && (!memberCriteriaId || !selectedCriteriaIsActive) ? (
        <Alert tone="warning">{t(memberCriteriaId ? 'unavailableCriteriaDescription' : 'criteriaRequired')}</Alert>
      ) : null}
    </DsLayoutStack>
  );
}
