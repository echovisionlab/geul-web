'use client';
import { SupportingText } from '@/components/core/Typography';
import {
  LayoutStack as DsLayoutStack,
  LayoutInset as DsLayoutInset,
  LayoutInline as DsLayoutInline,
} from '@/components/core/Layout';

import { unwrapQueryResult } from '@/lib/api/query-result';

import { useEffect, useState } from 'react';
import { MemberCriteriaKind } from '@echovisionlab/geul-proto/secure/member_criteria_pb.ts';
import { IconUsers } from '@tabler/icons-react';
import { useTranslations } from 'next-intl';

import { DateInput, MultiSelect } from '@/components/core/Input';
import { LabelBadge } from '@/components/core/Badge';
import { Button } from '@/components/core/Button';

import { listAllUserTagsAction } from '@/lib/actions/user-tag';
import { SEGMENT_ROLE_OPTIONS, type CriteriaConfigState } from './MemberCriteriaConfig';
import { coerceDateValue } from './criteria-date';

interface MemberCriteriaConfigFieldsProps {
  kind: MemberCriteriaKind | null;
  config: CriteriaConfigState;
  onConfigChange: (config: CriteriaConfigState) => void;
  estimatedCount: number | null;
  onEstimate: () => void;
  estimateLoading: boolean;
}

export function MemberCriteriaConfigFields({
  kind,
  config,
  onConfigChange,
  estimatedCount,
  onEstimate,
  estimateLoading,
}: MemberCriteriaConfigFieldsProps) {
  const tCommon = useTranslations('common');
  const tCommonEntities = useTranslations('common.entities');
  const tPage = useTranslations('adminList.memberCriteria');
  const [userTags, setUserTags] = useState<{ value: string; label: string }[]>([]);
  const [tagsLoading, setTagsLoading] = useState(false);
  const [tagsError, setTagsError] = useState(false);

  const roleOptions = [
    { value: SEGMENT_ROLE_OPTIONS[0].value, label: tCommon('roles.admin') },
    { value: SEGMENT_ROLE_OPTIONS[1].value, label: tCommon('roles.author') },
    { value: SEGMENT_ROLE_OPTIONS[2].value, label: tCommon('roles.user') },
  ];

  useEffect(() => {
    let current = true;
    if (kind === MemberCriteriaKind.MEMBER_TAGS) {
      setTagsLoading(true);
      setTagsError(false);
      void listAllUserTagsAction()
        .then(unwrapQueryResult)
        .then((tags) => {
          if (current) {
            setUserTags(tags.map((tag) => ({ value: tag.id, label: tag.name })));
          }
        })
        .catch(() => {
          if (current) {
            setTagsError(true);
          }
        })
        .finally(() => {
          if (current) {
            setTagsLoading(false);
          }
        });
    }
    return () => {
      current = false;
    };
  }, [kind]);

  if (!kind) {
    return null;
  }

  return (
    <DsLayoutInset blockStart="sm">
      <DsLayoutStack gap="sm">
        {kind === MemberCriteriaKind.ALL_MEMBERS && (
          <SupportingText tone="secondary">{tPage('config.allUsersHelp')}</SupportingText>
        )}

        {kind === MemberCriteriaKind.MEMBER_TAGS && (
          <MultiSelect
            label={tCommonEntities('userTags')}
            placeholder={tPage('config.userTagsPlaceholderSelect')}
            data={userTags}
            value={config.memberTagIds}
            onChange={(value) => onConfigChange({ ...config, memberTagIds: value })}
            disabled={tagsLoading || tagsError}
            isLoading={tagsLoading}
            error={tagsError ? tCommon('states.notAvailable') : undefined}
            searchable
            clearable
          />
        )}

        {kind === MemberCriteriaKind.FILTER && (
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
            <DsLayoutInline grow>
              <DateInput
                label={tPage('config.createdAfterLabel')}
                placeholder={tPage('config.createdAfterPlaceholder')}
                value={config.createdAfter ? new Date(config.createdAfter) : null}
                onChange={(date) => onConfigChange({ ...config, createdAfter: coerceDateValue(date) })}
                clearable
              />
              <DateInput
                label={tPage('config.createdBeforeLabel')}
                placeholder={tPage('config.createdBeforePlaceholder')}
                value={config.createdBefore ? new Date(config.createdBefore) : null}
                onChange={(date) => onConfigChange({ ...config, createdBefore: coerceDateValue(date) })}
                clearable
              />
            </DsLayoutInline>
          </>
        )}

        <DsLayoutInline>
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
        </DsLayoutInline>
      </DsLayoutStack>
    </DsLayoutInset>
  );
}
