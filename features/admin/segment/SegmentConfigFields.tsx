'use client';

import { useEffect, useState } from 'react';
import { SegmentType } from '@echovisionlab/geul-proto/secure/audience_pb.ts';
import { IconUsers } from '@tabler/icons-react';
import { useTranslations } from 'next-intl';
import { z } from 'zod';
import { Group, Stack, Text } from '@mantine/core';
import { DateInput } from '@mantine/dates';
import { LabelBadge } from '@/components/core/Badge';
import { Button } from '@/components/core/Button';
import { MultiSelect } from '@/components/core/Input';
import { listAllUserTagsAction } from '@/lib/actions/user-tag';
import { SEGMENT_ROLE_OPTIONS, type SegmentConfigState } from './SegmentConfig';

const dateToISO = z.coerce.date().transform((d) => d.toISOString());

function coerceDateValue(value: unknown): string {
  if (!value) {
    return '';
  }
  const result = dateToISO.safeParse(value);
  return result.success ? result.data : '';
}

interface SegmentConfigFieldsProps {
  segmentType: SegmentType | null;
  config: SegmentConfigState;
  onConfigChange: (config: SegmentConfigState) => void;
  estimatedCount: number | null;
  onEstimate: () => void;
  estimateLoading: boolean;
}

export function SegmentConfigFields({
  segmentType,
  config,
  onConfigChange,
  estimatedCount,
  onEstimate,
  estimateLoading,
}: SegmentConfigFieldsProps) {
  const tCommon = useTranslations('common');
  const tCommonEntities = useTranslations('common.entities');
  const tPage = useTranslations('adminList.audienceSegments');
  const [userTags, setUserTags] = useState<{ value: string; label: string }[]>([]);
  const [tagsLoading, setTagsLoading] = useState(false);

  const roleOptions = [
    { value: SEGMENT_ROLE_OPTIONS[0].value, label: tCommon('roles.admin') },
    { value: SEGMENT_ROLE_OPTIONS[1].value, label: tCommon('roles.author') },
    { value: SEGMENT_ROLE_OPTIONS[2].value, label: tCommon('roles.user') },
  ];

  useEffect(() => {
    if (segmentType === SegmentType.MEMBER_TAGS && userTags.length === 0) {
      setTagsLoading(true);
      listAllUserTagsAction()
        .then((tags) => setUserTags(tags.map((t) => ({ value: t.id, label: t.name }))))
        .finally(() => setTagsLoading(false));
    }
  }, [segmentType, userTags.length]);

  if (!segmentType) {
    return null;
  }

  return (
    <Stack gap="sm" mt="sm">
      {segmentType === SegmentType.ALL_MEMBERS && (
        <Text size="sm" c="dimmed">
          {tPage('config.allUsersHelp')}
        </Text>
      )}

      {segmentType === SegmentType.MEMBER_TAGS && (
        <MultiSelect
          label={tCommonEntities('userTags')}
          placeholder={tagsLoading ? tCommon('states.loadingTags') : tPage('config.userTagsPlaceholderSelect')}
          data={userTags}
          value={config.memberTagIds}
          onChange={(value) => onConfigChange({ ...config, memberTagIds: value })}
          disabled={tagsLoading}
          searchable
          clearable
        />
      )}

      {segmentType === SegmentType.MEMBERS_BY_FILTER && (
        <>
          <MultiSelect
            label={tPage('config.rolesLabel')}
            placeholder={tCommon('placeholders.selectRoles')}
            data={roleOptions}
            value={config.accountRoles}
            onChange={(value) => onConfigChange({ ...config, accountRoles: value })}
            searchable
            clearable
          />
          <Group grow>
            <DateInput
              label={tPage('config.createdAfterLabel')}
              placeholder={tPage('config.createdAfterPlaceholder')}
              value={config.createdAfter ? new Date(config.createdAfter) : null}
              valueFormat="YYYY-MM-DD"
              onChange={(date) => onConfigChange({ ...config, createdAfter: coerceDateValue(date) })}
              clearable
            />
            <DateInput
              label={tPage('config.createdBeforeLabel')}
              placeholder={tPage('config.createdBeforePlaceholder')}
              value={config.createdBefore ? new Date(config.createdBefore) : null}
              valueFormat="YYYY-MM-DD"
              onChange={(date) => onConfigChange({ ...config, createdBefore: coerceDateValue(date) })}
              clearable
            />
          </Group>
        </>
      )}

      <Group>
        <Button
          emphasis="medium"
          size="xs"
          leftSection={<IconUsers size={14} />}
          onClick={onEstimate}
          loading={estimateLoading}
        >
          {tPage('config.estimateCount')}
        </Button>
        {estimatedCount !== null && (
          <LabelBadge size="lg">
            {tPage('config.estimatedRecipients', {
              count: estimatedCount.toLocaleString(),
            })}
          </LabelBadge>
        )}
      </Group>
    </Stack>
  );
}
